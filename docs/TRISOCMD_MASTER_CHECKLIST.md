# TRISOCMD master checklist

Updated 2026-11-11 (Asia/Tehran). **INCOMPLETE; not release-ready.**

Baseline: PR #36 at 3eea77c; all four commits including hosted marketplace status compatibility are preserved.
VERIFIED LOCAL means isolated fixtures/local services; hosted acceptance remains separate. PARTIAL means implementation exists with gaps. UNVERIFIED means acceptance pending; not necessarily absent. BLOCKED means external configuration or permissions required.

| Phase | Status and evidence |
|---|---|
| 1 | PARTIAL: PR #36 retained; 24 provider tests, 25 native PostgreSQL scenarios. Local same-project Auth/SQL integration passes; hosted rollout and real provider acceptance pending. |
| 2 | PARTIAL: admin pagination/gallery batching fixed; mocked cross-seller listing #241 visible; paginated browse/search/price filters and eight DB scenarios added. Migration unapplied; real role/upload/quota E2E pending. |
| 3 | PARTIAL: 8 session tests; refresh coordinator, offline retention and server logout requests. Real OAuth/chat/admin acceptance pending. |
| 4 | VERIFIED LOCAL: private alerts, durable email/push outbox, signed webhooks and canonical support workflows; live sender/push/hosted rollout blocked. See TRISOCMD_COMMUNICATIONS_VERIFICATION.md. |
| 5 | PARTIAL: media parsing, blog deletion/RTL/metadata fixed; 4 static article tests. CMS publication wiring and production SEO gate pending. |
| 6 | PARTIAL: 50 Node tests, 78 DB scenarios, 56 Python tests, six Chromium suites; 13 native marketplace/Storage cases. Firefox blocked; exhaustive real-role/device/security/performance audit unfinished. |


## PHASE 1 — COMPLETE PAYMENT, CHECKOUT AND ORDER MANAGEMENT

| Requirement | Status |
|---|---|
| Server-generated BTC/LTC invoices | PARTIAL — PR #36; fixtures tested; live service blocked |
| Immutable server-authoritative pricing | PARTIAL — PR #36; fixtures tested; live service blocked |
| Exchange-rate conversion | PARTIAL — PR #36; fixtures tested; live service blocked |
| Invoice expiration | PARTIAL — PR #36; fixtures tested; live service blocked |
| Unique invoice identifiers | PARTIAL — PR #36; fixtures tested; live service blocked |
| Secure TXID submission | PARTIAL — PR #36; fixtures tested; live service blocked |
| Global TXID uniqueness across accounts and orders | PARTIAL — PR #36; fixtures tested; live service blocked |
| Independent blockchain payment verification | PARTIAL — PR #36; fixtures tested; live service blocked |
| Correct address, network and amount validation | PARTIAL — PR #36; fixtures tested; live service blocked |
| Sufficient confirmation checks | PARTIAL — PR #36; fixtures tested; live service blocked |
| Idempotent transaction processing | PARTIAL — PR #36; fixtures tested; live service blocked |
| Duplicate webhook protection | PARTIAL — PR #36; fixtures tested; live service blocked |
| Payment audit logging | PARTIAL — PR #36; fixtures tested; live service blocked |
| Expired/partial/late payments | PARTIAL — PR #36; fixtures tested; live service blocked |
| Safe retries and cancellations | PARTIAL — PR #36; fixtures tested; live service blocked |
| Payment failure and support flows | PARTIAL — PR #36; fixtures tested; live service blocked |
| Buyer/seller/admin order views | PARTIAL — PR #36; fixtures tested; live service blocked |
| Pending, submitted, confirmed, fulfilled, cancelled and disputed statuses | PARTIAL — PR #36; fixtures tested; live service blocked |
| Inventory reservation | PARTIAL — PR #36; fixtures tested; live service blocked |
| Atomic stock updates | PARTIAL — PR #36; fixtures tested; live service blocked |
| Duplicate-purchase protection | PARTIAL — PR #36; fixtures tested; live service blocked |
| Accurate Sold status | PARTIAL — PR #36; fixtures tested; live service blocked |
| Order history | PARTIAL — PR #36; fixtures tested; live service blocked |
| Fulfillment workflow | PARTIAL — PR #36; fixtures tested; live service blocked |
| Dispute management | PARTIAL — PR #36; fixtures tested; live service blocked |
| Transactional notifications | PARTIAL — PR #36; fixtures tested; live service blocked |

