"""Synchronize the checked-in preview from the canonical root site.

Run after editing root pages/assets. Tests reject drift between both route sets.
This copies local files only; it never deploys or contacts Supabase.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / "preview"
for name in ("index.html", "product.html", "marketplace.html", "seller.html"):
    shutil.copyfile(ROOT / name, PREVIEW / name)
for name in ("assets", "admin", "blog", "videos", "help", "policies"):
    shutil.copytree(ROOT / name, PREVIEW / name, dirs_exist_ok=True)
print("Preview synchronized from root site; no deployment performed.")
