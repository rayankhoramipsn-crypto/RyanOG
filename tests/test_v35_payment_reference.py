"""V35: prevent duplicate transaction references without claiming crypto verification."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
class PaymentReferenceSafety(unittest.TestCase):
 def test_server_side_txid_guards(self):
  sql=(ROOT/'docs/v35-transaction-claims-email-optin.sql').read_text()
  for key in ["UNIQUE(txid)","UNIQUE(request_id)","'^[0-9a-f]{64}$'","buyer_id=v_buyer FOR UPDATE","v_method NOT IN ('BTC','LTC')","status IN ('unverified','invalid')","No purchase status update","ENABLE ROW LEVEL SECURITY","REVOKE ALL ON TABLE public.market_txid_claims"]:
   self.assertIn(key,sql)
  self.assertNotIn('status = \'sold\'',sql)
 def test_email_preference_not_unconsented(self):
  sql=(ROOT/'docs/v35-transaction-claims-email-optin.sql').read_text()
  for key in ['email_enabled boolean NOT NULL DEFAULT false','WHERE user_id=NEW.recipient_id AND email_enabled','REVOKE ALL ON TABLE public.market_email_outbox','CREATE TRIGGER tc35_notification_email']:
   self.assertIn(key,sql)
  html=(ROOT/'marketplace.html').read_text()
  self.assertIn('id="tc35-email-optin"',html)
  self.assertIn('id="tc35-txid-form"',html)
 def test_no_unverified_payment_confirmation(self):
  js=(ROOT/'assets/marketplace-v15.js').read_text()
  self.assertIn("rpc('market_submit_txid'",js)
  self.assertIn('No payment was verified, no item was sold',js)
  self.assertIn('tc35TxidOptions()',js)
  self.assertNotIn('market_admin_update_purchase',js)
 def test_search_privacy_and_manual_notifications(self):
  for page in ('index.html','marketplace.html'):
   html=(ROOT/page).read_text()
   self.assertIn('readonly onfocus="this.readOnly=false"',html)
  script=(ROOT/'assets/triso-notifications-v34.js').read_text()
  self.assertIn('TrisoNotifications={readEmailOptin,saveEmailOptin,enableDeviceAlerts}',script)
  self.assertIn("root.hidden=false;owner=null",script)
if __name__=='__main__': unittest.main()
