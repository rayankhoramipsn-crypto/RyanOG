# Real staging blog runner

`blog-live.cjs` is separate from the unchanged fixture suite `blog.cjs`. It uses real browser fetches to **cxtytbjvdlngahytfilr.supabase.co** only. It does not accept a project override, admin key, saved token or alternate remote app origin. It starts its own ephemeral localhost static server; no deployment or existing port-8000 server is needed.

Runtime: Node.js, Playwright, and system Chromium at `/usr/bin/chromium` (the same browser/dependency already used by the fixture suite in this workspace). Run from the repository:

```sh
node tests/browser/blog-live.cjs --preflight
node tests/browser/blog-live.cjs
```

The second command actually reads all four Secrets from process.env:

```text
TRISO_TEST_ADMIN_EMAIL
TRISO_TEST_ADMIN_PASSWORD
TRISO_TEST_USER_EMAIL
TRISO_TEST_USER_PASSWORD
```

Provide these through the runtime's secure secret bindings, never as command-line assignments or committed files. Provision two separate **dedicated test accounts**, with server-controlled app_metadata roles admin and customer, as described in `docs/BLOG_REAL_ACCOUNT_SETUP.md`. Do not inject secret/service_role keys. The publishable key comes from the staging app itself. Standard HTTPS_PROXY/HTTP_PROXY settings are honored by Chromium; loopback bypasses the proxy. The environment must permit HTTPS to the staging hostname and have a functioning proxy. TLS verification is retained.

## What it executes

28 independently named report entries cover actual storefront UI password login for both accounts, Auth-server role verification and distinct IDs, separate guest/customer contexts, UI draft creation and same-ID editing, four simultaneous state fixtures, unfiltered RLS reads and direct-ID hiding, guest/customer insert/update/delete denial with admin read-back, duplicate slug, UI publish/archive, real refresh request followed by save/read-back, cleanup, and logout.

The refresh case advances browser Date to exercise the app's expiry check against a real refresh endpoint. It does not wait for or claim cryptographic JWT expiration. The SQL 19-check suite is a separate tool-executed transaction and is explicitly reported as NOT_RUN_BY_THIS_RUNNER.

## Mutation and output safeguards

- Uses only user-issued sessions from real login, in memory within separate ephemeral browser contexts. No API responses are mocked. Routing blocks unrelated external/API traffic and unrelated store admin operations; it never fulfills/replaces responses.
- Every created slug has a per-run random prefix. Mutation routing permits only that prefix or IDs recorded from this run. Slug edits outside the run prefix are blocked.
- Finally cleanup discovers/deletes only that exact run prefix, including a POST that committed before its response was lost. The report includes the nonsecret cleanupPrefix whenever creation was attempted, for recovery/audit even if a write response was lost. Failed cleanup is explicitly FAIL. Test accounts themselves are not deleted by this runner.
- Finally sign-out uses each test user's own session. Accounts must be dedicated because sign-out scope is global. Missing or unissued sessions are not counted as successful logout.
- No screenshots, HAR, tracing, videos, Auth response logs, stack traces, session dumps or raw Playwright errors are emitted. Diagnostic env switches are disabled before loading Playwright; account Secrets and Supabase admin-key env names are removed from the Chromium child environment. Only login form values enter the page. Never enable external wrappers that record browser inputs/network secrets.
- The local static server serves only allowlisted app assets, never work/, tests/, .git or secrets.

Results are JSON with fixed test names and PASS / FAIL / NOT_RUN. A failed prerequisite or test aborts remaining dependent work; cleanup still runs when needed. NOT_RUN is never a pass. Exit code 2 means missing account bindings, 1 means runtime/network/test/cleanup failure, 0 means completed successfully (or a successful preflight with all four bindings present). A preflight result never counts as a passed account test.

## Current observed results

- Missing-Secrets execution: exit 2; all 28 live entries NOT_RUN.
- Actual Chromium network preflight: exit 1, network UNAVAILABLE; no credentials sent.
- Local `node tests/browser/blog-live-safety.cjs`: 3 passed (missing-secret failure, child-env secret isolation, mutation-scope guard). These are runner safety tests, not live integration evidence.
- Existing fixture suite remains separate and unchanged. Real authenticated integration is still pending network and secret provisioning.
