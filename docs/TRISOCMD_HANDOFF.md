# TRISOCMD continuation handoff

Updated 2026-11-10 (Asia/Tehran). Work stops when this task ends; no background execution is promised.

Branch: feature/trisocmd-completion, based on feature/phase1-checkout / PR #36 head 3eea77c. Preserve PR #36 and its compatibility changes. Do not merge or deploy. No production, staging data, credentials, DNS or financial system was modified.

Completed additions: shared refresh serialization/offline retention/logout-race protection; session-only persistence; admin pagination and gallery batching; late admin response guard; product/blog URL constructor collision fixes; blog delete/RTL/metadata; offline article generator; disabled email template/delivery core; targeted tests; master tracking files.

Read TRISOCMD_MASTER_CHECKLIST.md, BUG_AUDIT.md, EXTERNAL_DEPENDENCIES.md and RELEASE_READINESS.md before continuing. Scope is incomplete. Do not present this PR as completion of all six phases.

Priority continuation:
1. Reconstruct full staging/production schema from read-only metadata in a disposable local DB. Existing Phase 1 fixture validates only a subset. Keep live projects untouched.
2. Marketplace: browse RPC caps at 100; implement backend pagination/search/price filters with safe grants and role tests. Embedded account moderation pagination/gallery batches are included; add a dedicated >200-row browser case. Validate real owner/admin uploads and three/day concurrency, edit/remove and Pro expiry.
3. Auth: add real cross-tab Web Locks browser race tests; test expired/revoked tokens and all preview/account surfaces. Real signup/email/OAuth requires staging sender/redirects, not production accounts.
4. Chat: participant isolation/reconnect/unread dedup and permission revocation tests; admin oversight must use authorized read path.
5. Support: reconcile support_tickets versus tc42_support_threads/messages before adding more tables; complete admin replies/status/history across buyer/admin.
6. Email: integrate email.mjs with atomic SKIP LOCKED leasing, capped attempts/backoff, stable provider idempotency, verified Resend transport, monitoring. Default disabled. Supabase Auth confirmation/recovery templates are separate from optional notifications.
7. Content: connect reviewed published export to CMS/static build, product prerendering, complete sitemap/robots publication gate. Journal generator refuses existing output dirs to prevent stale removed posts.
8. Security: harden legacy admin claim freshness; inspect all exposed grants, functions, storage, RLS. Advisor warnings are recorded; do not weaken policies to clear warnings.
9. Run all 24 requested real-role workflows, Firefox/Chrome, accessibility and performance checks before acceptance. Firefox downloads currently policy-blocked.

Validation commands in RELEASE_READINESS. Work logs are local ignored work/ files. Tests use fake identities and simulated payments; they prove no real delivery/payment outcome.
