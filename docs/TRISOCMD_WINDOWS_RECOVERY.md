# Windows staging recovery drill — owner-operated, local only

Updated 2026-11-20 (Asia/Tehran). Source target: **TRISO TEST `cxtytbjvdlngahytfilr` only**. PR #37 preserves PR #36. No hosted restore, migration, function deployment, merge or provider activation is authorized here.

The owner reports a PostgreSQL 17 custom-format backup, successful `pg_restore --list` and local public-data extraction. This is progress beyond the previous access blocker, but **full database/Auth/Storage recovery, encryption/off-site retention and binary object recovery remain unverified**. Keep the archive on the owner's machine; do not upload it or private diagnostics for review.

## Prerequisites and isolation

Use Windows PowerShell 5.1 or PowerShell 7, Python **3.11+**, and local Docker Desktop in **Linux containers** mode. No hosted or paid database is needed. Use a local BitLocker/encrypted volume outside every Git checkout, OneDrive, cloud-synced folders and CI. Restrict its Windows ACL to the owner and SYSTEM. Shell transcripts, terminal recording and cloud backup of plaintext must be off. Docker Desktop/WSL swap or crash dumps may persist RAM: its disk, swap and the host must also be protected. Allow enough Docker RAM for the decompressed database; the drill uses tmpfs and never adds a persistent database volume.

Keep the original archive unchanged. Use a backup known to originate from the stated staging project; a dump by itself cannot cryptographically prove the originating project. Obtain the trusted PG17 image **before** loading private data. The test used `postgres:17.11-bookworm` (registry digest `sha256:665dc7b37ac52a17e298511414c21d23ffa4e6a6ef6225b3e5d59c7afb35e994`); it is a compatibility probe, not a full Supabase platform distribution. Managed extensions absent from this image must cause failure, not be excluded from the dump. Use an owner-reviewed PG17 image with matching installed extensions if needed; the runner overrides its entrypoint, requires `postgres` OS user and `initdb`/`postgres`/`psql`/`pg_restore` on PATH, and initializes a new cluster. Do not install extensions into hosted staging for this test.

## Exact PowerShell restore instructions

Run from the reviewed repository checkout. Paths below are examples; select a new private folder and the existing owner archive. No hosted URL, password, token, `PGSERVICE`, database port or linked Supabase workdir is supplied to the runner.

```powershell
$ErrorActionPreference = 'Stop'
$PrivateRoot = 'D:\TRISOCMD-Private'
$Backup = 'D:\TRISOCMD-Private\triso-test.dump'
$Proof = Join-Path $PrivateRoot ('restore-proof-' + [guid]::NewGuid().ToString('N'))
$DockerHost = 'npipe:////./pipe/dockerDesktopLinuxEngine'
$Image = 'postgres:17.11-bookworm@sha256:665dc7b37ac52a17e298511414c21d23ffa4e6a6ef6225b3e5d59c7afb35e994'
# PrivateRoot must already be an encrypted, owner-restricted, non-synced directory.
if (-not (Test-Path -LiteralPath $PrivateRoot -PathType Container)) { throw 'Prepare the private encrypted directory first.' }
if (-not (Test-Path -LiteralPath $Backup -PathType Leaf)) { throw 'Local archive not found.' }
py -3 --version
if ($LASTEXITCODE -ne 0) { throw 'Install Python 3.11 or newer.' }
docker --host $DockerHost info --format '{{.OSType}}'
if ($LASTEXITCODE -ne 0) { throw 'Start local Docker Desktop Linux engine.' }
# This downloads public software only. The restore runner never pulls images.
docker --host $DockerHost pull $Image
if ($LASTEXITCODE -ne 0) { throw 'Trusted local PG17 image unavailable.' }
py -3 .\scripts\restore-staging-backup.py --backup $Backup --out $Proof --image $Image --docker-host $DockerHost --check-migrations
if ($LASTEXITCODE -ne 0) { throw 'Recovery NOT verified. Inspect private diagnostics locally; do not paste them into chat.' }
```

If that named pipe does not exist, use the other permitted **local** Docker Desktop pipe, `npipe:////./pipe/docker_engine`, only after confirming it is the Linux engine. Remote Docker contexts, TCP and SSH endpoints are refused. Do not replace it with a hosted DB connection. No manual `createdb`, host `pg_restore`, `db reset`, `db push`, `migration repair`, or hosted `backups restore` command is needed.