## PHASE 2 — COMPLETE MARKETPLACE

| Requirement | Status |
|---|---|
| Seller listing creation | VERIFIED LOCAL — isolated role/Storage/DB/browser checks; hosted rollout pending |
| Mandatory image upload from local gallery | VERIFIED LOCAL — isolated role/Storage/DB/browser checks; hosted rollout pending |
| Secure Supabase Storage | VERIFIED LOCAL — isolated role/Storage/DB/browser checks; hosted rollout pending |
| Multiple listing photos where supported | VERIFIED LOCAL — isolated role/Storage/DB/browser checks; hosted rollout pending |
| Title, price, description and category fields | VERIFIED LOCAL — isolated role/Storage/DB/browser checks; hosted rollout pending |
| Listing editing and deletion | VERIFIED LOCAL — isolated role/Storage/DB/browser checks; hosted rollout pending |
| Listing previews | UNVERIFIED — acceptance pending; see phase evidence |
| Listing approval queue | VERIFIED LOCAL — isolated role/Storage/DB/browser checks; hosted rollout pending |
| Admin approve/decline/remove actions | VERIFIED LOCAL — isolated role/Storage/DB/browser checks; hosted rollout pending |
| Moderation notes | UNVERIFIED — acceptance pending; see phase evidence |
| Seller ownership checks | VERIFIED LOCAL — isolated role/Storage/DB/browser checks; hosted rollout pending |
| Three free listings per day | VERIFIED LOCAL — isolated role/Storage/DB/browser checks; hosted rollout pending |
| Seller Pro privileges and unlimited listings | VERIFIED LOCAL — isolated role/Storage/DB/browser checks; hosted rollout pending |
| Four percent commission records | VERIFIED LOCAL — isolated role/Storage/DB/browser checks; hosted rollout pending |
| Pro seller prioritization | VERIFIED LOCAL — isolated role/Storage/DB/browser checks; hosted rollout pending |
| Listing search | VERIFIED LOCAL — paginated RPC and main/preview 241-listing fixtures; migration/live acceptance pending |
| Category and price filters | VERIFIED LOCAL — paginated RPC and main/preview 241-listing fixtures; migration/live acceptance pending |
| Sorting | VERIFIED LOCAL — paginated RPC and main/preview 241-listing fixtures; migration/live acceptance pending |
| New arrivals | UNVERIFIED — acceptance pending; see phase evidence |
| Featured items | UNVERIFIED — acceptance pending; see phase evidence |
| Seller profiles | VERIFIED LOCAL — isolated role/Storage/DB/browser checks; hosted rollout pending |
| Listing status synchronization | VERIFIED LOCAL — isolated role/Storage/DB/browser checks; hosted rollout pending |
| Sold-out inventory protection | VERIFIED LOCAL — isolated role/Storage/DB/browser checks; hosted rollout pending |
| Responsive product cards | VERIFIED LOCAL — isolated role/Storage/DB/browser checks; hosted rollout pending |
| Loading, empty and error states | VERIFIED LOCAL — paginated RPC and main/preview 241-listing fixtures; migration/live acceptance pending |

## PHASE 3 — AUTHENTICATION, CHAT AND ADMIN

