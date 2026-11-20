# Staging release preparation status

Updated 2026-11-20 (Asia/Tehran). PR #37 remains draft and based on PR #36 (`3eea77c`); feature branch continues from `d237a3c`. **NO-GO for hosted migration execution and production release.** This task prepares/tests owner-operated recovery; it performs no hosted writes, secret/config changes, deployment, merge or financial/messaging activation.

## Ready versus unverified

| Item | Evidence / remaining gate |
|---|---|
| Owner database export | Owner reports a local PG17 custom-format dump, successful archive listing and public extraction. Archive stays private; its contents, completeness, encryption and recovery have not been independently inspected here. |
| Local recovery implementation | `scripts/restore-staging-backup.py` uses a new PG17 cluster, no network/ports/host mounts, read-only root and tmpfs. Rejects remote Docker, private paths in Git, corrupt archives, drift/missing Auth/Storage/history and failed migrations. Records success only after cleanup. |
| Recovery test evidence | Synthetic PG17 full dump → restore, baseline/Auth/Storage/history checks, all-six transaction/rollback and corrupt-archive rejection pass. This is workflow verification, not recovery of the owner's archive. |
| Storage tooling | Offline full key-set/size/SHA-256 manifest generation and recovery comparison implemented; traversal, Windows aliases/case collisions, symlinks, missing/extra files and size mismatches rejected. No hosted object download attempted. |
| Windows instructions | [Exact PowerShell procedure](TRISOCMD_WINDOWS_RECOVERY.md) uses Python binary streaming instead of PowerShell binary pipelines. Docker Desktop/Windows runtime acceptance must be performed by the owner; Linux PG17 runner execution passes. |
| Staging schema | Last read-only hosted check was **2026-11-12**, not a fresh 2026-11-20 inspection. It matched all four fingerprints, 25 foundation migrations and no Auth/TXID conflicts. All six feature migrations were then pending. Recheck immediately before any approved rollout; do not assume no later drift. |
| Source/dependency review | PR #36 dependency preserved; six migration files unchanged. Rehearsal uses the actual files, checked against the fixed inventory and hashed in private `result.json`. No hosted history changes. |

## Verification in this batch

- Passed: 65 Node tests; 85 embedded PostgreSQL scenarios (25 checkout, 8 browse, 52 combined schema); 66 Python tests including 10 recovery/Storage safety regressions; four Deno Edge checks.
- Passed on actual PostgreSQL 17.11 Docker: full synthetic archive restore with Auth/Storage/history, baseline validation, six actual migration files applied in one local transaction and rolled back with full table-count preservation; corrupt archive rejection and cleanup. Pinned image is used by the new existing-workflow CI step.
- Not run: owner's actual archive/data/object downloads/decryption, Windows Docker Desktop execution, hosted acceptance or any deployment. PowerShell container/parser availability check was blocked by registry download `Forbidden`; instructions were reviewed, not executed on Windows. No tests were weakened or protection schemas skipped.
- Reproduce: `npm test`, `npm run check:edge`, then install the pinned public image from the workflow and run `python3 tests/recovery-local.py` (synthetic fixtures only). The two owner tools must run outside CI against private artifacts. CI status for the eventual new commit must be checked separately; prior green runs are not new-commit evidence.

## Six migrations: exact reviewed order and prerequisites

| Order / source | Required baseline / effect to validate |
|---|---|
| 1 — `20261108214609_phase1_checkout.sql` | Existing canonical orders, crypto invoices, purchase requests, used-TXID tables and known status constraints; every order must reference staging Auth, and cross-system historic TXIDs must not collide. Adds order/inventory/payment authorization and preserves history; provider stays disabled. |
| 2 — `20261110201622_marketplace_browse_page.sql` | Existing listings, browse/profile/Pro foundation and approved statuses. Adds bounded public browse RPC/index; no private entitlement/owner exposure. Has no outer transaction wrapper; do not invent one inside a hosted tool-owned transaction. |
| 3 — `20261110204751_staging_integration_authorization.sql` | Phase 1 functions, real staging Auth users/sessions/ban fields, existing public/Storage policies and roles. Enforces current sessions/persisted admin claims and revokes insecure legacy purchase/settlement paths; never restore JWT-only admin grants to bypass a failure. |
| 4 — `20261111181536_marketplace_workflows.sql` | Prior session/admin hardening, listing/gallery/chat/order foundation. Completes seller/admin workflows and restrictive private `market-gallery` MIME/5 MB configuration; verify any existing bucket/config conflicts. |
| 5 — `20261111185818_notifications_email_support.sql` | Existing canonical support threads/messages, legacy tickets, notifications/outbox and Auth references; no empty historic ticket subject/body. Backfills legacy support without deleting it, adds delivery/preferences/read state and Realtime publication changes. Does not activate workers or delivery. |
| 6 — `20261111200640_storefront_content.sql` | Prior persisted admin gate; exact baseline blog/product-media policies, products and content sequences; `description_fa` not already partially added. Validates content and creates public marketing `content-media` only if reviewed settings match. Never place private files in that bucket. |

