# TRISOCMD release readiness

**NOT READY. Six-phase scope incomplete.** Updated 2026-11-10 (Asia/Tehran).

Based on PR #36 at 3eea77c, preserving compatibility fixes. This branch adds auth/moderation/media repairs, offline article tooling and disabled email core. No new migration needed for these additions. Phase 1 migration/Edge Functions remain inherited and undeployed.

## Validation

- 40 Node tests (24 payment/provider, 8 session, 4 journal, 4 email).
- 25 native PostgreSQL scenarios using independent connections; inventory races, TXID uniqueness, transitions, idempotency and grants against reconstructed fixture.
- 56 Python regressions.
- Three Chromium suites: route/UI smoke, Phase 1 checkout/orders, completion suite covering 151-row moderation, blog media/deletion/sanitization/RTL at 390/768/1365px and product URL parsing.
- Deno checks pass for inherited Edge Function entrypoints.
- Browser external mutations intercepted; no real payment/Auth/email/RLS claim.
- Firefox blocked by download policy. Exhaustive real-role, accessibility and performance acceptance pending.

Reproduce with npm ci, npm test, npm run check:edge. Serve repository using python3 -m http.server 8765 --bind 127.0.0.1, then run TRISO_CHROMIUM_PATH=/usr/bin/chromium npm run test:browser (omit override if Playwright Chromium installed).

## Offline publishing

Export reviewed published articles to JSON without credentials/private drafts. Run node scripts/render-journal.mjs reviewed-posts.json work/journal-output. Target must not exist, preventing deleted pages surviving rebuild. Generates clean article directories, article-only sitemap and robots. Defaults noindex; --indexable is an explicit later release choice. Not yet wired to CMS/deployment; not a complete storefront sitemap.

## Release and rollback

1. Finish MASTER_CHECKLIST residual implementation and real isolated staging acceptance.
2. Reconstruct complete disposable schema and reconcile identities/legacy constraints without deleting history.
3. Review phase1-setup.md and phase1-retire.sql. Back up before any approved migration.
4. Verify provider/sender/permissions and repeat tests; keep financial switches disabled.
5. Obtain explicit merge/deployment approval. Main pushes publish automatically; do not merge to test.
6. Frontend rollback: revert feature commits through a PR while preserving PR #36 and historical data. These additions need no DB rollback.
7. If Phase 1 is separately rolled out, disable providers and use its data-preserving retirement plan. Do not drop orders/claims/invoices/audit history.

No production-readiness or six-phase-completion claim is made.
