# TRISOCMD release readiness

Updated 2026-11-12 (Asia/Tehran). **NO-GO for production.** Code is ready for staged release review within the limits below; hosted rollout and live integrations are not accepted. PR #37 retains PR #36 (`3eea77c`) as its dependency. No hosted writes, merge, deployment or provider activation occurred.

## Verified evidence

- 62 Node tests, 85 embedded PostgreSQL scenarios (25 payment, 8 browse, 52 full staging schema), 56 Python regressions and four Deno Edge entrypoints.
- Eight Chromium suites cover storefront/content, marketplace/admin, checkout, notifications/support, session races and accessibility. Provider/browser backend writes are intercepted.
- Fresh PostgreSQL 17 local Supabase: 57 scenarios with real Auth/JWT/REST and binary Storage. Six migrations apply together, roll back atomically to the unchanged 27-table/56-policy baseline, then apply successfully. Operational payment retirement denies writes while preserving ten historical data/audit tables.
- Two actual local WebSocket scenarios verify participant-only chat delivery, reconnect/history and post-session-revocation denial. Hosted WebSocket acceptance remains separate.
- Six additional real local Auth/Mailpit scenarios: unconfirmed signup denial, email confirmation, password recovery/change, cross-account support denial, token rotation/global logout and immediate private-session gating. Google is tested only for safe rejection while unconfigured. Mail stays in disposable local Mailpit.
- Real Chromium Web Locks serialize cross-tab refresh; logout/new login defeats late refresh; session-only login stays tab-local. Eight anonymous/authenticated-admin route states have no critical/serious axe WCAG findings at 390px. DOM budgets/overflow and navigation timings are recorded in ignored `work/phase6-accessibility.json`; this is fixture testing, not a field-performance or complete WCAG certification.
- Local SQL security advisors complete successfully with no findings. `npm audit` reports no known dependency vulnerabilities after Playwright's security patch. Hosted advisories are separately recorded below.

Reproduce: `RUN_ADVISORS=1 npm test`, `npm run check:edge`; serve on loopback 8765, then `TRISO_CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`. Native: use a **fresh, never-linked** CLI workdir, `node tests/prepare-release-auth.mjs work/<copy>` before starting, write CLI status JSON into ignored `work/`, then `TRISO_INTEGRATION_CONFIG=work/<status>.json TRISO_STORAGE_TESTS=1 RUN_ADVISORS=1 npm run test:integration` and `npm run test:release:auth` with the same config. Tests refuse non-loopback database/API targets and nonempty schemas.

The managed Docker proxy caused localhost-only Auth/Storage health commands to fail. The local copy used `--ignore-health-check` only after diagnosis; actual API, JWT, recovery, database and binary Storage tests independently passed. No remote TLS checks were disabled. Local advisor connections explicitly use `sslmode=disable` for loopback PostgreSQL; failures now fail the test instead of being silently accepted.

## Hosted staging compatibility (read-only)

`cxtytbjvdlngahytfilr` remains at the 25-entry hosted migration history ending `20261106131852_store_crypto_invoice_reconciliation`. None of the six feature migrations is installed. It has 27 public tables, 56 public policies, all public tables with RLS, zero missing order/listing/support Auth identities and zero historic store/market TXID collisions.

The restored fixture and actual hosted schema match these fingerprints exactly (see `release-preflight.sql`):

| Component | Count | MD5 of normalized catalog inventory |
|---|---:|---|
| Columns | 184 | `03a28dc752050159989ca67326de9053` |
| Constraints | 138 | `016eb29a5a5b15472dc1e18315b3b99c` |
| Policies | 56 | `d54a3d2ea41257c7e04f3c9ce549340d` |
| Functions | 21 | `87082b22af6983676cc61e4079e627be` |

These are drift checks, not cryptographic certification of safety. Storage policies match the committed private-gallery baseline. Hosted Realtime publishes conversations/messages; the notification publication changes remain pending in migration five. Hosted Auth configuration/SMTP/OAuth and WebSocket acceptance are not verified by these SQL checks.

Hosted security advisors still report intended public/authenticated SECURITY DEFINER entrypoints, three deny-by-default RLS service tables, and disabled leaked-password protection. The legacy hosted authorization has not acquired the branch's current-session/persisted-admin hardening. Do not treat local clean advisors as a hosted clean bill of health.

## Exact rollout order — instructions only, approval required

