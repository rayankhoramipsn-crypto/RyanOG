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

## Connection and SQL safety recheck

The connector again resolved `cxtytbjvdlngahytfilr` to TRISO TEST / ACTIVE_HEALTHY and returned the expected API URL. A fresh SQL query resolved the existing blog table successfully. This confirms connector/database access, not executor-to-Auth API access. The executor's fresh health request again failed connecting to its inherited proxy (curl exit 7, HTTP 000); no password or token was sent.

The SQL suite was reviewed before resubmission. Reviewed SHA-256: `74206aa38db105afc0cca474b2932ceb37b5aea979c051b8a88a8269a2bd5769`.

Safety review:
- One BEGIN/ROLLBACK transaction; no COMMIT, permanent DDL, policy changes, RLS bypass changes, Auth configuration changes or external calls.
- Temporary context/results tables and temporary grants only; timeouts limit statement execution and lock waiting.
- Four own randomized-prefix article fixtures plus one own randomized UUID Auth FK parent. This parent has no password/identity/session and is not used as a real account.
- Every UPDATE/DELETE targets only that randomized prefix or the newly returned article ID. Existing content is not a target.
- Fresh catalog check found zero noninternal triggers on both auth.users and blog_posts. This inspection is a prerequisite to future runs as triggers could introduce other effects.
- Any uncaught SQL failure aborts the transaction; ROLLBACK or disconnect is required to release an aborted transaction. Successful completion explicitly ROLLBACKs fixtures and temporary objects. This suite must be submitted as a single batch, not copied as individually committed statements.

Despite the fresh request and user authorization, the connector again returned `status=expired`, “This confirmation expired after 2 minutes.” No 19-check results were returned. The suite remains **NOT EXECUTED / NOT PASSED**; there was no claimed automatic-approval rejection or database SQL assertion failure. A subsequent audit still found zero blog rows and RLS enabled. No persistent test rows or schema changes are reported.

Separate read-only transactions actually executed:

| Database role/claims (simulated) | Observed result | Limit |
| --- | --- | --- |
| anon | zero visible rows; INSERT/UPDATE/DELETE table grants all false | proves missing table grants, not an HTTP mutation test |
| authenticated / app_metadata customer / user_metadata admin | zero visible rows; is_admin() false | no populated-row or signed-JWT test |
| authenticated / app_metadata admin / user_metadata customer | zero visible rows; is_admin() true | no admin mutation or login test |

The table is empty, so zero leaked rows must not be interpreted as full visibility coverage. Creating/editing/publishing/archiving/deleting real staging articles and real login/refresh remain untested. The earlier 9 Python / 46 fixture browser checks are previous results, not new real-account results.

The environment still reports no credential/secret bindings. Existing Auth users were not inspected for credentials or reused. [BLOG_REAL_ACCOUNT_SETUP.md](BLOG_REAL_ACCOUNT_SETUP.md) now gives the exact safe provisioning, app_metadata assignment, staging-only network access, four runtime secret bindings, real-browser test procedure and own-fixture cleanup route. No passwords or tokens should be provided in chat.

## Executable live runner added (2026-10-31 client date)

`tests/browser/blog-live.cjs` now implements the real browser flow and directly consumes the four documented Secrets from process.env. It starts an allowlisted localhost server, logs in through the actual storefront form, uses real user JWTs, verifies distinct accounts/app_metadata through Auth, executes blog CRUD/RLS checks and actual refresh/save, and cleans up only its randomized article prefix. It never uses service_role or mocks API responses. The original fixture runner is unchanged.

Actual runs this revision: the live command exited 2 with missing_secret_bindings and all 28 account checks NOT_RUN; the Chromium preflight exited 1 with network UNAVAILABLE, and a separate curl health probe again failed reaching the inherited proxy (exit 7 / HTTP 000). Runtime status again reports no Secrets/runtime bindings and no staging domain in the network allowlist. No real account case was passed or attempted with supplied credentials.

Three executable local safety tests passed for missing-secret fail-closed behavior, browser-child secret isolation and mutation ownership guards. Nine Python regression tests passed again. These results must remain separate from real Supabase tests. The 19 SQL checks remain unexecuted; the live runner cannot and does not run that administrative SQL suite.

See `tests/browser/BLOG_LIVE.md` for executable commands, exact consumed variable names, 28 result names, cleanup behavior and reporting limitations. After account and network prerequisites are provisioned, run the live command and record each actual result; do not infer them from the safety or fixture suite.
