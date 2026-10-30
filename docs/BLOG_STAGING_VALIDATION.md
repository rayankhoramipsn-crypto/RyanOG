# Blog staging validation continuation

Scope: `rayankhoramipsn-crypto/RyanOG`, `fix/site-blog`, baseline `2d77a8af568681c55d2c5147ec9036c0455c8aef`. Supabase project `cxtytbjvdlngahytfilr` (TRISO TEST, ACTIVE_HEALTHY), verified through list_projects and successful SQL catalog queries. Production, payments, deployment settings, workflows and merge state were not changed.

## Confirmed and corrected frontend defects

1. Session renewal ran only at page initialization. Keeping the editor open past expiry caused later saves to use the expired token. The expanded browser test fails on the baseline (expected one refresh, observed zero) and passes with the fix.
2. An already-open editor retained its initial administrator decision. Administrative requests now fetch the current Auth user before proceeding, deny a changed role, hide the editor and clear the admin list. This is defense in depth: RLS remains responsible for actual data authorization.
3. A 401 from Auth now triggers one refresh and a second user verification, even if cached expiry appears valid or is missing. Refresh responses without expires_at are normalized using expires_in; concurrent checks share one in-flight verification. Invalid credentials clear the saved session; network failures deny administrative work without deleting refresh credentials.

Changed application files: `blog/index.html` and its matching `preview/blog/index.html`. Expanded fixture suite: `tests/browser/blog.cjs`. No dependencies or publication configuration changed.

## Actual staging database inspection

Existing `public.blog_posts` has 15 columns: id, slug, title, excerpt, body, cover_image_url, category, language, seo_title, seo_description, status, author_id, published_at, created_at, updated_at. No duplicate table was created.

Verified constraints:
- UUID primary key; unique slug plus Latin lowercase/digit/hyphen format.
- Trimmed title length 3–180.
- Language limited to en/fa/ar; status to draft/published/archived.
- Published state requires published_at.
- Cover URL is NULL or matches an HTTPS/no-whitespace constraint.
- author_id references auth.users.

RLS is enabled (not forced). `anon` has SELECT only; `authenticated` has SELECT/INSERT/UPDATE/DELETE, constrained by RLS. Public SELECT requires status=published AND published_at<=now(). Admin SELECT/UPDATE/DELETE require JWT app_metadata.role=admin. INSERT also requires author_id=auth.uid(). UPDATE has both USING and WITH CHECK. No blog policy trusts user_metadata. Primary/slug unique indexes and two partial published-article indexes exist; no noninternal triggers were found.

The table currently contains **zero rows**. Read-only transactions were executed as anon and as authenticated with simulated customer/admin claims. Each saw zero rows; forged user_metadata.role=admin with app_metadata.role=customer remained nonadmin. These demonstrate role switching and empty-table reads only. They do **not** prove visibility of populated states, mutation denial, signed-JWT validation, or actual Auth login.

## Tests actually run

- `python3 tests/test_staging_routes.py`: 6 passed.
- `python3 tests/test_site_artifacts.py`: 3 passed; existing artifact assembly scripts were tested without editing or running deployment workflows.
- `node tests/browser/blog.cjs`: **46 fixture browser checks passed**, across root and preview at a 390px viewport. Includes original CRUD/publication/archive fixtures, duplicate slug recovery, empty/500 save responses, preserved edit ID, HTTPS rejection, Arabic/FA RTL, plain-text malicious content, mobile overflow, session expiry during editing, 401 recovery, and role downgrade while the page remains open.
- The new expiry regression was run against baseline HTML and failed as expected before the fix.
- Changed inline JavaScript parses; `git diff --check` passed.

Browser requests were intercepted with fixtures. None of these browser checks contacted real Supabase, verified an external cover image/video, or authenticated a real account.

## Prepared but NOT executed

`tests/sql/blog_rls.sql` is a transaction-scoped, 19-check role/claim simulation suite covering populated publication states, guest/customer mutation denial (including forged user_metadata), admin create/edit/publish/archive/delete, slug uniqueness, HTTPS, language and date constraints. It creates only its own randomized fixtures plus a disposable FK parent in auth.users, then ROLLBACKs everything. The FK parent is not a usable Auth account.

The attempted execution returned tool status `expired`: “This confirmation expired after 2 minutes.” There was no successful mutation result. Subsequent catalog query confirmed blog_posts still had zero rows. The suite is retained for review and must not be described as passed. It is not a migration, does not change schema/policies, and is not an end-to-end Auth test.

## Remaining requirements and limitations

The cloud environment reports no configured secrets, runtime credentials, or outbound identities. Its destination policy omits the staging API hostname, and command-line network requests failed because the inherited proxy was unreachable. The Supabase connector provides database administration, but no usable real customer/admin login was available. No existing credentials, user records or sessions were harvested.

Still untested: actual email/password login, real refresh-token rotation, JWT/API authorization for guest/customer/admin, visibility of draft/archived/future records with real requests, live admin CRUD, and external media availability. Run these with disposable staging accounts on an environment authorized to reach the staging API; never substitute a service credential for user JWTs. Do not publish or merge based on the fixture results alone.

No database migration was needed or applied. No persistent test data was created, so there was nothing to delete. Existing content was not modified.

Security advisors still report the previously documented exposed SECURITY DEFINER RPCs and disabled leaked-password protection; no blog-specific RLS warning was returned. These settings were left unchanged.
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
