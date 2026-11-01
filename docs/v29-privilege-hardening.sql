-- TRISOCMD V29: prevent self-awarded Pro privileges, defense in depth.
-- Preserve RLS, authenticated user profile edits, privileged administrator RPCs.
REVOKE ALL PRIVILEGES ON TABLE public.seller_profiles FROM anon, authenticated;
GRANT SELECT ON TABLE public.seller_profiles TO authenticated;
GRANT INSERT (user_id,display_name) ON TABLE public.seller_profiles TO authenticated;
GRANT UPDATE (display_name) ON TABLE public.seller_profiles TO authenticated;
-- Public visitors only read approved marketplace listing and approved media.
REVOKE ALL PRIVILEGES ON TABLE public.market_listings FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.market_listing_media FROM anon;
GRANT SELECT ON TABLE public.market_listings TO anon;
GRANT SELECT ON TABLE public.market_listing_media TO anon;
-- Chat rows can only be viewed through participant/admin RLS; all writes go via RPC.
REVOKE ALL PRIVILEGES ON TABLE public.market_conversations FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.market_messages FROM anon, authenticated;
GRANT SELECT ON TABLE public.market_conversations TO authenticated;
GRANT SELECT ON TABLE public.market_messages TO authenticated;
-- Gallery remains a seller-owned, pending-only upload via RLS. No direct UPDATE/TRUNCATE.
REVOKE UPDATE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.market_listing_media FROM authenticated;
-- Preserve SELECT/INSERT/DELETE for pending seller photos.
