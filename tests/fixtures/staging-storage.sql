-- Staging storage object policies, schema-only; no objects or bucket data.
-- Requires the Supabase platform storage schema (stand-ins in embedded tests).
GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;
CREATE POLICY "market_gallery_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'market-gallery'::text) AND (( SELECT is_admin() AS is_admin) OR (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM market_listings l
  WHERE (((l.id)::text = (storage.foldername(objects.name))[2]) AND (l.seller_id = ( SELECT auth.uid() AS uid)) AND (l.status = 'pending'::text))))))));
CREATE POLICY "market_gallery_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'market-gallery'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (name ~ '^[0-9a-f-]{36}/[0-9]+/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'::text) AND (EXISTS ( SELECT 1
   FROM market_listings l
  WHERE (((l.id)::text = (storage.foldername(objects.name))[2]) AND (l.seller_id = ( SELECT auth.uid() AS uid)) AND (l.status = 'pending'::text))))));
CREATE POLICY "market_gallery_read" ON storage.objects AS PERMISSIVE FOR SELECT TO "anon","authenticated" USING (((bucket_id = 'market-gallery'::text) AND (( SELECT is_admin() AS is_admin) OR ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR (EXISTS ( SELECT 1
   FROM (market_listing_media m
     JOIN market_listings l ON ((l.id = m.listing_id)))
  WHERE ((m.object_path = objects.name) AND (l.status = 'approved'::text)))))));
