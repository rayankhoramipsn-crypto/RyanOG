# Admin Support Inbox repair — 2026-11-26

## Confirmed hosted authorization and root cause

Read-only metadata checks targeted TRISO TEST `cxtytbjvdlngahytfilr` only. `authenticated` has public-schema USAGE and SELECT on both canonical support tables. Message RLS is enabled, with customer/authorized-staff SELECT policies and the restrictive active-session policy. Anonymous message SELECT and support RPC execution are denied. One active admin membership exists; no individual user/session/token or customer messages were read.

The reported permission error comes from the obsolete homepage/preview `tc42AdminInbox` reply handler: it directly POSTed to `/rest/v1/tc42_support_messages` (SQL INSERT with client-supplied `sender_id`). The communications migration intentionally revoked authenticated INSERT/UPDATE/DELETE on these tables. The newer support module returned early on homepages, leaving that inline legacy handler and the “SUPPORT INBOX / LIVE SUPPORT 4.7” block active. Earlier dedicated-admin browser coverage missed the actual homepage entrypoint.

`support_history` is SECURITY INVOKER and reads under the existing SELECT grant/RLS. `support_reply` is authenticated-only SECURITY DEFINER, checks active session plus thread owner/staff authorization, assigns `sender_id=auth.uid()` and enforces retry idempotency. The correct repair is to use this RPC, not grant direct message writes or disable RLS.

**No SQL migration is required or proposed.** No hosted data, grants, policies, functions, membership or migration history was modified. No production access or provider activation.

## Implemented

- Replaced all four actual admin entrypoints: account admin panel on main/preview homepages and main/preview `/admin/`. Removed the legacy direct-write conversation builders, duplicate refresh buttons and duplicate read-only legacy-ticket table presentation. Historical records remain in the canonical model; no records were changed/deleted.
- One shared staff-gated Admin Support Inbox: conversation search, All/Live Chat/Ticket filters, current status, latest stored preview, customer/conversation/order IDs and actual timestamps; one selected chronological message pane and reply composer. Mobile switches list/detail; EN/FA/AR and RTL.
- Every reply uses `support_reply(p_thread,p_body,p_key)`. No sender impersonation or direct table writes. Input bounds, loading/error/confirmed-result states, per-conversation memory drafts, identity guards and uncertain-response retry keys are retained. Existing `support_manage` handles status/assign-to-me. Unauthorized accounts load no inbox data.
- Customer names are not exposed through a new Auth-admin API; authorized stored customer IDs are the safe fallback. The backend has no per-agent unread watermark or presence service, so the inbox makes no fabricated unread/online claims.
- Fixed the visual cascade: generic luxury-theme `!important` button/form/section styling now excludes only the new inbox, matching the existing account-component exemption. Cache tags on affected pages ensure the corrected styles load. Checkout, customer messenger, ticket backend and marketplace logic are unchanged.

## Focused evidence

- Node contracts cover both homepage handlers, all four modern mounts and canonical-only sender behavior; existing routing and live-chat identity tests retained.
- Disposable PostgreSQL tests reproduce the exact `42501` direct-INSERT failure under authenticated staff/admin roles, then prove RPC replies persist with the actual authenticated sender and are readable by the customer. Cross-account/anonymous access is denied; current role revocation takes effect. Existing ticket and live-chat idempotency groups retained. Auth/session stand-ins are separate from hosted JWT acceptance.
- Browser tests render the real four entrypoint sources against isolated persisted HTTP fixtures that reject every direct message write. Cover admin reply → customer floating messenger, uncertain retry without duplicates, search/filter/drafts/status controls, denied history, ordinary-user clearing, support-only access and mobile list/detail. EN/FA/AR rendered screenshots at 390/768/1365/1920, page errors and axe A/AA checks included.
- Retained customer live-chat, Support Center/ticket, communications/staff assignment and marketplace-management checks are scoped regressions. No unrelated full audit/suite.

## Remaining hosted acceptance

The database diagnosis uses actual hosted metadata; SQL role tests and HTTP-intercepted browser tests are not a real hosted reply outcome. After the staging-only frontend publication, sign in with a dedicated authorized admin/customer pair: customer sends a unique message; open the account panel's new Admin Support Inbox and select Live Chat; read the message and send a reply; confirm HTTP POST goes to `/rest/v1/rpc/support_reply` and succeeds; customer sees that reply after refresh/relogin. Repeat from `/admin/`, and verify another customer/anonymous user cannot access the conversation. Never share JWTs, passwords or verification links. No migration approval is needed for this frontend repair. Do not claim hosted end-to-end acceptance until these checks pass.
