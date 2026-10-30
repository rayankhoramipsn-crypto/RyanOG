# TRISOCMD engineering instructions

## Project scope
TRISOCMD is a gaming storefront, editorial blog, and moderated community marketplace. The live site and staging preview are distinct. The staging Supabase project is cxtytbjvdlngahytfilr; production Supabase is separate.

## Non-negotiable safeguards
- Work on a feature branch and use pull requests. Do not deploy production without explicit approval.
- Never modify production Supabase data, credentials, DNS, payment systems, or enable checkout while testing.
- Do not expose service_role, API secrets, private tokens, or customer data in client code or commits.
- Keep staging pages noindex,nofollow; only remove from real public pages when ready to index.
- Prefer additive migrations with RLS and least-privilege grants; verify every migration and run Supabase security advisors.
- Do not weaken authentication, authorization, or marketplace moderation to make features work.
- Review SECURITY DEFINER RPCs, especially market_set_pro and tc42_create_order, before allowing production use.
- Do not facilitate stolen accounts, compromised credentials, or unauthorized access.
- Keep existing functionality and preserve EN/FA/AR support; ensure RTL is correct.

## Design direction (after infrastructure)
Modern Store: premium, restrained dark ecommerce with clean typography, strong product photography, accessible components, mobile-first layouts, and subtle performant motion. Product detail pages should support image galleries, specs, and optional YouTube review/unboxing embeds. Honor reduced-motion settings.

## Development workflow
1. Inspect actual files, routes, DB schema and dependencies; do not assume features exist.
2. Describe the intended change and its impact.
3. Implement in small reversible steps on a branch.
4. Run tests or clearly state which tests cannot run.
5. Include changed files, migration notes, security implications and manual verification steps in PR.
6. Never claim that Google indexing, email delivery, payment processing or authentication is working without an actual end-to-end check.

## Staging database content foundation
- public.blog_posts: editorial articles, draft/published/archived, per-article SEO fields, admin-only writes, published-only public reads.
- public.product_media: ordered image and YouTube URLs, admin-only writes, public reads for available products.
- public.products: optional slug, seo_title, seo_description.
- Existing orders, marketplace and support tables remain in place. Avoid creating duplicate order systems.
- Admin authorization currently uses JWT app_metadata.role=admin; never trust user_metadata for admin decisions. Consider claim freshness and defense in depth.

## SEO
Provide indexable production URLs, unique canonical and metadata, accessible HTML article content, sitemap and robots, Article/Product structured data where appropriate. Indexing/ranking cannot be guaranteed.
