"use strict";
// Deterministic browser regression suite. All remote data is intercepted.
// This does not prove live Auth/email/Storage/payment availability.
const { chromium } = require("playwright");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http");
const root = path.resolve(__dirname, "..");
const products = [
  {
    id: 2,
    title: "Fixture keyboard",
    description: "Mechanical fixture keyboard",
    description_ar: "لوحة مفاتيح للاختبار",
    price: 79.5,
    image_url: "https://images.example.test/keyboard.png",
    category: "Gaming Accessories",
    status: "available",
    stock: 4,
    min_qty: 1,
    max_qty: 3,
  },
  {
    id: 1,
    title: "Fixture gift card",
    description: "Digital test item",
    price: 20,
    image_url: "https://images.example.test/card.png",
    category: "Gift Cards",
    status: "available",
    stock: 10,
    min_qty: 1,
    max_qty: 5,
  },
];
const articles = [
  {
    id: "a",
    slug: "fixture-guide",
    title: "Fixture guide",
    excerpt: "A buying guide fixture",
    body: "<script>window.pwned=true</script> Plain article text.",
    category: "Guides",
    language: "en",
    status: "published",
    published_at: "2026-10-01T00:00:00Z",
    cover_image_url: "https://images.example.test/guide.png",
  },
  {
    id: "b",
    slug: "fixture-news",
    title: "Fixture news",
    excerpt: "News fixture",
    body: "A second article.",
    category: "News",
    language: "en",
    status: "published",
    published_at: "2026-10-02T00:00:00Z",
  },
];
const listings = [
  {
    id: 10,
    title: "Fixture controller",
    platform: "PC",
    description: "Legitimately owned test controller.",
    price: 30,
    is_pro: false,
    image_url: null,
  },
  {
    id: 11,
    title: "Fixture console",
    platform: "Console",
    description: "Legitimately owned test console.",
    price: 200,
    is_pro: false,
    image_url: null,
  },
];
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "fixture@example.invalid",
  app_metadata: { role: "customer" },
};
const fakeSession = {
  access_token: "fixture-access-token",
  refresh_token: "fixture-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user,
};
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
let passed = 0;
const server = http.createServer((req, res) => {
  const relative = decodeURIComponent(
    new URL(req.url, "http://localhost").pathname,
  );
  let target = path.resolve(root, "." + relative);
  if (target !== root && !target.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if (fs.statSync(target).isDirectory())
      target = path.join(target, "index.html");
    const type =
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
      }[path.extname(target)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(fs.readFileSync(target));
  } catch {
    res.writeHead(404).end();
  }
});
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port + (process.env.TRISO_TEST_ROOT ? "/" : "/preview/");
  const browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    let errors = [],
      writes = [],
      offline = false,
      adminRole = false,
      submitted = false,
      media = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await context.route("https://**/*", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (url.hostname === "images.example.test") {
        await route.fulfill({ contentType: "image/png", body: pixel });
        return;
      }
      if (url.hostname.endsWith(".supabase.co")) {
        const p = url.pathname,
          method = req.method();
        if (offline && p.includes("/products")) {
          await route.abort("failed");
          return;
        }
        if (method !== "GET")
          writes.push({ path: p, method, body: req.postData() });
        let data = [];
        if (p === "/auth/v1/user")
          data = {
            ...user,
            app_metadata: { role: adminRole ? "admin" : "customer" },
          };
        else if (p.startsWith("/auth/v1/token"))
          data = {
            ...fakeSession,
            user: {
              ...user,
              app_metadata: { role: adminRole ? "admin" : "customer" },
            },
          };
        else if (p === "/rest/v1/products") {
          const id = url.searchParams.get("id");
          data = id?.startsWith("eq.")
            ? products.filter((p) => String(p.id) === id.slice(3))
            : id?.startsWith("neq.")
              ? products.filter((p) => String(p.id) !== id.slice(4))
              : products;
        } else if (p === "/rest/v1/product_media")
          data = [
            {
              id: 1,
              media_type: "image",
              media_url: "https://images.example.test/keyboard.png",
              label: "Front",
            },
            {
              id: 2,
              media_type: "image",
              media_url: "https://images.example.test/back.png",
              label: "Back",
            },
            {
              id: 3,
              media_type: "youtube",
              media_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
              label: "Fixture review",
            },
            {
              id: 4,
              media_type: "youtube",
              media_url: "https://evil.example.test/watch?v=dQw4w9WgXcQ",
              label: "Unsafe",
            },
          ];
        else if (p === "/rest/v1/product_specs")
          data = [{ id: 1, spec_key: "Switch type", spec_value: "Mechanical" }];
        else if (p === "/rest/v1/blog_posts")
          data = method === "GET" ? articles : [];
        else if (p === "/rest/v1/rpc/is_admin") data = adminRole;
        else if (p === "/rest/v1/rpc/market_browse") data = listings;
        else if (p === "/rest/v1/rpc/market_submit") {
          submitted = true;
          data = 12;
        } else if (p === "/rest/v1/seller_profiles")
          data =
            method === "GET"
              ? [{ display_name: "Fixture seller", is_pro: false }]
              : [];
        else if (p === "/rest/v1/market_listings")
          data =
            method === "PATCH"
              ? [{ id: 12, status: "approved" }]
              : (url.searchParams.get("seller_id") && submitted) || adminRole
                ? [
                    {
                      id: 12,
                      title: "Fixture listing",
                      platform: "PC",
                      description:
                        "Owned fixture item for automated regression.",
                      price: 12,
                      status: "pending",
                      seller_id: user.id,
                    },
                  ]
                : [];
        else if (p === "/rest/v1/market_listing_media") {
          if (method === "POST") {
            media.push(JSON.parse(req.postData()));
            data = [];
          } else data = media;
        } else if (p.startsWith("/storage/v1/object/sign/"))
          data = {
            signedURL: "/object/sign/market-gallery/fixture.jpg?token=fixture",
          };
        else if (p.startsWith("/storage/v1/object/")) data = { Key: "fixture" };
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(data),
        });
        return;
      }
      await route.fulfill({ status: 200, body: "" });
    });
    const test = async (name, fn) => {
      await fn();
      assert.deepEqual(errors.splice(0), [], name + ": browser runtime errors");
      passed++;
      console.log("PASS " + name);
    };
    await test("catalog loads from API and product details are real links", async () => {
      await page.goto(base);
      await page.locator("#product-grid .product-card").first().waitFor();
      assert.equal(
        await page.locator("#product-grid .product-card").count(),
        2,
      );
      assert.match(
        await page.locator("#product-grid").textContent(),
        /\$79\.50/,
      );
      assert.equal(
        await page
          .locator("#product-grid .product-card a")
          .first()
          .getAttribute("href"),
        "product.html?id=2",
      );
      assert.equal(await page.locator(".snowflake").count(), 0);
      assert.equal(await page.locator("#tc37-welcome").isVisible(), false);
    });
    await test("catalog search, sort and category filters", async () => {
      await page.locator("#tc39-search").fill("keyboard");
      assert.equal(
        await page.locator("#product-grid .product-card").count(),
        1,
      );
      await page.locator("#tc39-search").fill("");
      await page.locator("#tc39-sort").selectOption("low");
      assert.match(
        await page.locator("#product-grid .product-card").first().textContent(),
        /gift card/,
      );
      await page.locator("#tc39-category").selectOption("Gaming Accessories");
      assert.equal(
        await page.locator("#product-grid .product-card").count(),
        1,
      );
      await page.locator("#tc39-category").selectOption("");
    });
    await test("mobile menu and three language directions", async () => {
      for (const width of [1440, 1024, 768, 390, 360]) {
        await page.setViewportSize({ width, height: 900 });
        for (const locale of ["en", "fa", "ar"]) {
          if (width <= 760) {
            const menu = page.locator(".menu-toggle");
            if ((await menu.getAttribute("aria-expanded")) === "false")
              await menu.click();
          }
          await page
            .locator("#commerce-menu .locale-picker")
            .selectOption(locale);
          assert.equal(
            await page.locator("html").getAttribute("dir"),
            locale === "en" ? "ltr" : "rtl",
          );
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            true,
            "overflow " + width + " " + locale,
          );
          assert.equal(await page.locator("#hero-title").isVisible(), true);
        }
      }
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator(".menu-toggle").getAttribute("aria-expanded"),
        "false",
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.locator(".locale-picker").selectOption("en");
    });
    await test("product gallery, specifications, safe video, related and quantity limits", async () => {
      await page.goto(base + "product.html?id=2");
      await page.locator("#gallery button").first().waitFor();
      assert.equal(await page.locator("#gallery button").count(), 2);
      assert.match(await page.locator("#specs").textContent(), /Mechanical/);
      assert.equal(await page.locator("#videos iframe").count(), 1);
      await page.locator("#gallery button").nth(1).click();
      assert.match(await page.locator("#hero").getAttribute("src"), /back.png/);
      await page.locator("#zoom-image").click();
      assert.equal(await page.locator("dialog[open]").count(), 1);
      await page.keyboard.press("Escape");
      await page.locator("#quantity").fill("4");
      await page.locator("#add-to-bag").click();
      assert.match(
        await page.locator("#notice").textContent(),
        /quantity|limit/,
      );
      await page.locator("#quantity").fill("2");
      await page.locator("#add-to-bag").click();
      assert.match(await page.locator("#bag-feedback").textContent(), /Added/);
      assert.equal(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem("tc39-bag"))["2"],
        ),
        2,
      );
      assert.equal(await page.locator("#related-products a").count(), 1);
    });
    await test("cart restores from product page, checkout blocked, focus returns", async () => {
      await page.goto(base + "index.html?bag=1");
      await page.locator("#tc39-cart.open").waitFor();
      assert.match(
        await page.locator("#tc39-cart-items").textContent(),
        /Fixture keyboard/,
      );
      assert.equal(
        await page.locator("#tc45-cart-checkout").isDisabled(),
        true,
      );
      await page.keyboard.press("Escape");
      await page.locator("#commerce-menu button").last().click();
      await page.keyboard.press("Escape");
      const result = await page.evaluate(async () => {
        try {
          await fetch(
            "https://cxtytbjvdlngahytfilr.supabase.co/rest/v1/rpc/tc42_create_order",
            { method: "POST" },
          );
          return false;
        } catch {
          return true;
        }
      });
      assert.equal(result, true);
      assert.equal(
        writes.some((w) => w.path.includes("tc42_create_order")),
        false,
      );
    });
    await test("blog filters, article text XSS safety and metadata", async () => {
      await page.goto(base + "blog/");
      await page.locator("#listing .card").first().waitFor();
      assert.equal(await page.locator("#listing .card").count(), 2);
      await page.locator("#article-category").selectOption("Guides");
      assert.equal(await page.locator("#listing .card").count(), 1);
      await page.locator("#listing a").first().click();
      await page.locator("#article:not(.hidden)").waitFor();
      assert.match(
        await page.locator("#article-body").textContent(),
        /<script>/,
      );
      assert.equal(await page.evaluate(() => window.pwned), undefined);
      const schema = JSON.parse(
        await page.locator("#article-schema").textContent(),
      );
      assert.equal(schema.headline, "Fixture guide");
      assert.equal(
        await page.locator("#article-cover").getAttribute("src"),
        articles[0].cover_image_url,
      );
      await page.locator("#back").click();
      assert.equal(await page.locator("#article-filters").isVisible(), true);
    });
    await test("marketplace filtering and sort", async () => {
      await page.goto(base + "marketplace.html");
      await page.locator("#listings .card").first().waitFor();
      assert.equal(await page.locator("#listings .card").count(), 2);
      await page.locator(".listing-filters input").fill("controller");
      assert.equal(await page.locator("#listings .card:visible").count(), 1);
      await page.locator(".listing-filters input").fill("");
      await page.locator(".listing-filters select").last().selectOption("high");
      assert.match(
        await page.locator("#listings .card").first().textContent(),
        /console/,
      );
    });
    await test("seller sign in, profile, moderated submission and image upload", async () => {
      await page.locator("#email").fill("fixture@example.invalid");
      await page.locator("#password").fill("fixture-password");
      await page.locator("#signin").click();
      await page.locator("#signed:not(.hidden)").waitFor();
      await page.locator("#seller-profile:not([hidden])").waitFor();
      await page.locator("#seller-display-name").fill("Updated fixture");
      await page.locator("#seller-profile-form button").click();
      await page
        .locator("#seller-profile-status")
        .filter({ hasText: "saved" })
        .waitFor();
      await page.locator("#title").fill("Fixture listing");
      await page.locator("#platform").fill("PC");
      await page
        .locator("#description")
        .fill("Owned fixture item for automated regression.");
      await page.locator("#price").fill("12");
      await page.locator("#listing-images").setInputFiles({
        name: "fixture.png",
        mimeType: "image/png",
        buffer: pixel,
      });
      await page.locator("#submit button").click();
      await page
        .locator("#notice")
        .filter({ hasText: "Submitted for review" })
        .waitFor();
      assert.equal(
        writes.some((w) =>
          w.path.startsWith("/storage/v1/object/market-gallery/"),
        ),
        true,
      );
      assert.equal(media.length, 1);
      assert.equal(media[0].seller_id, user.id);
      assert.equal(media[0].listing_id, 12);
      await page.locator("#mine .listing-gallery").waitFor();
      assert.equal(await page.locator("#mine .listing-gallery").count(), 1);
      await page.locator("#signout").click();
      await page.locator("#signed").waitFor({ state: "hidden" });
      assert.equal(await page.locator("#signed").isVisible(), false);
    });
    await test("forged admin storage claims do not unlock content management", async () => {
      await page.evaluate(
        (s) =>
          sessionStorage.setItem(
            "tc35_auth_session",
            JSON.stringify({
              ...s,
              user: { ...s.user, app_metadata: { role: "admin" } },
            }),
          ),
        fakeSession,
      );
      await page.goto(base + "admin/");
      await page.waitForFunction(() =>
        document
          .querySelector("#status")
          .textContent.includes("Administrator login required"),
      );
      assert.equal(await page.locator("#dashboard").isVisible(), false);
    });
    await test("administrator article save and moderation request paths", async () => {
      adminRole = true;
      await page.evaluate(
        (s) => sessionStorage.setItem("tc35_auth_session", JSON.stringify(s)),
        fakeSession,
      );
      await page.goto(base + "blog/");
      await page.locator("#admin:not(.hidden)").waitFor();
      await page.locator("#title").fill("Fixture published article");
      await page.locator("#body").fill("Fixture body content");
      await page.locator("#status").selectOption("published");
      await page.locator('#editor button[type="submit"]').click();
      await page
        .locator("#message")
        .filter({ hasText: "Saved successfully" })
        .waitFor();
      assert.equal(
        writes.some(
          (w) =>
            w.path === "/rest/v1/blog_posts" &&
            JSON.parse(w.body).status === "published",
        ),
        true,
      );
      await page.goto(base + "admin/");
      await page.locator("#dashboard:not(.hidden)").waitFor();
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Approve", exact: true }).click();
      await page.waitForFunction(() =>
        document
          .querySelector("#status")
          .textContent.includes("Dashboard loaded"),
      );
      assert.equal(
        writes.some(
          (w) =>
            w.path === "/rest/v1/market_listings" &&
            w.method === "PATCH" &&
            JSON.parse(w.body).status === "approved",
        ),
        true,
      );
      adminRole = false;
      await page.evaluate(() => sessionStorage.clear());
    });
    await test("offline catalog does not show cached or synthetic inventory", async () => {
      offline = true;
      await page.evaluate(() =>
        localStorage.setItem(
          "trisocmd_test_state",
          JSON.stringify({
            lang: "en",
            dir: "ltr",
            products: [
              { id: 99, title: "Stale fixture product", status: "available" },
            ],
          }),
        ),
      );
      await page.goto(base);
      await page
        .locator("#product-grid button")
        .filter({ hasText: "Try again" })
        .waitFor();
      assert.equal(
        await page.locator("#product-grid .product-card").count(),
        0,
      );
      assert.doesNotMatch(
        await page.locator("#product-grid").textContent(),
        /Stale fixture/,
      );
      offline = false;
      await page.locator("#product-grid button").click();
      await page.locator("#product-grid .product-card").first().waitFor();
    });
    await test("content routes are responsive and remain noindex", async () => {
      for (const route of [
        "product.html?id=2",
        "marketplace.html",
        "blog/",
        "help/",
        "policies/",
        "videos/",
        "admin/",
      ]) {
        await page.goto(base + route);
        await page.locator(".locale-picker").waitFor();
        for (const locale of ["en", "fa", "ar"]) {
          await page.locator(".locale-picker").selectOption(locale);
          for (const width of [1440, 768, 390, 360]) {
            await page.setViewportSize({ width, height: 900 });
            assert.equal(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
              true,
              route + " " + locale + " " + width,
            );
          }
          assert.equal(
            await page.locator("html").getAttribute("dir"),
            locale === "en" ? "ltr" : "rtl",
          );
        }
        assert.match(
          await page.locator('meta[name="robots"]').getAttribute("content"),
          /noindex/,
        );
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    });
    await test("reduced motion preference disables animation", async () => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(base);
      assert.equal(
        await page
          .locator("#hero-title")
          .evaluate((n) => getComputedStyle(n).animationName),
        "none",
      );
      await page.emulateMedia({ reducedMotion: "no-preference" });
    });
    if (process.env.TRISO_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.TRISO_SCREENSHOT_DIR, { recursive: true });
      await page.evaluate(() => localStorage.setItem("triso_locale", "en"));
      await page.goto(base);
      await page.locator("#product-grid .product-card").first().waitFor();
      await page.screenshot({
        path: path.join(process.env.TRISO_SCREENSHOT_DIR, "store-desktop.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: path.join(process.env.TRISO_SCREENSHOT_DIR, "store-mobile.png"),
        fullPage: true,
      });
    }
    console.log(
      passed +
        " browser scenarios passed. API fixtures intercepted; no live writes.",
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
