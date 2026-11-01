# V29 / Supabase privileges and Auth security audit

The V29 migration revokes direct edits to seller entitlement fields `is_pro` and `pro_until` from the browser `authenticated` role. Only `display_name` may be updated by that role, and the existing RLS policy still requires the authenticated owner. New profiles may set only `user_id` and `display_name`; `is_pro=false` and `pro_until=NULL` are database defaults.

The trusted `market_set_pro` RPC still checks `public.is_admin()`, which reads signed-in *app_metadata* (not user metadata). Browser users cannot self-promote through the profile table. The security-definer RPC remains part of a documented privileged surface to inspect regularly.

Further revoke unused direct write privileges from anonymous listing/media access and anonymous/authenticated conversation/message tables. Preserve public SELECT of approved listing/media, participant/admin-scoped SELECT of conversations and messages, and seller uploads via INSERT/DELETE with existing RLS.

**Outstanding operational configuration:** Supabase Auth's leaked password protection was reported disabled by the security advisor; activation requires checking the project's Auth settings and plan, and is NOT changed by this migration. The public `market_browse()` RPC intentionally exposes only approved listing fields, and presently uses SECURITY DEFINER for a restricted projection including seller Pro status. It has not been changed to SECURITY INVOKER without separately validating the seller_profiles access dependency.

Do not expose credentials, modify user identities or approve orders. Verify effective role grants after applying.
