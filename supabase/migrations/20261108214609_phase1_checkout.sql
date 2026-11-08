-- Additive Phase 1. Existing V27/V28/V34/V35 + store-crypto-invoices.sql required.
-- Never apply production-store-checkout.sql to staging: it describes a different auth topology.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.tc42_orders') IS NULL OR to_regclass('public.store_crypto_invoice') IS NULL
 OR to_regclass('public.market_purchase_requests') IS NULL OR to_regclass('public.store_used_txid') IS NULL
 THEN RAISE EXCEPTION 'Missing baseline: see docs/phase1-setup.md'; END IF;
 IF EXISTS(SELECT 1 FROM public.tc42_orders o WHERE NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=o.customer_id)) THEN RAISE EXCEPTION 'Identity project mismatch: reconcile orders and Auth before Phase 1'; END IF;
END $$;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.store_crypto_invoice i JOIN public.market_txid_claims c ON lower(i.txid)=lower(c.txid)) THEN
 RAISE EXCEPTION 'Historic duplicate store/market TXID: reconcile before migration'; END IF;
END $$;
ALTER TABLE public.tc42_orders
 ADD COLUMN seller_id uuid,
 ADD COLUMN listing_id bigint REFERENCES public.market_listings(id),
 ADD COLUMN market_request_id uuid UNIQUE REFERENCES public.market_purchase_requests(id),
 ADD COLUMN commission_usd numeric(12,2) NOT NULL DEFAULT 0 CHECK(commission_usd>=0),
 ADD COLUMN delivery_note text CHECK(char_length(delivery_note)<=2000),
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
-- Extend the known status constraint without rewriting any historic rows.
ALTER TABLE public.tc42_orders DROP CONSTRAINT IF EXISTS tc42_orders_status_check;
ALTER TABLE public.tc42_orders ADD CONSTRAINT tc42_orders_status_check CHECK(status IN
 ('awaiting_payment','payment_submitted','payment_review','paid','fulfillment_pending','fulfilled','cancelled','refunded','disputed'));
ALTER TABLE public.market_listings DROP CONSTRAINT IF EXISTS market_listings_status_check;
ALTER TABLE public.market_listings ADD CONSTRAINT market_listings_status_check CHECK(status IN ('pending','approved','declined','removed','sold'));
CREATE INDEX phase1_seller_orders ON public.tc42_orders(seller_id,created_at DESC);
CREATE INDEX phase1_buyer_orders ON public.tc42_orders(customer_id,created_at DESC);
ALTER TABLE public.store_crypto_invoice
 ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 ADD COLUMN chain text NOT NULL DEFAULT 'mainnet' CHECK(chain='mainnet'),
 ADD COLUMN currency text GENERATED ALWAYS AS (network) STORED,
 ADD COLUMN provider text NOT NULL DEFAULT 'legacy-shared-address',
 ADD COLUMN provider_invoice_id text,
 ADD COLUMN state text NOT NULL DEFAULT 'awaiting_payment' CHECK(state IN
 ('awaiting_payment','submitted','partial','confirming','verified','expired','review','failed','cancelled')),
 ADD COLUMN verification jsonb;
CREATE UNIQUE INDEX phase1_provider_address ON public.store_crypto_invoice(network,address) WHERE provider<>'legacy-shared-address';
CREATE UNIQUE INDEX phase1_provider_invoice ON public.store_crypto_invoice(provider,provider_invoice_id)
 WHERE provider_invoice_id IS NOT NULL;
