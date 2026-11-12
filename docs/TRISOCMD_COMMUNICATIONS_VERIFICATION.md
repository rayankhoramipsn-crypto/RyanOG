# Notifications, email and support verification

2026-11-11. Continues `5bc014c` on `feature/trisocmd-completion`, PR #37. Isolated implementation verified; live delivery remains disabled and unverified. No hosted data, deployments, payments or DNS changed.

## Implementation and compatibility

Fifth additive migration: `20261111185818_notifications_email_support.sql`. Applies after the four existing feature migrations against the committed staging public/Storage snapshot. Historical orders, original `support_tickets`, existing threads and complete legacy message bodies survive. Legacy ticket inserts/status updates bridge into the existing canonical `tc42_support_threads/messages`; customer/admin/support use this model. Direct client message/thread writes are replaced by active-session RPCs with retry keys. Support role comes from persisted app metadata and grants no financial order or Pro-management access.

Events cover buyer/seller purchase requests, order transitions, invoice states, chat, pending listing/admin review, approval/rejection, support creation/replies/status. Unique event/recipient/channel keys collapse overlapping personal/admin audiences. Private notification pages, server read watermarks, preferences, opt-in foreground alerts and a notification-only service worker preserve account isolation. Realtime reconnect triggers refresh; polling also recovers missed events. Background payloads contain generic text only, with stable replacement tags; push providers do not offer exactly-once delivery. No page/token caching is installed.

Existing outbox now supports atomic SKIP LOCKED leases, fencing, current consent/role/verified-address checks, six attempts with capped exponential backoff, a 23-hour automatic retry window, immutable attempt logs, and stable Resend idempotency keys. Provider acceptance and confirmed delivery are separate states. Signed Resend/Svix webhooks enforce raw-body HMAC, timestamp, size and event validation plus durable deduplication, including events arriving before worker acknowledgement. Admin monitoring exposes redacted aggregates/logs and restricted manual retries within the same window. Ambiguous jobs outside that window require provider reconciliation; they are never automatically resent.

Support includes owner history, staff inbox/filter/assignment/status, earlier replies, order-linked dispute tickets, network-failure draft retention and idempotent retries. Cross-account access, forged support roles and stale sessions are denied. Opening a dispute ticket does not change financial/order status or process a refund.

## Reproduction and evidence

- `RUN_ADVISORS=1 npm test`: 50 Node, 78 PostgreSQL scenarios (25 payment, 8 browse, 45 full reconstructed schema), 56 Python regressions. Embedded platform stand-ins are explicitly labeled.
- `npm run check:edge`: four Deno entrypoints, including the real pinned `web-push` transport.
- Serve this repository on loopback port 8765, then `TRISO_CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`: six Chromium suites. New coverage includes synchronized reads, opt-in/out, reconnect refresh, disabled unconfigured push, private session resets, retry keys, preserved drafts, assignment/status, 390px Persian/Arabic RTL and uncaught-error checks. Browser backend traffic is intercepted.
- `TRISO_INTEGRATION_CONFIG=work/local-supabase-status.json npm run test:communications:local`: dedicated loopback-only local Supabase, 17 communications scenarios including real Auth/JWT/REST support isolation and the actual database-backed worker. Resend is intercepted with synthetic acknowledgements; no live email. Existing local copies can refresh this milestone's functions with `TRISO_REFRESH_DELIVERY=1`; this option is solely for disposable test copies.
- CI restores the full snapshot into a fresh disposable local Supabase and runs all migrations, real JWT tests and binary Storage checks. It also runs all regressions, Edge checks and six browser suites.

## External configuration and rollout blockers

All five feature migrations and new Edge Functions remain unapplied/undeployed on hosted projects. After a separately authorized staging rollout, verify hosted RLS, Auth, realtime publication/subscriptions and reconnection. Support role assignment must be performed by an authorized operator through app metadata; user metadata never grants access.

No authorized Resend API/webhook secret, independently verified `trisocmd.shop` sending-domain configuration, or live delivery receipt was available. Keep `EMAIL_DELIVERY_ENABLED=false` and `EMAIL_SENDER_VERIFIED=false`. Intended sender is exactly `support@trisocmd.shop`. Supabase Auth confirmation/recovery SMTP/templates remain a separate external configuration task.

For a later authorized setup: configure Edge secrets from `.env.example`; verify domain/DNS with Resend; configure the signed `delivery-webhook` endpoint for sent/delivered/bounced/complained/failed events; provision a private scheduler that POSTs `delivery-worker` with `Authorization: Bearer <DELIVERY_WORKER_SECRET>` (random secret, at least 32 characters). Each invocation handles at most five email and five push jobs. No scheduler is installed or deployed here. Review queue health and synthetic delivery receipts before enabling flags.

Background push additionally requires an authorized VAPID key pair, hosted worker deployment, HTTPS service-worker publication and real-device acceptance. Keep `WEB_PUSH_ENABLED=false`. Capabilities GET exposes only availability and the public VAPID key; browser preflight is supported. Subscription endpoints are vendor allowlisted, owner isolated and capped at ten active devices. Live Web Push and hosted realtime have not been independently verified. Firefox coverage remains blocked by its browser-download policy.
