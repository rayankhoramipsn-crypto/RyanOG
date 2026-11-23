# Account Settings & Security Center — staging

Eight sections now live inside the existing dashboard, preserving its identity sidebar, orders, activity, navigation and saved language. Main and preview share the same implementation. Settings requires an authenticated session; sensitive forms use verified Auth user/identities and reject a changed actor, failed reauthentication or late responses.

| Action | Existing authorized API / behavior | Hosted acceptance |
|---|---|---|
| Display name | Auth `GET/PUT /auth/v1/user`, own metadata only; Cancel restores server value | New save/reload/Google relogin check required |
| Avatar change/remove | Validated PNG/JPEG/WebP ≤2MB, ≤4096px; private owner path, signed read; removal clears displayed-avatar metadata and retains old private files | **BLOCKED:** pending private bucket migration |
| Email change | Email identities only; password sign-in must return the same user, then Auth user update with same-origin redirect; GET refresh distinguishes `new_email` from verified email | Confirm required messages in a dedicated staging inbox; test used/expired links |
| Password change | Email sign-in identity; current-password reauthentication, minimum12 characters and confirmation; supports server nonce/current_password requirements | Actual Auth policy/password acceptance required |
| Google-only password setup | Existing Auth recovery email route; never assumes Google proves a local password | Auth email recovery must be enabled and deliverable |
| Providers | Verified `identities`; trusted app metadata fallback; truthful read-only listing | Manual linking/unlinking intentionally unavailable |
| Notifications | Existing `market_alert_preferences` ownership RLS; email/browser opt-ins; separate real browser permission request | Preference save does not activate email/background push; delivery remains held |
| Preferences | Existing persistent language and Remember Me adapters | Owner already reports earlier language/Google behavior passed; new settings integration needs acceptance |
| Sessions | Local logout, confirmed `scope=others` or `scope=global`; no invented device/IP history | Refresh-token revocation needs two actual dedicated sessions; JWTs may live until expiry |
| Account management | Actual authenticated status, privacy policy and existing support navigation | No secure automatic deletion workflow exists; no fake deletion control |

No profile table or username field exists. Existing listing/admin image buckets cannot safely serve account avatars. Prepared `supabase/migrations/20261123163305_account_avatars.sql` creates one new private bucket and three owner-scoped Storage policies; no UPDATE/upsert policy, no SECURITY DEFINER, no existing object or migration-history changes. It passed isolated SQL rollback, owner/cross-account/anonymous/path/reassignment/delete tests. It is **not authorized or applied hosted**. After owner approval, apply this single additional migration to `cxtytbjvdlngahytfilr`, verify the private bucket/policies, then exercise uploads with dedicated accounts. Do not rerun the already-applied six migrations or use blind db push.

Staging Auth owner checks, without sharing credentials:

1. Keep email confirmation and secure email change enabled. Retain the current staging origin/index callback allowlist. Email-change templates must use Supabase's generated `{{ .ConfirmationURL }}` or a typed `token_hash` callback with `type=email_change`; do not route them to password recovery. No hosted template was changed by this task.
2. Review Auth password security (current-password/reauthentication settings). The UI always reauthenticates an email identity before changing email/password and handles optional nonce requests. Existing Google-only users should use the recovery route to establish a local password; enabling a preference does not guarantee Auth email delivery.
3. With dedicated Google-only and email identities, verify profile persistence, email verification/pending/confirmation, wrong current password rejection, password change/recovery and scoped logout from two sessions. Test FA/AR, reload and Google return. Never paste passwords, token-bearing links or session tokens into chat.
4. After the separately approved avatar migration, upload valid/forged/oversized images, verify reload/removal, and confirm account B cannot read or sign account A's avatar. Existing objects remain private and retained.

Verification uses actual local Chromium rendering with isolated HTTP fixtures plus real disposable PostgreSQL RLS. Hosted schema/Storage/preference policy metadata was inspected read-only, without customer rows. The established hosted HTTPS execution path is inaccessible, so no new live email, sensitive Auth action or avatar delivery is claimed. Production, payments and delivery providers remain unchanged.

Focused final results: 60 Auth/language/account Node tests and 3 release-packet tests; 88 settings/security, 58 retained dashboard, 42 Auth callback and 15 language-persistence Chromium scenarios; retained communications/browser checks; 7 PostgreSQL avatar scenarios and 7 relevant Python checks passed. All eight settings sections passed the focused WCAG A/AA checks. Rendered EN/FA/AR screenshots were inspected at 390/768/1365/1920. No new live Auth action or delivery is claimed.

Secure email-change callbacks also support Supabase’s intermediate message-only/two-confirmation response without creating a login or claiming completed verification. Typed invalid/expired email-change links return to Sign In with an Account Settings retry instruction, while signup verification and password recovery retain their existing flows.
