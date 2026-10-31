-- TRISOCMD Marketplace V18: owner/admin soft removal, purchase-request workflow.
-- No payment collection or money holding is enabled by these SQL objects.
-- Preserve listings, media, conversations and existing orders.

create table if not exists public.market_listing_activity (
  id bigint generated always as identity primary key,
  listing_id bigint not null references public.market_listings(id),
  actor_id uuid not null references auth.users(id),
  previous_status text not null,
  action text not null check (action in ('removed_by_seller','removed_by_admin')),
  created_at timestamptz not null default now()
);
alter table public.market_listing_activity enable row level security;
drop policy if exists market_listing_activity_read on public.market_listing_activity;
create policy market_listing_activity_read on public.market_listing_activity
for select to authenticated using (
  (select public.is_admin()) or actor_id=(select auth.uid())
  or exists(select 1 from public.market_listings l
    where l.id=listing_id and l.seller_id=(select auth.uid()))
);
revoke all on public.market_listing_activity from public,anon;
grant select on public.market_listing_activity to authenticated;

create table if not exists public.market_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id bigint not null references public.market_listings(id),
  buyer_id uuid not null references auth.users(id),
  seller_id uuid not null references auth.users(id),
  listing_title text not null,
  price_usd numeric(12,2) not null check(price_usd>=1 and price_usd<=1000000),
  payment_method text not null check (payment_method in ('LTC','BTC','BANK','CONTACT_SUPPORT')),
  status text not null default 'requested'
    check (status in ('requested','cancelled','awaiting_payment_setup','payment_reported','payment_verified','delivery_reported','completed','disputed','seller_payout_recorded')),
  buyer_note text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);
alter table public.market_purchase_requests enable row level security;
create index if not exists market_purchases_listing_idx on public.market_purchase_requests(listing_id,status);
create index if not exists market_purchases_buyer_idx on public.market_purchase_requests(buyer_id,created_at desc);
create index if not exists market_purchases_seller_idx on public.market_purchase_requests(seller_id,created_at desc);
-- Only authenticated participants can see their purchase requests; moderator
-- access is verified via trusted JWT app_metadata.role on the server.
drop policy if exists market_purchase_requests_read on public.market_purchase_requests;
create policy market_purchase_requests_read on public.market_purchase_requests
for select to authenticated
using ((select public.is_admin()) or buyer_id=(select auth.uid()) or seller_id=(select auth.uid()));
revoke all on public.market_purchase_requests from public,anon;
grant select on public.market_purchase_requests to authenticated;

-- The buyer creates a purchase REQUEST with server-quoted listing price.
-- It never creates a paid order, holds funds, or provides wallet addresses.
create or replace function public.market_request_purchase(
  p_listing bigint,
  p_method text default 'CONTACT_SUPPORT',
  p_note text default null
) returns uuid
language plpgsql security definer set search_path=''
as $fn$
declare
 v_buyer uuid:=auth.uid();
 v_seller uuid;
 v_title text;
 v_price numeric;
 v_id uuid;
 v_method text:=upper(trim(coalesce(p_method,'')));
begin
 if v_buyer is null then raise exception 'Sign in required' using errcode='28000';end if;
 if v_method not in ('LTC','BTC','BANK','CONTACT_SUPPORT') then
   raise exception 'Invalid payment preference' using errcode='22023';
 end if;
 if char_length(coalesce(p_note,''))>500 then
   raise exception 'Note too long' using errcode='22023';
 end if;
 select seller_id,title,price into v_seller,v_title,v_price
 from public.market_listings where id=p_listing and status='approved';
 if v_seller is null then raise exception 'Listing is not currently available' using errcode='23514';end if;
 if v_seller=v_buyer then raise exception 'Cannot purchase your own listing' using errcode='23514';end if;
 -- Avoid duplicate outstanding requests for the same buyer and listing.
 select id into v_id from public.market_purchase_requests
 where listing_id=p_listing and buyer_id=v_buyer and status not in ('cancelled','completed','seller_payout_recorded')
 order by created_at desc limit 1;
 if v_id is not null then return v_id;end if;
 insert into public.market_purchase_requests
 (listing_id,buyer_id,seller_id,listing_title,price_usd,payment_method,buyer_note,status)
 values(p_listing,v_buyer,v_seller,v_title,v_price,v_method,nullif(trim(p_note),''),'requested')
 returning id into v_id;
 return v_id;
end
$fn$;

-- Soft remove: hide from public immediately; leave historic conversations and
-- pending payment requests untouched for moderation/disputes.
create or replace function public.market_remove_listing(p_listing bigint)
returns void language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid:=auth.uid();v_seller uuid;v_status text;v_admin boolean;
begin
 if v_actor is null then raise exception 'Sign in required' using errcode='28000';end if;
 v_admin:=public.is_admin();
 select seller_id,status into v_seller,v_status
 from public.market_listings where id=p_listing for update;
 if v_seller is null then raise exception 'Listing not found' using errcode='P0002';end if;
 if v_seller<>v_actor and not v_admin then raise exception 'Not authorized' using errcode='42501';end if;
 if v_status='removed' then return;end if;
 if exists(select 1 from public.market_purchase_requests p
   where p.listing_id=p_listing and p.status in
   ('payment_reported','payment_verified','delivery_reported','disputed')) then
   raise exception 'Listing has an active payment/delivery review. Contact an administrator before removal'
     using errcode='23514';
 end if;
 update public.market_listings set status='removed' where id=p_listing;
 insert into public.market_listing_activity(listing_id,actor_id,previous_status,action)
 values(p_listing,v_actor,v_status,case when v_admin and v_actor<>v_seller
   then 'removed_by_admin' else 'removed_by_seller' end);
end
$fn$;

-- Admin can change tracked REQUEST status, but this records a decision only.
-- No funds are received, escrowed, verified by a processor or paid out by SQL.
create or replace function public.market_admin_update_purchase(
 p_request uuid,p_status text,p_note text default null
) returns void language plpgsql security definer set search_path=''
as $fn$
declare v_old text;
begin
 if not public.is_admin() then raise exception 'Admin only' using errcode='42501';end if;
 if p_status not in ('cancelled','awaiting_payment_setup','disputed') then
  raise exception 'This preview does not activate payment processing or payouts' using errcode='22023';
 end if;
 if char_length(coalesce(p_note,''))>500 then raise exception 'Note too long' using errcode='22023';end if;
 select status into v_old from public.market_purchase_requests where id=p_request for update;
 if v_old is null then raise exception 'Request not found' using errcode='P0002';end if;
 if v_old not in ('requested','awaiting_payment_setup','disputed') then
   raise exception 'This request cannot be changed in preview' using errcode='23514';
 end if;
 update public.market_purchase_requests
 set status=p_status,admin_note=nullif(trim(p_note),''),
     updated_at=now() where id=p_request;
end
$fn$;

revoke all on function public.market_request_purchase(bigint,text,text) from public,anon;
revoke all on function public.market_remove_listing(bigint) from public,anon;
revoke all on function public.market_admin_update_purchase(uuid,text,text) from public,anon;
grant execute on function public.market_request_purchase(bigint,text,text) to authenticated,service_role;
grant execute on function public.market_remove_listing(bigint) to authenticated,service_role;
grant execute on function public.market_admin_update_purchase(uuid,text,text) to authenticated,service_role;
