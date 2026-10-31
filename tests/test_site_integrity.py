"""Site-wide source integrity audit.

Static checks complement (not replace) browser and real end-to-end tests.
"""
from html.parser import HTMLParser
from pathlib import Path
import subprocess
import unittest

ROOT=Path(__file__).resolve().parents[1]
ROUTES=[
 "index.html","404.html","marketplace.html","admin/index.html","blog/index.html",
 "videos/index.html","help/index.html","policies/index.html","product.html",
 "preview/index.html","preview/marketplace.html","preview/admin/index.html",
 "preview/blog/index.html","preview/videos/index.html","preview/help/index.html",
 "preview/policies/index.html","preview/product.html"
]

class Assets(HTMLParser):
 def __init__(self):
  super().__init__()
  self.assets=[]
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  if tag=="script" and d.get("src"):self.assets.append(d["src"])
  if tag=="link" and d.get("rel")=="stylesheet" and d.get("href"):self.assets.append(d["href"])
  if tag=="img" and d.get("src") and "$"+"{" not in d["src"]:self.assets.append(d["src"])

class SiteIntegrity(unittest.TestCase):
 def test_all_html_assets_exist(self):
  for page in ROUTES:
   html=(ROOT/page).read_text(encoding="utf-8")
   parser=Assets();parser.feed(html)
   for src in parser.assets:
    with self.subTest(page=page,src=src):
     if not src or src.startswith(("https:","http:","data:","blob:","//","/")):continue
     asset=src.split("#",1)[0].split("?",1)[0]
     if not asset:continue
     self.assertTrue((ROOT/page).parent.joinpath(asset).is_file(),f"Missing asset {src} in {page}")

 def test_public_and_staging_pages_are_distinct(self):
  for page in ROUTES:
   html=(ROOT/page).read_text(encoding="utf-8")
   self.assertIn("<title>",html,page)
   self.assertNotIn("sb_secret_",html,page)
   self.assertNotIn("service_role_key",html,page)
   if page.startswith("preview/"):
    self.assertIn("noindex,nofollow",html,page)

 def test_admin_action_panel_uses_real_database_relations(self):
  for page in ["index.html","preview/index.html"]:
   html=(ROOT/page).read_text(encoding="utf-8")
   self.assertIn("market_listing_activity?select=",html)
   self.assertNotIn("tc46_admin_audit?select=",html)
   self.assertNotIn("rpc/tc46_transition_order",html)
   self.assertIn("Order status transitions are not configured.",html)
   self.assertIn("payment verification/fulfillment is intentionally disabled",html.lower())
   self.assertIn("Full admin audit logging is not configured",html)

 def test_branded_404_has_functional_recovery(self):
  page=(ROOT/"404.html").read_text(encoding="utf-8")
  self.assertIn("<title>404 — Page Not Found | TRISOCMD</title>",page)
  self.assertIn('name="robots" content="noindex,follow"',page)
  for target in ('href="/"','href="/marketplace.html"','href="/help/"'):
   self.assertIn(target,page)
  self.assertIn('id="language-switch"',page)
  self.assertIn('id="go-back"',page)
  self.assertIn("prefers-reduced-motion",page)
  self.assertNotIn("service_role",page)

 def test_core_javascript_parses(self):
  for path in [
   "app.js","assets/marketplace-v15.js","assets/triso-admin-v18.js",
   "assets/triso-market-admin.js","assets/triso-auth-storage.js",
   "assets/trisocmd-native-v13.js","assets/trisocmd-lower-v14.js",
  ]:
   with self.subTest(path=path):
    result=subprocess.run(["node","--check",str(ROOT/path)],capture_output=True,text=True)
    self.assertEqual(result.returncode,0,result.stderr)

if __name__=="__main__":
 unittest.main()
