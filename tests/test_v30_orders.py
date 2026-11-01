import unittest
from pathlib import Path
SRC=(Path(__file__).resolve().parents[1]/'index.html').read_text()
class TestV30(unittest.TestCase):
 def test_non_payment_status_and_guard(self):
  for s in ['let tc30OrderBusy=false','if(tc30OrderBusy)return','if(button)button.disabled=true','check My Orders before retrying','Not paid and not confirmed','tc30-order-notice']:
   self.assertIn(s,SRC)
 def test_no_automatic_charge(self):
  self.assertNotIn("tc30OrderBusy=false;await rpc('payment",SRC)
if __name__=='__main__':unittest.main()