1. **Confirm the target.** Run `docs/release-preflight.sql` read-only and inspect hosted migration history. Obtain backups/restore evidence including Auth, Storage metadata/objects and financial/support history. Stop if fingerprints/identity checks drift. These are staging-compatible migrations; do not apply them to the separate production project's different schema/Auth topology.
2. **Preserve existing migration history.** The repository contains six feature files, not the hosted 25-entry foundation history. Do not blindly run `db push`, `db reset` or migration-history repair. In an approved staging change, use Supabase's hosted `apply_migration` with each complete file as its query/name, in the following order; verify each history entry before proceeding:

| Order | Migration |
|---:|---|
| 1 | `20261108214609_phase1_checkout.sql` |
| 2 | `20261110201622_marketplace_browse_page.sql` |
| 3 | `20261110204751_staging_integration_authorization.sql` |
| 4 | `20261111181536_marketplace_workflows.sql` |
| 5 | `20261111185818_notifications_email_support.sql` |
| 6 | `20261111200640_storefront_content.sql` |

3. **Verify SQL before exposing the frontend.** Recheck RLS/grants, `market_set_pro`, disabled legacy `tc42_create_order`, private participant RPCs, upload buckets and admin/support persisted roles. Test synthetic authorized staging roles and actual uploads. Refresh PostgREST's schema cache if necessary. Validate Realtime publications/reconnect using authenticated clients; never expose service credentials.
4. **Deploy reviewed Edge Functions** only with separate authorization: `supabase functions deploy <name> --project-ref cxtytbjvdlngahytfilr` for `store-crypto`, `payment-webhook`, `delivery-worker`, `delivery-webhook`. Retain repository `verify_jwt=false` only because these handlers perform explicit same-project Auth, worker-secret or cryptographic webhook validation. Runtime Supabase credentials remain server-side. Verify public capability endpoints report disabled providers; prove unauthorized requests fail.
5. **Configure services independently.** Follow `TRISOCMD_EXTERNAL_DEPENDENCIES.md`. Keep email/push/payment delivery disabled until each corresponding sandbox or device test and approval succeeds. Do not install delivery/payment schedules before verifying configuration and draining/reconciling old jobs/invoices.
6. **Build/review Pages artifact.** `node scripts/build-site.mjs --out <fresh-dir> --content content/published.json`. Optionally configure public-only CMS repository variables for automatic snapshot refresh. Verify product/article/category routes, sitemap, robots, source selection and noindex. Current frontend targets staging; production requires an explicitly reviewed target/Auth plan. Do not remove staging markers/noindex as part of this task.
7. **Release dependency order.** Review PR #36 first; preserve its commits when reviewing/retargeting PR #37. Merge/Pages deployment requires explicit approval. The existing workflow publishes on `main` pushes/manual dispatch; do not use a merge or deployment to test. After an approved rollout, run real staging acceptance before a separately approved production release.

## Rollback and stop conditions

The isolated suite tests rollback of the entire six-migration transaction and data-preserving operational retirement using `docs/phase1-retire.sql`. That script stops payment RPCs; it is not a universal schema downgrade or an automatic refund mechanism. Before retirement, stop provider workers/schedules and review outstanding invoices/delivery receipts. Reconcile accepted payments with trusted provider evidence; retain idempotency/TXID/reservation/audit history.

After a committed rollout, preserve additive schema and hardened policies. Roll back frontend only to a version compatible with all six migrations (for example `a969b0a`), retain security patches where applicable, and use reviewed backup/ACL restoration if needed. Never restore legacy shared-wallet settlement or JWT-only admin privileges, drop customer/history tables, truncate queues, or replay migrations/history repairs to force compatibility.

## Remaining release gates

- Require green CI for the final review revision; initial queued runs are not evidence of success. Latest execution evidence is recorded on PR #37.
- Hosted six-migration/Edge/frontend rollout and real staging acceptance require authorization. Separate production schema/Auth reconciliation and target selection remain unresolved.
- No independently verified live crypto provider, PayPal integration, Resend sender/delivery, Web Push, scheduler, Google OAuth or hosted email/realtime operation. Their exact prerequisites are in the external-dependencies document.
- Actual reviewed product media/specifications and published articles are absent from the staging snapshot (three products, including demos; no published articles). No production catalog, indexing, full device/browser or field-performance acceptance is claimed. Firefox remains download-policy blocked.
