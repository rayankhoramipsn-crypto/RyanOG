"""Owner-operated PostgreSQL 17 recovery drill. Never connects to hosted services.
All archive contents, SQL output and diagnostics stay in a new private directory.
"""
import argparse
from contextlib import nullcontext
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = [
    '20261108214609_phase1_checkout.sql',
    '20261110201622_marketplace_browse_page.sql',
    '20261110204751_staging_integration_authorization.sql',
    '20261111181536_marketplace_workflows.sql',
    '20261111185818_notifications_email_support.sql',
    '20261111200640_storefront_content.sql',
]
FINGERPRINTS = {
    'columns': (184, '03a28dc752050159989ca67326de9053'),
    'constraints': (138, '016eb29a5a5b15472dc1e18315b3b99c'),
    'policies': (56, 'd54a3d2ea41257c7e04f3c9ce549340d'),
    'functions': (21, '87082b22af6983676cc61e4079e627be'),
}
# NOLOGIN compatibility roles, not hosted credentials or platform stand-ins.
ROLES = ['anon', 'authenticated', 'service_role', 'authenticator', 'supabase_admin',
         'supabase_auth_admin', 'supabase_storage_admin', 'supabase_functions_admin',
         'supabase_read_only_user', 'dashboard_user', 'pgbouncer']

class DrillError(Exception):
    pass


def private_path(value):
    p = Path(value).expanduser().resolve()
    if any((parent / '.git').exists() for parent in [p, *p.parents]):
        raise DrillError('Private files must be outside every Git checkout.')
    return p


def docker_endpoint(value):
    allowed = ['unix:///var/run/docker.sock', 'unix:///run/codex-docker/docker.sock',
               'npipe:////./pipe/docker_engine', 'npipe:////./pipe/dockerDesktopLinuxEngine']
    if value not in allowed:
        raise DrillError('Only an explicit local Docker socket is accepted.')
    return value


def migration_sql():
    parts, hashes = [], {}
    actual = sorted(p.name for p in (ROOT / 'supabase/migrations').glob('*.sql'))
    if actual != MIGRATIONS:
        raise DrillError('Migration inventory changed; review before this recovery drill.')
    for name in MIGRATIONS:
        data = (ROOT / 'supabase/migrations' / name).read_bytes()
        source = data.decode('utf-8')
        # Match only outer standalone wrappers; preserve function-body BEGIN/END.
        if bool(re.search(r'^BEGIN;[ \t]*$', source, re.M)) != bool(re.search(r'^COMMIT;[ \t]*$', source, re.M)):
            raise DrillError('Migration transaction wrapper requires review.')
        source = re.sub(r'^BEGIN;[ \t]*$', '', source, count=1, flags=re.M)
        source = re.sub(r'^COMMIT;[ \t]*$', '', source, count=1, flags=re.M)
        parts.append(source)
        hashes[name] = hashlib.sha256(data).hexdigest()
    return 'BEGIN;\n' + '\n'.join(parts) + '\nROLLBACK;\n', hashes


def validate_inventory(inventory):
    if set(inventory['fingerprints']) != set(FINGERPRINTS):
        raise DrillError('Incomplete schema fingerprint inventory.')
    for key, (count, digest) in FINGERPRINTS.items():
        if inventory['fingerprints'][key] != {'objects': count, 'fingerprint': digest}:
            raise DrillError('Restored schema differs from the reviewed staging baseline.')
    if inventory['public_tables'] != 27 or inventory['without_rls'] != 0:
        raise DrillError('Restored table/RLS inventory differs from baseline.')
    if inventory['history_count'] != 25 or inventory['history_latest'] != '20261106131852':
        raise DrillError('Foundation migration history differs; do not repair or replay it.')
    if any(inventory['missing_auth'].values()):
        raise DrillError('Restored Auth relationships require review.')


