# TRISOCMD V34 — Notification Center & Payment Readiness

## Implemented now
- Private, server-generated notification rows for new marketplace purchase-review requests, message events, and purchase-review status changes. Seller receives new-request notices, recipient receives message notices, authorized administrators can read moderation notices.
- RLS restricts notifications to the recipient or the authorized admin broadcast; direct INSERT, UPDATE, DELETE are not permitted for ordinary users.
- In-site alert bell in storefront, marketplace and admin pages. Client checks for new rows while the signed-in page is open, and persists **only the last-seen notification ID** on the device. Do not store message bodies in notification storage.
- Explicit button can request browser/OS notification permission for **foreground** alerts (while the site is open). Availability depends on browser and OS.
- Search fields use dedicated non-email names and autocomplete-off. Browsers may still suggest profile data based on their own settings.
- Gaming Gear storefront category card uses the verified headset illustration rather than the previously embedded mixed-language screenshot.

## NOT implemented or enabled
- **No real money receipt, escrow, chain confirmation, wallet management, or sale/stock mutation.**
- A TXID entered by a user would be only a claim. Never mark a listing Sold or show 'paid' without an independently verified server-side receipt, correct network/asset, amount, recipient, confirmations and unique invoice.
- Full **background** device push when the site is closed requires a service worker and a delivery backend, with a private VAPID key / FCM configuration. Nothing is pretending to send background notifications. For iOS, web-push support may also depend on Home Screen install and the device/browser.
- Browser notification permissions must only be requested from a deliberate user click, not automatically.
- Neither registered email nor user identifier is included in the notification message body.

## Verification
- Automated browser coverage for visible bell, private fake notification feed, required listing review gating, read-only live routes, search fields and category image.
- SQL migration audit and effective grants/policies checks after deployment.
- No emails, payments, offers or messages are sent in tests.
