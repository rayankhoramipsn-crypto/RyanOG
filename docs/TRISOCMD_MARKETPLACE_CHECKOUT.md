# Marketplace checkout review — 2026-11-23

PR #37 preserves PR #36 and the canonical marketplace request/order bridge. Staging only; no hosted migrations, customer records, provider settings or production were changed.

## Implemented

- Reference-led glowing outer frame, beveled-style purple/cyan CTA, highlighted total and dark two-column summary/payment comparison, actual authorized listing/media/public seller profile, original price, independent buyer fee, separate crypto discount and review total. EN/FA/AR; mobile stacks; keyboard radios/focus; refresh/back/marketplace/read-only order tracking.
- Exactly 10% of normalized original USD item price, half-up cents. Switching methods restores full price. Current marketplace buyer fee is zero; the existing 4% seller commission is **not** a buyer fee. BigInt calculations avoid binary-float discount errors. Only the selected method enum is stored per buyer/order in sessionStorage; URL amounts/discounts are ignored.
- Buyer-owned canonical order is checked against the current approved listing, seller, currency, saved item snapshot and price. Changed/unavailable listings block review. Account changes clear private content; stale responses cannot repopulate it. Expired refresh credentials clear through existing Auth storage logic.
- Confirmed hosted contract mismatch fixed: `market_browse_page` has no `p_limit` argument and omits seller/status. The existing listing-to-order call no longer sends that argument; checkout reads the approved listing through existing table RLS. Hosted evidence was function-definition metadata only, not a customer-data query.
- Payment CTAs remain disabled with no financial handlers. Existing provider readiness is read with GET only and cannot lift the staging hold. Crypto and PayPal/manual selection are comparison options, **not operational gateways**. No TXID/receipt/address collection.

## Server pricing — pending approval, NOT deployed

`supabase/migrations/20261123195010_marketplace_checkout_quote.sql` adds only `market_checkout_quote(uuid,text)`, a STABLE SECURITY INVOKER function with empty search_path and authenticated-only EXECUTE. Requires Phase 1 and staging active-session authorization migrations. It is independent of the deferred avatar migration: do not apply that migration or use a blind db push.

The RPC reads the caller's awaiting-payment marketplace order and current approved listing, rejects changed price/seller/self-purchase, and returns a nonpayable quote. It accepts no amount/fee/discount arguments and writes no data. It never updates listing price, order totals, invoices, status or seller entitlement.

Until approved deployment of this RPC, the UI explicitly labels its calculation **Estimate only — server pricing verification is pending**. Missing-RPC fallback is restricted to PostgREST 404/PGRST202; authorization/network/malformed/mismatched quote failures block review. Even a valid server quote remains nonpayable. The browser compares its monetary fields, order/listing identity and disabled-settlement flags before displaying server validation.

## Promotion accounting and remaining payment gates

Proposed funder: platform, **not approved for settlement**. Seller entitlement remains original item price minus the existing original-price commission. Platform net before provider costs = original commission minus the full promotion. At the current 4% commission and 10% discount, this is a 6% item-price loss before provider costs (subject to cent rounding). Existing gross canonical orders remain unchanged; review totals must not be treated as payable invoice amounts.

Before real payment activation: approve funding/budget and subsidy/refund ledger; approve/apply the isolated quote migration; implement atomic, expiring server quote-to-invoice validation with selected provider/currency/fees and idempotency; independently verify provider transactions; reconcile subsidy, commission, seller entitlement and refunds; exercise authorized sandbox and hosted JWT/RLS/Storage acceptance. A read-only quote is not a checkout settlement implementation. Keep provider/payment/payout/messaging holds in place.

## Focused evidence

- `npm run test:checkout`: decimal-safe money tests and isolated PostgreSQL role/RLS/pricing tests. PostgreSQL 18 fixtures use platform stand-ins, not hosted JWT/Auth; the quote also runs against the existing canonical Phase 1 schema/order builder.
- `npm run test:checkout:browser`: actual source rendering, all hosted HTTP intercepted with isolated fixtures; EN/FA/AR at 390/768/1365/1920; switching/reload/back, session/network/authorization errors, quote tampering, disabled-provider enforcement, tracking and signed-image URL isolation.
- Existing listing-details duplicate-entry/rules/chat flow, marketplace seller/admin management, checkout SQL and smoke regressions retained. New mocks enforce the deployed browse RPC argument contract.
- Rendered screenshots: ignored `work/marketplace-checkout/{en,fa,ar}-{390,768,1365,1920}.png`. Visual inspection confirms stacked mobile/tablet, aligned desktop columns and no clipping/overflow. Screenshots contain synthetic test data only; no fixture content is shipped.

Hosted browser/payment acceptance remains unverified from this environment. Owner-reported successful listing-details/chat acceptance is prior evidence, not a new independent payment result. No production readiness claim.

Results: 30 focused Node tests, 16 pricing SQL scenarios plus 26 canonical checkout SQL scenarios, 34 checkout browser scenarios (12 screenshot layouts, no page errors/axe A-AA violations), 58 listing-detail scenarios, four seller/admin workflow groups, safe browser smoke and 16 marketplace Python regressions pass. Hosted end-to-end payment acceptance was not attempted.
