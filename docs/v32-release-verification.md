# TRISOCMD V29–V32 Release Verification

The release is focused on security, stability, and **non-payment** accuracy. It is NOT certification that online payments, escrow, or payout services are available.

| Release | Scope | Objective proof |
|---|---|---|
| V29 | Seller Pro entitlements and chat privileges | Effective role grants verified in Supabase; authenticated can UPDATE display_name, cannot UPDATE is_pro/pro_until; direct chat table writes denied |
| V30 | Main-store order request reliability | Mocked concurrent saves produce only one RPC; errors show warning and do not imply a paid order |
| V31 | API authorization and public secret scan | Static CI scans public assets for secret key patterns and documents RLS/RPC read/write boundaries |
| V32 | Integrated checkout safety and localization | E2E smoke covers disabled invoice/TXID controls and all eight locale headings; regression tests still cover auth, marketplace, admin moderation, chat and orders |

## Open gates before real customer funds

1. Supabase Auth leaked-password screening: last advisor reported disabled. Configure in provider settings if available for this account/plan, then re-run advisor.
2. Public `market_browse()` is a restricted SECURITY DEFINER function, intentionally used to show published listings with seller Pro flags; merits future function/ACL review.
3. Server-issued invoice IDs and immutable amounts, cryptographic network payment validation, chain confirmations, idempotent reconciliation and financial audit logging are not in production.
4. Escrow, payout, refund, chargeback, disputes and custody remain unconfigured. Do not offer them as live services.
5. Production testing of external email delivery, a real account, live orders and any payment remains manual and must not be claimed by green mocked tests.
6. Operators should verify product ownership and marketplace/platform terms, and handle age/identity and service requirements appropriately.

## Safe manual QA

- Hard refresh `https://trisocmd.shop/`, `/marketplace.html`, and `/admin/` to bypass cached assets.
- Check auth sign-up, login, password recovery and Remember Me with test accounts; do not disclose the recovery link or password.
- Confirm only admins can approve/decline marketplace items and inspect conversations.
- Confirm buyer/seller inbox unread counters require explicit conversation opens.
- Confirm all order screens say review/saved/unpaid, never automatically verified.
- Confirm crypto invoice and TXID controls are visibly disabled until a separately tested server-side verification system is commissioned.

No payment or live account modifications were performed in automated tests.
