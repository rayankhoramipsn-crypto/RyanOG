# TRISOCMD V31 / Payment and API authorization security review

Date: 2026-11-01. Scope: staging/main storefront, marketplace, Supabase RLS and server RPCs.

## Verified server-side boundaries (read-only audit)

- `products`: public reads only available records; all create/update/delete policies require the admin claim in `app_metadata`.
- `tc42_orders`: signed-in user reads own orders, admin reads all; no direct INSERT/UPDATE/DELETE granted to authenticated browser clients. `tc42_create_order` is the sole supported order creation path and validates product availability, stock, quantity limits, cart size and authoritative price server-side.
- `market_purchase_requests`: member/admin owner-scoped read. V28 removed direct DML grants; V27 request and review RPCs still validate user/admin and safe status transitions.
- `seller_profiles`: V29 grants members UPDATE only on `display_name`, never on `is_pro` or `pro_until`.
- `market_conversations` and `market_messages`: participant/admin RLS protects SELECT; messaging must go through checked member RPCs.
- `market_browse()`: intentionally public, returns only approved listing fields and effective Pro tag. Because this function also reads seller Pro status, replacing SECURITY DEFINER with INVOKER must be reviewed as a separate compatibility change. The Supabase advisor still flags it.
- `is_admin()` evaluates JWT `app_metadata.role`, never user-editable `user_metadata`. A stale JWT remains a concern until token refresh/session expiration.

## Operationally incomplete — DO NOT mark as enabled

Leaked-password screening in Supabase Auth (reported disabled by the advisor); hosted backend-issued invoices; independent TXID/chain verification; rate locking; signed payment webhooks; dispute/chargeback handling; real escrow/custody and payouts. These need a separate explicit launch authorization, relevant provider contracts, and security/legal review. No public page should claim they currently exist.

## CI release contract

Automated tests review publicly served HTML and first-party JavaScript for obvious secret-key patterns, check auth-policy conventions and ensure no unverified payment success handlers were introduced. They do not replace professional penetration testing or a real user transaction audit. Current previews and checks use mocks only.
