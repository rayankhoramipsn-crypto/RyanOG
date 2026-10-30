"""Static regression checks for staging routes and safety-critical invariants.
Run: python3 tests/test_staging_routes.py
No third-party dependencies or production credentials required.
"""
from pathlib import Path
from html.parser import HTMLParser
import re
import unittest

ROOT = Path(__file__).resolve().parents[1] / "preview"
PAGES = {
    "index.html",
    "marketplace.html",
    "product.html",
    "blog/index.html",
    "videos/index.html",
    "help/index.html",
    "policies/index.html",
}

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.meta = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "a" and "href" in a:
            self.links.append(a["href"])
        if tag == "meta":
            self.meta.append(a)

class StagingRoutes(unittest.TestCase):
    def test_all_pages_exist_and_are_noindex(self):
        for page in sorted(PAGES):
            with self.subTest(page=page):
                source = (ROOT / page).read_text(encoding="utf-8")
                parser = Links()
                parser.feed(source)
                self.assertTrue(any(m.get("name") == "robots" and "noindex" in m.get("content", "") for m in parser.meta))
                self.assertIn("<title>", source)
                self.assertNotIn("service_role", source.lower())
                self.assertNotIn("sb_secret_", source)

    def test_relative_internal_links_resolve(self):
        for page in sorted(PAGES):
            parser = Links()
            parser.feed((ROOT / page).read_text(encoding="utf-8"))
            for link in parser.links:
                if not link or link.startswith(("#", "https:", "http:", "mailto:", "tel:", "javascript:")):
                    continue
                route = link.split("#", 1)[0].split("?", 1)[0]
                if not route or "{" in route:
                    continue
                target = (ROOT / page).parent / route
                if target.is_dir():
                    target /= "index.html"
                # Existing legacy links may refer to other future pages; validate known feature routes.
                if any(route.startswith(p) for p in ("blog/", "videos/", "help/", "policies/", "marketplace.html", "product.html")):
                    self.assertTrue(target.is_file(), f"{page}: broken link {link}")

    def test_safe_youtube_embed(self):
        product = (ROOT / "product.html").read_text(encoding="utf-8")
        videos = (ROOT / "videos/index.html").read_text(encoding="utf-8")
        for source in (product, videos):
            self.assertIn("youtube-nocookie.com/embed/", source)
            self.assertIn("{11}", source)
            self.assertNotIn("innerHTML=", source)

    def test_editor_uses_admin_and_text_nodes(self):
        blog = (ROOT / "blog/index.html").read_text(encoding="utf-8")
        self.assertIn("app_metadata?.role==='admin'", blog)
        self.assertIn("textContent=p.body", blog)
        self.assertIn("blog_posts", blog)

    def test_staging_checkout_not_enabled_on_new_product_page(self):
        product = (ROOT / "product.html").read_text(encoding="utf-8")
        self.assertIn("Purchasing is disabled", product)
        self.assertNotIn("/rpc/tc42_create_order", product)

if __name__ == "__main__":
    unittest.main()
