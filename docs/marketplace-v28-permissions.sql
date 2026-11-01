-- TRISOCMD V28 / Defense in depth for review-only marketplace requests.
-- The authenticated role may READ requests allowed by existing row-level policies,
-- but it must not directly CREATE, UPDATE, DELETE or TRUNCATE payment-review data.
-- All authorized creation and review actions remain in checked SECURITY DEFINER
-- RPC functions: market_request_purchase and market_admin_update_purchase.
-- Preserve RLS, select access, service_role access and existing rows.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.market_purchase_requests FROM anon, authenticated;
GRANT SELECT ON TABLE public.market_purchase_requests TO authenticated;
