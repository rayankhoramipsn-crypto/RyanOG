# TRISOCMD — COMPLETE WEBSITE DEVELOPMENT & FINAL DELIVERY

## YOUR ROLE AND OBJECTIVE

You are the lead full-stack developer, database engineer, security auditor, UI/UX engineer, QA tester, and release engineer for TRISOCMD.

**Your mission is to finish the ENTIRE existing website across all six phases, repair all discovered defects, test every critical workflow, and deliver reviewable code without repeatedly interrupting me.**

Repository: `rayankhoramipsn-crypto/RyanOG`

Production: `https://trisocmd.shop`

Existing checkout PR: `#36`

Technology:
- HTML, CSS, JavaScript
- GitHub Pages and Cloudflare
- Supabase PostgreSQL, Auth, Storage, RLS and Edge Functions
- Resend email infrastructure
- Intended LTC/BTC and authorized alternative payment methods

**THIS IS AN EXISTING WEBSITE. DO NOT REBUILD IT FROM SCRATCH.**

Keep the premium black/purple gaming design, existing functionality, user data, products, listings, conversations, accounts, and orders.

Review and preserve PR #36, including the Phase 1 migration compatibility changes. Do not duplicate its work.

## EXECUTION MODE — MAXIMUM SAFE AUTONOMY

I will be away from the computer. Complete all feasible work independently within the permissions already granted.

- Do not ask routine questions.
- Do not stop after writing a plan.
- Do not pause after completing one phase.
- Do not repeatedly ask for access to services.
- Make reasonable engineering decisions based on the repository and existing requirements.
- Use existing authorized integrations.
- Perform routine edits, tests, refactoring, commits and permitted feature-branch updates independently.
- If blocked on one feature, document it and immediately continue with another.
- Do not request secrets or credentials in chat.
- Do not bypass platform permissions or security restrictions.
- Do not deploy to production, merge into main, enable live payments, spend money or make irreversible database changes without the required approval.
- Create reviewable PRs and preserve every completed change.
- If execution limits are reached, record all progress in the repository so another execution can resume.
- Do not claim background execution beyond the actual Codex task lifetime.

**Do not interrupt me for routine engineering decisions. Collect unavoidable approval requests into one final report.**

---

# PHASE 1 — COMPLETE PAYMENT, CHECKOUT AND ORDER MANAGEMENT

Continue and finish PR #36.

### Cryptocurrency checkout

Complete:

- Server-generated BTC/LTC invoices
- Immutable server-authoritative pricing
- Exchange-rate conversion
- Invoice expiration
- Unique invoice identifiers
- Secure TXID submission
- Global TXID uniqueness across accounts and orders
- Independent blockchain payment verification
- Correct address, network and amount validation
- Sufficient confirmation checks
- Idempotent transaction processing
- Duplicate webhook protection
- Payment audit logging
- Expired/partial/late payments
- Safe retries and cancellations
- Payment failure and support flows

A customer-provided TXID is a claim, not proof of payment.

Do not mark orders Paid or listings Sold without independently verified receipt.

If a real payment provider is not authorized or configured, implement the provider integration interface, test with mocks/sandboxes, document requirements and keep live payments disabled.

### PayPal and manual methods

Complete the authorized architecture for PayPal Orders API, verified captures, webhook validation, and cancellation/refund handling.

Preserve manual payment methods and admin review.

Do not bypass merchant verification or eligibility requirements.

Do not enable unsupported financial operations.

### Orders

Complete:

- Buyer/seller/admin order views
- Pending, submitted, confirmed, fulfilled, cancelled and disputed statuses
- Inventory reservation
- Atomic stock updates
- Duplicate-purchase protection
- Accurate Sold status
- Order history
- Fulfillment workflow
- Dispute management
- Transactional notifications

Preserve a three-day escrow requirement in specifications, but do not claim actual custody, payouts or fund release until a legitimate and fully configured service exists.

### Database

Audit existing Supabase projects, Auth topology, migrations, grants, RLS and permissions.

Fix Phase 1 compatibility against a disposable database copy.

Preserve all historical data.

Test before proposing rollout.

---

# PHASE 2 — COMPLETE MARKETPLACE

Implement or repair:

