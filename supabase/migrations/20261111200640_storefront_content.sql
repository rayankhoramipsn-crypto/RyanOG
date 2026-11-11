-- Additive content integration; preserves existing rows/assets and never enables delivery.
BEGIN;
ALTER TABLE public.products ADD COLUMN description_fa text;
-- Replace legacy JWT-only content policies with current persisted administrator checks.
DROP POLICY blog_admin_read ON public.blog_posts;
DROP POLICY blog_admin_insert ON public.blog_posts;
DROP POLICY blog_admin_update ON public.blog_posts;
DROP POLICY blog_admin_delete ON public.blog_posts;
CREATE POLICY blog_admin_read ON public.blog_posts FOR SELECT TO authenticated USING((SELECT public.is_admin()));
CREATE POLICY blog_admin_insert ON public.blog_posts FOR INSERT TO authenticated WITH CHECK((SELECT public.is_admin()) AND author_id=(SELECT auth.uid()));
CREATE POLICY blog_admin_update ON public.blog_posts FOR UPDATE TO authenticated USING((SELECT public.is_admin())) WITH CHECK((SELECT public.is_admin()));
CREATE POLICY blog_admin_delete ON public.blog_posts FOR DELETE TO authenticated USING((SELECT public.is_admin()));
DROP POLICY product_media_admin_read ON public.product_media;
DROP POLICY product_media_admin_insert ON public.product_media;
DROP POLICY product_media_admin_update ON public.product_media;
DROP POLICY product_media_admin_delete ON public.product_media;
CREATE POLICY product_media_admin_read ON public.product_media FOR SELECT TO authenticated USING((SELECT public.is_admin()));
CREATE POLICY product_media_admin_insert ON public.product_media FOR INSERT TO authenticated WITH CHECK((SELECT public.is_admin()));
CREATE POLICY product_media_admin_update ON public.product_media FOR UPDATE TO authenticated USING((SELECT public.is_admin())) WITH CHECK((SELECT public.is_admin()));
CREATE POLICY product_media_admin_delete ON public.product_media FOR DELETE TO authenticated USING((SELECT public.is_admin()));
CREATE FUNCTION public.content_validate() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE url text;
BEGIN
 IF TG_TABLE_NAME='product_media' THEN
  url:=NEW.media_url;
  IF NEW.media_type='youtube' AND url !~ '^https://((www[.]|m[.])?youtube[.]com/watch[?]([^#[:space:]]*&)?v=[A-Za-z0-9_-]{11}([&#][^[:space:]]*)?|(www[.]|m[.])?youtube[.]com/(shorts|embed)/[A-Za-z0-9_-]{11}([/?#][^[:space:]]*)?|(www[.])?youtu[.]be/[A-Za-z0-9_-]{11}([/?#][^[:space:]]*)?|www[.]youtube-nocookie[.]com/embed/[A-Za-z0-9_-]{11}([/?#][^[:space:]]*)?)$' THEN RAISE EXCEPTION 'Approved YouTube URL required';END IF;
  IF NEW.sort_order NOT BETWEEN 0 AND 10000 OR length(coalesce(NEW.label,''))>180 THEN RAISE EXCEPTION 'Invalid media details';END IF;
 ELSIF TG_TABLE_NAME='blog_posts' THEN
  url:=NEW.cover_image_url;
  IF char_length(trim(NEW.title)) NOT BETWEEN 1 AND 180 OR char_length(trim(NEW.body)) NOT BETWEEN 1 AND 100000 OR NEW.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(NEW.slug)>110 THEN RAISE EXCEPTION 'Invalid article content';END IF;
  IF NEW.status='published' AND NEW.published_at IS NULL THEN NEW.published_at:=now();END IF;
  NEW.updated_at:=clock_timestamp();
 ELSE
  url:=NEW.image_url;
  IF NEW.price::text IN ('NaN','Infinity','-Infinity') OR NEW.price<0 OR NEW.stock<0 OR char_length(trim(NEW.title)) NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'Invalid product';END IF;
  IF NEW.slug IS NOT NULL AND (NEW.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(NEW.slug)>110) THEN RAISE EXCEPTION 'Invalid product slug';END IF;
  NEW.updated_at:=clock_timestamp();
 END IF;
 IF url IS NOT NULL AND (length(url)>2048 OR url !~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?(/[^[:space:]<>]*)?$') THEN RAISE EXCEPTION 'Safe HTTPS media URL required';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.content_validate() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER content_validate BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.content_validate();
CREATE TRIGGER content_validate BEFORE INSERT OR UPDATE ON public.product_media FOR EACH ROW EXECUTE FUNCTION public.content_validate();
CREATE TRIGGER content_validate BEFORE INSERT OR UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.content_validate();
-- Public marketing images only, never customer attachments or confidential draft documents.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('content-media','content-media',true,5242880,ARRAY['image/png','image/jpeg','image/webp']) ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='content-media' AND (NOT public OR file_size_limit IS DISTINCT FROM 5242880 OR allowed_mime_types IS DISTINCT FROM ARRAY['image/png','image/jpeg','image/webp'])) THEN RAISE EXCEPTION 'Existing content-media configuration requires review';END IF;END $$;
CREATE POLICY content_image_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='content-media');
CREATE POLICY content_image_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='content-media' AND (SELECT public.is_admin()) AND (storage.foldername(name))[1]=(SELECT auth.uid())::text AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](png|jpg|webp)$');
CREATE POLICY content_image_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='content-media' AND (SELECT public.is_admin()));
-- Public sequence consumers have no reason to reserve/change content IDs.
REVOKE ALL ON SEQUENCE public.product_media_id_seq,public.product_specs_id_seq FROM anon;
COMMIT;