CREATE TABLE public.store_inventory_reservations(
 order_id uuid NOT NULL REFERENCES public.tc42_orders(id),
 inventory_key text NOT NULL,
 qty int NOT NULL CHECK(qty>0),
 expires_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','committed','released')),
 PRIMARY KEY(order_id,inventory_key)
);
CREATE INDEX phase1_active_reservations ON public.store_inventory_reservations(inventory_key,expires_at) WHERE state='active';
CREATE TABLE public.store_payment_claims(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES public.tc42_orders(id),
 method text NOT NULL CHECK(method IN ('BTC','LTC','BANK','PAYPAL','CASHAPP','CONTACT_SUPPORT')),
 reference text NOT NULL CHECK(char_length(reference) BETWEEN 1 AND 200),
 txid text UNIQUE CHECK(txid ~ '^[0-9a-f]{64}$'),
 state text NOT NULL DEFAULT 'unverified' CHECK(state IN ('unverified','rejected','verified','review')),
 review_note text CHECK(char_length(review_note)<=1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,method,reference)
);
CREATE TABLE public.store_order_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES public.tc42_orders(id),
 event_key text NOT NULL UNIQUE,
 kind text NOT NULL,
 actor uuid,
 detail jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX phase1_order_events ON public.store_order_events(order_id,id);
CREATE TABLE public.store_provider_events(
 provider text NOT NULL,
 event_id text NOT NULL,
 order_id uuid NOT NULL REFERENCES public.tc42_orders(id),
 evidence jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(provider,event_id)
);
CREATE TABLE public.store_checkout_keys(
 buyer_id uuid NOT NULL,
 key uuid NOT NULL,
 cart jsonb NOT NULL,
 order_id uuid NOT NULL REFERENCES public.tc42_orders(id),
 PRIMARY KEY(buyer_id,key)
);
ALTER TABLE public.store_used_txid ADD COLUMN order_id uuid REFERENCES public.tc42_orders(id),
 ADD COLUMN request_id uuid REFERENCES public.market_purchase_requests(id);
