-- TRISOCMD V35. Secure transaction-reference claims; NEVER infer received funds.
-- Review evidence is not an invoice, a payment, an escrow receipt or a sale.
CREATE TABLE IF NOT EXISTS public.market_txid_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL REFERENCES public.market_purchase_requests(id) ON DELETE RESTRICT,
 buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 network text NOT NULL CHECK (network IN ('LTC','BTC')),
 txid text NOT NULL CHECK (txid ~ '^[0-9a-f]{64}$'),
 status text NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified','invalid')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT market_txid_globally_unique UNIQUE(txid),
 CONSTRAINT market_txid_one_claim_per_request UNIQUE(request_id)
);
CREATE INDEX IF NOT EXISTS market_txid_claims_buyer_idx ON public.market_txid_claims(buyer_id,created_at DESC);
ALTER TABLE public.market_txid_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS market_txid_claims_view ON public.market_txid_claims;
CREATE POLICY market_txid_claims_view ON public.market_txid_claims FOR SELECT TO authenticated
 USING(buyer_id=(SELECT auth.uid()) OR (SELECT public.is_admin()));
REVOKE ALL ON TABLE public.market_txid_claims FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.market_txid_claims TO authenticated;

CREATE OR REPLACE FUNCTION public.market_submit_txid(p_request uuid,p_txid text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_buyer uuid:=auth.uid();v_status text;v_method text;v_id uuid;v_clean text;
BEGIN
 IF v_buyer IS NULL THEN RAISE EXCEPTION 'Sign in required' USING errcode='28000'; END IF;
 v_clean:=lower(trim(coalesce(p_txid,'')));
 IF v_clean !~ '^[0-9a-f]{64}$' THEN
  RAISE EXCEPTION 'A 64-character hexadecimal transaction ID is required' USING errcode='22023';
 END IF;
 SELECT status,payment_method INTO v_status,v_method
 FROM public.market_purchase_requests WHERE id=p_request AND buyer_id=v_buyer FOR UPDATE;
 IF v_status IS NULL THEN RAISE EXCEPTION 'Purchase request unavailable' USING errcode='42501'; END IF;
 IF v_method NOT IN ('BTC','LTC') THEN
  RAISE EXCEPTION 'Transaction IDs can only be submitted for BTC or LTC review requests' USING errcode='22023';
 END IF;
 IF v_status NOT IN ('requested','awaiting_payment_setup','disputed') THEN
  RAISE EXCEPTION 'This request is not accepting transaction references' USING errcode='23514';
 END IF;
 IF EXISTS (SELECT 1 FROM public.market_txid_claims WHERE request_id=p_request) THEN
  RAISE EXCEPTION 'A transaction reference was already submitted for this request' USING errcode='23505';
 END IF;
 BEGIN
  INSERT INTO public.market_txid_claims(request_id,buyer_id,network,txid)
  VALUES (p_request,v_buyer,v_method,v_clean) RETURNING id INTO v_id;
 EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'This transaction reference is already registered on another request or has been submitted before' USING errcode='23505';
 END;
 -- No purchase status update; no listing mutation; no verification or payout.
 INSERT INTO public.market_notifications(recipient_id,kind,title,request_id)
 VALUES (v_buyer,'purchase_updated','Transaction ID received for review — NOT payment verification',p_request);
 INSERT INTO public.market_notifications(for_admin,kind,title,request_id)
 VALUES (true,'purchase_updated','Unverified transaction ID submitted for review',p_request);
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.market_submit_txid(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.market_submit_txid(uuid,text) TO authenticated;

-- Transactional email opt-in preferences; NOT an email-sending service.
CREATE TABLE IF NOT EXISTS public.market_alert_preferences(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 email_enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.market_alert_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS market_alert_preferences_self_select ON public.market_alert_preferences;
DROP POLICY IF EXISTS market_alert_preferences_self_insert ON public.market_alert_preferences;
DROP POLICY IF EXISTS market_alert_preferences_self_update ON public.market_alert_preferences;
CREATE POLICY market_alert_preferences_self_select ON public.market_alert_preferences FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY market_alert_preferences_self_insert ON public.market_alert_preferences FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY market_alert_preferences_self_update ON public.market_alert_preferences FOR UPDATE TO authenticated
 USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
REVOKE ALL ON TABLE public.market_alert_preferences FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.market_alert_preferences TO authenticated;
GRANT INSERT(user_id,email_enabled),UPDATE(email_enabled) ON public.market_alert_preferences TO authenticated;

-- Private, deduplicated email delivery queue. Requires a separately configured
-- trusted transactional email sender. Nothing sends without operator setup.
CREATE TABLE IF NOT EXISTS public.market_email_outbox(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 notification_id bigint NOT NULL REFERENCES public.market_notifications(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','sent','failed')),
 attempts int NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 CONSTRAINT market_outbox_one_per_user UNIQUE(notification_id,user_id)
);
ALTER TABLE public.market_email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.market_email_outbox FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.market_email_outbox_id_seq FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.tc35_queue_opted_in_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF NEW.recipient_id IS NOT NULL THEN
  INSERT INTO public.market_email_outbox(notification_id,user_id)
  SELECT NEW.id,NEW.recipient_id
  WHERE EXISTS(SELECT 1 FROM public.market_alert_preferences
    WHERE user_id=NEW.recipient_id AND email_enabled);
 ELSIF NEW.for_admin THEN
  INSERT INTO public.market_email_outbox(notification_id,user_id)
  SELECT NEW.id,u.id FROM auth.users u
  JOIN public.market_alert_preferences p ON p.user_id=u.id AND p.email_enabled
  WHERE u.raw_app_meta_data->>'role'='admin'
  ON CONFLICT DO NOTHING;
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.tc35_queue_opted_in_email() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS tc35_notification_email ON public.market_notifications;
CREATE TRIGGER tc35_notification_email AFTER INSERT ON public.market_notifications
FOR EACH ROW EXECUTE FUNCTION public.tc35_queue_opted_in_email();