def inventory_sql():
    preflight = (ROOT / 'docs/release-preflight.sql').read_text()
    fingerprints = preflight[preflight.index("SELECT 'columns'"):preflight.index('SELECT count(*) AS public_tables_without_rls')].strip().rstrip(';')
    # Fail if any required schema/table is absent. No synthetic Auth/Storage tables.
    return '''BEGIN TRANSACTION READ ONLY;
SELECT json_build_object(
 'fingerprints', (SELECT json_object_agg(component,json_build_object('objects',objects,'fingerprint',fingerprint)) FROM (''' + fingerprints + ''') f),
 'public_tables',(SELECT count(*) FROM pg_tables WHERE schemaname='public'),
 'without_rls',(SELECT count(*) FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity),
 'history_count',(SELECT count(*) FROM supabase_migrations.schema_migrations),
 'history_latest',(SELECT max(version) FROM supabase_migrations.schema_migrations),
 'auth_users',(SELECT count(*) FROM auth.users),
 'auth_identities',(SELECT count(*) FROM auth.identities),
 'auth_sessions',(SELECT count(*) FROM auth.sessions),
 'storage_objects',(SELECT count(*) FROM storage.objects),
 'storage_buckets',(SELECT count(*) FROM storage.buckets),
 'missing_auth',json_build_object(
  'orders',(SELECT count(*) FROM public.tc42_orders o WHERE NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=o.customer_id)),
  'listings',(SELECT count(*) FROM public.market_listings l WHERE NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=l.seller_id)),
  'support',(SELECT count(*) FROM public.tc42_support_threads t WHERE NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=t.customer_id)),
  'legacy_support',(SELECT count(*) FROM public.support_tickets t WHERE NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=t.user_id)),
  'identities',(SELECT count(*) FROM auth.identities i WHERE NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=i.user_id)),
  'sessions',(SELECT count(*) FROM auth.sessions s WHERE NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=s.user_id)),
  'requests',(SELECT count(*) FROM public.market_purchase_requests r WHERE NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=r.buyer_id) OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=r.seller_id)))
);
COMMIT;
'''


