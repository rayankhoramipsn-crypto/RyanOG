"""V31: static confidentiality, authorization and non-payment contract."""
import pathlib,re,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
FILES=[ROOT/'index.html',ROOT/'marketplace.html',ROOT/'admin/index.html']+list((ROOT/'assets').glob('*.js'))
class V31Contract(unittest.TestCase):
 def test_no_secret_key_in_public_site_assets(self):
  for f in FILES:
   content=f.read_text(encoding='utf-8')
   self.assertNotRegex(content,r'sb_secret_[A-Za-z0-9_-]{10,}',str(f))
   self.assertNotRegex(content,r'(?i)(service.role.key|supabase.service.role.key)\\s*[:=]\\s*["\\\'](?:eyJ|sb_secret_)',str(f))
 def test_paid_state_not_generated_by_client(self):
  main=(ROOT/'index.html').read_text(encoding='utf-8')
  self.assertIn('Not paid and not confirmed',main)
  self.assertIn('let tc30OrderBusy=false',main)
  self.assertIn('NO VERIFIED INVOICE',main)
  adm=(ROOT/'admin/index.html').read_text(encoding='utf-8')
  self.assertIn('NOT READY FOR AUTOMATED PAYMENT OR ESCROW',adm)
 def test_privileged_sql_contract(self):
  v28=(ROOT/'docs/marketplace-v28-permissions.sql').read_text()
  v29=(ROOT/'docs/v29-privilege-hardening.sql').read_text()
  self.assertIn('REVOKE INSERT, UPDATE, DELETE',v28)
  self.assertIn('GRANT UPDATE (display_name)',v29)
  self.assertNotIn('GRANT UPDATE (is_pro)',v29)
 def test_document_limitations(self):
  d=(ROOT/'docs/v31-api-authorization-review.md').read_text()
  for x in ('leaked-password','SECURITY DEFINER','No public page','TXID'):
   self.assertIn(x,d)
if __name__=='__main__':unittest.main()
