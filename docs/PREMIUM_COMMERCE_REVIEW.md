# TRISOCMD premium commerce review

Date: 2026-10-30. Branch: `feat/premium-gaming-commerce`.

The redesign is implemented under `preview/` and synchronized to the root site
paths on this feature branch. The existing staging project configuration and
noindex remain intact in both copies. No live website was deployed. This is a
reviewable release, not approval to enable commerce or publish to `trisocmd.shop`.

## Implemented

- Shared restrained charcoal/purple design system, responsive navigation, local
  controller illustration, consistent cards/forms, visible keyboard focus,
  reduced-motion handling, gallery lightboxes and bag focus management.
- Storefront opens directly, with search, real category filters, price sorting,
  newest-first available inventory, currency formatting, loading skeletons,
  retry/empty states, and semantic links to product pages. Cached/sample products
  no longer appear as live inventory when the API is unavailable.
- Product pages load specifications (previously never loaded), images, approved
  YouTube URL forms, related products, stock/quantity limits, and a local bag.
  Fixed a `URL` string variable shadowing the browser URL constructor on product,
  journal and marketplace pages. No invented reviews or sales figures.
- Marketplace search/platform/price controls; existing moderated submission and
  buyer/seller messages retained. Added private six-image gallery uploads,
  previews, image lightboxes/removal, submission retry for partial upload failures,
  deep links for moderator image review, owner profile editing and real submission
  summaries. A submission with upload errors remains pending and can be repaired
  from My submissions; it is not silently submitted again.
- Admin sidebar, existing moderation/read-only orders/support views, links to
  listing galleries, and category rename across products with existing admin RLS.
  Existing product CRUD and support inbox remain in the account dashboard.
- Journal search/category filters, readable article layout, related articles,
  Article structured data, cover image handling, and existing draft/publish editor.
  Article text is rendered as text, including strings resembling HTML/scripts.
  Failed initial editor lookups are now handled inside the submit error boundary.
- Shared EN/FA/AR language preference, direction, interface dictionaries and
  cross-page navigation. Product and editorial content remains authored content;
  no automatic translation of database content is claimed.
- Shared content-page session restoration refreshes tokens and verifies the
  current user via Auth before deriving admin UI state. Server RLS is the actual
  access boundary; no privileges derive from editable user metadata.
- Staging checkout is disabled in UI and guarded before legacy scripts load.
  This browser guard is a precaution, not backend authorization. No payment
  providers, production credentials, production data, DNS or hosting changed.
- Removed competing preview-to-Pages deployment on main. The preview workflow
  now builds a downloadable full-site artifact, including all routes/assets,
  without deploying. The root publishing workflow is now manual-only and depends on passing tests;
  merges/pushes cannot deploy. Root publishing includes every shared asset.

## Database change

Only staging project `cxtytbjvdlngahytfilr` was changed.

`supabase/migrations/20261030193709_marketplace_private_gallery.sql` adds
`market_listing_media`, indexes, row policies, and a private `market-gallery`
Storage bucket (JPEG/PNG/WebP, 5 MiB per image). Positions 0–5 enforce six media
rows per listing. Sellers can attach/remove media only on their own pending
listings; approved rows are publicly readable; administrators can moderate media.
Storage object policies enforce owner paths and pending status for uploads.
Signed URLs expire in five minutes. Public views/functions were not added, and
existing moderation/authentication policies were not weakened.

The migration filename matches the remote history version. The old schema's
baseline is not in this repository; this is an additive migration, not a fresh
Supabase installation. See `supabase/README.md` before any future rollout.

## Validation actually performed

- `python3 tests/test_staging_routes.py`: **10 checks passed**, covering all eight
  staging pages, local assets, noindex, media safety, disabled product purchasing,
  editor/moderation guards and gallery migration invariants.