| Requirement | Status |
|---|---|
| Email registration and confirmation | UNVERIFIED — acceptance pending; see phase evidence |
| Password login | UNVERIFIED — acceptance pending; see phase evidence |
| Google OAuth | BLOCKED / UNVERIFIED — service configuration and E2E required |
| Password recovery | UNVERIFIED — acceptance pending; see phase evidence |
| Remember Me | UNVERIFIED — acceptance pending; see phase evidence |
| Persistent sessions | UNVERIFIED — acceptance pending; see phase evidence |
| Refresh-token handling | UNVERIFIED — acceptance pending; see phase evidence |
| Logout | UNVERIFIED — acceptance pending; see phase evidence |
| Expired sessions | UNVERIFIED — acceptance pending; see phase evidence |
| Account permissions | UNVERIFIED — acceptance pending; see phase evidence |
| Buyer/seller conversations | UNVERIFIED — acceptance pending; see phase evidence |
| Real-time message delivery | UNVERIFIED — acceptance pending; see phase evidence |
| Message history | UNVERIFIED — acceptance pending; see phase evidence |
| Inbox | UNVERIFIED — acceptance pending; see phase evidence |
| Unread counters | UNVERIFIED — acceptance pending; see phase evidence |
| Chat notifications | UNVERIFIED — acceptance pending; see phase evidence |
| Mobile layout | UNVERIFIED — acceptance pending; see phase evidence |
| Reconnect and subscription cleanup | UNVERIFIED — acceptance pending; see phase evidence |
| Conversation authorization | UNVERIFIED — acceptance pending; see phase evidence |
| Admin oversight where legitimately permitted | UNVERIFIED — acceptance pending; see phase evidence |
| Product listings | UNVERIFIED — acceptance pending; see phase evidence |
| Marketplace moderation | UNVERIFIED — acceptance pending; see phase evidence |
| Users and sellers | UNVERIFIED — acceptance pending; see phase evidence |
| Orders | UNVERIFIED — acceptance pending; see phase evidence |
| Payment claims | UNVERIFIED — acceptance pending; see phase evidence |
| Support tickets | UNVERIFIED — acceptance pending; see phase evidence |
| Disputes | UNVERIFIED — acceptance pending; see phase evidence |
| Chats | UNVERIFIED — acceptance pending; see phase evidence |
| Seller Pro entitlements | UNVERIFIED — acceptance pending; see phase evidence |
| Product media | UNVERIFIED — acceptance pending; see phase evidence |
| Blog content | UNVERIFIED — acceptance pending; see phase evidence |
| Operational logs | UNVERIFIED — acceptance pending; see phase evidence |

## PHASE 4 — NOTIFICATIONS, EMAIL AND SUPPORT

| Requirement | Status |
|---|---|
| In-site notifications | VERIFIED LOCAL — isolated role/SQL/browser coverage; hosted rollout pending |
| Browser foreground notifications | VERIFIED LOCAL — isolated role/SQL/browser coverage; hosted rollout pending |
| Optional background Web Push with a genuine configured delivery service | BLOCKED / UNVERIFIED — service configuration and E2E required |
| Notification permission controls | VERIFIED LOCAL — isolated role/SQL/browser coverage; hosted rollout pending |
| Notification preferences | VERIFIED LOCAL — isolated role/SQL/browser coverage; hosted rollout pending |
| Duplicate-event prevention | VERIFIED LOCAL — isolated role/SQL/browser coverage; hosted rollout pending |
| Seller order notifications | VERIFIED LOCAL — isolated role/SQL/browser coverage; hosted rollout pending |
| Buyer payment notifications | VERIFIED LOCAL — isolated role/SQL/browser coverage; hosted rollout pending |
| New-message alerts | VERIFIED LOCAL — isolated role/SQL/browser coverage; hosted rollout pending |
| Listing moderation notifications | VERIFIED LOCAL — isolated role/SQL/browser coverage; hosted rollout pending |
| Order cancellation and dispute updates | VERIFIED LOCAL — isolated role/SQL/browser coverage; hosted rollout pending |
| Registration confirmation | BLOCKED / UNVERIFIED — service configuration and E2E required |
| Password reset | UNVERIFIED — acceptance pending; see phase evidence |
| Order confirmation | VERIFIED LOCAL — templates/queue/worker tested; live sending disabled and unverified |
| Payment status | VERIFIED LOCAL — templates/queue/worker tested; live sending disabled and unverified |
| Seller purchase notices | VERIFIED LOCAL — templates/queue/worker tested; live sending disabled and unverified |
| Listing approval/decline | VERIFIED LOCAL — templates/queue/worker tested; live sending disabled and unverified |
| Support replies | VERIFIED LOCAL — templates/queue/worker tested; live sending disabled and unverified |
| Customer contact form | VERIFIED LOCAL — isolated role/SQL/browser coverage; hosted rollout pending |
| Support tickets | VERIFIED LOCAL — isolated role/SQL/browser coverage; hosted rollout pending |
| Ticket history | VERIFIED LOCAL — isolated role/SQL/browser coverage; hosted rollout pending |
| Admin replies | VERIFIED LOCAL — isolated role/SQL/browser coverage; hosted rollout pending |
| Ticket statuses | VERIFIED LOCAL — isolated role/SQL/browser coverage; hosted rollout pending |
| Help Center | UNVERIFIED — acceptance pending; see phase evidence |
| FAQ | UNVERIFIED — acceptance pending; see phase evidence |
| Dispute and refund information | UNVERIFIED — acceptance pending; see phase evidence |

