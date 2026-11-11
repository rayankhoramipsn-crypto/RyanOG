# TRISOCMD release readiness

**NOT READY. Six-phase scope incomplete.** Updated 2026-11-11 (Asia/Tehran).

Based on PR #36 at 3eea77c, preserving compatibility fixes. This branch adds auth/moderation/media repairs, offline article tooling and disabled email core. Marketplace browsing now adds an unapplied migration, 20261110201622_marketplace_browse_page.sql. It preserves market_browse(), grants only the new read RPC to anon/authenticated, exposes approved public fields and the existing derived Pro flag, pins search_path, and changes no table grants/RLS. SECURITY DEFINER retains access to private Pro entitlements without exposing profiles. Review/authorize staging rollout separately; until applied, clients show the legacy 100-result limitation. Phase 1 migration/Edge Functions remain inherited and undeployed.

## Validation

- 40 Node tests (24 payment/provider, 8 session, 4 journal, 4 email).
- 51 native PostgreSQL scenarios (25 payment, 8 browse and 18 full staging-schema) using independent connections; inventory races, TXID uniqueness, transitions, idempotency and grants against reconstructed fixture.
- 56 Python regressions.
- Four Chromium suites: route/UI smoke, Phase 1 checkout/orders, completion suite covering 241-row moderation, blog media/deletion/sanitization/RTL at 390/768/1365px and product URL parsing; marketplace suite covers 241-row pagination, server-filter contract, approved deep links, late responses, empty/error/retry states, missing-migration fallback and mobile RTL in main/preview.
- Local Supabase security advisors reported no issues against the browse fixture; this does not certify either live project.
- Deno checks pass for inherited Edge Function entrypoints.
- Browser external mutations intercepted; no real payment/Auth/email/RLS claim.
- Firefox blocked by download policy. Exhaustive real-role, accessibility and performance acceptance pending.

Reproduce with npm ci, npm test, npm run check:edge. Serve repository using python3 -m http.server 8765 --bind 127.0.0.1, then run TRISO_CHROMIUM_PATH=/usr/bin/chromium npm run test:browser (omit override if Playwright Chromium installed).

## Offline publishing

Export reviewed published articles to JSON without credentials/private drafts. Run node scripts/render-journal.mjs reviewed-posts.json work/journal-output. Target must not exist, preventing deleted pages surviving rebuild. Generates clean article directories, article-only sitemap and robots. Defaults noindex; --indexable is an explicit later release choice. Not yet wired to CMS/deployment; not a complete storefront sitemap.

## Release and rollback

1. Finish MASTER_CHECKLIST residual implementation and real isolated staging acceptance.
2. Reconstruct complete disposable schema and reconcile identities/legacy constraints without deleting history.
3. Review phase1-setup.md and phase1-retire.sql. Back up before any approved migration.
4. Verify provider/sender/permissions and repeat tests; keep financial switches disabled.
5. Obtain explicit merge/deployment approval. Main pushes publish automatically; do not merge to test.
6. Frontend rollback: revert feature commits through a PR while preserving PR #36 and historical data. The browse migration is additive and leaves the legacy API intact; frontend rollback can retain the new read RPC/index. No migration was applied remotely.
7. If Phase 1 is separately rolled out, disable providers and use its data-preserving retirement plan. Do not drop orders/claims/invoices/audit history.

No production-readiness or six-phase-completion claim is made.

## Supabase integration batch

See TRISOCMD_SUPABASE_VERIFICATION.md. Full staging public-schema/security fixtures now supplement the archive fixtures. New migration 20261110204751_staging_integration_authorization.sql adds active-session and persisted-admin gates, audit ACL restrictions and null-cart validation. It preserves ownership policies and historical rows. All hosted migrations remain unapplied; the currently deployed staging store-crypto is still the legacy implementation. No production identity migration is attempted.

The 20-scenario real local Supabase Auth/JWT/REST run passes on PostgreSQL 17.11, alongside all existing suites. Hosted Auth settings and deployed runtime acceptance remain unverified; no hosted rollout occurred. Preview pages now use the canonical order module, including its idempotent submission path.

## Marketplace/admin continuation

See TRISOCMD_MARKETPLACE_VERIFICATION.md for the fourth unapplied migration and local workflow evidence. Validation now includes owner edits/profiles, cross-seller history, Pro expiry, binary Storage checks, terminal intake synchronization, seller fulfillment and bounded/idempotent chat. CI includes full regressions and a fresh local Supabase JWT/Storage job. Hosted rollout/live realtime/Firefox acceptance remains pending.

## Communications continuation

See TRISOCMD_COMMUNICATIONS_VERIFICATION.md for the fifth additive migration, canonical support reconciliation, delivery controls and exact external prerequisites. Current isolated validation: 50 Node, 78 PostgreSQL, 56 Python, six Chromium suites, four Deno entrypoints and 17 dedicated native communications scenarios. Live email/push remain disabled and unverified; authorized hosted rollout, sender/domain/secrets, scheduler, VAPID and real-device acceptance remain required.
