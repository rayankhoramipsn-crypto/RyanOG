# TRISOCMD — isolated staging

This branch is **not production**. `main` currently serves the public site and must not be changed until security and checkout tests pass.

## Current state
- Supabase project: `TRISO TEST` (`cxtytbjvdlngahytfilr`), **not** the production Supabase project.
- Staging tables: `products`, `orders`, `order_items`, `support_tickets`, `tc42_orders`, `tc42_support_threads`, `tc42_support_messages`.
- Supabase Auth admin role is assigned via `app_metadata` to the designated admin user.
- The version 5.3 preview bundle exists outside this GitHub branch; it is **not yet committed** here.
- This branch initially contains the production snapshot. Do not assume its code uses the staging database.

## Release gates
1. Integrate the reviewed preview source and assets into this branch.
2. Ensure all Supabase URLs point to the test project and **only publishable/anon keys** appear in browser code.
3. Test login/logout, fresh admin JWT, product CRUD, stock, customer checkout, order ownership, and support RLS.
4. Confirm no browser-only admin bypass or public write policies; test unauthenticated requests.
5. Keep all payments in test/manual-review mode; never mark orders paid from browser-submitted data.
6. Check accessibility/mobile rendering, CSP, links, and SEO before promotion.
7. Publish a separate staging URL and verify it does not use the production custom domain.
8. Merge to `main` only after user approval and successful QA.

## Current security findings
- Supabase advisor flags `public.tc42_create_order(jsonb)` as a callable SECURITY DEFINER function. This is intentional for server-side price validation but requires a dedicated abuse/security review.
- Supabase Auth leaked-password protection is disabled; review Auth settings before launch.
