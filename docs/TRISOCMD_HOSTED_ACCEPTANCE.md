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

## Authentication correction (2026-11-22)

Source now distinguishes typed signup/email confirmation, recovery and OAuth callbacks; accepts token_hash, implicit fragments and PKCE authorization codes with the original same-browser project verifier. Credentials are captured in memory and removed from the URL before other page resources load. Untyped callback errors show a neutral sign-in error with an explicit verification resend action, never a reset-password assertion. Missing/conflicting verifiers fail closed; an untyped PKCE code cannot independently identify signup versus OAuth. Typed confirmation links are required to identify that PKCE case. Signup uses the existing implicit Auth flow, clears passwords on success and returns to Sign In without saving any signup session. No hosted setting was weakened.

**Owner Dashboard check — TRISO TEST only:** Authentication → Email Templates → **Confirm signup**. The verification anchor must use `href="{{ .ConfirmationURL }}"`. Preserve branding/subject; remove any hardcoded reset route or `type=recovery` from this template. **Reset password** must use its own `{{ .ConfirmationURL }}` in the recovery template. Do not swap the two templates or disable confirmation. If deliberately using a direct token-hash template instead, the supported signup URL is `{{ .SiteURL }}?token_hash={{ .TokenHash }}&amp;type=email`; recovery must explicitly use `type=recovery`. Never substitute the raw numeric OTP for TokenHash. Do not change OAuth callbacks to recovery.

The connector cannot read the current hosted templates. A misconfigured template is therefore **possible, not independently confirmed**. After checking it, use the new resend action and a dedicated staging inbox to verify a newly issued signup link → Sign In success, a new recovery link → new-password form, and Google OAuth → account. Do not share token-bearing URLs, captures or credentials. Existing consumed/expired links cannot be repaired by the frontend. Keep the staging redirect allowlist above. Real hosted email/Google acceptance remains owner-side because the execution network is blocked.

## Desktop layout and Google OAuth follow-up (2026-11-22)

The reproduced 1365px failure was a CSS cascade bug: `#tc31-panel[data-auth-mode="signin"] #tc31-guest` forced `display:grid!important`, overriding the new normal `display:block`; the inherited two-column template then split the 440px wrapper into 217.36px and 200.63px tracks. The only form occupied the first track. The shared guest grid now explicitly has one `minmax(0,1fr)` column. The wrapper has an explicit full available width capped at 440px, also fixing preview flex shrinkage. Password input/toggle alignment now uses the same grid cell with logical alignment instead of a fixed top offset. Language changes close preview's welcome overlay before returning to Auth.

The old Google button blindly navigated to the provider URL, so server setup errors left the website without a useful in-page notice. The new button checks public Auth settings first, reports disabled/unavailable/rate-limit/network/storage failures, and creates S256 PKCE with a tab-scoped verifier. The callback verifies the original path and server user before applying the existing Remember Me preference. Email/recovery SDK verifiers remain separate. These are source fixes, not proof that hosted Google authentication succeeds.

Read-only staging Auth log aggregation found **3 generic “provider is not enabled” errors among 37 entries** in the queried 24-hour window. Those errors did not identify Google; no `invalid_client` or `redirect_uri_mismatch` entries were found. This does **not** certify Google's enablement or client configuration. The connector cannot read/write those settings, and the known HTTPS restriction was not retried.

**Exact owner configuration/acceptance, staging only:**

1. In Google Cloud, verify a **staging-only OAuth client → Web application**. Its Authorized redirect URI must be exactly `https://cxtytbjvdlngahytfilr.supabase.co/auth/v1/callback` (the Supabase callback, not the frontend URL). If configuring Authorized JavaScript origins, use `https://trisocmd-staging-review.rayankhoramipsn.chatgpt.site`, without a path. This implementation uses redirect OAuth, not Google Identity Services JavaScript.
2. In **TRISO TEST → Authentication → Sign In / Providers → Google**, verify the provider is enabled and the matching Web client ID and secret are saved privately. Do not put the secret in source, chat or frontend configuration; do not disable nonce/security checks. Preserve production settings.
3. Preserve/verify the staging Site URL and four exact frontend redirect URLs listed above. Frontend `redirect_to` is the current origin/path; Google redirects first to Supabase, then Supabase returns the authorization code to this allowlisted frontend path.
4. If the Google consent app is in Testing, add only the dedicated staging Google account as a test user and ensure its audience permits that account. Verify the button reaches Google, complete consent, return to the original staging page, and check Account/session persistence with Remember Me both ways. Repeat cancellation once. Do not share codes/tokens or raw network captures.

Focused rendering evidence is generated locally by `TRISO_CHROMIUM_PATH=/usr/bin/chromium node tests/auth-layout-browser.mjs`: original screenshots, contact sheets and measured widths in ignored `work/auth-layout/`. API responses are synthetic, but the actual source styles and normal browser motion/cascade are rendered. Hosted Google login remains UNVERIFIED until the owner flow above passes.

## Account dashboard acceptance (2026-11-23)

The new main/preview account view reads the existing canonical `tc42_orders` through the shared order center, explicitly scoped to the current buyer/seller, with paginated deduplication and stale-response guards. Dashboard totals partition supported statuses: fulfilled → Completed; payment_submitted/payment_review/paid/fulfillment_pending → In progress; awaiting_payment/disputed → Action needed; cancelled/refunded → Closed. There is no invented Upcoming state or merged legacy order model. Activity is the existing private notification history, not a fabricated account audit log. Notification settings reuse the existing preferences panel; unsupported Deals/general account settings are omitted. Success banners occur only after verified password/OAuth sign-in and disappear on refresh/dismissal.

Read-only hosted metadata confirmed the required eight order fields, enabled order RLS, authenticated SELECT and executable `is_admin`, `support_is_staff`, `notification_page` RPCs with the expected return types. This is contract evidence, not an actual JWT/role journey. No business rows were read for this check. Synthetic browser fixtures cover both main/preview, including 150-order pagination, loading/empty/failure states, stale-data retention, role guards, cross-account late responses, all four viewport sizes, EN/FA/AR and accessibility; artifacts stay in ignored `work/account-dashboard/`.

Owner: use dedicated staging accounts to sign in → confirm your profile/role and canonical order totals → open tracking/change its filter → refresh → open notifications/preferences → test menu/search/category/cart/marketplace links → sign out and confirm the private view clears. Compare buyer/seller totals only with their own canonical orders; an administrator's personal dashboard intentionally excludes other customers' orders. Use the existing admin tools for authorized administration. Verify Google consent/return separately using the exact settings above. Keep payments/payouts and delivery held. Hosted HTTPS/JWT acceptance is still unverified from this execution environment.

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