def run_drill(backup, output, image, endpoint, check_migrations=False):
    backup, output = private_path(backup), private_path(output)
    if not backup.is_file():
        raise DrillError('Expected a local PostgreSQL custom-format archive (PGDMP).')
    with backup.open('rb') as f:
        if f.read(5) != b'PGDMP':
            raise DrillError('Expected a local PostgreSQL custom-format archive (PGDMP).')
        f.seek(0)
        original_digest = hashlib.file_digest(f, 'sha256').hexdigest()
    endpoint = docker_endpoint(endpoint)
    output.mkdir(mode=0o700)  # New only. Never overwrite existing evidence.
    name = 'trisocmd-recovery-' + uuid.uuid4().hex
    docker = ['docker', '--host', endpoint]
    log = (output / 'private-diagnostics.log').open('xb')
    created = False

    def call(args, data=None, required=True, archive=False):
        with backup.open('rb') if archive else nullcontext(None) as source:
            p = subprocess.run(docker + args, input=data, stdin=source, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, check=False)
        log.write(p.stderr)
        log.flush()
        if p.returncode and required:
            log.write(p.stdout)
            log.flush()
            raise DrillError('Recovery command failed; inspect diagnostics privately. No pass is recorded.')
        return p

    def sql(source):
        return call(['exec', '-i', name, 'psql', '-X', '-qAt', '--no-password',
                     '-h', '/tmp', '-U', 'postgres', '-d', 'triso_recovery',
                     '-v', 'ON_ERROR_STOP=1'], source.encode()).stdout

    try:
        # Resolve an already-installed image to immutable ID. No implicit pulls.
        image_id = call(['image', 'inspect', image, '--format', '{{.Id}}']).stdout.decode().strip()
        if not re.fullmatch(r'sha256:[a-f0-9]{64}', image_id):
            raise DrillError('Expected an immutable local image ID.')
        # No entrypoint hooks, API services, network, published ports or persistent DB volume.
        startup = ('initdb -D /recovery/db -A trust -U postgres >/tmp/init.log 2>&1 && '
                   'exec postgres -D /recovery/db -c listen_addresses= '
                   '-c unix_socket_directories=/tmp -c wal_level=logical '
                   '-c logging_collector=off -c log_statement=none')
        call(['run', '--detach', '--pull=never', '--name', name, '--network', 'none',
              '--log-driver', 'none', '--read-only', '--user', 'postgres',
              '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
              '--tmpfs', '/recovery:rw,nosuid,mode=1777', '--tmpfs', '/tmp:rw,nosuid,mode=1777',
              '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,mode=1777',
              '--entrypoint', '/bin/sh', image_id, '-c', startup])
        created = True
        for _ in range(60):
            if call(['exec', name, 'pg_isready', '-h', '/tmp', '-U', 'postgres'], required=False).returncode == 0:
                break
            time.sleep(1)
        else:
            raise DrillError('Isolated PostgreSQL did not start; image compatibility requires review.')
        state = json.loads(call(['inspect', name]).stdout)[0]
        if (state['HostConfig']['NetworkMode'] != 'none' or state['HostConfig'].get('PortBindings')
                or not state['HostConfig']['ReadonlyRootfs']
                or state['HostConfig']['LogConfig']['Type'] != 'none'
                or any(m['Type'] != 'tmpfs' for m in state['Mounts'])):
            raise DrillError('Container isolation verification failed.')
        version = call(['exec', name, 'pg_restore', '--version']).stdout.decode()
        if not re.search(r'PostgreSQL\) 17\.', version):
            raise DrillError('PostgreSQL 17 tools are required.')
        call(['exec', name, 'psql', '-X', '-q', '-h', '/tmp', '-U', 'postgres', '-d', 'postgres',
              '-v', 'ON_ERROR_STOP=1', '-c', 'CREATE DATABASE triso_recovery TEMPLATE template0'])
        sql(''.join(f'CREATE ROLE {r} NOLOGIN' + (' BYPASSRLS' if r == 'service_role' else '') + ';\n' for r in ROLES))
        toc = call(['exec', '-i', name, 'pg_restore', '--list'], archive=True).stdout
        (output / 'private-archive-list.txt').write_bytes(toc)
        call(['exec', '-i', name, 'pg_restore', '--no-password', '--exit-on-error', '--single-transaction',
              '--no-owner', '--host=/tmp', '--username=postgres', '--dbname=triso_recovery'], archive=True)
        if sql('SHOW server_version_num;').strip()[:2] != b'17':
            raise DrillError('PostgreSQL 17 server is required.')
        before = json.loads(sql(inventory_sql()))
        (output / 'private-inventory.json').write_text(json.dumps(before, indent=2) + '\n')
        validate_inventory(before)
        # Full per-table row counts stay private and can be compared with the owner's source inventory.
        counts = sql("SELECT format('SELECT %L AS relation,count(*) FROM %I.%I;',schemaname||'.'||tablename,schemaname,tablename) FROM pg_tables WHERE schemaname IN ('public','auth','storage','supabase_migrations') ORDER BY schemaname,tablename;")
        original_counts = sql(counts.decode())
        (output / 'private-row-counts.txt').write_bytes(original_counts)
        # Needed to reconcile the separate object copy; contains private names, never print.
        buckets = sql("SELECT coalesce(json_agg(json_build_object('id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) ORDER BY id),'[]') FROM storage.buckets;")
        (output / 'private-storage-buckets.json').write_bytes(buckets)
        objects = sql("SELECT coalesce(json_agg(json_build_object('bucket_id',bucket_id,'name',name,'metadata',metadata) ORDER BY bucket_id,name),'[]') FROM storage.objects;")
        (output / 'private-storage-objects.json').write_bytes(objects)
        hashes = None
        if check_migrations:
            source, hashes = migration_sql()
            sql(source)  # One local transaction, always rolled back on success.
            if json.loads(sql(inventory_sql())) != before or sql(counts.decode()) != original_counts:
                raise DrillError('Migration rollback did not preserve baseline inventory.')
        with backup.open('rb') as f:
            digest = hashlib.file_digest(f, 'sha256').hexdigest()
        if digest != original_digest:
            raise DrillError('Source archive changed during recovery drill.')
        report = {'local_restore': 'passed', 'network': 'none', 'image_id': image_id,
                  'archive_sha256': digest, 'baseline_validation': 'passed',
                  'migration_transaction_rollback': 'passed' if check_migrations else 'not_run',
                  'migration_sha256': hashes,
                  'source_inventory_comparison': 'owner_required',
                  'storage_binary_recovery': 'not_verified',
                  'hosted_acceptance': 'not_run',
                  'ownership_and_role_logins': 'normalized_local_only_no_owner_nologin_roles'}
        (output / 'result.json.partial').write_text(json.dumps(report, indent=2) + '\n')
    finally:
        if created:
            # Remove only the unique container this invocation created, including anonymous volumes.
            p = call(['rm', '--force', '--volumes', name], required=False)
            if p.returncode:
                log.close()
                raise DrillError('Local container cleanup failed; remove the uniquely named recovery container privately.')
        log.close()
    (output / 'result.json.partial').rename(output / 'result.json')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backup', required=True)
    parser.add_argument('--out', required=True, help='New private directory outside all Git checkouts')
    parser.add_argument('--image', default='postgres:17.11-bookworm', help='Already installed, trusted PG17 image')
    parser.add_argument('--docker-host', default='npipe:////./pipe/dockerDesktopLinuxEngine' if os.name == 'nt' else 'unix:///var/run/docker.sock')
    parser.add_argument('--check-migrations', action='store_true', help='Apply all six ONLY inside local transaction, then ROLLBACK')
    args = parser.parse_args()
    os.umask(0o077)
    try:
        run_drill(args.backup, args.out, args.image, args.docker_host, args.check_migrations)
        print('PASS: isolated local restore/baseline checks. Review private results and remaining recovery gates.')
        return 0
    except (DrillError, OSError, ValueError, KeyError, TypeError) as exc:
        # Never print arbitrary exceptions, subprocess output, customer rows or paths.
        print(str(exc) if isinstance(exc, DrillError) else 'Recovery stopped; verify private inputs and local Docker availability.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
