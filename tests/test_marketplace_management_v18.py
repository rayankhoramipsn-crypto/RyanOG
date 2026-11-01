"""Regression tests for V18 marketplace administration and login navigation."""
from pathlib import Path
from html.parser import HTMLParser
import subprocess, re, unittest, tempfile
ROOT=Path(__file__).resolve().parents[1]
class Tags(HTMLParser):
 def __init__(self): super().__init__();self.ids={}
 def handle_starttag(self,tag,attrs):
  for k,v in attrs:
   if k=='id':self.ids[v]=self.ids.get(v,0)+1
class MarketplaceV18(unittest.TestCase):
 def test_authenticated_return_visit_skips_login_onboarding(self):
  for path in ["index.html","preview/index.html"]:
   with self.subTest(path=path):
    code=(ROOT/path).read_text(encoding="utf-8")
    if path=="index.html":
     self.assertIn("showScreen('lang-screen');",code)
     self.assertIn("function renderAccountMode",code)
     self.assertIn("window.TrisoAuth?.read()?.user",code)
    else:
     self.assertIn("returningMember?'store-screen':'lang-screen'",code)
     self.assertIn("tc37ShowWelcome",code)
     self.assertIn("auth.refresh_token",code)
 def test_purchase_request_only_and_owner_removal(self):
  for path in ["marketplace.html","preview/marketplace.html"]:
   with self.subTest(path=path):
    page=(ROOT/path).read_text(encoding="utf-8")
    tags=Tags();tags.feed(page)
    for id_ in ("purchase-method","request-purchase","purchase-status",
                "purchase-requests","purchase-requests-wrap","refresh-purchases"):
     self.assertEqual(tags.ids.get(id_),1,id_)
    for t in ("payments to sellers directly are not permitted",
              "administrator oversight","not currently accept","No payment",
              "4%"):
     self.assertIn(t.lower(),page.lower())
  js=(ROOT/"assets/marketplace-v15.js").read_text(encoding="utf-8")
  for x in ("rpc('market_remove_listing'","rpc('market_request_purchase'",
            "requestPurchase()","removeMyListing(p)","await purchases()",
            "seller_id=eq.","confirmed"):
   if x=="confirmed":continue
   if x=="seller_id=eq.":continue
   self.assertIn(x,js)
 def test_admin_all_conversations_and_admin_listing_removal(self):
  script=(ROOT/"assets/triso-admin-v18.js").read_text(encoding="utf-8")
  for x in ("market_conversations?select=","market_messages?select=",
            "window.tc18RemoveListing","rpcV18('market_remove_listing'",
            "market_purchase_requests?select=","market_admin_update_purchase"):
   self.assertIn(x,script)
  self.assertNotIn("innerHTML",script)
  for path in ["admin/index.html","preview/admin/index.html"]:
   with self.subTest(path=path):
    html=(ROOT/path).read_text(encoding="utf-8")
    parser=Tags();parser.feed(html)
    for id_ in ("tc18-chat-list","tc18-chat-messages","tc18-chat-refresh",
                "tc18-order-list","tc18-orders-refresh"):
     self.assertEqual(parser.ids.get(id_),1,id_)
    revision="35" if path=="admin/index.html" else "18"
    self.assertIn("triso-admin-v18.js?v="+revision,html)
    self.assertIn("window.tc18RemoveListing",html)
 def test_migration_enforces_roles_and_no_fake_escrow(self):
  sql=(ROOT/"docs/marketplace-v18-moderation-order-requests.sql").read_text(encoding="utf-8")
  for k in ("market_remove_listing","market_request_purchase",
            "market_purchase_requests_read","market_listing_activity",
            "buyer_id=(select auth.uid())","seller_id=(select auth.uid())",
            "public.is_admin()","status='removed'","No funds are received",
            "grant execute on function public.market_remove_listing"):
   self.assertIn(k,sql)
  self.assertNotIn("grant all on public.market_purchase_requests to anon",sql.lower())
 def test_new_script_syntax(self):
  for path in ["assets/marketplace-v15.js","assets/triso-admin-v18.js"]:
   result=subprocess.run(["node","--check",str(ROOT/path)],capture_output=True,text=True)
   with self.subTest(path=path):
    self.assertEqual(result.returncode,0,result.stderr)
  for path in ["admin/index.html","preview/admin/index.html","index.html","preview/index.html"]:
   html=(ROOT/path).read_text(encoding="utf-8")
   blocks=re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>",html,re.S|re.I)
   for i,block in enumerate(blocks):
    if not block.strip():continue
    with tempfile.TemporaryDirectory() as tmp:
     f=Path(tmp)/"inline.js";f.write_text(block,encoding="utf-8")
     result=subprocess.run(["node","--check",str(f)],capture_output=True,text=True)
     with self.subTest(path=path,block=i):
      self.assertEqual(result.returncode,0,result.stderr)
if __name__=="__main__":unittest.main()