- Seller listing creation
- Mandatory image upload from local gallery
- Secure Supabase Storage
- Multiple listing photos where supported
- Title, price, description and category fields
- Listing editing and deletion
- Listing previews
- Listing approval queue
- Admin approve/decline/remove actions
- Moderation notes
- Seller ownership checks
- Three free listings per day
- Seller Pro privileges and unlimited listings
- Four percent commission records
- Pro seller prioritization
- Listing search
- Category and price filters
- Sorting
- New arrivals
- Featured items
- Seller profiles
- Listing status synchronization
- Sold-out inventory protection
- Responsive product cards
- Loading, empty and error states

**Specifically fix the reported issue where listings from another account fail to appear in the admin approval queue.**

Backend must enforce authorization and listing limits.

Do not activate paid Pro membership without an authorized payment service.

---

# PHASE 3 — AUTHENTICATION, CHAT AND ADMIN

### Authentication

Fully test and repair:

- Email registration and confirmation
- Password login
- Google OAuth
- Password recovery
- Remember Me
- Persistent sessions
- Refresh-token handling
- Logout
- Expired sessions
- Account permissions

**Fix the known Remember Me login-loop issue.**

### Live chat

Complete:

- Buyer/seller conversations
- Real-time message delivery
- Message history
- Inbox
- Unread counters
- Chat notifications
- Mobile layout
- Reconnect and subscription cleanup
- Conversation authorization
- Admin oversight where legitimately permitted

### Admin panel

Complete admin management for:

- Product listings
- Marketplace moderation
- Users and sellers
- Orders
- Payment claims
- Support tickets
- Disputes
- Chats
- Seller Pro entitlements
- Product media
- Blog content
- Operational logs

All sensitive actions require backend authorization, not client-only role checks.

---

# PHASE 4 — NOTIFICATIONS, EMAIL AND SUPPORT

Complete:

- In-site notifications
- Browser foreground notifications
- Optional background Web Push with a genuine configured delivery service
- Notification permission controls
- Notification preferences
- Duplicate-event prevention
- Seller order notifications
- Buyer payment notifications
- New-message alerts
- Listing moderation notifications
- Order cancellation and dispute updates

### Resend and emails

Complete the existing email infrastructure for:

- Registration confirmation
- Password reset
- Order confirmation
- Payment status
- Seller purchase notices
- Listing approval/decline
- Support replies

Preserve the professional TRISOCMD dark email design.

Use `support@trisocmd.shop` only after verifying sender-domain configuration.

Keep optional email notifications opt-in where appropriate.

If sender credentials are unavailable, finish templates and outbox processing architecture, but do not claim emails are delivered.

### Support

Complete:

- Customer contact form
- Support tickets
- Ticket history
- Admin replies
- Ticket statuses
- Help Center
- FAQ
- Dispute and refund information

---

# PHASE 5 — STOREFRONT, CONTENT, DESIGN AND SEO

Preserve the existing luxury gaming appearance.

Visual direction:
- Near-black backgrounds
- Purple accents
- Premium typography
- Modern gaming imagery
- Professional and clean
- Not generic or overly cyberpunk
- Consistent components
- Mobile-first responsive behavior

Complete and test:

- Main navigation
- Hero
- Fortnite categories
- Gaming gear categories
- Digital products
- Featured items
- Best sellers
- New arrivals
- Product cards
- Product search
- Product detail pages
- Photo galleries
- Specifications
- Approved YouTube reviews
- Category filters
- Reviews where supported
- Newsletter functionality where configured
- Footer
- Contact links
- Storefront checkout entry points

### Blog CMS

Complete:

- Admin article creation
- Draft and publish
- Article editing
- Article deletion
- Cover images
- Categories
- Published article pages
- Article SEO metadata
- Clean crawlable article URLs
- Canonical URLs
- Sitemap integration
- Sanitized content

### Additional pages

Complete and test:

- Help
- Terms
- Privacy
- Marketplace rules
- Refund policy
- Contact
- Videos
- User account
- Seller profile
- Order history
- Admin pages
- 404

Do not invent legal guarantees or claim unsupported financial protections.

### Languages

Preserve all existing supported locale options.

Test translations, formatting, and Persian/Arabic RTL.

### SEO

Verify and repair:

- robots.txt
- sitemap.xml
- Canonical URLs
- Meta descriptions
- Open Graph tags
- Structured data
- Crawlable product/blog pages
- Broken links
- Redirect behavior
- Staging noindex

---

# PHASE 6 — COMPLETE WEBSITE AUDIT AND REGRESSION TESTING

Perform a comprehensive audit of the ENTIRE repository and all website routes.

Do not limit testing to the previous five phases.

### Find and fix:

