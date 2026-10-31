-- Marketplace v15: require a real stored photo for NEW approval events and enable live chat push.
-- Existing approved listings are intentionally grandfathered; no data is rewritten.
create or replace function public.market_require_uploaded_photo()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
 if new.status = 'approved'
   and old.status is distinct from 'approved'
   and not exists(
     select 1
     from public.market_listing_media m
     join storage.objects obj on obj.bucket_id = 'market-gallery'
                             and obj.name = m.object_path
     where m.listing_id = new.id
       and m.seller_id = new.seller_id
   )
 then
   raise exception 'At least one uploaded gallery photo is required before approval'
     using errcode = '23514';
 end if;
 return new;
end
$fn$;
drop trigger if exists market_listing_approval_photo_gate on public.market_listings;
create trigger market_listing_approval_photo_gate
before update of status on public.market_listings
for each row
execute function public.market_require_uploaded_photo();

do $block$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(
      select 1 from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public'
        and tablename='market_messages'
    ) then
  alter publication supabase_realtime add table public.market_messages;
 end if;
end
$block$;
