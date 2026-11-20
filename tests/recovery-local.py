"""PG17 Docker integration for recovery runner; generated synthetic archive only.
Run explicitly: python3 tests/recovery-local.py. No credential or hosted target.
"""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import time
import uuid

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('drill',ROOT/'scripts/restore-staging-backup.py')
drill=importlib.util.module_from_spec(spec);spec.loader.exec_module(drill)
IMAGE='postgres:17.11-bookworm@sha256:665dc7b37ac52a17e298511414c21d23ffa4e6a6ef6225b3e5d59c7afb35e994'
endpoint='unix:///var/run/docker.sock'
docker=['docker','--host',endpoint]
name='trisocmd-synthetic-source-'+uuid.uuid4().hex

def call(args,data=None):
    p=subprocess.run(docker+args,input=data,capture_output=True)
    if p.returncode:
        raise RuntimeError('Synthetic fixture Docker command failed: '+p.stderr.decode()[:1000])
    return p.stdout

with tempfile.TemporaryDirectory(prefix='triso-recovery-synthetic-') as d:
    directory=Path(d)
    try:
        call(['run','--detach','--pull=never','--name',name,'--network','none','--log-driver','none',
              '-e','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE,'-c','listen_addresses=', '-c','wal_level=logical'])
        for _ in range(60):
            p=subprocess.run(docker+['exec',name,'pg_isready','-U','postgres'],capture_output=True)
            if p.returncode==0:break
            time.sleep(1)
        def sql(s):
            return call(['exec','-i',name,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],s.encode())
        for f in ['staging-platform.sql','staging-public.sql','staging-storage.sql','staging-realtime.sql']:
            sql((ROOT/'tests/fixtures'/f).read_text())
        sql("""CREATE TABLE auth.identities(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id));
ALTER TABLE storage.objects ADD COLUMN metadata jsonb;
CREATE SCHEMA supabase_migrations;
CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[]);
INSERT INTO supabase_migrations.schema_migrations(version) SELECT '20260101'||lpad(i::text,6,'0') FROM generate_series(1,24)i;
INSERT INTO supabase_migrations.schema_migrations(version) VALUES('20261106131852');
INSERT INTO auth.users(id,email) VALUES('11111111-1111-4111-8111-111111111111','synthetic@example.test');
INSERT INTO auth.identities(id,user_id) VALUES(gen_random_uuid(),'11111111-1111-4111-8111-111111111111');
INSERT INTO storage.buckets(id,name,public) VALUES('market-gallery','market-gallery',false);
INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('market-gallery','synthetic.webp','{"size":10}');
""")
        backup=directory/'synthetic.dump'
        backup.write_bytes(call(['exec',name,'pg_dump','-U','postgres','-Fc','postgres']))
        result=drill.run_drill(backup,directory/'proof',IMAGE,endpoint,True)
        assert result['migration_transaction_rollback']=='passed'
        assert json.loads((directory/'proof/private-inventory.json').read_text())['auth_users']==1
        print('PASS: PG17 full custom archive restore, baseline/Auth/Storage/history validation and six-migration rollback')
        invalid=directory/'corrupt.dump';invalid.write_bytes(b'PGDMP'+b'\x00'*100)
        try:
            drill.run_drill(invalid,directory/'failed',IMAGE,endpoint)
        except drill.DrillError:
            assert not (directory/'failed/result.json').exists()
        else:raise AssertionError('Corrupt archive accepted')
        names=call(['ps','-a','--format','{{.Names}}']).decode().splitlines()
        assert not any(n.startswith('trisocmd-recovery-') for n in names)
        print('PASS: corrupt archive fails closed, no success proof, isolated recovery containers cleaned up')
    except Exception:
        # Synthetic data ONLY: safe developer diagnostics. Never use this test with owner files.
        for p in directory.rglob('private-diagnostics.log'):
            print(p.read_text()[-5000:])
        raise
    finally:
        call(['rm','--force','--volumes',name])
