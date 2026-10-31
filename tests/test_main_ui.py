"""Smoke tests for TRISOCMD lower design and real-store integration."""
from pathlib import Path
from html.parser import HTMLParser
import re, subprocess, tempfile, unittest
ROOT=Path(__file__).resolve().parents[1]
SOURCE=(ROOT/'index.html').read_text(encoding='utf-8')
class IdParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids={}
    def handle_starttag(self,tag,attrs):
        for k,v in attrs:
            if k=='id':self.ids[v]=self.ids.get(v,0)+1
class LowerPage(unittest.TestCase):
    def test_layout_and_unique_inputs(self):
        anchors=['<section class="tc14-journal"','<section class="tc14-feature"','<section class="tc-v8-shop-wrap tc14-shop"','<footer class="tc14-footer"']
        pos=[SOURCE.index(a) for a in anchors]
        self.assertEqual(pos,sorted(pos))
        self.assertIn('id="tc38-hero"',SOURCE)
        self.assertNotIn('tc-v9-reference-stage',SOURCE)
        for kind in ['all','fortnite','gear','digital']:
            self.assertIn('data-native-filter="'+kind+'"',SOURCE)
        p=IdParser();p.feed(SOURCE)
        for name in ['tc-journal','tc-shop-heading','tc39-search','tc39-category','tc39-sort','tc39-count','product-grid','store-empty','tc14-footer']:
            self.assertEqual(p.ids.get(name),1,name)
    def test_real_products_and_assets(self):
        self.assertIn('const prods=tc39Filtered()',SOURCE)
        self.assertIn('tc50Num(p.price).toFixed(2)',SOURCE)
        self.assertIn('openProduct($'+'{id})',SOURCE)
        self.assertIn('function setLang(',SOURCE)
        self.assertIn('id="tc31-panel"',SOURCE)
        for path in ['assets/trisocmd-native-v13.css','assets/trisocmd-native-v13.js','assets/trisocmd-lower-v14.css','assets/trisocmd-lower-v14.js','assets/triso-journal-world-v14.webp']:
            self.assertGreater((ROOT/path).stat().st_size,100,path)
    def test_syntax_and_staging(self):
        subprocess.run(['node','--check',str(ROOT/'assets/trisocmd-lower-v14.js')],check=True,capture_output=True,text=True)
        scripts=re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',SOURCE,re.S|re.I)
        script=next((x for x in scripts if 'function tc14ProductKind' in x),None)
        self.assertIsNotNone(script)
        with tempfile.TemporaryDirectory() as t:
            f=Path(t)/'inline.js';f.write_text(script,encoding='utf-8')
            result=subprocess.run(['node','--check',str(f)],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn('name="robots" content="noindex,nofollow"',SOURCE)
        self.assertIn('STAGING PREVIEW ONLY',SOURCE)
        self.assertIn('No real purchases or payments',SOURCE)
        self.assertNotIn('sb_secret_',SOURCE)
if __name__=='__main__':unittest.main()