- `node tests/check_scripts.cjs`: **25 JavaScript sources parsed**.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm test`: static checks and
  **13 browser scenarios passed** in Chromium. Remote requests were intercepted
  with test fixtures. Covers inventory links/search/sort, 360–1440 px layouts,
  EN/FA/AR direction, menu, gallery/specs/YouTube restrictions, quantity limits,
  bag restore/checkout guard, article XSS/metadata/filtering, listing filtering,
  seller profile/submission/upload/logout, forged cached admin claims, article
  publishing, moderation requests, offline retry, noindex, reduced motion.
- `tests/staging_gallery_rls.sql` executed successfully against staging: owner
  access, stranger/anonymous denial for pending media, public reads after approval,
  and seller write/delete denial after approval. Synthetic users/listings were
  rolled back. A subsequent read confirmed **zero remaining fixture listings**.
  These are SQL role/claim tests, not real signed JWT HTTP tests.
- Verified the private bucket configuration, all three Storage policies, remote
  migration history, and RLS metadata. Reran Supabase security advisors: existing
  SECURITY DEFINER exposure and leaked-password warnings remain; no new warning
  category was introduced by the gallery migration.
- `git diff --check` passed. Root/preview byte parity and manual-only deployment
  gates are covered by regression checks. Existing remote production was untouched.

## Limits and remaining release work

1. Live Auth login/recovery, email delivery, real JWT authorization, Storage HTTP
   upload/sign/download, and multi-user messaging require an actual staging E2E
   pass. The managed environment currently only allows package-manager/GitHub
   HTTP hosts. Add outbound access to
   `cxtytbjvdlngahytfilr.supabase.co` in the environment network configuration and
   provide disposable customer/seller/admin accounts through a secret manager.
   Configure the staging origin in Supabase Auth Site URL/redirect allowlist;
   configure an email provider if email tests are required. Never send privileged
   keys or test passwords in source or reports. A database password is not needed
   for the browser flows, and no production access is needed.
2. Featured/best-seller/discount badges were not invented. The current schema has
   no trusted merchandising flags, public sales aggregates, or promotion data.
   New arrivals and real inventory work; additional sections need approved data
   and an agreed backend contract.
3. Seller profile editing exists; a public seller directory/profile route with
   explicit public-field/privacy rules is not implemented. The existing profile
   table remains owner/admin readable.
4. Orders and support have parallel legacy tables. Read-only operations and the
   existing account support inbox were preserved. No order-table consolidation,
   fulfillment automation or checkout activation was attempted.
5. Staging remains `noindex,nofollow`. Article routes still use query strings and
   client fetching. Production prerendered URLs, canonical/sitemap generation,
   final legal policies, and public indexing require the separate release work.
6. Storage MIME/size restrictions and moderation are implemented; file malware/
   content scanning, server-side rate/byte quotas, and orphan-object cleanup are
   not. An interrupted upload can leave a private orphan. Signed links can remain
   valid for up to five minutes after moderation changes.
7. Some dynamic legacy error/status messages still fall back to English. New
   storefront controls, shared static UI, help/policy copy and RTL/LTR layouts are
   localized; a native-language editorial/accessibility review remains advisable.
8. Existing security findings require review before payments/production:
   - [Anonymous SECURITY DEFINER execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
   - [Authenticated SECURITY DEFINER execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
   - [Leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
   These warnings do not by themselves establish exploitable access; function
   contracts and actual role tests are required before changing privileges.

## Changed files

- Root `index.html`, `product.html`, `marketplace.html`, `assets/`, `admin/`,
  `blog/`, `help/`, `policies/`, `videos/` mirror the reviewed preview files.
- `preview/index.html`, `preview/product.html`, `preview/marketplace.html`
- `preview/admin/index.html`, `preview/blog/index.html`, `preview/help/index.html`,
  `preview/policies/index.html`, `preview/videos/index.html`
- `preview/assets/commerce.css`, `legacy-screens.css`, `commerce.js`, `locales.js`,
  `session.js`, `staging-safety.js`, `marketplace.js`, `admin.js`, `gear.svg`
- `supabase/migrations/20261030193709_marketplace_private_gallery.sql`,
  `supabase/README.md`
- `tests/browser.cjs`, `tests/check_scripts.cjs`, `tests/staging_gallery_rls.sql`,
  `tests/test_staging_routes.py`
- `package.json`, `package-lock.json`, `.gitignore`, `scripts/sync_preview.py`
- `.github/workflows/staging-checks.yml`, `.github/workflows/jekyll-gh-pages.yml`,
  `.github/workflows/deploy-main-pages.yml`
- `docs/PREMIUM_COMMERCE_REVIEW.md`

## Local review

Root files are the canonical source. After editing them, run `npm run sync:preview`;
the regression suite rejects drift in the checked-in preview copies.

```sh
npm ci
npx playwright install chromium
npm test
python3 -m http.server 4173
```

Open `http://localhost:4173/preview/`. Use the same browser tab for authenticated
content/admin navigation. The full staging artifact is also produced by the
“Build staging preview artifact” GitHub Actions workflow. No public preview has
been deployed by this change. Merging does not deploy. Manually dispatch the publish workflow only after
explicit release approval; it reruns the tests before publishing.
