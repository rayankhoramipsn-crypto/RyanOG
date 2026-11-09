# TRISOCMD external dependencies

No secrets requested in chat; no customer data exported; no remote writes, deployments, paid resources or live payments.

| Dependency | State / required action |
|---|---|
| Supabase | Staging cxtytbjvdlngahytfilr has marketplace/blog/support. Production zrolxgzndinktsjsthfw has six store/admin tables. Reconcile identity/schema and validate a complete disposable schema. PR #36 fixture is not a production clone. |
| BTC/LTC | Provider disabled. Authorized adapter, addresses/networks, independent chain verification, signatures, refunds/reorg handling and sandbox acceptance required. |
| PayPal | PR #36 internal sandbox transport only. Merchant eligibility/credentials, capture/webhook/refund integration pending. |
| Escrow/Pro | Three-day escrow remains specification only. No custody, payout, release or paid Pro claim. |
| Resend | Sender/credentials unverified. email.mjs is an injectable core, not deployed worker. Need atomic leasing, retry/backoff/limits, provider transport, monitoring and Auth template/hook integration. |
| OAuth/Auth email | Real isolated signup/confirmation/recovery/Google OAuth not run. Configure staging redirects and sender; no browser secrets. |
| Web Push | No delivery service; optional background push disabled/unimplemented. |
| Firefox | Install attempted; cdn.playwright.dev and playwright.download.prss.microsoft.com returned HTTP 403 Domain forbidden. System Chromium succeeded. Approve download domains or supply browser before Firefox acceptance. |
| Docs network | Direct Supabase changelog request blocked. Supabase documentation connector used for sessions. |
| SEO | Deployment requires noindex/staging marker. Offline renderer defaults noindex; CMS/build wiring and production release review required. |
| Password security | Leaked-password protection disabled in both projects; operator configuration/plan check required. |

Later approval boundary: merge/deployment, live payment activation, paid services and irreversible DB changes. No approval requested now because remaining implementation and staging validation must be completed first.
