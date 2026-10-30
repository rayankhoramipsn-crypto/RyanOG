"""Exercise the exact CI assembly scripts without uploading or deploying anything."""
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

class SiteArtifacts(unittest.TestCase):
    def assemble(self, workflow, step, prefix):
        source = (ROOT / '.github/workflows' / workflow).read_text()
        block = source.split('- name: ' + step, 1)[1].split('run: |', 1)[1]
        lines = []
        for line in block.splitlines()[1:]:
            if line.strip() and not line.startswith('          '):
                break
            lines.append(line[10:])
        with tempfile.TemporaryDirectory() as tmp:
            checkout = Path(tmp) / 'checkout'
            shutil.copytree(ROOT, checkout, ignore=shutil.ignore_patterns('.git', '_site', '__pycache__'))
            subprocess.run(['bash', '-e', '-c', '\n'.join(lines)], cwd=checkout, check=True)
            site = checkout / '_site'
            for page in ['index.html', 'marketplace.html', 'product.html', 'blog/index.html', 'videos/index.html', 'help/index.html', 'policies/index.html', 'admin/index.html', 'app.js']:
                self.assertTrue((site / prefix / page).is_file(), page)
            html = (site / prefix / 'index.html').read_text()
            for url in re.findall(r"url\(['\"]?([^)'\"]+)", html):
                if url.endswith('.png') and not url.startswith(('http:', 'https:', 'data:')):
                    self.assertTrue((site / prefix / url).is_file(), url)

    def test_main_artifact(self):
        self.assemble('deploy-main-pages.yml', 'Prepare published site', '')

    def test_preview_artifact(self):
        self.assemble('jekyll-gh-pages.yml', 'Assemble preview site', 'preview')

    def test_preview_does_not_deploy_over_main(self):
        workflow = (ROOT / '.github/workflows/jekyll-gh-pages.yml').read_text()
        self.assertNotIn('actions/deploy-pages', workflow)
        self.assertNotIn('pages: write', workflow)

if __name__ == '__main__':
    unittest.main()
