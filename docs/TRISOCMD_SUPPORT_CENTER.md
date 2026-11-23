# Support Center — 2026-11-24 (Asia/Tehran)

Focused PR #37 change; PR #36 dependency retained. No hosted migrations, provider activation, customer-data changes, Order Center redesign, avatar or notification work.

- `/help/` is the canonical customer Support Center: account navigation/actual identity, three main actions, six help categories, FAQs and working tracking/rules/contact links. EN/FA/AR, keyboard focus and mobile/tablet/desktop layouts follow the existing dark/violet account design. No screenshot artwork, sample identities/counts or online guarantees were imported.
- Open a Ticket reveals a styled category/subject/message/optional-order form. It reuses `support_create` and its retry key. Categories are an explicit subject prefix within the existing 120-character limit, not a competing data model. Both client lookup and the existing trusted RPC enforce linked-order ownership; dispute creation requires an order. Duplicate clicks/uncertain network retries retain one key; failures retain the draft. Success opens the created authorized ticket.
- My Tickets reuses canonical history, filtering and replies. The customer page explicitly reads only the signed-in customer's rows; the actual count is shown only after a successful read. Existing staff/admin tools retain their separate admin mount and RPC authorization.
- Live Support uses the same support threads/messages and canonical create/reply/history APIs. It reopens the existing `Store support` conversation, or starts one on the first explicit message. History refreshes periodically; staff presence is not verified and no new chat backend/Realtime guarantee is claimed.
- The shared module no longer appends a raw form to homepage/marketplace pages. Duplicate homepage/preview chat markup is retired; existing support entry points route to `/help/`. The mobile Support button sits above the fixed staging warning. Existing Order Center and checkout remain in place. Legacy `/preview/help/` forwards safe ticket/order/language context to the canonical page.
- Account/settings/tracking links use the existing signed-in account controls. Session changes clear private drafts/history immediately; stale requests cannot repopulate another account's view. Overlapping initial/history loads are sequenced. Anonymous access offers sign-in guidance. Attachments are not offered.

## Focused evidence

Commands: `npm run test:support`; `npm run test:support:browser`; retained `tests/account-dashboard-browser.mjs`.

Passed: 33 Support Center browser scenarios, five routing/source tests and six disposable PostgreSQL permission/idempotency scenarios using existing support RPC source; customer browser coverage for creation, retries, owned/foreign orders, history/replies/chat reuse, cross-account links, guest/session transitions, header/footer/account entry, legacy routing, tracking/settings; retained communications staff assignment/status and notification synchronization checks; 58 dashboard scenarios. Browser HTTP uses synthetic data and intercepted staging requests. PostgreSQL Auth/session stand-ins are not hosted JWT verification.

Rendered screenshots under ignored `work/support-center/` cover EN/FA/AR at 390/768/1365/1920, plus three mobile form states. Visual checks include action alignment, one language selector, RTL, overflow and readable controls. Browser page-error and axe A/AA checks are included. Publication evidence is kept in the task receipt; no production publication or merge is authorized.

## Hosted-only acceptance

On the private staging URL, use dedicated test accounts: open Support from navigation, submit a test ticket and owned-order reference, reopen it through My Tickets, reply from an authorized staff/admin inbox, verify the customer reply after refresh, and confirm a different account cannot read the ticket or link the order. Confirm the actual count/identity and mobile RTL. No hosted/customer records were used for automated verification. Email/push/customer messaging delivery and financial providers remain disabled; creating an in-app ticket is not proof of external message delivery.
