"""Offline verification of private Storage downloads. No API client or credential inputs."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys


def check_private(path):
    p = Path(path).resolve()
    if any((parent / '.git').exists() for parent in [p, *p.parents]):
        raise ValueError('Private paths must be outside Git checkouts')
    return p


def make_manifest(objects, directory):
    directory = check_private(directory)
    records, expected, folded = [], set(), set()
    for obj in objects:
        bucket, name = obj['bucket_id'], obj['name']
        if not isinstance(bucket, str) or '/' in bucket or not isinstance(name, str):
            raise ValueError('Invalid Storage key')
        # Object names are opaque; never normalize away traversal or Windows aliases.
        parts = [bucket, *name.split('/')]
        if any(not isinstance(p, str) or not p or p in ('.', '..') or
               any(c in p for c in '\\:\x00<>"|?*') or p.endswith((' ', '.')) or
               any(ord(c) < 32 for c in p) or
               p.split('.')[0].upper() in ['CON','PRN','AUX','NUL', *['COM'+str(i) for i in range(1,10)], *['LPT'+str(i) for i in range(1,10)]]
               for p in parts):
            raise ValueError('Object key cannot be represented safely; use a reviewed opaque-key export')
        relative = '/'.join(parts)
        if relative.casefold() in folded:
            raise ValueError('Duplicate or case-colliding Storage keys')
        expected.add(relative)
        folded.add(relative.casefold())
        path = directory.joinpath(*parts)
        if any(p.is_symlink() for p in [path, *path.parents] if p != directory.parent):
            raise ValueError('Symlinks are not permitted')
        if not path.is_file() or not path.resolve().is_relative_to(directory):
            raise ValueError('Missing or unsafe local object')
        size = path.stat().st_size
        metadata = obj.get('metadata') or {}
        if 'size' not in metadata or int(metadata['size']) != size:
            raise ValueError('Object size is missing or differs from database metadata')
        with path.open('rb') as f:
            digest = hashlib.file_digest(f, 'sha256').hexdigest()
        records.append({'bucket_id':bucket,'name':name,'bytes':size,'sha256':digest})
    actual = set()
    for p in directory.rglob('*'):
        if p.is_symlink():
            raise ValueError('Symlinks are not permitted')
        if p.is_file():
            actual.add(p.relative_to(directory).as_posix())
    if actual != expected:
        raise ValueError('Unexpected or missing local objects')
    return sorted(records, key=lambda r: (r['bucket_id'], r['name']))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--objects', required=True, help='Private JSON exported by the isolated restore workflow')
    p.add_argument('--files', required=True, help='Private root containing <bucket>/<object-key>')
    p.add_argument('--manifest', required=True, help='New private manifest, or existing manifest with --verify')
    p.add_argument('--verify', action='store_true', help='Compare restored bytes with an earlier manifest')
    args = p.parse_args()
    os.umask(0o077)
    try:
        objects = json.loads(check_private(args.objects).read_text(encoding='utf-8-sig'))
        manifest = make_manifest(objects, args.files)
        dest = check_private(args.manifest)
        if args.verify:
            if json.loads(dest.read_text(encoding='utf-8-sig')) != manifest:
                raise ValueError('Recovered object hashes differ')
        else:
            if dest.is_relative_to(check_private(args.files)):
                raise ValueError('Manifest must be outside the object tree')
            with dest.open('x', encoding='utf-8') as f:
                json.dump(manifest, f, ensure_ascii=True, indent=2)
        print('PASS: offline object inventory, sizes and SHA-256 checks; no hosted request made.')
        return 0
    except (OSError, ValueError, KeyError, TypeError):
        print('Storage verification failed; inspect private inventory, paths, sizes and hashes. No private details printed.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
