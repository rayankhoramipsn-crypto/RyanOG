-- Additive staging gallery. Requires the existing moderated marketplace foundation.
-- Never run against production without the separate release review.
create table public.market_listing_media (
 id uuid primary key default gen_random_uuid(),
 listing_id bigint not null references public.market_listings(id) on delete cascade,
 seller_id uuid not null references auth.users(id) on delete cascade,
 object_path text not null unique,
 alt_text text not null default '' check (char_length(alt_text)<=180),
 sort_order integer not null check (sort_order between 0 and 5),
 created_at timestamptz not null default now(),
 constraint market_media_path check (object_path ~ ('^' || seller_id::text || '/' || listing_id::text || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')),
 unique(listing_id,sort_order)
);
create index market_listing_media_seller_idx on public.market_listing_media(seller_id);
alter table public.market_listing_media enable row level security;
grant select on public.market_listing_media to anon,authenticated;
grant insert,delete on public.market_listing_media to authenticated;
create policy market_media_read on public.market_listing_media for select to anon,authenticated
 using (exists(select 1 from public.market_listings l where l.id=listing_id and (l.status='approved' or l.seller_id=(select auth.uid()) or (select public.is_admin()))));
create policy market_media_insert on public.market_listing_media for insert to authenticated
 with check (seller_id=(select auth.uid()) and exists(select 1 from public.market_listings l where l.id=listing_id and l.seller_id=(select auth.uid()) and l.status='pending'));
create policy market_media_delete on public.market_listing_media for delete to authenticated
 using ((select public.is_admin()) or (seller_id=(select auth.uid()) and exists(select 1 from public.market_listings l where l.id=listing_id and l.status='pending' and l.seller_id=(select auth.uid()))));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('market-gallery','market-gallery',false,5242880,array['image/jpeg','image/png','image/webp']);
-- Public signed reads only when the linked listing is approved. Pending uploads stay private.
create policy market_gallery_read on storage.objects for select to anon,authenticated
 using (bucket_id='market-gallery' and (
  (select public.is_admin()) or
  ((storage.foldername(name))[1]=(select auth.uid())::text) or
  exists(select 1 from public.market_listing_media m join public.market_listings l on l.id=m.listing_id where m.object_path=name and l.status='approved')
 ));
create policy market_gallery_insert on storage.objects for insert to authenticated
 with check (bucket_id='market-gallery' and (storage.foldername(name))[1]=(select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9]+/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
  and exists(select 1 from public.market_listings l where l.id::text=(storage.foldername(name))[2] and l.seller_id=(select auth.uid()) and l.status='pending'));
create policy market_gallery_delete on storage.objects for delete to authenticated
 using (bucket_id='market-gallery' and ((select public.is_admin()) or
 ((storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.market_listings l where l.id::text=(storage.foldername(name))[2] and l.seller_id=(select auth.uid()) and l.status='pending'))));
comment on table public.market_listing_media is 'At most six moderated images per listing. Uploads use private Storage and short-lived signed URLs.';
