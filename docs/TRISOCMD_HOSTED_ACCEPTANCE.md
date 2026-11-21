# Hosted staging acceptance — owner procedure

Frontend: https://trisocmd-staging-review.rayankhoramipsn.chatgpt.site
Target only TRISO TEST (`cxtytbjvdlngahytfilr`). The owner confirms the website opens. Codex HTTPS remains proxy-blocked; no repeated blocked requests or claimed hosted browser passes.

## One-time Auth configuration (owner Dashboard action)

The connected Supabase tool surface exposes no Auth configuration read/update operation. No management credential is configured here. These settings have **not** been changed or independently verified:

1. Open **TRISO TEST → Authentication → URL Configuration**. Set the staging **Site URL** to `https://trisocmd-staging-review.rayankhoramipsn.chatgpt.site/`.
2. Add these exact Redirect URLs, preserving existing entries:
   - `https://trisocmd-staging-review.rayankhoramipsn.chatgpt.site/`
   - `https://trisocmd-staging-review.rayankhoramipsn.chatgpt.site/index.html`
   - `https://trisocmd-staging-review.rayankhoramipsn.chatgpt.site/preview/`
   - `https://trisocmd-staging-review.rayankhoramipsn.chatgpt.site/preview/index.html`
3. Verify email confirmation, test-inbox delivery/SMTP and password policy in this staging project. Check leaked-password protection availability; the last advisor reported it disabled. Do not disable confirmation or weaken policy to pass. Do not edit the production project.

Confirmed source fix: signup previously omitted `redirect_to`, so confirmation could fall back to the configured default Site URL. Both main/preview Auth transports now send their current origin/path. Preview recovery also previously placed redirect_to only in its JSON body; the transport now supplies the required query parameter, consistent with main recovery/OAuth. Auth still enforces the server redirect allowlist; this source fix cannot modify that setting.

## One browser acceptance checklist

Open **[staging-check.html](https://trisocmd-staging-review.rayankhoramipsn.chatgpt.site/staging-check.html)** from the owner's permitted browser. Its checklist covers buyer/seller/admin flows; no credentials, jobs or business records are created by its automated checks.

1. Run Edge checks once. Require crypto disabled, delivery hold active and missing authentication rejected. Webhook endpoints deliberately lack browser CORS: inspect their Network requests for payment HTTP 503 and unsigned delivery HTTP 401/503. An opaque response is **manual/unverified**, never PASS. No CORS changes or valid worker invocation are needed.
2. Use dedicated buyer, seller, admin and support accounts through separate browser profiles. Confirm email, recover a password and test Remember Me both ways. Keep passwords, tokens, recovery links and raw captures private. Role assignment must use authorized Auth administration, never user-editable metadata.
3. Run the displayed seller → private photo → admin approval → buyer visibility → chat/reconnect → purchase/order → blog/content/support checklist. Use tagged synthetic records and harmless media. Invoice collection must stay disabled; creating an unpaid canonical order is not a payable invoice or proof of payment.
4. Verify cross-account API denial/empty results with the *other account's own session*, not merely a hidden UI. In particular test another user's order/support/conversation and unapproved Storage signing/read requests. Previously issued signed URLs are bearer capabilities until expiry and are not a cross-account RLS test. Do not touch historical records.
5. Share only sanitized PASS/FAIL plus non-sensitive HTTP/error codes from the diagnostics. Never share account details, request headers, private images, tokens or email/recovery links.

The session/role check reads only the signed-in test user's Auth identity and two role booleans. It never prints IDs/emails/tokens and does not prove cross-account RLS, Storage or Realtime by itself.

## Existing hosted evidence and limits

The eight high-risk RPC grant checks found invoice issuance/verification/failure and delivery lease/finish/webhook operations unavailable to anon/authenticated and available to service_role, with pinned search paths. Authenticated Pro/claim-review entrypoints are intentional admin-checked APIs; removing their grants would break legitimate admin flows. Previous hosted SQL-role tests proved persisted-admin/forged-claim and cross-account order/support checks. No new unsafe grant was confirmed, and no RLS/permission migration was made.

Four Edge deployments and six migrations remain recorded in the sprint report. No actual HTTPS endpoint, real JWT login, confirmation/recovery delivery, private upload, Realtime or browser role journey is certified by this change. The execution environment needs staging frontend HTTPS, staging API HTTPS and staging WSS access plus securely provisioned dedicated test accounts to run those tests here. The owner-browser procedure above can proceed without that environment change.

Payments, payouts and customer email/push remain held. Production release still requires hosted acceptance results, complete provider/invoice/settlement integration and separate release authorization.