The baseline four fingerprints are in `TRISOCMD_RELEASE_READINESS.md`. Owner recovery first compares them and verifies Auth relationships and the 25-entry history; `--check-migrations` then rehearses all six and rolls back, comparing baseline inventory and all restored table counts. This local drill normalizes ownership with `--no-owner` and uses NOLOGIN compatibility roles; full hosted owner/grant equivalence and real-role API acceptance remain separate. Do not infer live compatibility from a public-only dump or silently omit protected schemas, extensions, constraints or roles.

## Owner actions and approval boundary

1. Run the Windows recovery procedure against the existing private archive. If a protected schema/extension/role is absent or incompatible, stop at the private error and obtain a complete authorized export or reviewed compatible **local** image. No private upload is needed. Compare every restored table count with the owner's same-snapshot source/extraction inventory and privately review archive coverage, grants and role recovery requirements.
2. Back up **all current Storage buckets and object bytes** using existing authorized read/download access during a stable window. Compare metadata before/after, verify complete key sets, sizes and hashes, and preserve empty bucket configuration. An old DB/new object set is not a consistent recovery point. Three old objects are a dated observation, not the backup scope.
3. Encrypt DB/Auth/metadata/object/config artifacts for a verified owner recipient; retain ciphertext separately from the recovery key. Prove decryption from the retained copy, restore the recovered DB in the same isolated runner and verify recovered object hashes against the original private manifest. Confirm owner-controlled off-site retention. Archive listing/public extraction alone do not satisfy this gate.
4. Provide **sanitized** pass/fail, archive/image/migration hashes, source comparison and object recovery outcomes. No passwords, key material, Auth/customer data, object names, backup uploads or raw logs. Confirm a staging maintenance window and fresh read-only preflight/history/identity/Storage inventory before considering migration approval.
5. Only after recovery and fresh preflight pass, request explicit staging authorization for six migrations, four disabled-provider Edge deployments and tagged synthetic role/Storage/Realtime acceptance. No conditional authorization has been granted by this recovery-preparation request.

## Deployment order after separate approval — do not execute now

1. Freeze reviewed source/CI and generate a **new** packet with `node scripts/prepare-staging-rollout.mjs --out work/<new-review-directory>` from a clean checkout. Check target `cxtytbjvdlngahytfilr`, source/migration/Edge hashes and all current backup/preflight gates. Never reuse an older packet after source/config changes.
2. Preserve all 25 foundation history entries. Use the packet's six `supabase.apply_migration` payloads in the table order, one at a time, recording source hash → tool-assigned history version. Stop on partial/duplicate history or drift. No blind `db push`, history repair or reset.
3. Recheck historical records, Auth relationships, RLS/grants/RPCs, Storage restrictions, schema cache and publications. Confirm owner-reviewed runtime settings leave `EMAIL_DELIVERY_ENABLED=false`, `EMAIL_SENDER_VERIFIED=false`, `WEB_PUSH_ENABLED=false`; financial providers remain unconfigured/disabled. No scheduler installation.
4. From that frozen packet deploy `store-crypto`, `payment-webhook`, `delivery-worker`, `delivery-webhook` in order, using its `--project-ref cxtytbjvdlngahytfilr` commands/config. `verify_jwt=false` relies on the reviewed in-handler Auth/signature/worker-secret checks; never change that flag independently. Leave unrelated `marketplace-v15-preview` untouched.
5. With separate test-data authorization, run real staging buyer/seller/admin/support, private Storage, session/reconnect and disabled-provider acceptance. Compare preservation inventories; stop on failures. No real email, push or payment processing.
6. Pages/merge/production remain separate: build/review the Pages artifact locally, preserve staging noindex and PR #36 dependency, and follow `TRISOCMD_RELEASE_READINESS.md`. Do not push/merge to `main` or dispatch the Pages workflow as a backend test. Separate production schema/Auth, provider/sender/OAuth/VAPID/scheduler and content gates remain in `TRISOCMD_EXTERNAL_DEPENDENCIES.md`.

No paid resource, hosted migration/restore, function deployment, customer-data change, merge or provider activation was performed. Production readiness is not established by these isolated tests.
