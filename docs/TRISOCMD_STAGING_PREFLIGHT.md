# Hosted staging rollout preflight

2026-11-12 (Asia/Tehran). Target **TRISO TEST / cxtytbjvdlngahytfilr**, PostgreSQL **17.11.0.003**, `ACTIVE_HEALTHY`. Read-only inspection from PR #37, preserving PR #36. No hosted migrations, deployments, restores, configuration changes or test-data writes were performed.

**Decision: schema-compatible; NOT YET cleared for hosted writes. Backup and restore evidence is missing.** Production remains outside this request.

## Verified current state

- All four catalog fingerprints match the Phase 6 fixture exactly: 184 columns, 138 constraints, 56 policies and 21 functions. There are 27 public tables, all with RLS.
- Migration history still has 25 foundation entries ending `20261106131852_store_crypto_invoice_reconciliation`. All six feature migrations are pending; no partial installation or unexpected schema drift was found.
- Zero missing Auth references for orders, listing owners, purchase-request participants, canonical support and legacy tickets; zero empty legacy ticket bodies/subjects; zero duplicate store/market TXIDs; zero gallery metadata rows without a corresponding object.
- Aggregate preservation baseline: **4 Auth users, 3 products, 5 listings, 5 conversations, 11 chat messages, 2 purchase requests (both requested), 3 Storage objects**. Canonical/legacy orders, support tickets/threads, crypto invoices, TXID claims and email outbox are empty. Record counts are a point-in-time checkpoint, not a reason to erase legitimate later activity.
- One active persisted admin, no dedicated support-role account. Admin can handle support; no existing account needs automatic privilege changes.
- `market-gallery` remains private, limited to 5 MB and JPEG/PNG/WebP. Realtime publishes conversations/messages. `pg_cron` is not installed; external schedules and Edge runtime secrets are not visible through these SQL checks.
- Hosted `store-crypto` is still version 3 with gateway JWT verification enabled; its bundle hash is `7203507d3395f4b245c8eac0469a242d9ac332b3571d880d654264024366adfc`. The reviewed replacement uses explicit same-project Auth and `verify_jwt=false` for readiness GET. This is expected deployment drift, not permission to relax the existing function in place.
- Hosted `marketplace-v15-preview` version 1 is unrelated to the four target functions and must remain unchanged. `payment-webhook`, `delivery-worker`, and `delivery-webhook` are not hosted yet.
- Hosted advisors remain unchanged: intended callable SECURITY DEFINER entrypoints, three service tables with deny-by-default RLS and [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Feature migrations provide the locally tested authorization hardening; hosted settings remain separate.

## Backup / recovery gate

Organization metadata confirms the **Free** plan. No recoverable physical backup, PITR interval, off-site logical export or tested restore point was available for verification. The connector has no backup-list operation. The non-mutating command `supabase backups list --project-ref cxtytbjvdlngahytfilr --output json` stopped because no CLI access token is configured; it requires the `backups_read` scope. No token was requested in chat and no paid upgrade or restore was attempted.

Supabase's [backup documentation](https://supabase.com/docs/guides/platform/backups) recommends regular off-site logical exports for Free projects. A database backup includes Storage metadata, **not the binary objects**. The three existing private objects require a separate verified copy. A schema fixture and successful migration rollback tests are not a backup of hosted records.

Before any migration, an authorized owner must provide or authorize:

1. A secure, encrypted, consistent database backup covering public data, Auth identities and required Auth/Storage metadata, plus reviewed role/grant and migration-history recovery information. Keep credentials, password hashes and customer data out of Git, chat and build artifacts.
2. A separate backup of all three Storage objects, current deployed Edge source/configuration and Auth/redirect/SMTP settings needed for recovery. Confirm what external schedules exist; do not enable or install any.
3. Restore verification in an existing disposable environment: fingerprints, record counts/relationships, Auth/RLS and object availability. **Do not restore over hosted staging.** Any paid resource or hosted restore requires separate approval.
4. A maintenance window preventing writes from any frontend or worker targeting this staging project, including existing main/preview consumers, and a fresh preflight immediately before applying.

If backup credentials are unavailable, owner-run export/restore evidence is sufficient to review. Do not infer backup availability from plan metadata, healthy project status or database rollback tests.

## Frozen approval packet — no execution

After committing the reviewed source, run:

`node scripts/prepare-staging-rollout.mjs --out work/staging-rollout-review`

The command refuses a dirty checkout or existing output directory. It writes only local files: `manifest.json`, six structured `migration-payloads/*.json` and a complete `supabase/functions` dependency snapshot with config and SHA-256 hashes. It has no network/database/deployment path or apply flag. Target is fixed to staging, and the manifest explicitly records that execution is unauthorized and backup verification is required.

Each migration payload is a future `supabase.apply_migration` argument object. Its unique snake-case name preserves the original source version/name. Only outer BEGIN/COMMIT wrappers are removed so the hosted migration tool owns the transaction and history entry; inner SQL is unchanged. Record the tool-assigned hosted version against the source filename and SHA-256. Do not require it to equal the original file timestamp, repair existing history or blindly `db push` a repository lacking the 25 foundation files.

### Ordered procedure after approval and backup verification

1. Recheck target, maintenance window, `docs/release-preflight.sql`, pending-migration history and packet hashes. Stop on drift or a pre-existing matching source migration name; never replay it blindly.
2. Apply packet payloads one at a time, recording result/history after each:
   - `20261108214609_phase1_checkout.sql`
   - `20261110201622_marketplace_browse_page.sql`
   - `20261110204751_staging_integration_authorization.sql`
   - `20261111181536_marketplace_workflows.sql`
   - `20261111185818_notifications_email_support.sql`
   - `20261111200640_storefront_content.sql`
3. Recheck preserved records, RLS/RPC grants, bucket settings, schema cache and publications. Expect canonical support and notification/publication additions. Do not change existing users, recreate historical purchase requests or restore legacy settlement grants.
4. Have the authorized operator verify/set only disabled-delivery configuration: `EMAIL_DELIVERY_ENABLED=false`, `EMAIL_SENDER_VERIFIED=false`, `WEB_PUSH_ENABLED=false`; crypto's unconfigured adapter stays disabled. Runtime secrets/schedules were not verified by this read-only pass. Do not assume absent secrets or inactive external workers.
5. From the frozen packet directory, deploy **in this order** using its manifest commands: `store-crypto`, `payment-webhook`, `delivery-worker`, `delivery-webhook`. Each command is `supabase functions deploy <name> --workdir . --project-ref cxtytbjvdlngahytfilr`. Preserve packaged config; `verify_jwt=false` is paired with the reviewed in-handler Auth/signature/worker-secret checks. Leave `marketplace-v15-preview` untouched.
6. Verify disabled capabilities and unauthorized-request rejection. With explicit test-data approval, use tagged synthetic accounts/records to verify buyer/seller/admin/support, Storage and Realtime on staging. Preserve all existing records; no real payment/email/push attempt.
7. Compare the post-migration preservation baseline and record acceptance. A failure stops rollout; use the data-preserving stop/rollback guidance in release readiness. Do not drop additive schema, restore insecure grants or perform a hosted restore automatically.

**Separate approval remains required for PR merges, GitHub Pages deployment, production, paid services, enabling providers and scheduler installation.** The existing Pages workflow publishes `main`; do not trigger it during this backend staging rollout.

## Consolidated approval scope to review

Authorize secure staging backup/export and isolated restore verification first; **only if that gate and the repeated preflight pass**, authorize the six frozen migration payloads, four disabled-provider Edge deployments and tagged staging acceptance tests above. No production, Pages, merge, paid resources, hosted restore or live financial/messaging activation is included. Until recovery evidence is verified, migration execution remains blocked.

## Authorized backup follow-up

Backup/export preparation and a no-cost isolated restore were subsequently authorized. Execution remains blocked by absent hosted DB/private-Storage/CLI credentials and a designated owner recovery-encryption recipient, not by missing backup permission. No customer data was exported through the SQL connector, no backup was created and no restore was claimed. Exact secure owner steps and proof requirements are in TRISOCMD_STAGING_BACKUP.md. Migrations and deployments remain unauthorized.
