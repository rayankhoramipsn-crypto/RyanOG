"""V34 notification/accessibility and non-payment regression checks. No database writes."""
import pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
class V34Tests(unittest.TestCase):
 def test_notification_private_schema(self):
  sql=(ROOT/'docs/marketplace-v34-notifications.sql').read_text()
  for phrase in ('ENABLE ROW LEVEL SECURITY','recipient_id = (SELECT auth.uid())',
   'for_admin AND (SELECT public.is_admin())','market_purchase_requests','market_messages',
   'REVOKE ALL ON TABLE public.market_notifications','GRANT SELECT ON TABLE public.market_notifications',
   "NEW.status IS DISTINCT FROM OLD.status"):
   self.assertIn(phrase,sql)
  self.assertNotIn('payment_verified',sql)
  self.assertNotIn("status='sold'",sql)
 def test_all_bells_and_opt_in(self):
  j=(ROOT/'assets/triso-notifications-v34.js').read_text()
  for term in ('market_notifications?select=','Notification.requestPermission()',
   "'Notification' in window","window.isSecureContext","tc34_seen_", "No personal message contents"):
   self.assertIn(term,j)
  for page in ('index.html','marketplace.html','admin/index.html'):
   text=(ROOT/page).read_text()
   self.assertIn('triso-notifications-v34.js?v=35',text)
   self.assertIn('triso-notifications-v34.css?v=34',text)
 def test_fixed_search_and_image(self):
  store=(ROOT/'index.html').read_text()
  market=(ROOT/'marketplace.html').read_text()
  style=(ROOT/'assets/trisocmd-native-v13.css').read_text()
  for tag in ('tc35_store_catalog_lookup','tc35_store_header_lookup','type="search"'):
   self.assertIn(tag,store)
  self.assertIn('tc35_market_product_lookup',market)
  self.assertIn("triso-gear-art.svg",style)
  self.assertNotIn("tc-native-promo-gear{background-image:url('triso-native-gear.webp')",style)
 def test_no_fake_paid_status(self):
  j=(ROOT/'assets/triso-notifications-v34.js').read_text()
  for term in ("update public.market_listings","market_admin_update_purchase","mark_paid","txid"):
   self.assertNotIn(term.lower(),j.lower())
if __name__=='__main__':unittest.main()
