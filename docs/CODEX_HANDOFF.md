# Codex handoff — TRISOCMD

Start by reading `AGENTS.md` and `docs/INFRASTRUCTURE_STATUS.md`. Inspect actual code before changing it.

Primary objective: modernize the storefront and finish product/blog/marketplace UX without compromising security.

Phase A: Audit codebase and staging DB integrations; document confirmed features, missing functionality, and broken flows. Run available tests. Do not change production.

Phase B: Implement blog admin CRUD (draft/publish), article routes and SEO. Use public.blog_posts; do not create duplicate schema. Include sanitization, article image support, canonical URLs and sitemap.

Phase C: Implement product detail pages with galleries, specs, embedded approved YouTube reviews/unboxing, and responsive layouts. Use public.product_media and products SEO fields.

Phase D: Build Modern Store UI system and progressively update shop, product pages, blog and marketplace with polished animations, accessible contrast, reduced-motion support and mobile-first design.

Phase E: Security and reliability: review Supabase RPC SECURITY DEFINER functions, user roles, RLS, chat permissions, admin authorization, checkout state, XSS and rate limits. Never deploy or enable payments without approval.

Deliver each phase as a separate pull request with tests and a summary of outstanding risks.

## New implemented files
- `preview/blog/index.html`: editorial UI + admin CRUD
- `preview/product.html`: product gallery, YouTube reviews, specs, admin media/spec editor
- `preview/videos/index.html`: approved-product YouTube hub
- `preview/help/index.html`: customer FAQ
- `preview/policies/index.html`: non-final policy drafts
- `tests/test_staging_routes.py`: static regression checks; CI at `.github/workflows/staging-checks.yml`
- `docs/staging_verification.sql`: read-only RLS/RPC audit queries

Review and run tests before changing design. Preserve staging noindex, safe YouTube URL handling, admin-only write access and disabled checkout. Improve blog SEO with prerendered article URLs rather than relying on query-string client-side rendering.
