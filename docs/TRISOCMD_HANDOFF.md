# TRISOCMD continuation handoff

Updated 2026-11-11 (Asia/Tehran). Work stops when this task ends; no background execution is promised.

Branch: feature/trisocmd-completion, based on feature/phase1-checkout / PR #36 head 3eea77c. Preserve PR #36 and its compatibility changes. Do not merge or deploy. No production, staging data, credentials, DNS or financial system was modified.

Completed additions: shared refresh serialization/offline retention/logout-race protection; session-only persistence; admin pagination and gallery batching; late admin response guard; product/blog URL constructor collision fixes; blog delete/RTL/metadata; offline article generator; disabled email template/delivery core; targeted tests; master tracking files.

Read TRISOCMD_MASTER_CHECKLIST.md, TRISOCMD_BUG_AUDIT.md, TRISOCMD_EXTERNAL_DEPENDENCIES.md and TRISOCMD_RELEASE_READINESS.md before continuing. Scope is incomplete. Do not present this PR as completion of all six phases.

Priority continuation:
1. Full staging public-schema snapshot and isolated migration/permission suite added; see TRISOCMD_SUPABASE_VERIFICATION.md. Staging canonical orders already reference local Auth (zero missing identities). Keep production history separate. Hosted rollout/Auth configuration and real staging acceptance remain pending.
2. Marketplace: owner edits/review, profiles, Pro expiry controls, canonical intake lifecycle, full seller/order/admin history, chat paging/read watermarks/idempotent send and private binary Storage authorization now implemented and tested locally. See TRISOCMD_MARKETPLACE_VERIFICATION.md. All four feature migrations remain unapplied to hosted projects; hosted acceptance remains pending.
3. Auth: add real cross-tab Web Locks browser race tests; test expired/revoked tokens and all preview/account surfaces. Real signup/email/OAuth requires staging sender/redirects, not production accounts.
4. Chat: local participant isolation, read watermark, idempotent retries, history paging and revocation tests pass; verify real hosted WebSocket delivery/reconnect after authorized staging rollout. Admin oversight remains read-only.
5. Support: reconcile support_tickets versus tc42_support_threads/messages before adding more tables; complete admin replies/status/history across buyer/admin.
6. Email: integrate email.mjs with atomic SKIP LOCKED leasing, capped attempts/backoff, stable provider idempotency, verified Resend transport, monitoring. Default disabled. Supabase Auth confirmation/recovery templates are separate from optional notifications.
7. Content: connect reviewed published export to CMS/static build, product prerendering, complete sitemap/robots publication gate. Journal generator refuses existing output dirs to prevent stale removed posts.
8. Security: legacy admin claim freshness and active-session gates now have an unapplied migration and local tests; inspect all exposed grants, functions, storage, RLS. Advisor warnings are recorded; do not weaken policies to clear warnings.
9. Run all 24 requested real-role workflows, Firefox/Chrome, accessibility and performance checks before acceptance. Firefox downloads currently policy-blocked.

Validation commands in TRISOCMD_RELEASE_READINESS.md. Work logs are local ignored work/ files. Tests use fake identities and simulated payments; they prove no real delivery/payment outcome.

Latest focused batch: marketplace browse implementation; no live writes. Local security advisors reported no issues against the browse fixture. Re-run commands in TRISOCMD_RELEASE_READINESS.md. Full schema reconstruction, live role/upload/quota acceptance and other phase work remain pending. Keep payments disabled.

Supabase integration batch: complete staging public/Storage security fixtures, explicit grants, session/admin revocation, null-cart and internal-validator fixes. Standalone integration tests distinguish embedded platform stand-ins from real local Auth/JWT/REST. See TRISOCMD_SUPABASE_VERIFICATION.md for compatibility evidence and exact rollout/configuration limits.

Validation: 40 Node, 51 embedded DB, 56 Python, four Chromium suites, Deno checks and all 20 real local Supabase Auth/JWT/REST scenarios pass. Local advisors report no issues. All three feature migrations remain unapplied to hosted staging/production; hosted store-crypto v3 is legacy. Preview pages now use canonical checkout. Hosted Auth config reads are blocked (403); no real sender/OAuth/binary Storage upload acceptance claimed.

Marketplace milestone: see TRISOCMD_MARKETPLACE_VERIFICATION.md. Native binary Storage tests and a 241-row cross-seller admin REST case pass. CI now covers full regression/browser checks plus a fresh local Supabase Auth/Storage job. Providers remain disabled; no hosted/customer data was changed.