## PHASE 5 — STOREFRONT, CONTENT, DESIGN AND SEO

| Requirement | Status |
|---|---|
| Near-black backgrounds | UNVERIFIED — acceptance pending; see phase evidence |
| Purple accents | UNVERIFIED — acceptance pending; see phase evidence |
| Premium typography | UNVERIFIED — acceptance pending; see phase evidence |
| Modern gaming imagery | UNVERIFIED — acceptance pending; see phase evidence |
| Professional and clean | UNVERIFIED — acceptance pending; see phase evidence |
| Not generic or overly cyberpunk | UNVERIFIED — acceptance pending; see phase evidence |
| Consistent components | UNVERIFIED — acceptance pending; see phase evidence |
| Mobile-first responsive behavior | UNVERIFIED — acceptance pending; see phase evidence |
| Main navigation | UNVERIFIED — acceptance pending; see phase evidence |
| Hero | UNVERIFIED — acceptance pending; see phase evidence |
| Fortnite categories | UNVERIFIED — acceptance pending; see phase evidence |
| Gaming gear categories | UNVERIFIED — acceptance pending; see phase evidence |
| Digital products | UNVERIFIED — acceptance pending; see phase evidence |
| Featured items | UNVERIFIED — acceptance pending; see phase evidence |
| Best sellers | UNVERIFIED — acceptance pending; see phase evidence |
| New arrivals | UNVERIFIED — acceptance pending; see phase evidence |
| Product cards | UNVERIFIED — acceptance pending; see phase evidence |
| Product search | UNVERIFIED — acceptance pending; see phase evidence |
| Product detail pages | UNVERIFIED — acceptance pending; see phase evidence |
| Photo galleries | VERIFIED LOCAL — targeted mocks/parsers; live operation unverified |
| Specifications | UNVERIFIED — acceptance pending; see phase evidence |
| Approved YouTube reviews | VERIFIED LOCAL — targeted mocks/parsers; live operation unverified |
| Category filters | UNVERIFIED — acceptance pending; see phase evidence |
| Reviews where supported | UNVERIFIED — acceptance pending; see phase evidence |
| Newsletter functionality where configured | UNVERIFIED — acceptance pending; see phase evidence |
| Footer | UNVERIFIED — acceptance pending; see phase evidence |
| Contact links | UNVERIFIED — acceptance pending; see phase evidence |
| Storefront checkout entry points | UNVERIFIED — acceptance pending; see phase evidence |
| Admin article creation | UNVERIFIED — acceptance pending; see phase evidence |
| Draft and publish | UNVERIFIED — acceptance pending; see phase evidence |
| Article editing | UNVERIFIED — acceptance pending; see phase evidence |
| Article deletion | VERIFIED LOCAL — targeted mocks/parsers; live operation unverified |
| Cover images | UNVERIFIED — acceptance pending; see phase evidence |
| Categories | UNVERIFIED — acceptance pending; see phase evidence |
| Published article pages | UNVERIFIED — acceptance pending; see phase evidence |
| Article SEO metadata | UNVERIFIED — acceptance pending; see phase evidence |
| Clean crawlable article URLs | UNVERIFIED — acceptance pending; see phase evidence |
| Canonical URLs | UNVERIFIED — acceptance pending; see phase evidence |
| Sitemap integration | UNVERIFIED — acceptance pending; see phase evidence |
| Sanitized content | UNVERIFIED — acceptance pending; see phase evidence |
| Help | UNVERIFIED — acceptance pending; see phase evidence |
| Terms | UNVERIFIED — acceptance pending; see phase evidence |
| Privacy | UNVERIFIED — acceptance pending; see phase evidence |
| Marketplace rules | UNVERIFIED — acceptance pending; see phase evidence |
| Refund policy | UNVERIFIED — acceptance pending; see phase evidence |
| Contact | UNVERIFIED — acceptance pending; see phase evidence |
| Videos | UNVERIFIED — acceptance pending; see phase evidence |
| User account | UNVERIFIED — acceptance pending; see phase evidence |
| Seller profile | UNVERIFIED — acceptance pending; see phase evidence |
| Order history | UNVERIFIED — acceptance pending; see phase evidence |
| Admin pages | UNVERIFIED — acceptance pending; see phase evidence |
| 404 | UNVERIFIED — acceptance pending; see phase evidence |
| robots.txt | UNVERIFIED — acceptance pending; see phase evidence |
| sitemap.xml | UNVERIFIED — acceptance pending; see phase evidence |
| Canonical URLs | UNVERIFIED — acceptance pending; see phase evidence |
| Meta descriptions | UNVERIFIED — acceptance pending; see phase evidence |
| Open Graph tags | UNVERIFIED — acceptance pending; see phase evidence |
| Structured data | UNVERIFIED — acceptance pending; see phase evidence |
| Crawlable product/blog pages | UNVERIFIED — acceptance pending; see phase evidence |
| Broken links | UNVERIFIED — acceptance pending; see phase evidence |
| Redirect behavior | UNVERIFIED — acceptance pending; see phase evidence |
| Staging noindex | UNVERIFIED — acceptance pending; see phase evidence |

