"""Safety regressions; synthetic metadata only, no hosted access or private artifacts."""
import copy
import importlib.util
from pathlib import Path
import tempfile
import json
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m
restore = load('restore', 'restore-staging-backup.py')
storage = load('storage', 'storage-backup-manifest.py')


class RecoverySafety(unittest.TestCase):
    def test_refuse_remote_docker_and_contexts(self):
        for value in ['tcp://127.0.0.1:2375','ssh://staging','tcp://db.cxtytbjvdlngahytfilr.supabase.co:5432','default']:
            with self.assertRaises(restore.DrillError):
                restore.docker_endpoint(value)
        self.assertEqual(restore.docker_endpoint('npipe:////./pipe/dockerDesktopLinuxEngine'), 'npipe:////./pipe/dockerDesktopLinuxEngine')

    def test_private_artifacts_outside_repository(self):
        with self.assertRaises(restore.DrillError):
            restore.private_path(ROOT / 'work/private.dump')
        with self.assertRaises(ValueError):
            storage.check_private(ROOT / 'backup')

    def test_all_six_migrations_single_local_rollback(self):
        source, hashes = restore.migration_sql()
        self.assertTrue(source.startswith('BEGIN;\n'))
        self.assertTrue(source.endswith('ROLLBACK;\n'))
        self.assertEqual(len(hashes), 6)
        self.assertNotIn('\nCOMMIT;',source)
        self.assertIn('CREATE FUNCTION',source)

    def test_inventory_requires_auth_history_and_fingerprints(self):
        good = {'fingerprints':{k:{'objects':c,'fingerprint':h} for k,(c,h) in restore.FINGERPRINTS.items()},
                'public_tables':27,'without_rls':0,'history_count':25,'history_latest':'20261106131852','missing_auth':{'orders':0}}
        restore.validate_inventory(good)
        for key, value in [('history_count',0),('without_rls',1),('missing_auth',{'orders':1})]:
            bad=copy.deepcopy(good);bad[key]=value
            with self.assertRaises(restore.DrillError):
                restore.validate_inventory(bad)
        bad=copy.deepcopy(good);bad['fingerprints']['columns']['objects']=0
        with self.assertRaises(restore.DrillError):
            restore.validate_inventory(bad)

    def test_invalid_archive_stops_before_docker(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'bad.dump';p.write_bytes(b'not-a-backup')
            with self.assertRaises(restore.DrillError):
                restore.run_drill(p,Path(d)/'out','not-installed','unix:///var/run/docker.sock')
            self.assertFalse((Path(d)/'out').exists())


class StorageSafety(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        (self.root/'market-gallery').mkdir()
        (self.root/'market-gallery/test.webp').write_bytes(b'fake-bytes')
        self.objects=[{'bucket_id':'market-gallery','name':'test.webp','metadata':{'size':10}}]
    def tearDown(self):
        self.temp.cleanup()
    def test_bytes_hash_and_inventory(self):
        manifest=storage.make_manifest(self.objects,self.root)
        self.assertEqual(manifest[0]['bytes'],10)
        self.assertEqual(len(manifest[0]['sha256']),64)
        (self.root/'market-gallery/test.webp').write_bytes(b'other-byte')
        self.assertNotEqual(storage.make_manifest(self.objects,self.root),manifest)
    def test_missing_extra_or_wrong_size(self):
        for size in [9,None]:
            self.objects[0]['metadata']['size']=size
            with self.assertRaises((ValueError,TypeError)):
                storage.make_manifest(self.objects,self.root)
        self.objects[0]['metadata']['size']=10
        (self.root/'extra').write_text('extra')
        with self.assertRaises(ValueError):storage.make_manifest(self.objects,self.root)
    def test_path_traversal_windows_aliases_and_duplicates(self):
        for key in ['../outside','/root','a/../../x','a\\b','C:foo','NUL.webp','test.webp.','x\x00y']:
            self.objects[0]['name']=key
            with self.assertRaises(ValueError):storage.make_manifest(self.objects,self.root)
        self.objects[0]['name']='test.webp'
        with self.assertRaises(ValueError):storage.make_manifest(self.objects*2,self.root)
        with self.assertRaises(ValueError):storage.make_manifest(self.objects+[dict(self.objects[0],name='TEST.WEBP')],self.root)
    def test_cli_recovery_comparison_and_redacted_errors(self):
        with tempfile.TemporaryDirectory() as meta:
            objects=Path(meta)/'objects.json';objects.write_text(json.dumps(self.objects))
            manifest=Path(meta)/'manifest.json'
            command=[sys.executable,str(ROOT/'scripts/storage-backup-manifest.py'),
                     '--objects',str(objects),'--files',str(self.root),'--manifest',str(manifest)]
            first=subprocess.run(command,capture_output=True,text=True)
            self.assertEqual(first.returncode,0)
            self.assertEqual(subprocess.run(command+['--verify'],capture_output=True).returncode,0)
            (self.root/'market-gallery/test.webp').write_bytes(b'other-byte')
            failed=subprocess.run(command+['--verify'],capture_output=True,text=True)
            self.assertEqual(failed.returncode,1)
            self.assertNotIn('test.webp',failed.stdout+failed.stderr)
            self.assertEqual(subprocess.run(command,capture_output=True).returncode,1)

    def test_symlink_denied(self):
        link=self.root/'market-gallery/link.webp'
        try:link.symlink_to(self.root/'market-gallery/test.webp')
        except OSError:self.skipTest('symlinks unavailable')
        self.objects[0]['name']='link.webp'
        with self.assertRaises(ValueError):storage.make_manifest(self.objects,self.root)


if __name__ == '__main__':unittest.main()
