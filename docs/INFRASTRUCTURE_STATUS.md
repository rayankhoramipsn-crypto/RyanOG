# TRISOCMD staging infrastructure status

Updated: 2026-10-30

## Verified completed
- Staging Supabase project: `cxtytbjvdlngahytfilr` (production project untouched).
- Existing tables: products, orders, order_items, support_tickets, tc42_orders, tc42_support_threads, tc42_support_messages, seller_profiles, market_listings, market_conversations, market_messages. All existing public tables reported RLS enabled.
- Applied staging migration `triso_staging_blog_product_media_foundation` successfully:
  - `public.blog_posts` with article title, slug, excerpt, body, cover image, category, language, SEO title/description, status, author, publish and audit timestamps.
  - `public.product_media` with ordered image/YouTube media entries linked to products.
  - `public.products` now has optional `slug`, `seo_title`, `seo_description`.
  - RLS enabled for new tables; admin JWT app_metadata.role controls writes; only published posts and available product media are public.
- Verified policies exist by querying pg_policies. Ran security advisor after migration; existing SECURITY DEFINER warnings remain.

## Not yet complete / must be tested
- Browser E2E of admin blog CRUD, media rendering, login/recovery and marketplace.
- Blog CMS and product page UI; no claim these exist.
- Production robots.txt, sitemap.xml, canonical URLs, Google Search Console verification and indexing.
- Audit of existing SECURITY DEFINER functions: market_browse, market_send_message, market_set_pro, market_start_chat, market_submit, tc42_create_order. Do not blindly revoke privileges without understanding dependent flows.
- Supabase leaked-password protection disabled; enable in staging Auth settings if available.
- Review admin role claim freshness, image URL and YouTube allowlist validation, file upload security.
- Existing order tables are duplicated in concept (orders vs tc42_orders); decide canonical order model before expanding checkout.
- Do not enable payments or deploy to production.

## Product media integration
Use `product_media` sorted by `sort_order,id`. For YouTube, extract a valid video ID from approved youtube.com/youtu.be URL forms and embed only from `https://www.youtube-nocookie.com/embed/{videoId}` with an appropriate sandbox/referrer policy. Do not insert arbitrary user-controlled iframe HTML. Only embed videos permitted by their owner.

## Blog integration
Only admin can create/edit drafts; public users can read published posts after published_at. Build static-indexable article pages or a suitable prerendering strategy; client-only routes may be less reliable for SEO. Add admin editor, sanitization, unique slugs, sitemap generation and a publication workflow.

## Recommended next steps for Codex
1. Audit existing repository routes, UI and Supabase auth/RPC callers.
2. Write and run authorization tests against a disposable staging user.
3. Build admin blog editor and product media manager using new tables.
4. Add accessible public article/product pages and SEO infrastructure.
5. Build Modern Store design system and migrate screens progressively.
6. Test responsive design, performance, accessibility, RTL and regressions.

## Implemented staging frontend (feature branch)
- `preview/blog/index.html`: public published-article list and article view, admin create/edit/draft/publish using Supabase REST and existing staging session. All article content rendered as text to avoid HTML injection. Staging noindex remains enabled.
- `preview/product.html?id=<numeric-product-id>`: product details, ordered image gallery, YouTube-nocookie review embeds with strict video ID validation, admin add/remove media. Checkout intentionally disabled.
- Applied migration `triso_staging_content_validation`: HTTPS URL constraints and lookup indexes.
- These frontend changes are on the feature branch only. They are NOT deployed or browser-E2E-tested. Link integration with the existing storefront remains for Codex.
- Current content pages use query-string routes and browser-fetched data. Production SEO requires crawlable/prerendered URLs and a generated sitemap, not just changing noindex.
- Security review of `market_set_pro` confirmed an admin check; `tc42_create_order` validates product price/stock server-side. Further tests remain essential.