## PHASE 6 — COMPLETE WEBSITE AUDIT AND REGRESSION TESTING

| Requirement | Status |
|---|---|
| Broken buttons | UNVERIFIED — acceptance pending; see phase evidence |
| Broken links | UNVERIFIED — acceptance pending; see phase evidence |
| Failed API calls | UNVERIFIED — acceptance pending; see phase evidence |
| Auth loops | UNVERIFIED — acceptance pending; see phase evidence |
| Session expiration issues | UNVERIFIED — acceptance pending; see phase evidence |
| Missing marketplace items | UNVERIFIED — acceptance pending; see phase evidence |
| Broken admin actions | UNVERIFIED — acceptance pending; see phase evidence |
| Incorrect payment status | UNVERIFIED — acceptance pending; see phase evidence |
| Duplicate orders | UNVERIFIED — acceptance pending; see phase evidence |
| Duplicate TXIDs | UNVERIFIED — acceptance pending; see phase evidence |
| Duplicate notifications | UNVERIFIED — acceptance pending; see phase evidence |
| Inventory race conditions | UNVERIFIED — acceptance pending; see phase evidence |
| Chat realtime failures | UNVERIFIED — acceptance pending; see phase evidence |
| Unsafe file uploads | UNVERIFIED — acceptance pending; see phase evidence |
| Missing database permissions | UNVERIFIED — acceptance pending; see phase evidence |
| Privacy leaks | UNVERIFIED — acceptance pending; see phase evidence |
| Unauthorized access | UNVERIFIED — acceptance pending; see phase evidence |
| XSS and injection risks | UNVERIFIED — acceptance pending; see phase evidence |
| CSRF where applicable | UNVERIFIED — acceptance pending; see phase evidence |
| Broken mobile layouts | UNVERIFIED — acceptance pending; see phase evidence |
| RTL errors | UNVERIFIED — acceptance pending; see phase evidence |
| Accessibility problems | UNVERIFIED — acceptance pending; see phase evidence |
| Browser console errors | UNVERIFIED — acceptance pending; see phase evidence |
| Unexpected uncaught exceptions | UNVERIFIED — acceptance pending; see phase evidence |
| Loading-state bugs | UNVERIFIED — acceptance pending; see phase evidence |
| Broken images | UNVERIFIED — acceptance pending; see phase evidence |
| Performance bottlenecks | UNVERIFIED — acceptance pending; see phase evidence |

