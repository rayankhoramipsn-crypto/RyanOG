# TRISOCMD master checklist

Updated 2026-11-10 (Asia/Tehran). **INCOMPLETE; not release-ready.**

Baseline: PR #36 at 3eea77c; all four commits including hosted marketplace status compatibility are preserved.
VERIFIED LOCAL means local fixtures/mocks only. PARTIAL means implementation exists with gaps. UNVERIFIED means acceptance pending; not necessarily absent. BLOCKED means external configuration or permissions required.

| Phase | Status and evidence |
|---|---|
| 1 | PARTIAL: PR #36 retained; 24 provider tests, 25 native PostgreSQL scenarios. Real provider/Auth topology unresolved. |
| 2 | PARTIAL: admin pagination/gallery batching fixed; mocked cross-seller listing #151 visible. Real role/upload/quota E2E pending. |
| 3 | PARTIAL: 8 session tests; refresh coordinator, offline retention and server logout requests. Real OAuth/chat/admin acceptance pending. |
| 4 | PARTIAL: 4 email tests; templates and disabled delivery core. Durable outbox adapter/Resend transport and support completion pending. |
| 5 | PARTIAL: media parsing, blog deletion/RTL/metadata fixed; 4 static article tests. CMS publication wiring and production SEO gate pending. |
| 6 | PARTIAL: 40 Node tests, 25 DB scenarios, 56 Python tests, three Chromium suites. Firefox blocked; exhaustive real-role/device/security/performance audit unfinished. |


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
| Seller listing creation | UNVERIFIED — acceptance pending; see phase evidence |
| Mandatory image upload from local gallery | UNVERIFIED — acceptance pending; see phase evidence |
| Secure Supabase Storage | UNVERIFIED — acceptance pending; see phase evidence |
| Multiple listing photos where supported | UNVERIFIED — acceptance pending; see phase evidence |
| Title, price, description and category fields | UNVERIFIED — acceptance pending; see phase evidence |
| Listing editing and deletion | UNVERIFIED — acceptance pending; see phase evidence |
| Listing previews | UNVERIFIED — acceptance pending; see phase evidence |
| Listing approval queue | UNVERIFIED — acceptance pending; see phase evidence |
| Admin approve/decline/remove actions | UNVERIFIED — acceptance pending; see phase evidence |
| Moderation notes | UNVERIFIED — acceptance pending; see phase evidence |
| Seller ownership checks | UNVERIFIED — acceptance pending; see phase evidence |
| Three free listings per day | UNVERIFIED — acceptance pending; see phase evidence |
| Seller Pro privileges and unlimited listings | UNVERIFIED — acceptance pending; see phase evidence |
| Four percent commission records | UNVERIFIED — acceptance pending; see phase evidence |
| Pro seller prioritization | UNVERIFIED — acceptance pending; see phase evidence |
| Listing search | UNVERIFIED — acceptance pending; see phase evidence |
| Category and price filters | UNVERIFIED — acceptance pending; see phase evidence |
| Sorting | UNVERIFIED — acceptance pending; see phase evidence |
| New arrivals | UNVERIFIED — acceptance pending; see phase evidence |
| Featured items | UNVERIFIED — acceptance pending; see phase evidence |
| Seller profiles | UNVERIFIED — acceptance pending; see phase evidence |
| Listing status synchronization | UNVERIFIED — acceptance pending; see phase evidence |
| Sold-out inventory protection | UNVERIFIED — acceptance pending; see phase evidence |
| Responsive product cards | UNVERIFIED — acceptance pending; see phase evidence |
| Loading, empty and error states | UNVERIFIED — acceptance pending; see phase evidence |

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
| In-site notifications | UNVERIFIED — acceptance pending; see phase evidence |
| Browser foreground notifications | UNVERIFIED — acceptance pending; see phase evidence |
| Optional background Web Push with a genuine configured delivery service | BLOCKED / UNVERIFIED — service configuration and E2E required |
| Notification permission controls | UNVERIFIED — acceptance pending; see phase evidence |
| Notification preferences | UNVERIFIED — acceptance pending; see phase evidence |
| Duplicate-event prevention | UNVERIFIED — acceptance pending; see phase evidence |
| Seller order notifications | UNVERIFIED — acceptance pending; see phase evidence |
| Buyer payment notifications | UNVERIFIED — acceptance pending; see phase evidence |
| New-message alerts | UNVERIFIED — acceptance pending; see phase evidence |
| Listing moderation notifications | UNVERIFIED — acceptance pending; see phase evidence |
| Order cancellation and dispute updates | UNVERIFIED — acceptance pending; see phase evidence |
| Registration confirmation | BLOCKED / UNVERIFIED — service configuration and E2E required |
| Password reset | UNVERIFIED — acceptance pending; see phase evidence |
| Order confirmation | UNVERIFIED — acceptance pending; see phase evidence |
| Payment status | UNVERIFIED — acceptance pending; see phase evidence |
| Seller purchase notices | UNVERIFIED — acceptance pending; see phase evidence |
| Listing approval/decline | UNVERIFIED — acceptance pending; see phase evidence |
| Support replies | UNVERIFIED — acceptance pending; see phase evidence |
| Customer contact form | UNVERIFIED — acceptance pending; see phase evidence |
| Support tickets | UNVERIFIED — acceptance pending; see phase evidence |
| Ticket history | UNVERIFIED — acceptance pending; see phase evidence |
| Admin replies | UNVERIFIED — acceptance pending; see phase evidence |
| Ticket statuses | UNVERIFIED — acceptance pending; see phase evidence |
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
- Implement durable email leasing, Resend transport, retries and event wiring. Integrate Auth templates/hooks separately.
- Reconcile support_tickets with tc42_support_threads/messages; finish history/replies/status tests.
- Wire static journal publication into CMS and deployment; implement product prerendering and complete sitemap.
- Complete marketplace pagination beyond market_browse limit 100, price filters, seller/profile/edit workflows and live cross-account upload tests.
- Complete legacy current-admin freshness, user/seller management and operational logs.
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
