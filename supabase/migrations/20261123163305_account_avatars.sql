-- PREPARED ONLY: owner approval is required before applying on hosted staging.
-- Private, owner-scoped immutable avatar objects; no changes to existing buckets/data.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('account-avatars','account-avatars',false,2097152,ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='account-avatars' AND
   (public OR file_size_limit IS DISTINCT FROM 2097152 OR allowed_mime_types IS DISTINCT FROM ARRAY['image/png','image/jpeg','image/webp']))
 THEN RAISE EXCEPTION 'Existing account-avatars bucket requires review'; END IF;
END $$;
CREATE POLICY account_avatar_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='account-avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY account_avatar_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='account-avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
 AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](png|jpg|webp)$');
CREATE POLICY account_avatar_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='account-avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
-- No UPDATE policy: each upload uses a new UUID, never an upsert or shared path.
