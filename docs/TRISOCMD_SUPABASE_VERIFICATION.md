# Supabase integration verification

2026-11-11 (Asia/Tehran). Hosted staging was inspected read-only. No production writes, deployment, merge, paid branch, real payments or customer-data export.

## Compatibility

Staging `cxtytbjvdlngahytfilr` runs PostgreSQL 17.11. Its 25 recorded migrations end at `store_crypto_invoice_reconciliation`. The two previous feature migrations are absent. The committed schema-only fixtures reproduce all 27 public tables, 21 functions, 56 policies, constraints, triggers, table/column ACLs and Supabase default ACLs; Storage object policies are captured separately. No real user, order, listing, message or invoice rows are copied.

Phase 1, paginated browse and the new authorization migration apply successfully against that schema with synthetic historical orders retained. Staging has zero canonical orders lacking a local Auth identity, and `tc42_orders.customer_id` already references its own `auth.users`. New checkout stays on this same identity/data authority. No production accounts or historic production orders are imported or relabeled.

Hosted staging still runs legacy `store-crypto` v3 (`verify_jwt=true`, legacy invoice RPCs), not the new Phase 1 handler. Database compatibility alone does not establish hosted runtime readiness. Keep providers disabled; an authorized staging rollout must coordinate the migrations and same-project handlers/configuration.

## Fixes

- Persisted admin role and active Auth session checks replace stale JWT-only moderation/Pro authorization. Deleted, banned, expired-session and revoked-session identities fail closed.
- Restrictive RLS gates retain every existing ownership/moderation policy. Triggers also protect security-definer writes; explicit RPC guards cover idempotent fast paths. Worker operations remain separate.
- Reset Phase 1 worker-table ACLs before granting required operations. Supabase defaults otherwise leave audit DELETE/TRUNCATE privileges behind. Remove client TRUNCATE/REFERENCES/TRIGGER/MAINTAIN grants.
- Reject SQL-null/invalid carts, and restrict the legacy order validator to internal use through the idempotent canonical entry point. Wire preview storefront/marketplace/admin to the same module; preview retry submission is covered in Chromium.

## Verification

`npm test` includes `tests/staging-integration.mjs`. The standalone suite restores the complete public schema into embedded PostgreSQL with explicitly labeled Auth/Storage stand-ins. It tests migration application/history retention, buyer/seller/admin and cross-account access, concurrent three/day quota, Pro expiry, uploaded-photo moderation, participant-only chat/unread state, marketplace order bridges, reservation races, simulated settlement/fulfillment, immutable audit grants, forged claims and session/admin revocation.

For real local Auth/JWT/REST verification, create a **fresh disposable** local Supabase stack under an ignored `work/` directory (no project link or remote reset), capture `supabase status --output json` to an ignored local file, and run:

```sh
TRISO_INTEGRATION_CONFIG=work/local-supabase-status.json RUN_ADVISORS=1 npm run test:integration
```

The runner accepts loopback endpoints only and refuses nonempty public schemas or existing Auth users. Never pass hosted project credentials. It creates synthetic buyer/seller/other/admin identities through local Auth, logs them in, and checks signed JWTs through PostgREST and the same-project handler. The default embedded run is **not** real JWT verification. Local email confirmation is bypassed explicitly for synthetic users; no hosted signup, sender, OAuth or email-delivery claim is made.

## Results

- 40 Node tests, 51 embedded PostgreSQL scenarios (25 payment + 8 browse + 18 full-schema), 56 Python regressions, four Chromium suites and Deno checks pass. Final failures: zero.
- All 20 scenarios pass on a disposable local Supabase PostgreSQL 17.11 stack with real Auth-created buyer/seller/other/admin identities. Signed JWTs pass REST/RPC isolation checks; genuinely expired JWTs are rejected, stale admin roles lose access, revoked sessions lose private access, and the same-project handler keeps payments disabled even with legacy flags set.
- Local CLI security advisors reported no issues in the isolated database. Hosted advisor findings are unchanged; this is not hosted-project certification.
- The local Auth container's wget health probe incorrectly sent loopback through the inherited proxy (403). `--ignore-health-check` retained the stack for diagnosis; the actual Auth/REST endpoints then passed the integration tests. This does not establish hosted Auth configuration.
- Storage approval uses synthetic object metadata, not an actual binary upload or signed-image delivery check. Hosted signup/email/OAuth and genuine Storage upload acceptance remain pending.

## Remaining gates

- Hosted Auth settings are inaccessible through the available connector; direct `/auth/v1/settings` and Supabase changelog HTTP requests return 403. Sender/redirect/provider settings remain unverified. Advisors still report leaked-password protection disabled.
- Hosted migrations/handlers remain unapplied. No hosted buyer/seller/admin accounts or writes were used. Production historical identity/order continuity requires an operator-reviewed plan; this work does not combine projects.
- Hosted advisors retain intentional public browse/authenticated definer warnings and deny-by-default service-table notices. Local advisor output does not certify the hosted projects.
- Complete the other release checklist items, including Firefox and real staging signup/OAuth/email/storage workflows, before release.
