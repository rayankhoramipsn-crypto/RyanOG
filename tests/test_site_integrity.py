"""Site-wide source integrity audit.

Static checks complement (not replace) browser and real end-to-end tests.
"""
from html.parser import HTMLParser
from pathlib import Path
import subprocess
import unittest
import struct
import zlib
import re
import xml.etree.ElementTree as ET

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

 def test_shared_site_favicon_and_open_graph_cards(self):
  pages=[
   "index.html","marketplace.html","product.html","blog/index.html",
   "videos/index.html","help/index.html","policies/index.html",
   "admin/index.html","404.html",
   "preview/index.html","preview/marketplace.html","preview/admin/index.html",
   "preview/blog/index.html","preview/product.html","preview/videos/index.html",
   "preview/help/index.html","preview/policies/index.html"
  ]
  public_pages=set(pages[:7])
  for page in pages:
   with self.subTest(page=page):
    text=(ROOT/page).read_text(encoding="utf-8")
    icons=re.findall(r'<link\\s+rel="icon"\\s+type="image/svg\\+xml"\\s+href="([^"]+)"',text)
    self.assertEqual(len(icons),1,"Expected exactly one SVG favicon: "+page)
    path=(ROOT/page).parent/icons[0]
    self.assertTrue(path.is_file(),f"{page}: missing {path}")
    self.assertIn("trisocmd-icon-64.png",text)
    self.assertIn("trisocmd-apple-touch.png",text)
    if page in public_pages:
     for meta in (
      '<meta property="og:site_name" content="TRISOCMD">',
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      '<meta property="og:image:type" content="image/png">',
      '<meta name="twitter:card" content="summary_large_image">',
      'https://trisocmd.shop/assets/trisocmd-social.png?v=19',
      '<link rel="canonical" href="https://trisocmd.shop/',
     ):
      self.assertIn(meta,text,f"{page}: missing {meta}")
     self.assertEqual(len(re.findall(r'property="og:title"',text)),1)
     self.assertEqual(len(re.findall(r'property="og:description"',text)),1)
     self.assertEqual(len(re.findall(r'property="og:image"',text)),1)

 def test_image_file_formats_and_dimensions(self):
  for name,w,h in [
   ("trisocmd-social.png",1200,630),
   ("trisocmd-icon-64.png",64,64),
   ("trisocmd-apple-touch.png",180,180)
  ]:
   with self.subTest(image=name):
    data=(ROOT/"assets"/name).read_bytes()
    self.assertEqual(data[:8],b"\\x89PNG\\r\\n\\x1a\\n")
    self.assertEqual(struct.unpack(">II",data[16:24]),(w,h))
    off=8
    parts=[]
    while off<len(data):
     size=struct.unpack(">I",data[off:off+4])[0]
     kind=data[off+4:off+8]
     chunk=data[off+8:off+8+size]
     crc=struct.unpack(">I",data[off+8+size:off+12+size])[0]
     self.assertEqual(zlib.crc32(kind+chunk)&0xffffffff,crc)
     if kind==b"IDAT":parts.append(chunk)
     off+=12+size
     if kind==b"IEND":break
    self.assertEqual(off,len(data))
    self.assertEqual(len(zlib.decompress(b"".join(parts))),(w+1)*h)
  icon=ET.parse(ROOT/"assets/trisocmd-icon.svg").getroot()
  self.assertEqual(icon.tag,"{http://www.w3.org/2000/svg}svg")

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
