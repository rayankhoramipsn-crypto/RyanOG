# Marketplace/admin workflow verification

2026-11-11 (Asia/Tehran). Feature branch only. No hosted migrations, production changes, customer-data deletion, merge, deployment or payment activation.

Implemented in additive `20261111181536_marketplace_workflows.sql` and shared main/preview components:

- Owner-only listing editing; revisions return to pending moderation. Active purchase/order records block changes. Sold listings cannot be removed, resurrected or marked Sold by an authenticated client.
- Stored-owner photo validation and serialized four-photo attachment cap. Private gallery bucket enforces JPEG/PNG/WebP and 5 MiB. Browser checks binary signatures before consuming a listing quota slot; retries fill available photo positions. Pending photo removal keeps moderation gates in place.
- Opt-in public seller profiles, owner-scoped profile editing, and authorized admin Pro controls with optional expiry. These permissions do not collect payment.
- All-page seller submissions, buyer/seller orders, moderation conversations and intake records. Existing server browse search/category/price filters and sorting remain compatible.
- Buyer intake cancellation; canonical cancellation/fulfillment retires the linked intake, permitting safe new attempts. Direct legacy bridge edits remain blocked. Canonical transitions notify once per recipient; commission remains the immutable 4% server quote rounded to cents. Sellers can begin authorized fulfillment.
- Recent chat messages plus older history, backend inbox pagination, message-ID read watermarks and idempotent send keys. Late read acknowledgments cannot hide newly arrived messages. Retries create one message and one notification per recipient. Revoked permissions/account switches clear private views.

## Evidence

`npm test` runs payment, browse and complete staging-schema scenarios. `npm run test:browser` runs five Chromium suites, including seller history #241, editing/profile forms, admin Pro, older chat history, uncertain-send retries, permission revocation, mobile and FA/AR RTL. The existing admin suite verifies older pending submissions from another seller.

The new local native runner uses a previously prepared disposable loopback Supabase copy with the prior migrations; it preserves prior synthetic records and creates separate synthetic identities:

```sh
TRISO_INTEGRATION_CONFIG=work/local-supabase-status.json TRISO_STORAGE_TESTS=1 npm run test:marketplace:local
```

Thirteen native marketplace/Storage scenarios pass, including an actual PNG upload/read, MIME/size rejection, forbidden cross-owner uploads/private reads, a real-JWT admin REST query for 241 historical cross-seller listings, expiry permissions, commission, lifecycle and chat concurrency. A fresh local Supabase instance can instead run the complete suite with `TRISO_INTEGRATION_CONFIG=... TRISO_STORAGE_TESTS=1 npm run test:integration`.

CI now runs all Node/PostgreSQL/Python/Edge/browser suites and a separate fresh local Supabase JWT/Storage integration job. Its stacks are local to the runner and never linked to hosted projects.

## External gates

All four feature migrations and the new handlers remain unapplied to hosted staging/production. Hosted Auth settings/sender/OAuth, real hosted WebSocket reconnect/delivery and Firefox remain unverified. Approved binaries are served only through existing private-bucket authorization; this is file type/size and access validation, not malware scanning. Keep live payments disabled. Full six-phase release acceptance remains incomplete.
