# Site and journal review

Changes prepared on `fix/site-blog`; no deployment or database writes performed.

## Fixed

- Blog and product API constants shadowed the browser URL constructor. Every valid image URL was rejected; product YouTube URLs were also rejected. Renamed the constants in both root and preview pages.
- Missing snowflake references now point to the existing asset. Main packaging includes the image and app script.
- Preview CI previously published to the same Pages destination as the main deployment, with an incomplete artifact. Preview now builds a downloadable review artifact, preserving `/preview/` paths and root assets, without deploying or requiring Pages write permissions. Main deployment stays separate.
- Article creation now retains the returned ID, so subsequent saves update the article. Empty mutation responses are treated as a failure, and failed requests release the save button.
- Cover URLs are validated before saving. Editor preview uses text nodes, including for HTML-looking text.
- Blog admin visibility uses a fresh Auth user response, rather than trusting cached role metadata. Expiring sessions refresh when possible. Public article reads use anonymous access; administrative reads and writes use the session. Database RLS remains the authorization boundary.
- Added search, language filtering, EN/FA/AR editor labels, RTL article rendering, draft preview, and metadata reset on returning to the article list. Existing draft/published/archived workflow remains available.

## Validation

- `python3 tests/test_staging_routes.py`: 6 tests.
- `python3 tests/test_site_artifacts.py`: 3 tests; executes the actual assembly scripts in temporary checkouts and verifies page and image assets.
- `node tests/browser/blog.cjs`: 32 assertions across root and preview, using fixture responses. Exercises article loading, cover rendering, search, RTL, plain-text injection safety, metadata reset, guest and verified-role guards, HTTPS validation, preview, create/update, duplicate-slug recovery, publication/archive, product image and YouTube rendering. Uses Playwright and system Chromium available in the cloud environment. Start the stdlib HTTP server on port 8000 first. Browser dependencies are not installed by repository CI.
- All 42 inline JavaScript blocks and both standalone app scripts passed syntax checks.
- Eight main routes checked at a 390px viewport with fixture API responses: no uncaught JavaScript errors or horizontal page overflow.

## Remaining limits and release checks

These checks are not real Supabase integration tests. The staging Supabase hostname is outside the environment's current network allowlist, and no staging administrator session is supplied. Before release, verify real admin login, refresh, create/edit/publish/archive, duplicate-slug handling, anonymous draft restrictions, and customer write denial against staging. No credentials or tokens should be put in this document.

The browser fixture suite does not verify external images or video availability, email, payments, live marketplace moderation, or database policies. Existing SECURITY DEFINER and leaked-password-protection findings in INFRASTRUCTURE_STATUS.md remain open. Checkout was not enabled or changed.

Staging keeps noindex,nofollow. Articles still use client-fetched query-string routes. Production SEO needs a separate confirmed public origin, prerendered article pages, sitemap and canonical generation, and review of what is safe to index. This change does not claim those are complete or that search engines index the site.

## Manual review

Run `python3 -m http.server 8000 --bind 127.0.0.1` from the repository. Check the root and preview journal, switch EN/FA/AR, search/filter articles, and review keyboard and mobile behavior. With a real staging admin session, create a draft, save twice, preview, publish, then archive it; confirm anonymous readers only see published articles. Download the staging CI artifact and serve its root to inspect `/preview/`. Review both artifact tests before merging workflow changes. Merging main can trigger the existing main deployment workflow; do not merge or deploy without approval.

## Staging validation continuation

See [BLOG_STAGING_VALIDATION.md](BLOG_STAGING_VALIDATION.md) for the verified schema, grants and RLS inspection, confirmed editor-session fixes, 46 passing fixture browser checks, and explicit untested real-account flows. The prepared transaction-scoped SQL mutation suite did not execute successfully and is not counted as passed. No database, payment, deployment setting or existing content was changed.