The Python runner handles binary stdin, so PowerShell never pipes binary backup bytes or redirects `pg_dump` output through text encoding. It resolves the installed image to an immutable ID and creates only a random `trisocmd-recovery-*` container. Network is `none`, no ports/host paths are mounted, root filesystem is read-only, PostgreSQL listens only on its Unix socket, Docker logs are disabled, and no API/SMTP/worker/cron service starts. It streams the archive into `pg_restore --exit-on-error --single-transaction --no-owner`; any restore error fails the drill. A small explicit set of NOLOGIN Supabase role names is created only in the disposable cluster so ACL references can restore. No hosted roles, users, passwords or role SQL are replayed.

**`--no-owner` normalizes restored ownership to local postgres.** This checks archive/data/schema recovery and migration compatibility, not hosted owner equivalence, role memberships, Auth login, API/Storage authorization or RLS application behavior. Do not treat local compatibility roles as Supabase platform stand-ins. No fake Auth/Storage schema is injected. Required extensions, unknown roles, absent Auth/Storage/migration schemas or a PostgreSQL version mismatch stop the workflow.

On success the runner deletes only its own random container and produces private files under `$Proof`:

- `result.json`: restore/baseline and optional six-migration transaction/rollback result, archive SHA-256, immutable image ID and migration hashes. It still marks source comparison and Storage binary recovery as outstanding.
- `private-inventory.json`, `private-row-counts.txt`: schema fingerprints, 25-entry history and counts/relationships. Compare with the owner's same-backup-time source inventory/extraction, including **every** public/Auth/Storage table; do not force old record counts if legitimate activity changed them.
- `private-storage-buckets.json`, `private-storage-objects.json`: bucket configuration and object metadata for separate binary recovery. These contain private names; never publish them.
- `private-archive-list.txt`, `private-diagnostics.log`: confidential archive/restore diagnostics. Do not paste raw errors or lists into an issue or chat.

The six migration scripts run only inside the disposable restored database in one transaction followed by **ROLLBACK**; no migration history is repaired or stamped. Baseline fingerprints and counts must still match afterwards. `result.json` exists only after all requested checks and container cleanup succeed. A `.partial` result, an archive listing alone, public extraction alone or a failed restore is not acceptance. If Docker itself fails during cleanup, remove only the identified drill container after reviewing private diagnostics; never prune unrelated containers/volumes.

## Separate Storage backup — all buckets, metadata plus bytes

A PostgreSQL dump contains Storage metadata, **not object bytes**. Previously observed staging had private `market-gallery`, three objects, 5 MB JPEG/PNG/WebP limits; those are dated observations. Migration six adds public `content-media` for marketing assets. Inventory **all current buckets**, including empty buckets and any additions; never limit backup to three files or make private buckets public for download.

Coordinate a stable no-write window with the owner for database and Storage copying. If objects changed since the dump, arrange a fresh consistent database export plus object copy; do not claim an old DB/current objects pair is consistent. Preserve bucket settings, MIME/cache metadata, object keys and sizes, RLS/policies, and grant/role information. Record download-time start/end inventories privately and compare them; for independently verified byte identity, compare trusted original/download hashes or repeat downloads during the stable window. An ETag is not generally a SHA-256 (multipart uploads can differ).

Use **existing authorized** Storage access configured privately in the owner's CLI profile or protected environment, not a token in command arguments/history. CLI `2.122.1` help confirms remote-to-local `storage cp --recursive --project-ref`; scoped-token permissions may need `api_gateway_keys_read` and `api_gateway_keys_secret_read`. `backups_read` alone cannot download private objects. If access is absent, stop the download at that blocker; do not change policies or expose keys. The local restore runner requires no Storage credential.

After a successful restore, from the repository checkout with `npm ci` already completed:

```powershell
$Files = Join-Path $PrivateRoot ('storage-files-' + [guid]::NewGuid().ToString('N'))
$Manifest = Join-Path $PrivateRoot ('storage-manifest-' + [guid]::NewGuid().ToString('N') + '.json')
New-Item -ItemType Directory -Path $Files | Out-Null
$Buckets = @(Get-Content -LiteralPath (Join-Path $Proof 'private-storage-buckets.json') -Encoding UTF8 -Raw | ConvertFrom-Json)
foreach ($Bucket in $Buckets) {
    $Id = [string]$Bucket.id
    if ($Id -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*$') { throw 'Bucket key needs private operator review.' }
    $Destination = Join-Path $Files $Id
    New-Item -ItemType Directory -Path $Destination | Out-Null
    & .\node_modules\.bin\supabase.cmd storage cp --recursive --project-ref cxtytbjvdlngahytfilr ('ss:///' + $Id) $Destination *> (Join-Path $PrivateRoot 'storage-download-private.log')
    if ($LASTEXITCODE -ne 0) { throw 'Private Storage download failed; stop and inspect locally.' }
}
py -3 .\scripts\storage-backup-manifest.py --objects (Join-Path $Proof 'private-storage-objects.json') --files $Files --manifest $Manifest
if ($LASTEXITCODE -ne 0) { throw 'Object inventory/size verification failed.' }
```

