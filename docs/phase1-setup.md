# Phase 1 checkout: implementation and operator setup

This branch extends the existing site. It does not deploy, collect funds, enable
merchant processing, operate custody, or pay sellers. `configuredProvider()` always
returns disabled. Legacy `STORE_CRYPTO_ENABLED` and `STORE_CRYPTO_PILOT` flags no
longer enable the removed shared-wallet flow.

## Canonical model and compatibility

`tc42_orders` is canonical for new store and marketplace checkout orders.
`phase1_create_order(items, key)` wraps the existing server-price/quantity validator
with a buyer-scoped idempotency key. Reusing a key with a changed cart fails.
`orders` and `order_items` are historic tables: preserve them and their existing
policies. No automatic import is attempted because identity/financial provenance
cannot safely be inferred. Admin's order overview now reads `tc42_orders`.

`market_purchase_requests` remains the intake/moderation record. A buyer may bridge
an eligible request exactly once through `phase1_market_order(request_id)`.
Its unique `market_request_id` links the canonical order. Its price is the existing
server-quoted request price, with a recorded 4% commission rounded to USD cents.
Commission records do not authorize custody, deductions or payouts. A bridged
request's legacy status and TXID RPC paths are blocked: subsequent actions belong
in the canonical order center. Existing unbridged requests, chat and moderation
remain available. Old request statuses remain historical intake labels.

No historic order, invoice, product, account, conversation or claim is deleted.
Legacy shared-address invoices remain readable, but cannot be offered for a new
payment or settled by the new provider handler. Reconcile them independently.

## Apply in an isolated environment first

1. Back up schema and data and inspect actual constraints, policies and grants.
   The archive contains SQL snapshots, not an authoritative migration history.
   Required baseline objects come from the existing order schema and validator in
   `docs/production-store-checkout.sql` (the initial order definition only),
   V18/V27 marketplace requests, V28 grants, V34 notifications, V35 claims/email
   preferences, and `docs/store-crypto-invoices.sql`. Do not blindly concatenate
   or reapply those snapshots. They contain overlapping definitions.
2. Confirm products, listings, requests, invoice tables and global TXID registry
   exist. The versioned migration fails closed when required objects are absent.
   Confirm **one identity authority per checkout backend**. All existing canonical
   customer IDs must exist in that project's `auth.users`; otherwise migration
   aborts. The old production function authenticated staging users while writing
   to another project. Do not restore this bridge. An operator must choose an
   identity/data reconciliation plan before this can run on that split backend.
3. Review and apply `supabase/migrations/20261108214609_phase1_checkout.sql` to a
   disposable copy. It is transactional and additive except for extending known
   status constraints and replacing canonical SELECT policies/RPC access.
   Unknown custom status constraints or policies require review before application.
   Historic store/market TXID collisions abort rather than silently choosing an owner.
4. Run tests and security advisors against that copy, then real buyer/seller/admin
   JWT tests, including revoked admin sessions. Local fixtures are not a substitute
   for testing the deployed schema. The tests' fixture is **not a baseline migration**.
5. Deploy Edge Functions to that same isolated Supabase project only after review.
   `store-crypto` public GET reports capability, while every POST validates the
   bearer user token with the same project's `/auth/v1/user`. `verify_jwt=false`
   permits public readiness and provider callbacks, not anonymous mutation.
6. Review the frontend's existing project URL/public key. The order center uses
   the existing staging identity authority, just like the current auth flow.
   Do not point it at a different project without migrating Auth deliberately.
7. Review all release blockers below before any production deployment. No CLI
   command in this work applied a migration or deployed a function remotely.

The local test fixture reconstructs known archive contracts on PostgreSQL 18.
It does not establish compatibility with every deployed Postgres version,
production extension, policy, trigger, or undocumented schema difference.

## Provider integration contract — disabled until implemented and reviewed

Implement a concrete adapter returned by `configuredProvider()` only after
selecting a merchant-authorized provider with documented BTC **and** LTC support.
No provider has been selected or invented in this branch. Do not treat an arbitrary
HTTP URL, an explorer screenshot or a user TXID as a payment processor.

Adapter methods:

- `createInvoice({order, network, idempotencyKey})`: receives the server's locked
  order-price snapshot, never the browser's price. Return `chain: 'mainnet'`,
  `network: 'BTC'|'LTC'`, unique receiving `address`, integer `units` as a decimal
  string, `provider_invoice_id`, and ISO `expires_at` within one hour. The database
  generates a separate invoice UUID and binds it to the owner and order.
  Provider idempotency must bind the external invoice to this order. Never expose
  its payment instructions before the inventory reservation commits. Handle and
  cancel an orphan external invoice if the reservation fails.
- `verify({invoice, txid})`: independently fetch authoritative chain/provider proof;
  return stable versioned `event_id` and `evidence` with `provider_invoice_id`,
  `chain`, `network`, `address`, decimal-string `units`, normalized `txid`,
  integer `confirmations`, `double_spend: false`, and ISO `seen_at`.
  Verify full transaction outputs, exact intended chain, receiving script/address,
  amount actually received and confirmations. An adapter must not echo user fields.
  Both JS and SQL require matching invoice/network/chain/address, the issuance
  window and at least six confirmations. Sandbox adapters must remain isolated
  from this mainnet-only invoice schema; this branch uses mocks, never funds.
