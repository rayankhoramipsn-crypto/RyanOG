# Staging backup and recovery prerequisite

2026-11-12 (Asia/Tehran). **Backup preparation/export and a free isolated restore are authorized. Hosted migrations, deployments and restores are not.** Target only `TRISO TEST / cxtytbjvdlngahytfilr`.

## Result: blocked by access, not authorization

The project is `ACTIVE_HEALTHY`, PostgreSQL `17.11.0.003`. This environment has no configured hosted database connection/password/service profile, privileged private-Storage credential, Supabase CLI access token or designated owner recovery-encryption recipient. Checks inspected presence only; no credential values or customer rows were read into diagnostics. `supabase backups list --project-ref cxtytbjvdlngahytfilr --output json` again failed with “Access token not provided”.

The authorized SQL connector can inspect the database, but returned exports would pass through tool result records. That is not an acceptable channel for this task's customer/Auth data or backup content. A local test instance's credentials are not credentials for hosted staging. No encrypted backup was created, no Storage objects were copied, and no hosted-data restore/integrity proof exists. Previous schema-fixture/rollback tests do not satisfy this gate.

Free local compute and PostgreSQL 17.11 dump/restore tools are available through the existing disposable Docker environment; GPG is installed. No paid resource is required or was created. The missing credentials and owner recovery-key arrangement prevent proceeding securely.

## Owner action: configure secure access, or run the export privately

Supply through protected environment/credential files **outside the checkout**, never chat/PRs/CI logs:

- A PostgreSQL service profile and mode-0600 password file for the **staging** database with permission to read the database's application, Auth, Storage and migration metadata. Use the project's Connect settings; direct host is `db.cxtytbjvdlngahytfilr.supabase.co`. If IPv4 needs a session pooler, use the exact Dashboard host and `postgres.cxtytbjvdlngahytfilr` project-qualified user. Verify TLS/CA and project identity; do not disable remote TLS or use production credentials.
- Authorized private Storage download access. The installed CLI's `storage cp --help` supports `--project-ref` and recursive downloads; scoped-token permissions may require `api_gateway_keys_read` plus `api_gateway_keys_secret_read`. A `backups_read` token lists physical backups but does not by itself authorize a database/object export. Use least-privilege access or an owner-operated export; do not broaden credentials blindly.
- An owner-verified GPG public-key fingerprint and public key on the backup machine, with the corresponding private recovery key retained separately under owner control. Do not generate an unescrowed key and claim recoverability. Recovery testing needs owner-side decryption or a securely configured decryption capability; never send private keys/passwords in chat.
- A private encrypted filesystem for any temporary files and a separate owner-controlled location for the final ciphertext. Do not use the repository, GitHub artifacts or shared logs. Coordinate a no-write window so database and object copies describe the same recovery point; this authorization does not permit disabling accounts or changing hosted policies.

### Exact private export recipe (owner-operated alternative)

These are instructions, not commands executed against staging in this task. Use PostgreSQL 17 tools, the reviewed service profile, a trusted recipient and a new backup directory. Run interactively on the owner's protected machine, **not in CI**, with shell tracing/terminal recording disabled. `PGSERVICEFILE` and `PGPASSFILE` refer to protected files; do not put a database URL/password/token in command arguments or shell history.

```bash
set +x
set -euo pipefail
umask 077
# Owner sets PGSERVICEFILE, PGPASSFILE, PRIVATE_BACKUP_ROOT and
# BACKUP_GPG_FINGERPRINT securely; recipient fingerprint is verified independently.
export PGSERVICE=trisocmd_staging
BACKUP_DIR="$(mktemp -d "$PRIVATE_BACKUP_ROOT/trisocmd-staging-XXXXXXXX")"
pg_dump --no-password --format=custom --dbname='service=trisocmd_staging' 2>/dev/null |
  gpg --batch --encrypt --cipher-algo AES256 --recipient "$BACKUP_GPG_FINGERPRINT" \
      --output "$BACKUP_DIR/database.dump.gpg.partial"
mv "$BACKUP_DIR/database.dump.gpg.partial" "$BACKUP_DIR/database.dump.gpg"
pg_dumpall --no-password --roles-only --no-role-passwords \
  --dbname='service=trisocmd_staging' 2>/dev/null |
  gpg --batch --encrypt --cipher-algo AES256 --recipient "$BACKUP_GPG_FINGERPRINT" \
      --output "$BACKUP_DIR/roles.sql.gpg.partial"
mv "$BACKUP_DIR/roles.sql.gpg.partial" "$BACKUP_DIR/roles.sql.gpg"
```