## Residual implementation work

- Complete every UNVERIFIED row; this run does not meet the entire six-phase acceptance criteria.
- Verify authorized hosted sender/domain, Resend secrets/webhooks, scheduler and VAPID configuration after rollout; delivery infrastructure passes isolated tests and remains disabled. Integrate Auth templates/hooks separately.
- Verify canonical support migration and owner/staff workflows on authorized hosted staging; isolated preservation, history/replies/status/assignment tests pass.
- Wire static journal publication into CMS and deployment; implement product prerendering and complete sitemap.
- Apply/review the additive marketplace browse migration in an authorized staging rollout; verify the implemented seller/profile/edit and binary Storage workflows on authorized hosted staging. Paginated search/price filters pass local DB/browser tests.
- Review/apply the session/admin authorization migration in an authorized staging rollout; complete user/seller management and operational logs.
- Run isolated real staging signup/confirmation/recovery/OAuth/chat/storage and full buyer/seller/admin workflows.

## Requested end-to-end acceptance matrix

| Workflow | Status |
|---|---|
| 1. Visitor browses store | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 2. Customer registers | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 3. Email confirmation | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 4. Login and Remember Me | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 5. Password recovery | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 6. Google OAuth | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 7. Seller creates listing | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 8. Admin approves listing | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 9. Buyer searches and opens listing | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 10. Buyer messages seller | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 11. Buyer submits purchase request | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 12. Checkout creates an invoice | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 13. Payment claim submitted | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 14. Verified simulated transaction | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 15. Seller notification | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 16. Stock transition | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 17. Order fulfillment | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 18. Cancellation | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 19. Dispute | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 20. Support ticket | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 21. Admin moderation | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 22. Pro seller permissions | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 23. Cross-account security tests | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |
| 24. Logout and session cleanup | Real isolated-role E2E pending; local mocks/DB coverage is recorded separately |

## Supabase integration continuation

Full staging public-schema/ACL/Storage-policy snapshot restored with synthetic historical orders. Phase 1 and browse compatibility pass locally; authorization fixes and 18 embedded full-schema scenarios and 20 real local Supabase scenarios cover buyer/seller/admin isolation, quota concurrency, Pro expiry, moderation, chat, inventory/checkout and revocation. Hosted migrations/functions remain unchanged; see TRISOCMD_SUPABASE_VERIFICATION.md.

Marketplace/admin continuation: additive workflow migration, 241-row cross-seller queue and own history, actual local PNG authorization/type/size tests, canonical cancellation retries, 4% commission, Pro expiry, chat read watermark/send dedup and mobile RTL are covered. See TRISOCMD_MARKETPLACE_VERIFICATION.md. No hosted migrations or payment activation occurred.

Communications continuation: VERIFIED LOCAL — event/recipient/channel deduplication, server unread watermarks/preferences, foreground permission controls, generic Web Push architecture, fenced/retry-safe email leases, signed delivery events and redacted admin logs. Existing support model now covers ticket/reply retries, private history, staff assignment/status and order-linked disputes. 17 native local scenarios use real Auth/JWT/REST and intercepted Resend. Live delivery/hosted realtime remain BLOCKED / UNVERIFIED; see TRISOCMD_COMMUNICATIONS_VERIFICATION.md.