- `authenticateWebhook(request)`: authenticate the **raw** body, provider signature
  and timestamp/replay window. Return `order_id`, stable `event_id` and `txid`.
  The callback handler independently calls `verify` again; callback fields alone
  cannot confirm an order. Event IDs are globally unique per provider in SQL.
- Implement provider invoice cancellation and orphan reconciliation before enabling.

Partial payments remain partial. Multiple partial TXIDs are not automatically
aggregated: retain claims and reconcile with support. Overpayment may satisfy the
invoice but does not issue an automatic refund. Expired or cancelled reservations
never commit stock upon late proof: retain the verified receipt for review.
No chain-reorganization recovery or automated refund adapter is active. These
are launch blockers, not operations that can be enabled by a configuration flag.

Invoice retry returns the existing invoice. A different network or expired quote
requires a new unpaid order; never overwrite the original payment destination.
Inventory stays unchanged while reservations are active; locked reservation sums
prevent selling it twice. Verification commits stock once or records review.
Listings become Sold only with independently verified payment and committed stock.
Expired reservations stop counting immediately even if the expiry worker is delayed.
Schedule the service-only `phase1_expire_invoices()` RPC for expiry audit/notices.

## PayPal and manual methods

`_shared/paypal.mjs` is an **internal sandbox transport**, not an activated payment
method. It uses official OAuth, Orders v2 creation/capture and webhook verification
endpoints at `api-m.sandbox.paypal.com`. Server-generated order IDs bind reference
and request-id keys. `inspectPayPalCapture` rejects non-completed, wrong merchant,
wrong reference, amount or currency captures. No public route calls this adapter
and no PayPal response can settle crypto invoices.

To complete an authorized merchant release, supply sandbox merchant/client
credentials and webhook ID in backend secrets; persist provider order/capture
IDs in a dedicated receipt integration; verify server-fetched captures and signed
notifications; implement cancellation, capture reconciliation, duplicate capture,
refund and dispute workflows; add sandbox end-to-end tests. Only then consider
an explicitly authorized live merchant adapter. Do not change the hard-coded
sandbox hostname to bypass these gates.

BANK, PAYPAL, CASHAPP and CONTACT_SUPPORT claim references remain unverified.
Admin may reject or hold a claim with an audit note. There is deliberately no
"mark paid" button. Actual bank receipt or supported provider evidence must be
integrated before a manual payment can become an authoritative receipt.
Screenshots, references and customer statements cannot confirm funds.

## Lifecycle and private notifications

States: awaiting_payment → payment_submitted → paid/payment_review →
fulfillment_pending → fulfilled. Payment-confirmed is the existing `paid` label.
Cancellation is allowed for the owner/admin before any claim, with reservation
release. Buyer/seller/admin participants may open disputes. Admin can resume
fulfillment from a dispute only with a previously verified invoice, committed
inventory and a reason. Refund and payout states remain non-operational until
provider-backed integrations exist. Repeat transitions do not repeat fulfillment,
stock deduction or notifications.

The existing in-site inbox receives transactional order creation/status,
verification failure and expiry notices. Audit events, invoice proof and claims
are buyer/admin-restricted; sellers only see their authorized order summary and
delivery note. No buyer email is included in seller notifications.

V35's private, opt-in email outbox is reused by notification triggers. No authorized
Resend credentials or verified sender domain were supplied; nothing sends email.
Before enabling delivery, configure a backend-only Resend key, verified sender,
opt-in lookup and leased retry worker using provider idempotency keys per
notification/recipient, plus delivery/bounce monitoring. Email delivery is an
external blocker. Foreground browser alerts remain distinct from background push;
no background push service was introduced or claimed.

## Secrets and manual setup still required

- Same-project Supabase runtime URL, public key, backend-only service-role key;
  reconciled identity topology and confirmed migration baseline.
- Selected crypto provider merchant/store identity, server API secret, supported
  BTC/LTC endpoints, signature verification keys/webhook setup, owned invoice
  destinations, confirmation/reorganization monitoring and cancellation handling.
- PayPal sandbox merchant eligibility, client ID/secret, merchant ID, webhook ID;
  later explicit live authorization and completed receipt/refund integration.
- Optional Resend API key and verified sender/domain, opt-in email worker and cron.
- Operator-owned expiry scheduling, reconciliation, dispute, refund, delivery,
  payout and incident procedures. No escrow or payout claim is authorized here.

Do not paste secrets into chat, HTML, JavaScript, fixtures, PRs or repository files.
Use backend secret settings. The public/publishable keys already in the site are
not service-role keys.

## Rollback

Revert this branch's frontend/Edge Function commit, retaining the provider-disabled
behavior. Run `docs/phase1-retire.sql` to revoke new mutation APIs without deleting
orders or audit evidence. It deliberately does **not** re-enable legacy payment
settlement or undo financial history. Structural removal is safe only on an empty
disposable database; restoring old constraints after new states exist would fail
or destroy history. Restore service in a reviewed forward migration, rather than
resetting production or dropping populated tables.
