# Phase 1 security review and actual validation

Reviewed the uploaded archive at upstream commit
`cda5b660ca14e258e9776d8ad788e0cc9cf1e008`. It matched GitHub main when fetched.
No production database, deployment, DNS, wallet or merchant configuration changed.

## Findings addressed

- **Cross-project identity confusion:** the old crypto function authenticated
  production data requests against the staging Auth project. The new handler
  validates only its runtime project's Auth. The migration aborts on orphan buyer
  identities. Existing split-project production data requires explicit reconciliation.
- **Hard-coded shared receiving wallets and arbitrary trusted endpoints:** removed
  from the automated Edge Function. A disabled provider interface replaces them.
  Existing manual support options are preserved and remain unverified arrangements.
- **Competing order models:** canonical checkout/admin reads use `tc42_orders`;
  historic `orders` remains untouched. One-to-one marketplace request bridge and
  legacy-path guards prevent conflicting lifecycle writes after checkout begins.
- **Concurrent inventory purchases:** reservation sums serialize on product/listing
  rows, with deterministic product lock ordering. Verification commits inventory
  once; expired/cancelled reservations cannot commit. A real PostgreSQL concurrency
  test exposed a listing foreign-key lock upgrade deadlock; `FOR NO KEY UPDATE`
  resolves it without weakening inventory serialization.
- **Global reference reuse:** existing `store_used_txid` is retained and extended,
  backfilled from store/market claims; cross-origin historic duplicates abort
  migration. Concurrent claims/callbacks use unique TXIDs and provider-event keys.
- **Self-reported payment:** manual/crypto claims cannot mark orders paid.
  Only service-only independently verified evidence can commit stock; SQL and JS
  check invoice, chain, currency network, address, integer amount, issuance window,
  double spend and confirmations. Partial/confirming/expired cases remain unfulfilled.
- **Stale frontend roles:** new sensitive actions query the current role in
  `auth.users.raw_app_meta_data`, require a signed-in subject and check ownership.
  User metadata and browser flags confer no authority. Existing unrelated legacy
  RPCs still need hosted-schema review; their implementations are not all present.
- **Financial history/privacy:** append-only provider/audit grants, private evidence
  and claims, participant-scoped order reads, idempotent transition notices.
  Service credentials never reach the client. Sellers receive no buyer email.
- **Cancelled invoice UX:** cancellation withdraws payment instructions and releases
  reservations. Later proof preserves the cancelled order and stock, recording the
  received payment for review rather than silently reopening fulfillment.

## Actual local checks

- `npm test`: **24** Node payment/provider tests, **25** PostgreSQL integration
  scenarios, **56** existing Python regression tests passed.
- `npm run check:edge`: both Edge Function entry points pass Deno checks.
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`: existing mocked smoke
  suite and the new focused suite pass. Coverage includes login/recovery, chat,
  marketplace approval, buyer/seller views, checkout duplicate guards, admin gates,
  routes, 390px mobile layout, Persian RTL, mocked invoice creation/expiry,
  confirmation-pending responses, manual claims and sign-out privacy cleanup.
- `supabase db advisors --db-url <disposable-local-fixture> --type security`:
  completed with **No issues found**. This result concerns the reconstructed local
  fixture only. It says nothing about hosted Auth settings or undocumented policies.
- `git diff --check`: passed.

Tests use a native PostgreSQL 18 server with independent connections and roles,
not a mocked SQL state machine. They reconstruct the archive's documented baseline;
no hosted migration was applied and no real JWT penetration or financial test ran.
Provider signatures, chain APIs, PayPal transport and browser network calls are
mocked. Passing tests do **not** establish production payments or email delivery.

The original archive had two documentation-string test failures ("received amount"/
"TXID uniqueness" wording and lowercase "leaked-password"). The documentation was
clarified; financial safety assertions were not weakened. Browser fixtures were
updated to mock the new idempotent order RPC instead of the legacy RPC.

The environment blocked the Playwright browser download. Installed system Chromium
was used successfully. The Supabase changelog HTTP request was also blocked; current
Supabase documentation was consulted through the connected documentation tool for
Auth headers and Edge Function JWT handling. Hosted advisor checks remain required
on the actual reconciled target schema before deployment.

## Remaining operational limits

Crypto adapter and real authenticated provider webhook validation are intentionally
unconfigured. PayPal is an internal sandbox scaffold, without a public capture route
or receipt persistence. Manual receipt confirmation, chain reorganization recovery,
refunds, payouts/custody and Resend delivery are not active. Partial payments are
retained for review; multiple TXIDs are not automatically aggregated. Expiry notices
need a scheduled worker. The new migration has not been tested against a full copy
of the actual hosted schema because the archive lacks its complete baseline.

`docs/phase1-setup.md` contains the exact prerequisites, provider contract, credentials,
manual configuration and data-preserving rollback procedure. These are explicit
launch blockers. The implementation is reviewable; live financial readiness is not
claimed. Recheck production product transfer rights, hosting Auth settings, API
rate limits and operational controls as part of the authorized deployment review.
