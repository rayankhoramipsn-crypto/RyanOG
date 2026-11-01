# TRISOCMD V35: safe transaction-reference intake and alert preferences

## Implemented
- Buyer can submit one LTC/BTC transaction reference on a request they own. The server RPC checks buyer ID, request status, method, and 64-hex format. No payment is verified.
- Global UNIQUE(txid) and UNIQUE(request_id) constraints prevent reuse across browsers/accounts/requests. TXID is normalized to lowercase.
- RLS limits TXID record reads to the buyer and authorized admin. No client write grants to the claims table.
- Email preference is optional/default OFF. Owner-scoped preferences queue notification emails into private, duplicate-safe delivery records.
- Email delivery is not connected to an actual verified mail sender, so queued does not mean delivered.
- Permission prompts only happen on user action. Foreground browser alerts and in-site notifications remain separate from true background push.
- Search uses dedicated lookup names and readonly-until-focus to minimize Chrome email autofill; individual browser history may still override it.

## Not activated
No server-issued payment invoices, PayPal merchant Orders API capture, independent on-chain confirmations, custody or escrow, automatic Sold marking, email sender API, or background web push. Never treat an uploaded transaction hash, screenshot or claimed PayPal ID as evidence of actual received funds. Merchant eligibility and identity requirements must be followed rather than bypassed.

## Real gateway release requirements
A properly configured and authorized payment provider, owned invoice amount/network/address, backend-only credentials, tamper-resistant webhook verification, unique incoming transaction and sufficient confirmations, idempotent inventory/fulfilment transitions, refund and incident handling, and test-account audits are needed before accepting real payments.

## Validation
The PR adds mocked browser/SQL contract tests. No real bank/card/crypto transfer is made in any test.
