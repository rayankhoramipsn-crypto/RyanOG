-- Additive staging-only commerce metadata; existing orders/payments are untouched.
create table public.product_merchandising (
 product_id bigint primary key references public.products(id) on delete cascade,
 featured boolean not null default false,
 compare_at_price numeric(12,2) check(compare_at_price>0),
 updated_at timestamptz not null default now()
);
alter table public.product_merchandising enable row level security;
grant select on public.product_merchandising to anon,authenticated;
grant insert,update,delete on public.product_merchandising to authenticated;
create policy merchandising_public_read on public.product_merchandising for select to anon,authenticated
 using(exists(select 1 from public.products p where p.id=product_id and p.status='available'));
create policy merchandising_admin on public.product_merchandising for all to authenticated
 using((select public.is_admin())) with check((select public.is_admin()));

create table public.product_sales_snapshots (
 product_id bigint primary key references public.products(id) on delete cascade,
 units_sold bigint not null check(units_sold>=0),
 updated_at timestamptz not null default now()
);
alter table public.product_sales_snapshots enable row level security;
grant select on public.product_sales_snapshots to anon,authenticated;
grant insert,update,delete on public.product_sales_snapshots to authenticated;
create policy sales_snapshot_public_read on public.product_sales_snapshots for select to anon,authenticated
 using(exists(select 1 from public.products p where p.id=product_id and p.status='available'));
create policy sales_snapshot_admin on public.product_sales_snapshots for all to authenticated
 using((select public.is_admin())) with check((select public.is_admin()));
-- Explicit administrator refresh; no customer identifiers or order rows are published.
-- SECURITY INVOKER preserves existing order RLS and requires an authenticated admin.
create function public.refresh_product_sales_snapshots() returns integer
 language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 insert into public.product_sales_snapshots(product_id,units_sold)
 select p.id,coalesce(s.units_sold,0)
 from public.products p left join (
  select line->>'id' as product_id,sum((line->>'qty')::bigint) as units_sold
  from public.tc42_orders o
  cross join lateral jsonb_array_elements(case when jsonb_typeof(o.items)='array' then o.items else '[]'::jsonb end) line
  where o.status in ('paid','fulfilled') and (line->>'qty') ~ '^[1-9][0-9]{0,5}$'
  group by line->>'id'
 ) s on s.product_id=p.id::text
 on conflict(product_id) do update set units_sold=excluded.units_sold,updated_at=now();
 get diagnostics affected=row_count;
 return affected;
end;$$;
revoke all on function public.refresh_product_sales_snapshots() from public,anon;
grant execute on function public.refresh_product_sales_snapshots() to authenticated;

-- Public information is opt-in and separate from private seller/account records.
create table public.market_seller_public_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(char_length(trim(display_name)) between 3 and 60),
 bio text not null default '' check(char_length(bio)<=500),
 avatar_url text check(avatar_url is null or avatar_url ~ '^https://[^[:space:]]+$'),
 is_public boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.market_seller_public_profiles enable row level security;
grant select on public.market_seller_public_profiles to anon,authenticated;
grant insert,update,delete on public.market_seller_public_profiles to authenticated;
create policy public_seller_read on public.market_seller_public_profiles for select to anon,authenticated
 using(user_id=(select auth.uid()) or (select public.is_admin()) or (is_public and exists(select 1 from public.market_listings l where l.seller_id=user_id and l.status='approved')));
create policy public_seller_insert on public.market_seller_public_profiles for insert to authenticated
 with check(user_id=(select auth.uid()));
create policy public_seller_update on public.market_seller_public_profiles for update to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy public_seller_delete on public.market_seller_public_profiles for delete to authenticated
 using(user_id=(select auth.uid()) or (select public.is_admin()));
