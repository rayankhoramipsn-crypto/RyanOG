-- Version 1 retirement/operational rollback. Preserve all data and audit history.
-- Execute only after reviewing outstanding invoices and stopping provider workers.
BEGIN;
REVOKE EXECUTE ON FUNCTION
 public.phase1_create_order(jsonb,uuid),public.phase1_market_order(uuid),
 public.phase1_submit_claim(uuid,text,text),public.phase1_transition(uuid,text,text),
 public.phase1_review_claim(uuid,boolean,text)
FROM authenticated,service_role,anon,PUBLIC;
REVOKE EXECUTE ON FUNCTION
 public.phase1_issue_invoice(uuid,uuid,text,text,bigint,text,text,timestamptz),
 public.phase1_record_verification(uuid,uuid,text,jsonb),
 public.phase1_expire_invoices(),public.phase1_verification_failed(uuid,uuid,text,text)
FROM service_role,authenticated,anon,PUBLIC;
-- Keep ownership policies, audit tables, duplicate-TXID protections and legacy
-- request guards. Never restore legacy shared-address settlement privileges.
COMMIT;
