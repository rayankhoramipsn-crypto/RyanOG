# Staging Auth and protected routes

Project: TRISO TEST (`cxtytbjvdlngahytfilr`). No database migrations or remote configuration changes are needed for this change. The existing enabled publishable key and email/password Auth endpoints are used. No privileged credentials are shipped.

## Routes and behavior

- `auth.html`: email/password sign-in and registration, with a return URL limited to the app's origin and deployment path. Confirmation-required signups show an email instruction.
- `account.html`: requires a server-verified user, displays that user's RLS-filtered orders, and offers server sign-out.
- `admin/`: requires a fresh `/auth/v1/user` response with `app_metadata.role=admin` before loading, and rechecks before each API operation.
- `blog/`: stays public; editor privileges come from a verified user, and writes recheck admin status.
- `marketplace.html`: retains public browsing and existing login UI; REST requests validate/refresh sessions, and logout revokes the server session.
- Existing store login, Google callback and password recovery remain available. Sessions share `tc35_auth_session` in sessionStorage, within the same browser tab. Open account/admin in the same tab after signing in.

`auth.js` refreshes tokens with a 90 second margin, shares concurrent verification, and replaces stored user data with the Auth server's response. A failed verification never grants access. Invalid refresh credentials clear storage; network errors preserve credentials for retry. Local credentials clear even if remote sign-out fails, with an explicit failure message.

These are static GitHub Pages routes: HTML is publicly downloadable. Client guards control navigation and rendering; Supabase grants, RLS and RPC authorization are the security boundary. All public tables currently have RLS enabled (verified through a staging query). Existing policies limit orders/support to their owner or admins, marketplace conversations to participants/admins, and editorial writes to admins. JWT role changes can remain stale at the database until token refresh; fresh user checks in the UI do not replace token expiry/revocation strategy for sensitive operations.

## Validation and remaining checks

Passed: seven executable session tests (`node tests/test_auth.cjs`), six staging static regressions (`python3 tests/test_staging_routes.py`), inline JS syntax checks, and `git diff --check`. Tests cover forged stored admin data, guest redirects, concurrent refresh, invalid refresh, offline denial, open redirects and failed remote logout. Both Pages packaging workflows now include Auth assets; CI runs Auth tests.

No real account/password was supplied. Live email confirmation, recovery delivery, OAuth, and authenticated browser behavior have NOT been checked end to end. The environment's outbound proxy was unreachable; the changelog fetch also failed. Current Auth documentation was consulted through Supabase search_docs.

Before merging/deploying, test on staging:
1. Visit `account.html` as a guest; sign in and confirm the return navigation.
2. Sign up with a test email, complete confirmation, and sign in. Test store password recovery.
3. Verify customer access to account and denial at `admin/`, then verify admin access using a staging admin.
4. Expire the access token; verify refresh and repeat a protected operation.
5. Use two staging customers to confirm private orders/messages cannot be read across accounts through direct API requests.
6. Sign out, revisit a protected route, and verify the server session cannot refresh.

## Existing Supabase advisories

Security advisors flag publicly executable SECURITY DEFINER RPCs and disabled leaked-password protection. `market_set_pro` checks `is_admin()` and `tc42_create_order` checks `auth.uid()`; review the full marketplace/order RPC authorization before production. This change does not alter those functions, enable payments, or change production.

- RPC advisories: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Leaked password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Two existing workflows publish to the same GitHub Pages environment on main pushes. Both now package the Auth files, but their competing deployment behavior should be resolved separately before a production rollout. No deployment is performed by this branch.
