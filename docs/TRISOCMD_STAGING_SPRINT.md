# Staging implementation sprint — 2026-11-22

Target: TRISO TEST only. Source branch `feature/trisocmd-completion`, preserving PR #36 → PR #37. No production access, public frontend deployment, merge, live collection, payout or customer message was authorized or performed.

## DEPLOYED — management API confirmed ACTIVE

| Function | Version | Gateway JWT |
|---|---:|---|
| store-crypto | 6 | false; handler validates same-project Auth on POST |
| payment-webhook | 1 | false; default provider disabled; signature/provider verification required when integrated |
| delivery-worker | 2 | false; worker-secret authorization plus explicit staging delivery hold |
| delivery-webhook | 1 | false; bounded raw body, timestamp and Resend/Svix signature required |

Deployed in that order. The worker was updated once more to enforce a source-level staging hold: EMAIL_DELIVERY_ENABLED, EMAIL_SENDER_VERIFIED and WEB_PUSH_ENABLED resolve to false regardless of pre-existing environment values. Removal requires separate delivery approval and reviewed deployment. No scheduler was installed. Crypto's configuredProvider() remains disabled and PayPal has no live route.

Runtime endpoint acceptance is **BLOCKED**: direct HTTPS to the staging API was rejected by the execution proxy (403); the web connector also could not access those endpoints. ACTIVE and reviewed source/auth settings do not prove cold-start/runtime HTTP behavior. The necessary next network action is to allow outbound HTTPS to `cxtytbjvdlngahytfilr.supabase.co`, then check public readiness and rejection of missing/invalid Auth, worker secrets and webhook signatures. Do not send a valid delivery-worker invocation against customer jobs.

## IMPLEMENTED LOCALLY — not activated or wired into deployed settlement

- Read-only Bitcoin Core/Litecoin Core JSON-RPC transport: configured HTTPS endpoint, redirects refused, bounded replies, request/reply correlation, deadlines and sanitized failures; sending/wallet-write RPCs are forbidden.
- Independent BTC/LTC wallet transaction verification: mainnet/node-brand/sync checks, exact invoice destination, integer base units, output deduplication, conflicts/replacements, first-received window and confirmations. Returns partial/pending/verified evidence for the existing SQL authorization/idempotency layer; it does not mark an order paid. Transparent wallet receive outputs only; no MWEB or arbitrary token support claimed.
- PayPal sandbox reconciliation re-fetches official Orders v2 order details and verifies provider order, canonical reference, merchant, currency, exact amount, capture completion and single capture. Added bounded responses, redirect refusal, invalid ID/amount/retry-key rejection and sanitized transport failures.
- Updated the browser regression to check article-level language/RTL while preserving the chosen English admin interface, matching the prior content localization implementation.

Remaining payment implementation is explicit: durable unique-address invoice allocation and trusted BTC/LTC quote source, approved node/provider configuration, authenticated callback/polling bridge, and official PayPal-to-canonical-order settlement/refund wiring. These are not supplied by the read-only verifier. Do not select this verifier as configuredProvider() or enable collection until those pieces and independent provider acceptance pass. Existing SQL retains global TXID uniqueness, reservations, audit/idempotent transitions and dispute states.

## TESTED

- 51 final focused payment/delivery tests pass, including BTC and LTC proof, underpayment, insufficient confirmations, conflicts/replacements, wrong networks/recipients, invalid amounts, duplicate outputs, bounded node responses, PayPal merchant/capture mismatches and explicit delivery hold.
- One integration pass: 76 Node tests, 85 embedded PostgreSQL scenarios and 67 Python regressions passed. Subsequent focused regressions cover the final added invoice-value, checkout-evidence integration and delivery-hold guards; the unchanged integration suites were not repeated.
- Completion/content-admin and checkout Chromium suites passed; four deployed Edge entrypoints and the new payment modules passed Deno checks. No actual provider, chain-node or sandbox account call was made.
- Actual hosted SQL-role tests passed: canonical order price/idempotency, denial of buyer-paid transition, cross-account order/support denial, forged JWT admin rejection and persisted admin/staff recognition. Fresh synthetic Auth/session/product/order/support rows were in a transaction and rolled back. PostgreSQL sequence gaps can remain; no real account or business row was edited. These are SQL-role checks, **not real-JWT HTTP/Auth acceptance**.

## Database state and external gates

All six reviewed migrations were already installed individually in the preceding rollout; all 25 foundation entries were retained. No additional migration/schema change was made in this sprint. The owner accepted the remaining partial recovery limitations for staging; full encrypted recovery certification is not claimed.

Still needed: staging HTTP access and real-JWT/browser/Storage/Realtime acceptance; owner-reviewed node/provider credentials and invoice/quote allocation; eligible PayPal merchant country/business account, sandbox client credentials, merchant/webhook IDs and official sandbox settlement acceptance; verified Resend domain/sender, VAPID and separately approved schedules/delivery. Merchant operating region is unknown: availability and product eligibility must be confirmed with the actual provider/account; do not infer eligibility from site language or use regional/identity workarounds. Production schema/Auth reconciliation and release approval remain separate.

Primary references: [Bitcoin Core gettransaction](https://bitcoincore.org/en/doc/30.0.0/rpc/wallet/gettransaction/), [Litecoin Core wallet RPC source](https://github.com/litecoin-project/litecoin/blob/v0.21.4/src/wallet/rpcwallet.cpp), [PayPal Orders v2](https://developer.paypal.com/api/orders/v2), [PayPal country availability](https://www.paypal.com/webapps/mpp/country-worldwide). These define API behavior/availability checks, not proof of this merchant's approval.
