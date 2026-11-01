# TRISOCMD V28 — Checkout Safety & Launch Readiness

**Status: manual contact / review only. Automated payments and escrow are not enabled.**

## Boundaries verified on 2026-11-01

- The TRISOCMD main store displays LTC/BTC estimates and manual support contact. These are **not** a final invoice, an on-chain receipt, or verification.
- `public.tc42_create_order(jsonb)` validates products, quantities and prices on the server; it only saves an order record. It is not a charge processor.
- `public.market_request_purchase(...)` checks signed-in user, listing approval and buyer != seller. V27 serialized concurrent duplicate review requests.
- `public.market_admin_update_purchase(...)` allows only review statuses and checks an administrator role before changing a record.
- Tables `tc42_orders` and `market_purchase_requests` have RLS with owner/admin-scoped SELECT. In V28 unnecessary direct DML grants on market purchase requests are revoked; existing controlled RPCs remain available.
- No site component is authorized to present a TXID, screenshot, quote, or client-side message as proof of payment.

## Release gates — NOT MET

1. Confirm operator eligibility, product transfer rights, required provider and legal compliance before operating any payment or custody program.
2. Define a distinct, server-signed invoice ID for each order and the currency, network, exact amount, recipient, expiry and ownership; never accept client-supplied prices as authoritative.
3. Verify payments independently server-side against a trusted source including network, invoice ownership, received total, sufficient confirmations, expiration and uniqueness of the transaction reference.
4. Handle duplicate webhooks, retries, partial payments, underpayments, overpayments, cancellations, chain reorganizations, refunds and operational errors idempotently.
5. Implement authorized, auditable state transitions and maintain reconciliation records independent of user-entered payment claims.
6. Establish published support, dispute, refund, delivery, payout and incident response procedures before advertising escrow or payout guarantees.
7. Protect server credentials in a trusted backend, enforce minimum role privileges, monitor abuse and perform end-to-end tests with test accounts.
8. Obtain explicit operator approval after legal/security review before any live money movement.

## Security audit notes

- V28 removes unneeded direct `authenticated` DML grants from `market_purchase_requests` while preserving RLS and existing RPCs.
- Supabase advisors reported `SECURITY DEFINER` functions callable by signed-in users; their internal permissions require ongoing code review. `market_browse()` is intentionally public-readable, but its security-definer status should receive separate least-privilege assessment.
- Supabase advisors reported leaked-password protection as disabled at audit time; review eligibility and setup in the Auth dashboard. No auth configuration was changed in V28.
- **Do not** mark payment status confirmed from a TXID or user assertion. A successful UI test does not prove actual transfer verification.

## V28 tests

- Static checks for checkout warning, multilingual non-imperative checkout copy, review-only admin readiness indicators and migration.
- Browser checks ensure warning is visible when visiting Checkout, no paid/verified state is implied, and admin readiness remains behind the existing admin authentication gate.
- Database post-migration permission checks verify authenticated SELECT stays available but INSERT/UPDATE/DELETE/TRUNCATE are not.
- No real invoice is generated, no fund transfer is initiated, and no real order, message, or payment status is modified.