INSERT INTO public.store_used_txid(txid) SELECT lower(txid) FROM public.store_crypto_invoice WHERE txid IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO public.store_used_txid(txid) SELECT lower(txid) FROM public.market_txid_claims ON CONFLICT DO NOTHING;
UPDATE public.store_used_txid u SET order_id=i.order_id FROM public.store_crypto_invoice i WHERE i.txid=u.txid;
UPDATE public.store_used_txid u SET request_id=c.request_id FROM public.market_txid_claims c WHERE c.txid=u.txid;
-- Client authorization is the current project's live auth.users role, not editable metadata.
CREATE FUNCTION public.phase1_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid() AND raw_app_meta_data->>'role'='admin')
$$;
REVOKE ALL ON FUNCTION public.phase1_is_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase1_is_admin() TO authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['store_inventory_reservations','store_payment_claims','store_order_events','store_provider_events','store_checkout_keys'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO service_role',t);
 END LOOP;
END $$;
REVOKE UPDATE ON public.store_order_events,public.store_provider_events FROM service_role;
GRANT USAGE,SELECT ON SEQUENCE public.store_order_events_id_seq TO service_role;
REVOKE ALL ON SEQUENCE public.store_order_events_id_seq FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.market_notifications TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.market_notifications_id_seq TO service_role;
GRANT SELECT,UPDATE ON public.products,public.market_listings TO service_role;
GRANT SELECT ON public.tc42_orders,public.store_order_events,public.store_payment_claims,public.store_crypto_invoice TO authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.tc42_orders FROM authenticated,anon;
-- Replace all SELECT policies on canonical orders to avoid permissive stale-role policies.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='tc42_orders' AND cmd='SELECT' LOOP
 EXECUTE format('DROP POLICY %I ON public.tc42_orders',p.policyname); END LOOP;
END $$;
CREATE POLICY phase1_orders_read ON public.tc42_orders FOR SELECT TO authenticated USING
 (customer_id=(SELECT auth.uid()) OR seller_id=(SELECT auth.uid()) OR (SELECT public.phase1_is_admin()));
CREATE POLICY phase1_invoice_read ON public.store_crypto_invoice FOR SELECT TO authenticated USING
 (EXISTS(SELECT 1 FROM public.tc42_orders o WHERE o.id=order_id AND (o.customer_id=(SELECT auth.uid()) OR (SELECT public.phase1_is_admin()))));
CREATE POLICY phase1_claim_read ON public.store_payment_claims FOR SELECT TO authenticated USING
 (EXISTS(SELECT 1 FROM public.tc42_orders o WHERE o.id=order_id AND (o.customer_id=(SELECT auth.uid()) OR (SELECT public.phase1_is_admin()))));
CREATE POLICY phase1_event_read ON public.store_order_events FOR SELECT TO authenticated USING
 ((SELECT public.phase1_is_admin()) OR (actor=(SELECT auth.uid()) AND kind='order_created'));
-- No seller can read another buyer's reference, private evidence or admin audit details.
CREATE OR REPLACE FUNCTION public.store_reserve_txid() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_order uuid; v_request uuid; n int;
BEGIN
 IF NEW.txid IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.txid IS NOT DISTINCT FROM NEW.txid THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='market_txid_claims' THEN v_request:=NEW.request_id; ELSE v_order:=NEW.order_id; END IF;
 INSERT INTO public.store_used_txid(txid,order_id,request_id) VALUES(lower(NEW.txid),v_order,v_request)
 ON CONFLICT(txid) DO UPDATE SET txid=EXCLUDED.txid
 WHERE (v_order IS NOT NULL AND store_used_txid.order_id=v_order)
 OR (v_request IS NOT NULL AND store_used_txid.request_id=v_request);
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n=0 THEN RAISE EXCEPTION 'Transaction reference already registered' USING errcode='23505'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER phase1_claim_txid BEFORE INSERT ON public.store_payment_claims FOR EACH ROW EXECUTE FUNCTION public.store_reserve_txid();
-- Legacy invoice/settlement entry points cannot be used by the deployed function.
REVOKE EXECUTE ON FUNCTION public.store_issue_crypto(uuid,uuid,text,text,numeric),public.store_settle_crypto(uuid,uuid,text) FROM service_role;
CREATE FUNCTION public.phase1_create_order(p_items jsonb,p_key uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); k public.store_checkout_keys; o uuid;
BEGIN
 IF u IS NULL OR p_key IS NULL THEN RAISE EXCEPTION 'Sign in and retry key required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(u::text),hashtext(p_key::text));
 SELECT * INTO k FROM public.store_checkout_keys WHERE buyer_id=u AND key=p_key;
 IF FOUND THEN IF k.cart<>p_items THEN RAISE EXCEPTION 'Retry key already used for different cart'; END IF; RETURN k.order_id; END IF;
 o:=public.tc42_create_order(p_items);
 INSERT INTO public.store_checkout_keys VALUES(u,p_key,p_items,o);
 RETURN o;
END $$;
CREATE FUNCTION public.phase1_market_order(p_request uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.market_purchase_requests; o uuid; u uuid:=auth.uid();
BEGIN
 SELECT * INTO STRICT r FROM public.market_purchase_requests WHERE id=p_request AND buyer_id=u FOR UPDATE;
 SELECT id INTO o FROM public.tc42_orders WHERE market_request_id=p_request;
 IF FOUND THEN RETURN o; END IF;
 IF r.status NOT IN ('requested','awaiting_payment_setup') THEN RAISE EXCEPTION 'Request unavailable'; END IF;
 PERFORM 1 FROM public.market_listings WHERE id=r.listing_id AND status='approved' AND seller_id=r.seller_id FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Listing unavailable'; END IF;
 INSERT INTO public.tc42_orders(customer_id,seller_id,listing_id,market_request_id,total_amount,commission_usd,items)
 VALUES(u,r.seller_id,r.listing_id,r.id,r.price_usd,round(r.price_usd*0.04,2),jsonb_build_array(jsonb_build_object('listing_id',r.listing_id,'title',r.listing_title,'qty',1,'unit_price',r.price_usd))) RETURNING id INTO o;
 RETURN o;
END $$;
-- Triggered only by trusted server writes; one event and notification per actual transition.
CREATE FUNCTION public.phase1_order_notice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE label text; event text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.status=OLD.status THEN RETURN NULL; END IF;
 label:=CASE WHEN TG_OP='INSERT' THEN 'Purchase request created' ELSE 'Order status: '||NEW.status END;
 event:=NEW.id::text||':'||CASE WHEN TG_OP='INSERT' THEN 'created' ELSE NEW.status||':'||NEW.updated_at::text END;
 INSERT INTO public.store_order_events(order_id,event_key,kind,actor,detail)
 VALUES(NEW.id,event,CASE WHEN TG_OP='INSERT' THEN 'order_created' ELSE 'status_changed' END,auth.uid(),jsonb_build_object('status',NEW.status));
 -- Notifications can only target accounts in this same auth project.
 INSERT INTO public.market_notifications(recipient_id,kind,title,request_id)
 SELECT id,'purchase_updated',label,NEW.market_request_id FROM auth.users WHERE id=NEW.customer_id;
 IF NEW.seller_id IS NOT NULL THEN
 INSERT INTO public.market_notifications(recipient_id,kind,title,request_id)
 SELECT id,'purchase_updated',label,NEW.market_request_id FROM auth.users WHERE id=NEW.seller_id;
 END IF;
 INSERT INTO public.market_notifications(for_admin,kind,title,request_id) VALUES(true,'purchase_updated',label,NEW.market_request_id);
 RETURN NULL;
END $$;
CREATE TRIGGER phase1_order_notice AFTER INSERT OR UPDATE OF status ON public.tc42_orders FOR EACH ROW EXECUTE FUNCTION public.phase1_order_notice();
CREATE FUNCTION public.phase1_submit_claim(p_order uuid,p_method text,p_reference text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.tc42_orders; i public.store_crypto_invoice; c public.store_payment_claims; ref text:=trim(p_reference); coin text:=upper(p_method);
BEGIN
 SELECT * INTO STRICT o FROM public.tc42_orders WHERE id=p_order AND customer_id=auth.uid() FOR UPDATE;
 IF coin IN ('BTC','LTC') THEN
 ref:=lower(ref);
 IF ref !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid TXID'; END IF;
 SELECT * INTO STRICT i FROM public.store_crypto_invoice WHERE order_id=p_order;
 IF i.network<>coin THEN RAISE EXCEPTION 'Wrong payment network'; END IF;
 END IF;
 SELECT * INTO c FROM public.store_payment_claims WHERE order_id=p_order AND method=coin AND reference=ref;
 IF FOUND THEN RETURN c.id; END IF;
 IF o.status NOT IN ('awaiting_payment','payment_submitted','payment_review') THEN RAISE EXCEPTION 'Order not accepting claims'; END IF;
 INSERT INTO public.store_payment_claims(order_id,method,reference,txid)
 VALUES(p_order,coin,ref,CASE WHEN coin IN ('BTC','LTC') THEN ref END) RETURNING * INTO c;
 UPDATE public.tc42_orders SET status='payment_submitted',updated_at=clock_timestamp() WHERE id=p_order;
 INSERT INTO public.store_order_events(order_id,event_key,kind,actor) VALUES(p_order,'claim:'||c.id,'payment_claim',auth.uid());
 RETURN c.id;
END $$;
-- Only a trusted provider adapter can call this. No browser address/rate/amount is accepted.
CREATE FUNCTION public.phase1_issue_invoice(p_user uuid,p_order uuid,p_network text,p_address text,p_units bigint,p_provider text,p_provider_id text,p_expires timestamptz)
RETURNS public.store_crypto_invoice LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o public.tc42_orders; i public.store_crypto_invoice; x record; held bigint; available bigint; inventory text;
BEGIN
 SELECT * INTO STRICT o FROM public.tc42_orders WHERE id=p_order AND customer_id=p_user FOR UPDATE;
 SELECT * INTO i FROM public.store_crypto_invoice WHERE order_id=p_order;
 IF FOUND THEN RETURN i; END IF;
 IF o.status<>'awaiting_payment' OR p_provider='legacy-shared-address' OR p_provider_id IS NULL OR length(p_address)<14
 OR p_expires<=now() OR p_expires>now()+interval '1 hour' THEN RAISE EXCEPTION 'Invalid provider invoice'; END IF;
 FOR x IN SELECT * FROM jsonb_to_recordset(o.items) AS t(id bigint,listing_id bigint,qty int) ORDER BY id NULLS LAST LOOP
 IF o.listing_id IS NOT NULL THEN
 inventory:='listing:'||o.listing_id;
 SELECT CASE WHEN status='approved' THEN 1 ELSE 0 END INTO available FROM public.market_listings WHERE id=o.listing_id FOR NO KEY UPDATE;
 ELSE
 inventory:='product:'||x.id;
 SELECT CASE WHEN status='available' THEN stock ELSE 0 END INTO available FROM public.products WHERE id=x.id FOR NO KEY UPDATE;
 END IF;
 SELECT coalesce(sum(qty),0) INTO held FROM public.store_inventory_reservations WHERE inventory_key=inventory AND state='active' AND expires_at>now();
 IF available IS NULL OR available-held<x.qty THEN RAISE EXCEPTION 'Inventory unavailable'; END IF;
 INSERT INTO public.store_inventory_reservations(order_id,inventory_key,qty,expires_at) VALUES(p_order,inventory,x.qty,p_expires);
 END LOOP;
 INSERT INTO public.store_crypto_invoice(order_id,network,address,units,provider,provider_invoice_id,expires_at)
 VALUES(p_order,p_network,p_address,p_units,p_provider,p_provider_id,p_expires) RETURNING * INTO i;
 RETURN i;
END $$;
-- Immutable provider event IDs serialize duplicate callbacks and bind each to an order.
CREATE FUNCTION public.phase1_record_verification(p_user uuid,p_order uuid,p_event text,p_evidence jsonb)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o public.tc42_orders; i public.store_crypto_invoice; e public.store_provider_events; c public.store_payment_claims; x record; enough boolean:=true; target text; required int;
BEGIN
 SELECT * INTO STRICT o FROM public.tc42_orders WHERE id=p_order AND customer_id=p_user FOR UPDATE;
 SELECT * INTO STRICT i FROM public.store_crypto_invoice WHERE order_id=p_order FOR UPDATE;
 SELECT * INTO e FROM public.store_provider_events WHERE provider=i.provider AND event_id=p_event;
 IF FOUND THEN IF e.order_id<>p_order OR e.evidence<>p_evidence THEN RAISE EXCEPTION 'Event replay mismatch'; END IF; RETURN o.status; END IF;
 IF p_event IS NULL OR length(p_event)>200 OR p_evidence->>'provider_invoice_id' IS DISTINCT FROM i.provider_invoice_id
 OR p_evidence->>'chain' IS DISTINCT FROM i.chain OR p_evidence->>'network' IS DISTINCT FROM i.network OR p_evidence->>'address' IS DISTINCT FROM i.address
 OR p_evidence->>'txid' !~ '^[0-9a-f]{64}$' OR coalesce((p_evidence->>'double_spend')::boolean,true)
 OR coalesce(p_evidence->>'units','') !~ '^[0-9]{1,16}$'
 OR coalesce(p_evidence->>'confirmations','') !~ '^[0-9]{1,8}$'
 OR (p_evidence->>'seen_at')::timestamptz<i.issued_at
 OR (p_evidence->>'seen_at')::timestamptz>i.expires_at THEN RAISE EXCEPTION 'Payment evidence mismatch'; END IF;
 IF p_evidence->>'txid' IS NULL OR p_evidence->>'seen_at' IS NULL THEN RAISE EXCEPTION 'Incomplete payment evidence'; END IF;
 SELECT * INTO c FROM public.store_payment_claims WHERE order_id=p_order AND txid=p_evidence->>'txid' FOR UPDATE;
 IF NOT FOUND THEN
 INSERT INTO public.store_payment_claims(order_id,method,reference,txid)
 VALUES(p_order,i.network,p_evidence->>'txid',p_evidence->>'txid') RETURNING * INTO c;
 END IF;
 INSERT INTO public.store_provider_events VALUES(i.provider,p_event,p_order,p_evidence,now());
 IF i.txid IS NOT NULL THEN
  IF i.txid=c.txid THEN RETURN o.status; END IF;
  RAISE EXCEPTION 'Invoice already settled';
 END IF;
 required:=6;
 IF (p_evidence->>'units')::bigint<i.units THEN
 UPDATE public.store_crypto_invoice SET state='partial',verification=p_evidence WHERE order_id=p_order;
 RETURN 'partial';
 ELSIF (p_evidence->>'confirmations')::int<required THEN
 UPDATE public.store_crypto_invoice SET state='confirming',verification=p_evidence WHERE order_id=p_order;
 RETURN 'pending_confirmations'; END IF;
 -- No stock commitment for a released/expired reservation, cancellation or dispute.
 IF o.status NOT IN ('awaiting_payment','payment_submitted','payment_review') THEN enough:=false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.store_inventory_reservations WHERE order_id=p_order AND state='active' AND expires_at>now()) THEN enough:=false; END IF;
 IF EXISTS(SELECT 1 FROM public.store_inventory_reservations WHERE order_id=p_order AND (state<>'active' OR expires_at<=now())) THEN enough:=false; END IF;
 FOR x IN SELECT * FROM jsonb_to_recordset(o.items) AS t(id bigint,qty int) ORDER BY id LOOP
 IF o.listing_id IS NULL THEN
  PERFORM 1 FROM public.products WHERE id=x.id AND stock>=x.qty AND status='available' FOR NO KEY UPDATE;
 ELSE
  PERFORM 1 FROM public.market_listings WHERE id=o.listing_id AND status='approved' FOR NO KEY UPDATE;
 END IF;
 IF NOT FOUND THEN enough:=false; END IF;
 END LOOP;
 IF enough THEN
 IF o.listing_id IS NULL THEN
 UPDATE public.products p SET stock=p.stock-line.qty FROM jsonb_to_recordset(o.items) AS line(id bigint,qty int) WHERE p.id=line.id;
 ELSE
 UPDATE public.market_listings SET status='sold' WHERE id=o.listing_id;
 END IF;
 UPDATE public.store_inventory_reservations SET state='committed' WHERE order_id=p_order;
 END IF;
 target:=CASE WHEN enough THEN 'paid' ELSE 'payment_review' END;
 UPDATE public.store_crypto_invoice SET txid=c.txid,state=CASE WHEN enough THEN 'verified' ELSE 'review' END,verification=p_evidence WHERE order_id=p_order;
 UPDATE public.store_payment_claims SET state=CASE WHEN enough THEN 'verified' ELSE 'review' END WHERE id=c.id;
 UPDATE public.tc42_orders SET status=CASE WHEN o.status IN ('cancelled','disputed','refunded') THEN o.status ELSE target END,updated_at=clock_timestamp() WHERE id=p_order RETURNING status INTO target;
 INSERT INTO public.store_order_events(order_id,event_key,kind,detail) VALUES(p_order,'verified:'||i.id,'payment_verified',jsonb_build_object('inventory_committed',enough));
 RETURN target;
END $$;
CREATE FUNCTION public.phase1_transition(p_order uuid,p_status text,p_note text DEFAULT NULL) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.tc42_orders; u uuid:=auth.uid(); admin boolean:=public.phase1_is_admin(); allowed boolean:=false;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO STRICT o FROM public.tc42_orders WHERE id=p_order AND (customer_id=u OR seller_id=u OR admin) FOR UPDATE;
 IF char_length(coalesce(p_note,''))>2000 THEN RAISE EXCEPTION 'Note too long'; END IF;
 IF o.status=p_status THEN RETURN o.status; END IF;
 IF p_status='cancelled' AND o.status='awaiting_payment' AND (o.customer_id=u OR admin)
 AND NOT EXISTS(SELECT 1 FROM public.store_payment_claims WHERE order_id=p_order) THEN allowed:=true; END IF;
 IF admin AND p_status='cancelled' AND o.status IN ('awaiting_payment','payment_submitted','payment_review','disputed')
 AND NOT EXISTS(SELECT 1 FROM public.store_payment_claims WHERE order_id=p_order AND state<>'rejected')
 AND NOT EXISTS(SELECT 1 FROM public.store_crypto_invoice WHERE order_id=p_order AND txid IS NOT NULL) THEN allowed:=true; END IF;
 IF p_status='disputed' AND o.status NOT IN ('cancelled','refunded') THEN allowed:=true; END IF;
 IF admin AND o.status='disputed' AND p_status='fulfillment_pending'
 AND EXISTS(SELECT 1 FROM public.store_crypto_invoice WHERE order_id=p_order AND state='verified' AND txid IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM public.store_inventory_reservations WHERE order_id=p_order AND state<>'committed')
 AND length(trim(coalesce(p_note,'')))>0 THEN allowed:=true; END IF;
 IF (admin OR o.seller_id=u) AND ((o.status='paid' AND p_status='fulfillment_pending') OR
 (o.status IN ('paid','fulfillment_pending') AND p_status='fulfilled' AND length(trim(coalesce(p_note,'')))>0)) THEN allowed:=true; END IF;
 -- Refunds require an authenticated provider refund integration; never an admin assertion.
 IF NOT allowed THEN RAISE EXCEPTION 'Transition not authorized'; END IF;
 UPDATE public.tc42_orders SET status=p_status,delivery_note=CASE WHEN p_status='fulfilled' THEN p_note ELSE delivery_note END,updated_at=clock_timestamp() WHERE id=p_order;
 INSERT INTO public.store_order_events(order_id,event_key,kind,actor,detail) VALUES(p_order,'transition:'||gen_random_uuid(),'order_transition',u,jsonb_build_object('from',o.status,'to',p_status,'note',p_note));
 IF p_status='cancelled' THEN
 UPDATE public.store_crypto_invoice SET state='cancelled' WHERE order_id=p_order AND txid IS NULL;
 UPDATE public.store_inventory_reservations SET state='released' WHERE order_id=p_order AND state='active'; END IF;
 RETURN p_status;
END $$;
CREATE FUNCTION public.phase1_review_claim(p_claim uuid,p_reject boolean,p_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.store_payment_claims;
BEGIN
 IF NOT public.phase1_is_admin() OR auth.uid() IS NULL THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF length(trim(coalesce(p_note,''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Review note required'; END IF;
 SELECT * INTO STRICT c FROM public.store_payment_claims WHERE id=p_claim;
 PERFORM 1 FROM public.tc42_orders WHERE id=c.order_id FOR UPDATE;
 SELECT * INTO STRICT c FROM public.store_payment_claims WHERE id=p_claim FOR UPDATE;
 IF c.state='verified' THEN RAISE EXCEPTION 'Verified evidence is immutable'; END IF;
 IF c.state=(CASE WHEN p_reject THEN 'rejected' ELSE 'review' END) AND c.review_note=p_note THEN RETURN; END IF;
 UPDATE public.store_payment_claims SET state=CASE WHEN p_reject THEN 'rejected' ELSE 'review' END,review_note=p_note WHERE id=p_claim;
 UPDATE public.tc42_orders SET status='payment_review',updated_at=clock_timestamp() WHERE id=c.order_id AND status='payment_submitted';
 INSERT INTO public.store_order_events(order_id,event_key,kind,actor,detail) VALUES(c.order_id,'review:'||gen_random_uuid(),'claim_review',auth.uid(),jsonb_build_object('claim_id',c.id,'rejected',p_reject,'note',p_note));
END $$;
-- Expiration is callable by a scheduled trusted worker and on customer resume.
CREATE FUNCTION public.phase1_expire_invoices() RETURNS int LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE i record; n int:=0;
BEGIN
 FOR i IN SELECT order_id,id FROM public.store_crypto_invoice WHERE expires_at<=now() AND state IN ('awaiting_payment','submitted','partial','confirming') FOR UPDATE SKIP LOCKED LOOP
 UPDATE public.store_crypto_invoice SET state='expired' WHERE order_id=i.order_id;
 UPDATE public.store_inventory_reservations SET state='released' WHERE order_id=i.order_id AND state='active';
 INSERT INTO public.store_order_events(order_id,event_key,kind) VALUES(i.order_id,'expired:'||i.id,'invoice_expired') ON CONFLICT(event_key) DO NOTHING;
 INSERT INTO public.market_notifications(recipient_id,kind,title)
 SELECT o.customer_id,'purchase_updated','Payment invoice expired; contact support for any transfer already sent' FROM public.tc42_orders o WHERE o.id=i.order_id;
 n:=n+1;
 END LOOP; RETURN n;
END $$;
-- Once bridged, the request stays a historical intake record. Legacy review RPCs
-- must not create a competing payment/fulfillment state for the canonical order.
CREATE FUNCTION public.phase1_legacy_request_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE request uuid;
BEGIN
 IF TG_TABLE_NAME='market_txid_claims' THEN request:=NEW.request_id;
 ELSE
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  request:=NEW.id;
 END IF;
 IF EXISTS(SELECT 1 FROM public.tc42_orders WHERE market_request_id=request) THEN
 RAISE EXCEPTION 'This request has a canonical order; use the order center'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.phase1_legacy_request_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER phase1_legacy_status BEFORE UPDATE OF status ON public.market_purchase_requests FOR EACH ROW EXECUTE FUNCTION public.phase1_legacy_request_guard();
CREATE TRIGGER phase1_legacy_claim BEFORE INSERT ON public.market_txid_claims FOR EACH ROW EXECUTE FUNCTION public.phase1_legacy_request_guard();
CREATE FUNCTION public.phase1_verification_failed(p_user uuid,p_order uuid,p_txid text,p_code text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE inserted bigint;
BEGIN
 IF p_code !~ '^[a-z_]{1,80}$' OR NOT EXISTS(SELECT 1 FROM public.tc42_orders WHERE id=p_order AND customer_id=p_user)
 OR NOT EXISTS(SELECT 1 FROM public.store_payment_claims WHERE order_id=p_order AND txid=p_txid) THEN RAISE EXCEPTION 'Invalid failure event'; END IF;
 INSERT INTO public.store_order_events(order_id,event_key,kind,detail)
 VALUES(p_order,'failure:'||p_order||':'||p_txid||':'||p_code,'verification_failed',jsonb_build_object('txid',p_txid,'code',p_code)) ON CONFLICT(event_key) DO NOTHING RETURNING id INTO inserted;
 IF inserted IS NOT NULL THEN
 INSERT INTO public.market_notifications(recipient_id,kind,title) VALUES(p_user,'purchase_updated','Payment verification failed; review your order or contact support');
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.phase1_verification_failed(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase1_verification_failed(uuid,uuid,text,text) TO service_role;
-- All new RPCs default deny, then grant only the intended caller.
REVOKE ALL ON FUNCTION public.phase1_create_order(jsonb,uuid),public.phase1_market_order(uuid),public.phase1_submit_claim(uuid,text,text),public.phase1_transition(uuid,text,text),public.phase1_review_claim(uuid,boolean,text),public.phase1_order_notice() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase1_create_order(jsonb,uuid),public.phase1_market_order(uuid),public.phase1_submit_claim(uuid,text,text),public.phase1_transition(uuid,text,text),public.phase1_review_claim(uuid,boolean,text) TO authenticated;
REVOKE ALL ON FUNCTION public.phase1_issue_invoice(uuid,uuid,text,text,bigint,text,text,timestamptz),public.phase1_record_verification(uuid,uuid,text,jsonb),public.phase1_expire_invoices() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase1_issue_invoice(uuid,uuid,text,text,bigint,text,text,timestamptz),public.phase1_record_verification(uuid,uuid,text,jsonb),public.phase1_expire_invoices() TO service_role;
COMMIT;
