# TRISOCMD bug audit

Updated 2026-11-10 (Asia/Tehran). Local fixtures/mocked browsers are not live validation.

| ID | Finding | Action / evidence |
|---|---|---|
| A01 | Admin cleared login on any refresh error | Shared coordinator retains session on transient errors; session tests pass. |
| A02 | Overlapping token rotation | Shared promise and HTTPS Web Locks serialize refresh. Cross-tab browser stress test pending; without Web Locks only same-page serialization. |
| A03 | Session-only recovery promoted to persistent storage on read | Removed promotion; read/refresh persistence tests pass. |
| A04 | Admin queue limited to newest 150 rows | Stable pagination; mocked cross-seller listing #151 appears. Gallery batched at 75 listings (six photos each below 500 cap). One reproduced omission fixed; not proof all account issues resolved. |
| A05 | Blog/product API URL shadows browser URL constructor | Renamed API_URL in main/preview. Images and approved YouTube parsing pass Chromium tests. |
| A06 | Missing blog delete and article RTL/metadata | RLS-governed delete with confirmation; metadata/RTL at 390/768/1365px tested. |
| A07 | Admin/marketplace logout only clears browser | Added authenticated server logout request. Offline revocation is not guaranteed. |
| A08 | Query-string client-only article URLs | Public CMS export, fresh product/article/category build and sitemap are implemented and tested without JavaScript. Hosted clean-route publication/indexing remain pending. |
| A09 | No outbox delivery worker | Disabled injectable core/templates added; durable lease adapter, Resend transport and actual delivery pending. |
| A10 | Production/store and staging/marketplace schema/Auth split | Read-only metadata confirms; launch blocker; no remote writes. |
| A11 | Leaked-password protection disabled | Both projects per advisors; operator action pending. |
| A12 | market_browse caps results at 100 | Confirmed function definition; browse pagination/search still pending. |
| A13 | Legacy admin RPC claims can be stale | market_set_pro checks is_admin, which checks app_metadata; current-admin revocation hardening outside Phase 1 pending. |
| A14 | Support has two data models | Admin support_tickets vs store tc42_support_threads/messages; reconcile before full workflow acceptance. |

Read-only security inspection: listing SELECT allows approved, owner or admin; UPDATE has USING and WITH CHECK. market_submit validates fields and locks per seller for the three-per-UTC-day quota. market_set_pro checks admin. Chat start/send/read RPCs check participant identity and pin search_path. These are source/metadata findings, not real JWT attack tests.

Advisor warnings: staging public market_browse SECURITY DEFINER (approved rows only), 11 authenticated SECURITY DEFINER functions, three RLS/no-policy tables; production one authenticated SECURITY DEFINER warning and four RLS/no-policy tables. Deny-by-default service tables are not automatically defects. Neither project certified clean.

References:
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
