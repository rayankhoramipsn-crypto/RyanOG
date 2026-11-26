# Floating Live Support — 2026-11-25 (Asia/Tehran)

**Admin inbox superseded (2026-11-26):** owner confirms the customer messenger works; the legacy homepage admin handler was still using a forbidden direct table INSERT. See [the focused repair and hosted metadata evidence](TRISOCMD_ADMIN_SUPPORT_REPAIR.md). The customer messenger itself is unchanged.

Owner confirms Support Center layout, ticket creation/history/replies and navigation passed hosted acceptance. The previous Live Support action reused the ticket renderer and navigated away from the current page. This focused correction replaces that live-only presentation; it does not redesign tickets, Order Center or checkout.

## Implementation and durable identity

- One lazy, non-modal bottom-right messenger on the existing support-enabled main/preview home, marketplace, help and admin entrypoints. All Live Support shortcuts open it without navigation. Minimize/restore and close controls, memory-only drafts, persisted bubbles/timestamps, translated EN/FA/AR controls, RTL and responsive layout. No fabricated agent messages, presence or response-time claims.
- Reuses `tc42_support_threads`, `tc42_support_messages`, `support_create`, `support_reply` and `support_history`. These are the existing generic conversation infrastructure; no new table, migration, RPC, provider or legacy `support_tickets` write is introduced. The first explicit customer message creates a conversation; merely opening the widget does not create records.
- A chat is identified by BOTH subject `Live support chat` and the UUIDv5 key derived from the authenticated customer UUID, DNS namespace and name `trisocmd-live-support-v1:<customer UUID>`. The existing unique `(customer_id, client_key)` index and server advisory lock enforce one chat per customer. This is a durable public identifier, not a permission token. Do not change this identity scheme without an explicit compatibility plan.
- Customer My Tickets/counts exclude only correctly identified live conversations. Existing unmarked tickets and historical `Store support` records remain unchanged and accessible in My Tickets. They are not silently converted or deleted. New widget history persists in its reserved conversation across reloads/sign-ins.
- First-send uncertain responses/races and message retries reuse existing server idempotency. Reply retry UUIDs plus message fingerprints survive an uncertain response/reload in sessionStorage; plaintext drafts and Auth secrets are not stored by this component. Browser Web Locks supplement the database uniqueness boundary. Successful identical new messages remain separate explicit intents.
- Refresh every five seconds while open/minimized and the document is visible; offline/reconnect/error/retry states are explicit. Earlier history is retained through refresh. This uses polling, not a claim of hosted Realtime delivery. Drafts/history/retry state clear on account changes; stale async preparation and responses cannot send/show another account's content.
- The existing admin support inbox adds All/Tickets/Live Chat filtering and stored customer/conversation IDs with update context. Authorized agents use the same existing replies/status/assignment APIs. Sender identity comes from persisted rows/server Auth. No backend per-agent unread watermark or agent presence exists; none is fabricated. The minimized customer badge counts only newly fetched replies in the current widget session.

## Verification and limits

`npm run test:support`: eight routing/identity tests and seven isolated PostgreSQL permission/idempotency groups using existing RPC source. Covers parallel chat creation, idempotent staff replies, owner/other/anonymous/session restrictions and preservation of separate ticket keys. SQL Auth/session stand-ins are not hosted JWT acceptance.

`npm run test:support:browser`: 28 live-chat browser scenarios, 33 retained Support Center scenarios and retained communications/staff-management checks. Actual frontend sources render against intercepted HTTPS and isolated persisted fixtures. Includes customer send → authorized admin reply → customer refresh, uncertain first/reply retry, reload, minimize drafts, closed/reopened chats, private history denial, account switch during async digest preparation, older history and EN/FA/AR at 390/768/1365/1920. No hosted/customer data is used. Browser page-error and axe A/AA checks pass. Screenshots are ignored under `work/live-support/`.

## Staging acceptance still required

Use dedicated customer and staff/admin accounts on the private staging site. Confirm Live Support opens over the current page; send a unique test message; open Admin → support conversation filter → Live Chat; verify the stored customer ID and reply as staff. Confirm receipt in the customer widget, reload/relogin history, minimize/restore draft and denial from a different account. Historical unmarked records remain under My Tickets. No hosted messaging outcome is claimed by fixture tests.

No hosted migrations, production deployment, financial/provider activation, deferred avatar migration or notification work. Checkout files and payment infrastructure are unchanged. Publication provenance is recorded in the task receipt.