Check the pinned CLI's local directory layout privately: the verifier requires `<Files>/<bucket>/<exact-object-key>` and rejects missing/extra files or a nested duplicate bucket prefix. Do not rename original keys or ignore mismatches. If the CLI cannot represent case-colliding, reserved Windows or other unsafe names, stop and use an owner-reviewed opaque-key export preserving original keys in encrypted metadata (no such export is claimed here). Symbolic links, traversal, duplicates, missing sizes and case collisions fail closed. Empty bucket configuration remains in the DB/bucket inventory even if no directory is copied.

The verifier computes per-object SHA-256 without network access or printing names. Keep its manifest **outside** `$Files` but inside the protected package. Its size/set checks compare to the restored DB metadata; they cannot detect a same-size replacement without a trusted earlier hash/consistent source. Download CLI hosted acceptance is **not** proven by our offline synthetic tests.

## Encrypt, retain separately, and prove recovery

Use an independently verified owner GPG recipient with a separately retained private recovery key. Do not generate an unescrowed recovery key. Place copies of the DB archive, proof, manifest, Storage files, current Edge source/config, Auth redirect/provider/SMTP configuration and reviewed role/grant inventory into a **new protected package directory**. Runtime secrets belong in the owner's secret manager; no plaintext credentials in scripts or PRs. The backup itself may contain password hashes and sessions.

The following avoids PowerShell binary pipelines. `$Package` and `$RecoveredPackage` are new private directories outside Git; `$Encrypted` and `$Tar` are new filenames on the encrypted volume. Set `$Recipient` to the independently verified **public fingerprint**, never a private key or password. Both tar and GPG exit codes are mandatory:

```powershell
# Owner sets Package, Tar, Encrypted, Recipient, RecoveryTar, RecoveredPackage privately.
if ((Test-Path -LiteralPath $Tar) -or (Test-Path -LiteralPath $Encrypted)) { throw 'Use fresh output files.' }
tar.exe -cf $Tar -C $Package .
if ($LASTEXITCODE -ne 0) { throw 'Private package creation failed.' }
gpg --batch --encrypt --cipher-algo AES256 --recipient $Recipient --output ($Encrypted + '.partial') $Tar
if ($LASTEXITCODE -ne 0) { throw 'Encryption failed; partial output is not a backup.' }
Move-Item -LiteralPath ($Encrypted + '.partial') -Destination $Encrypted
(Get-FileHash -Algorithm SHA256 -LiteralPath $Encrypted).Hash | Set-Content -LiteralPath ($Encrypted + '.sha256') -Encoding ascii
# Copy ciphertext + checksum to separate owner-controlled storage; compare hashes there.
# Prove decryption with the separately retained recovery key; allow local GPG pinentry.
if ((Test-Path -LiteralPath $RecoveryTar) -or (Test-Path -LiteralPath $RecoveredPackage)) { throw 'Use fresh recovery paths.' }
gpg --output $RecoveryTar --decrypt $Encrypted
if ($LASTEXITCODE -ne 0) { throw 'Recovery decryption failed.' }
New-Item -ItemType Directory -Path $RecoveredPackage | Out-Null
tar.exe -xf $RecoveryTar -C $RecoveredPackage
if ($LASTEXITCODE -ne 0) { throw 'Private recovery extraction failed.' }
```

Extract only the archive just created from the owner's trusted package. Re-run the restore runner on the **decrypted recovered DB dump**, and `storage-backup-manifest.py --verify` on recovered files using the recovered object metadata and original manifest. This verifies recovery from retained ciphertext rather than merely a plaintext source. Keep decryption/extraction and diagnostics local; retain ciphertext and the separate recovery key, and retire plaintext working copies under the owner's encrypted-volume policy. Do not claim secure deletion of SSD/swap files from a simple remove command.

Share only sanitized pass/fail, archive hash, tested image/version, migration hash mapping, source-count comparison result, object hash verification result and recovery date. Keep keys, paths, object names, customer/Auth rows and raw diagnostics private. Even a successful drill does not authorize hosted migrations. See [release preparation status](TRISOCMD_RELEASE_PREPARATION.md) for the next approval boundary.
