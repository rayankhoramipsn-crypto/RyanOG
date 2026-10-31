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
    "admin/index.html",
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

    def test_admin_moderation_guardrails(self):
        admin = (ROOT / "admin/index.html").read_text(encoding="utf-8")
        self.assertIn("rpc/is_admin", admin)
        self.assertIn("admin-login-form", admin)
        self.assertIn("Promise.allSettled", admin)
        self.assertIn("status=eq.pending", admin)
        self.assertIn("reviewed_by:session.user.id", admin)
        self.assertIn("Payment confirmation and fulfillment are intentionally disabled", admin)

    def test_staging_checkout_not_enabled_on_new_product_page(self):
        product = (ROOT / "product.html").read_text(encoding="utf-8")
        self.assertIn("Purchasing is disabled", product)
        self.assertNotIn("/rpc/tc42_create_order", product)


    def test_marketplace_admin_queue_is_independent_and_secure(self):
        for rel in ("preview/admin/index.html", "admin/index.html"):
            admin = (ROOT.parent / rel).read_text(encoding="utf-8")
            with self.subTest(page=rel):
                self.assertIn("rpc/is_admin", admin)
                self.assertIn("Promise.allSettled", admin)
                self.assertIn("admin-login-form", admin)
                self.assertIn("reviewed_by:session.user.id", admin)
                self.assertNotIn("raw_user_meta_data", admin)
        # The marketplace now uses real DOM controls and a versioned external script.
        script = (ROOT.parent / "assets/marketplace-v15.js").read_text(encoding="utf-8")
        for rel in ("preview/marketplace.html", "marketplace.html"):
            market = (ROOT.parent / rel).read_text(encoding="utf-8")
            with self.subTest(page=rel):
                self.assertIn("marketplace-v15.js", market)
                self.assertIn("marketplace-v15.css", market)
                self.assertIn('id="cards"', market)
                self.assertIn('id="detail-dialog"', market)
                self.assertIn('id="photos" type="file"', market)
                self.assertIn("multiple required", market)
                self.assertIn('id="chat-dialog"', market)
                self.assertIn('id="accept" type="checkbox" required', market)
                self.assertNotIn("service_role", market.lower())
        for critical in ("market_browse", "market_submit", "market_listing_media",
                         "market_start_chat", "market_send_message", "market_messages",
                         "market_conversations", "market-gallery", "realtimeSubscribe",
                         "setInterval", "checkFiles(files)", "p_image_url:null"):
            self.assertIn(critical, script)
        # Admin reviews seller photos; approval is blocked if gallery is empty.
        for rel in ("preview/admin/index.html", "admin/index.html"):
            content = (ROOT.parent / rel).read_text(encoding="utf-8")
            self.assertIn("loadListingGallery", content)
            self.assertIn("galleryPhotoUrl", content)
            self.assertIn("if(!photos.length){approve.disabled=true", content)

if __name__ == "__main__":
    unittest.main()
