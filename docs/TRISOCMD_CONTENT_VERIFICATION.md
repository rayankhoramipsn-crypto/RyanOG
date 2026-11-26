# Storefront, content and SEO verification

2026-11-11 (Asia/Tehran). Continues `3e96427`, existing branch and draft PR #37. No hosted writes, merge, deployment or delivery/payment activation.

## Implemented

- Product details now load specifications independently of galleries. Main/preview include keyboard-operated thumbnails, deferred approved YouTube embeds, responsive media, per-product canonical/Open Graph/Twitter/Product metadata and localized EN/FA/AR descriptions. Numeric fallback routes work for products without slugs.
- Admin media/spec editors add, edit/order and remove entries. PNG/JPEG/WebP uploads validate size, signature, decodability and dimensions before sending. New `content-media` bucket restricts admin-owned insert paths, MIME types and 5 MB size; replacement writes are denied. These are public marketing images, explicitly labeled public before upload; never use the bucket for confidential documents.
- Store catalog and admin history paginate beyond previous REST limits. Native search/category controls stay synchronized; price, new-arrival, featured and best-seller sorting use existing server-maintained merchandising/sales records. No sales statistics are invented. Admin edits preserve draft/inactive/archived statuses and include slug/SEO/Persian fields plus media/spec links.
- Blog supports full paged history, public search/category navigation, paged/searched admin entries, draft previews, idempotent create retries, editing/publishing/scheduling in UTC, cover uploads, deletion and public-content export. Plain-text bodies remain escaped; no competing CMS or unsafe HTML renderer is introduced.
- `scripts/export-content.mjs` and the browser export share one public snapshot collector. Only publishable/anon credentials are accepted. Drafts, future articles, author/session/customer fields are excluded. Optional GitHub repository variables `TRISO_CONTENT_API_URL` and `TRISO_CONTENT_PUBLIC_KEY` connect future authorized builds to the public CMS; otherwise the committed public snapshot is used. Read failures fail the build rather than replacing content with an empty export.
- `scripts/build-site.mjs --out <fresh-dir> [--content <snapshot>]` packages the site and produces script-free `/products/<slug-or-id>/`, category, article and journal pages, injects crawlable article links into the existing blog/editor route, and writes complete sitemap/robots output. A fresh output directory prevents withdrawn/draft pages surviving rebuilds. Clean routes have safe dynamic fallbacks in the existing 404 handler. Build changes are wired into the existing main-only Pages workflow; it was not deployed.
- Keyboard focus/menu controls, skip links, reduced motion, responsive dark content components, image loading/dimensions and Persian/Arabic reading order improved without replacing the existing theme.

## Migration and source evidence

Sixth additive migration `20261111200640_storefront_content.sql` adds Persian descriptions, current persisted-admin policies for blog/media, write-time content/media validators and the dedicated public image bucket. Existing content/assets remain intact. No existing table/model is replaced. Local full-schema compatibility, active roles and stale-admin revocation pass; refreshing revoked content clears draft product/article views, editor fields and private metadata; local security advisors report no issues.

A read-only authorized staging CMS query returned three available products and zero published articles. `content/published.json` contains only those public product/media/spec fields; it includes demo/test listings and is not a production catalog certification. It builds eight content pages. Existing hosted rows were not changed. Rich galleries, articles and specs are additionally exercised with isolated synthetic data.

## Validation

- `RUN_ADVISORS=1 npm test`: 58 Node, 83 PostgreSQL scenarios (25 payment, 8 browse, 50 full staging snapshot), 56 Python regressions.
- `npm run check:edge`: all four inherited Edge entrypoints.
- Serve the repository on loopback port 8765; `TRISO_CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`: seven Chromium suites, including 241-product/article pagination, editor CRUD, upload validation, main/preview, 390/768/1365px layouts, Persian/Arabic RTL, keyboard and uncaught-error checks. Backend writes are intercepted.
- `TRISO_STORAGE_TESTS=1 TRISO_INTEGRATION_CONFIG=work/local-supabase-status.json npm run test:content:local`: six dedicated real local Supabase Auth/JWT/SQL/binary-Storage scenarios. Existing disposable copies can refresh only the validator with `TRISO_REFRESH_CONTENT=1`. Hosted URLs are refused.
- New browser suite serves the actual generated build and checks product/article/blog-index HTML with JavaScript disabled, plus structured data, sitemap and robots. CI repeats full regressions/browser checks and all six migrations against fresh local Supabase with real JWT/Storage tests.

## Remaining external gates

All six feature migrations remain unapplied to hosted projects. Hosted editor/upload acceptance requires an authorized staging rollout. Existing hosted public products have no media/spec rows and there are no published articles; actual editorial content/media authoring remains an operator task, not a tested production outcome. The public snapshot/build was verified using the authorized database connection; direct Supabase HTTP access and changelog remain blocked by this execution environment's domain policy.

Indexing stays deliberately disabled (`noindex,nofollow`, `Disallow: /`) under the existing staging/release rule. `--indexable` is an explicit renderer/build option for a later authorized release; shell noindex/staging markers and existing deployment checks still require review. No search-engine indexing, production SEO readiness or live editor/upload outcome is claimed. Firefox downloads remain externally blocked. Previously recorded live Auth/payment/email/push gates are unchanged.
