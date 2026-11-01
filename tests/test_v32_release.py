import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
S=(ROOT/'index.html').read_text()
class TestV32CheckoutQA(unittest.TestCase):
 def test_disabled_unconfigured_invoice(self):
  for phrase in ['INVOICES NOT ENABLED','VERIFICATION NOT AVAILABLE','TXID verification is not enabled','id="tc43-invoice-btn" disabled','id="tc43-verify-btn" disabled','id="tc43-txid"']:
   self.assertIn(phrase,S)
  self.assertNotIn('CREATE SECURE INVOICE ↗',S)
  self.assertNotIn("CONTINUE TO CRYPTO PAYMENT ↗",S)
 def test_removed_dead_invoice_api(self):
  self.assertNotIn("const created=await api('create',{coin,items})",S)
  self.assertNotIn("const data=await api('verify',{invoice_id:",S)
 def test_record_release_gates(self):
  doc=(ROOT/'docs/v32-release-verification.md').read_text()
  for term in ['V29','V30','V31','V32','leaked-password','not in production','manual QA']:
   self.assertIn(term.lower(),doc.lower())
if __name__=='__main__':unittest.main()
