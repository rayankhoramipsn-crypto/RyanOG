"""V28 checkout safety regressions: static-only, no payment or database writes."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class V28CheckoutSafety(unittest.TestCase):
 def test_clear_nonpayment_disclosure(self):
  text=(ROOT/"index.html").read_text(encoding="utf-8")
  for term in [
   'id="tc28-checkout-notice"',
   'MANUAL REVIEW ONLY · NO VERIFIED INVOICE',
   'This page does not verify transactions',
   'not a unique, server-issued invoice',
   'CHECKOUT ENQUIRY / TRISOCMD'
  ]:
   self.assertIn(term,text)
  self.assertNotIn('SECURE CHECKOUT / TRISOCMD',text)
  self.assertEqual(text.count("co_title:"),8)
  self.assertEqual(text.count("co_paid:"),8)
  self.assertIn("co_title:'بررسی روش‌های پرداخت'",text)
  self.assertIn("co_title:'Review payment options'",text)

 def test_admin_dashboard_stays_review_only(self):
  dashboard=(ROOT/"admin/index.html").read_text(encoding="utf-8")
  self.assertIn('id="tc28-readiness"',dashboard)
  self.assertIn("NOT READY FOR AUTOMATED PAYMENT OR ESCROW",dashboard)
  self.assertIn("No trusted server-side blockchain transaction verification",dashboard)
  self.assertIn("No audited custody, escrow",dashboard)

 def test_least_privilege_migration_is_additive(self):
  sql=(ROOT/"docs/marketplace-v28-permissions.sql").read_text(encoding="utf-8").lower()
  self.assertIn("revoke insert, update, delete, truncate, references, trigger",sql)
  self.assertIn("grant select on table public.market_purchase_requests to authenticated",sql)
  self.assertNotIn("drop table",sql)
  self.assertNotIn("delete from",sql)

 def test_documented_release_gates(self):
  guidance=(ROOT/"docs/checkout-v28-readiness.md").read_text(encoding="utf-8")
  for k in ["not enabled","server-signed invoice ID","received amount","TXID uniqueness","refund","dispute","RLS","operator approval"]:
   self.assertIn(k.lower(),guidance.lower())

if __name__=="__main__":
 unittest.main()
