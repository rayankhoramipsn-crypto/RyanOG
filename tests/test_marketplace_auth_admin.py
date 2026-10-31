"""Regression checks for persistent login and marketplace admin moderation."""
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class IDs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = {}
    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if k == "id":
                self.ids[v] = self.ids.get(v, 0) + 1


class PersistentMarketAdmin(unittest.TestCase):
    def test_storefront_admin_queue_exists_and_is_authorized(self):
        for path in ["index.html", "preview/index.html"]:
            with self.subTest(path=path):
                page = (ROOT / path).read_text(encoding="utf-8")
                ids = IDs()
                ids.feed(page)
                for name in ("tc-market-admin", "tc-market-pending", "tc-market-count",
                             "tc-market-status", "tc31-remember"):
                    self.assertEqual(ids.ids.get(name), 1, name)
                self.assertIn("window.tcMarketAdminLoad?.()", page)
                self.assertIn("window.tcMarketAdminReset?.()", page)
                self.assertIn("window.TrisoAuth.write(d)", page)
                self.assertIn("window.TrisoAuth.read()", page)
                self.assertIn("window.TrisoAuth.clear()", page)
                self.assertIn("triso-auth-storage.js", page)
                self.assertIn("triso-market-admin.js", page)

    def test_all_account_routes_read_shared_login(self):
        for path in ["marketplace.html", "preview/marketplace.html",
                     "admin/index.html", "preview/admin/index.html",
                     "blog/index.html", "preview/blog/index.html",
                     "product.html", "preview/product.html"]:
            with self.subTest(path=path):
                page = (ROOT / path).read_text(encoding="utf-8")
                self.assertIn("triso-auth-storage.js", page)
                self.assertNotIn("sessionStorage.getItem('tc35_auth_session')", page)
        scripts = (ROOT / "assets/marketplace-v15.js").read_text(encoding="utf-8")
        self.assertIn("window.TrisoAuth.read()", scripts)
        self.assertIn("window.TrisoAuth.write(session)", scripts)
        self.assertIn("window.TrisoAuth.clear()", scripts)

    def test_moderation_reads_pending_only_and_uses_server_permissions(self):
        code = (ROOT / "assets/triso-market-admin.js").read_text(encoding="utf-8")
        for s in ("rpc/is_admin", "status=eq.pending", "market_listings",
                  "market_listing_media", "gallery", "reviewed_by",
                  "reviewed_at", "window.tc42AccessToken"):
            self.assertIn(s, code)
        self.assertNotIn("service_role", code)
        self.assertNotIn("sb_secret_", code)

    def test_admin_approval_queue_handles_old_photoless_listings(self):
        # Legacy approved/declined rows with no gallery records must not crash
        # rendering of newer pending items with uploaded photos.
        for path in ["admin/index.html", "preview/admin/index.html"]:
            with self.subTest(path=path):
                page = (ROOT / path).read_text(encoding="utf-8")
                self.assertIn("const warning=el('div','No uploaded gallery photos", page)
                self.assertIn("warning.className='photo-missing';", page)
                self.assertIn("description.append(warning);", page)
                self.assertNotIn("description.append(el('div','No uploaded gallery photos", page)
                self.assertIn("catch(error){", page)
                self.assertIn("Moderation panel could not finish rendering:", page)
                self.assertIn("status=eq.pending", page)

    def test_marketplace_admin_shortcut_is_role_gated(self):
        for path in ["marketplace.html", "preview/marketplace.html"]:
            with self.subTest(path=path):
                page = (ROOT / path).read_text(encoding="utf-8")
                self.assertIn('id="nav-admin"', page)
                self.assertIn('href="admin/"', page)
        script = (ROOT / "assets/marketplace-v15.js").read_text(encoding="utf-8")
        self.assertIn("adminLink.classList.toggle('hidden',!on||!S.admin)", script)
        self.assertIn("S.admin=await adminCheck()", script)

    def test_script_syntax(self):
        for path in ["assets/triso-auth-storage.js",
                     "assets/triso-market-admin.js",
                     "assets/marketplace-v15.js"]:
            with self.subTest(path=path):
                r = subprocess.run(["node", "--check", str(ROOT / path)],
                                   capture_output=True, text=True)
                self.assertEqual(r.returncode, 0, r.stderr)
        for path in ["index.html", "preview/index.html"]:
            html = (ROOT / path).read_text(encoding="utf-8")
            scripts = re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>", html, re.S | re.I)
            auth = next((x for x in scripts if "const storeKey='tc35_auth_session'" in x), None)
            self.assertIsNotNone(auth)
            with tempfile.TemporaryDirectory() as tmp:
                target = Path(tmp) / "auth.js"
                target.write_text(auth, encoding="utf-8")
                check = subprocess.run(["node", "--check", str(target)],
                                       capture_output=True, text=True)
                self.assertEqual(check.returncode, 0, check.stderr)


if __name__ == "__main__":
    unittest.main()