The full archive must include application data, `auth` identities/users and required metadata, `storage` metadata, grants/policies/functions/triggers and `supabase_migrations` history. Do not silently omit restricted schemas if export fails. Role passwords are deliberately excluded from the separate role inventory; required runtime credentials/configuration belong in the owner's secret manager. Any `.partial` output is unverified; do not count it as a completed backup.

For binary objects, make `SCRATCH` a fresh directory on the private encrypted filesystem. With the authorized CLI profile/token configured securely, download from the remote source to the local destination only:

```bash
SCRATCH="$(mktemp -d "$PRIVATE_BACKUP_ROOT/trisocmd-objects-XXXXXXXX")"
mkdir "$SCRATCH/objects"
supabase storage cp --recursive --project-ref cxtytbjvdlngahytfilr \
  ss:///market-gallery "$SCRATCH/objects" >/dev/null 2>/dev/null
# Privately record each relative object name, byte count and SHA-256 in SCRATCH.
# Compare the complete object set with the same-point-in-time Storage metadata.
tar -C "$SCRATCH" -cf - . |
  gpg --batch --encrypt --cipher-algo AES256 --recipient "$BACKUP_GPG_FINGERPRINT" \
      --output "$BACKUP_DIR/storage.tar.gpg.partial"
mv "$BACKUP_DIR/storage.tar.gpg.partial" "$BACKUP_DIR/storage.tar.gpg"
sha256sum "$BACKUP_DIR/database.dump.gpg" "$BACKUP_DIR/roles.sql.gpg" \
  "$BACKUP_DIR/storage.tar.gpg" > "$BACKUP_DIR/SHA256SUMS"
```

The last verified inventory contained three private objects; re-inventory at export time rather than assuming that count is permanent. Record per-object hashes/lengths in the encrypted archive and compare them after decryption. The CLI download must not upload/delete/change hosted objects. Save current Edge source/config and required Auth/redirect/SMTP settings privately as well. Database backups do **not** contain Storage object bytes or all external runtime configuration; see [Supabase backups](https://supabase.com/docs/guides/platform/backups).

## Required isolated recovery proof

1. Verify ciphertext hashes at the owner-controlled destination, then prove decryption with the retained recovery key. Send decrypted bytes directly into local tooling or the private encrypted filesystem; never to chat, terminal output or shared logs. Auth data, role SQL, object manifests and errors may contain sensitive information.
2. Inspect the archive privately (`gpg --decrypt … | pg_restore --list`) and confirm required schemas/objects and metadata are present. This is integrity inspection, not a successful restore. Do not publish the archive listing.
3. Use a **new, empty** disposable local PostgreSQL 17/Supabase environment with matching required extensions/roles, loopback-only access and outbound email/payment/functions/schedules disabled. Do not use an existing QA database or a hosted project. Review role inventory; do not replay managed/superuser role SQL blindly.
4. Restore the full archive with `pg_restore --exit-on-error --single-transaction --no-owner` against the explicit local target. Specify loopback host and the new disposable database explicitly; do not inherit the staging `PGSERVICE`. Keep all output confidential; stop on any restore error or schema/role incompatibility. Do not drop constraints, skip Auth tables or use a production/hosted connection to make a restore pass. Raw role/extension compatibility must be checked with the actual archive; it has not been verified here.
5. Compare full table counts and relationships, the known public-schema fingerprints, 25-entry migration history, Auth identities, RLS/grants/functions and Storage metadata. Decrypt the separate object archive privately and verify every object's name, length and hash. Where applicable, exercise the restored Auth/Storage/RLS using isolated synthetic actors, never real customer passwords or live providers.
6. Retain the encrypted backups and separate recovery key off the disposable machine, with a dated restore result. Share only sanitized pass/fail/count/hash evidence. Do not upload backups, Auth rows, private files, raw error logs or keys to PR #37.

**Migration gate stays closed until real backup and isolated recovery evidence pass.** Existing authorization permits this backup work once access/key prerequisites are supplied; there is no need to ask for the same backup permission again. Migration/deployment approval remains separate and has not been granted.
