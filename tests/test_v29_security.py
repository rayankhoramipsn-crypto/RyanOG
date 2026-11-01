import unittest
from pathlib import Path
root=Path(__file__).resolve().parents[1]
class TestV29Security(unittest.TestCase):
 def test_grants(self):
  text=(root/'docs/v29-privilege-hardening.sql').read_text()
  self.assertIn('REVOKE ALL PRIVILEGES ON TABLE public.seller_profiles',text)
  self.assertIn('GRANT UPDATE (display_name)',text)
  self.assertNotIn('GRANT UPDATE (is_pro)',text)
  self.assertNotIn('DROP TABLE',text)
  self.assertIn('GRANT SELECT ON TABLE public.market_messages TO authenticated',text)
 def test_documentation(self):
  text=(root/'docs/v29-security-audit.md').read_text()
  self.assertIn('leaked password protection',text)
  self.assertIn('market_browse()',text)
if __name__=='__main__':unittest.main()