- Broken buttons
- Broken links
- Failed API calls
- Auth loops
- Session expiration issues
- Missing marketplace items
- Broken admin actions
- Incorrect payment status
- Duplicate orders
- Duplicate TXIDs
- Duplicate notifications
- Inventory race conditions
- Chat realtime failures
- Unsafe file uploads
- Missing database permissions
- Privacy leaks
- Unauthorized access
- XSS and injection risks
- CSRF where applicable
- Broken mobile layouts
- RTL errors
- Accessibility problems
- Browser console errors
- Unexpected uncaught exceptions
- Loading-state bugs
- Broken images
- Performance bottlenecks

### End-to-end testing

Test complete buyer, seller and admin workflows using isolated accounts and safe simulated payments.

Include:

1. Visitor browses store
2. Customer registers
3. Email confirmation
4. Login and Remember Me
5. Password recovery
6. Google OAuth
7. Seller creates listing
8. Admin approves listing
9. Buyer searches and opens listing
10. Buyer messages seller
11. Buyer submits purchase request
12. Checkout creates an invoice
13. Payment claim submitted
14. Verified simulated transaction
15. Seller notification
16. Stock transition
17. Order fulfillment
18. Cancellation
19. Dispute
20. Support ticket
21. Admin moderation
22. Pro seller permissions
23. Cross-account security tests
24. Logout and session cleanup

Use browser automation, PostgreSQL tests, and provider mocks/sandboxes.

Never use real customer funds in automated tests.

### Device compatibility

Test desktop, tablet, narrow mobile screens, Chrome, Firefox, LTR and RTL layouts.

### Performance and security

Optimize assets, database queries, loading, caching and layout stability.

Audit RLS, RPC privileges, Edge Functions, SECURITY DEFINER functions, storage permissions, session authorization, transaction verification and secret handling.

Re-run all regression tests after fixes.

---

# MASTER DELIVERABLES

Maintain these files:

`docs/TRISOCMD_MASTER_CHECKLIST.md`

Track every feature and its implementation/test status.

`docs/TRISOCMD_BUG_AUDIT.md`

Track discovered defects, fixes, verification and remaining issues.

`docs/TRISOCMD_RELEASE_READINESS.md`

Track release blockers, tests, risks, deployment readiness and rollback procedures.

`docs/TRISOCMD_EXTERNAL_DEPENDENCIES.md`

Track missing provider credentials, external integrations, permissions and required operator actions.

Deliver:

- All feasible completed features
- Source code
- Database migrations
- Edge Functions
- Automated tests
- Browser regression tests
- Security audit notes
- Pull Requests
- Release instructions
- Rollback procedures
- Final completion report

---

# MANDATORY AUTONOMOUS WORKFLOW

1. Inspect the repository and previous PRs.
2. Establish the current baseline.
3. Create a comprehensive implementation checklist.
4. Fix existing defects.
5. Implement Phase 1.
6. Run tests and fix failures.
7. Continue directly to Phase 2.
8. Continue through Phases 3–6 without waiting for routine confirmation.
9. Run full-site regression tests.
10. Produce reviewable PRs and final documentation.

Never unnecessarily restart already completed work.

Commit progress regularly.

If blocked by an unavailable service, missing credential, or permission requirement:

- Record the blocker.
- Keep the blocked functionality safely disabled.
- Continue with independently achievable work.
- Do not repeatedly interrupt me.
- Include all necessary approvals in the final report.

**Use existing authorized GitHub and Supabase connections.**

No bypassing security boundaries, no unauthorized live deployments, no destructive production changes, no real-money tests without authorization.

If task execution stops due to platform limits, write a precise handoff file for the next run. Do not claim to continue after execution has stopped.

## FINAL ACCEPTANCE CRITERIA

Do not claim completion until:

- All feasible requested features are implemented.
- Critical workflows have been tested.
- Known critical defects are resolved.
- Existing data and features are preserved.
- Backend permissions are verified.
- Browser tests pass.
- Responsive and RTL layouts are checked.
- The checkout is safe.
- All unavailable live financial services remain disabled.
- External blockers are clearly reported.
- Source changes are committed and reviewable.

A successful mock test does not prove real payment processing or production readiness.

## FINAL INSTRUCTION

I am stepping away from my computer.

Do not repeatedly ask for instructions.

Work independently within existing permissions.

Make decisions, implement code, fix bugs, run tests, document changes, and continue through all six phases.

Collect unavoidable approval requests into one final report.

**COMPLETE THE ENTIRE FEASIBLE TRISOCMD DEVELOPMENT SCOPE — NOT JUST ONE SMALL TASK.**