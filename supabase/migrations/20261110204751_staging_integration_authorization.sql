-- After Phase 1 and paginated browse. Additive authorization reconciliation:
-- same project's Auth users + live sessions, no production identity import.
BEGIN;
CREATE OR REPLACE FUNCTION public.triso_active_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (
  SELECT 1 FROM auth.users u JOIN auth.sessions s ON s.user_id=u.id
  WHERE u.id=auth.uid() AND u.deleted_at IS NULL
   AND (u.banned_until IS NULL OR u.banned_until<=now())
   AND s.id::text=(auth.jwt()->>'session_id')
   AND (s.not_after IS NULL OR s.not_after>now())
 )
$$;
REVOKE ALL ON FUNCTION public.triso_active_user() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.triso_active_user() TO authenticated;
CREATE OR REPLACE FUNCTION public.phase1_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.triso_active_user() AND EXISTS (
  SELECT 1 FROM auth.users WHERE id=auth.uid() AND raw_app_meta_data->>'role'='admin'
 )
$$;
-- Legacy moderation/Pro/support policies now use current persisted app metadata.
-- Anonymous policies also call is_admin(); the definer returns false without a
-- live user/session and does not expose auth tables or trust user_metadata.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.phase1_is_admin()
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon,authenticated;

-- Preserve every existing ownership/moderation policy; add a restrictive gate.
-- Security-definer write RPCs bypass RLS, so a separate trigger gates their
-- authenticated writes too. Privileged worker/DB maintenance writes still work.
CREATE FUNCTION public.triso_require_active_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF current_setting('role',true) IN ('anon','authenticated')
    AND NOT public.triso_active_user() THEN
  RAISE EXCEPTION 'Active session required' USING errcode='28000';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.triso_require_active_user() FROM PUBLIC,anon,authenticated,service_role;
DO $block$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['blog_posts','market_alert_preferences','market_conversation_reads','market_conversations','market_email_outbox','market_listing_activity','market_listing_media','market_listings','market_messages','market_notifications','market_purchase_requests','market_seller_public_profiles','market_txid_claims','order_items','orders','product_media','product_merchandising','product_sales_snapshots','product_specs','products','seller_profiles','store_crypto_invoice','store_used_txid','support_tickets','tc42_orders','tc42_support_messages','tc42_support_threads','store_inventory_reservations','store_payment_claims','store_order_events','store_provider_events','store_checkout_keys'] LOOP
  EXECUTE format('CREATE POLICY triso_active_session ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.triso_active_user())) WITH CHECK ((SELECT public.triso_active_user()))',t);
  EXECUTE format('REVOKE TRUNCATE,REFERENCES,TRIGGER,MAINTAIN ON public.%I FROM anon,authenticated',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['tc42_orders','market_listings','market_conversations','market_messages','market_purchase_requests','market_txid_claims','market_conversation_reads','seller_profiles'] LOOP
  EXECUTE format('CREATE TRIGGER triso_active_session BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.triso_require_active_user()',t);
 END LOOP;
END $block$;
-- Existing storage ownership/approved-image rules remain in place.
CREATE POLICY triso_active_session ON storage.objects AS RESTRICTIVE
 FOR ALL TO authenticated USING ((SELECT public.triso_active_user()))
 WITH CHECK ((SELECT public.triso_active_user()));

-- Supabase default ACLs grant much more than vanilla PostgreSQL fixtures do.
-- Start worker tables at deny-all before adding only the required operations.
REVOKE ALL ON public.store_inventory_reservations,public.store_payment_claims,
 public.store_order_events,public.store_provider_events,public.store_checkout_keys
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.store_inventory_reservations,public.store_payment_claims,public.store_checkout_keys TO service_role;
GRANT SELECT,INSERT ON public.store_order_events,public.store_provider_events TO service_role;
GRANT SELECT ON public.store_order_events,public.store_payment_claims TO authenticated;
REVOKE ALL ON SEQUENCE public.store_order_events_id_seq FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE,SELECT ON SEQUENCE public.store_order_events_id_seq TO service_role;
-- Only the idempotent Phase 1 entry point is a client API; it invokes the
-- legacy validator as its owner, so revocation does not break canonical checkout.
REVOKE EXECUTE ON FUNCTION public.tc42_create_order(jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.tc42_create_order(p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_user uuid := auth.uid(); v_entry jsonb; v_product record; v_id bigint; v_qty int; v_total numeric(12,2):=0; v_lines jsonb:='[]'::jsonb; v_order uuid;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in to save an order'; END IF;
 IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Invalid cart size'; END IF;
 FOR v_entry IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  IF jsonb_typeof(v_entry) IS DISTINCT FROM 'object' OR coalesce(v_entry->>'id','') !~ '^[0-9]{1,18}$' OR coalesce(v_entry->>'qty','') !~ '^[0-9]{1,5}$' THEN RAISE EXCEPTION 'Invalid cart item'; END IF;
  v_id:=(v_entry->>'id')::bigint; v_qty:=(v_entry->>'qty')::int;
  IF v_qty<1 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  SELECT id,title,price,stock,status,min_qty,max_qty INTO v_product FROM public.products WHERE id=v_id FOR SHARE;
  IF NOT FOUND OR v_product.status IS DISTINCT FROM 'available' OR v_product.stock<v_qty THEN RAISE EXCEPTION 'Product unavailable'; END IF;
  IF v_qty<v_product.min_qty OR (v_product.max_qty IS NOT NULL AND v_qty>v_product.max_qty) THEN RAISE EXCEPTION 'Quantity outside allowed range'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_lines) x WHERE (x->>'id')::bigint=v_id) THEN RAISE EXCEPTION 'Duplicate product'; END IF;
  v_total:=v_total+round(v_product.price*v_qty,2);
  IF v_total>9999999999 THEN RAISE EXCEPTION 'Cart total too large'; END IF;
  v_lines:=v_lines||jsonb_build_array(jsonb_build_object('id',v_id,'title',v_product.title,'unit_price',v_product.price,'qty',v_qty));
 END LOOP;
 INSERT INTO public.tc42_orders(customer_id,total_amount,items) VALUES(v_user,v_total,v_lines) RETURNING id INTO v_order;
 RETURN v_order;
END;$function$;
-- Guard idempotent/read-before-write fast paths as well as actual writes.

CREATE OR REPLACE FUNCTION public.phase1_create_order(p_items jsonb,p_key uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); k public.store_checkout_keys; o uuid;
BEGIN
 IF NOT public.triso_active_user() THEN RAISE EXCEPTION 'Active session required' USING errcode='28000'; END IF;
 IF u IS NULL OR p_key IS NULL THEN RAISE EXCEPTION 'Sign in and retry key required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(u::text),hashtext(p_key::text));
 SELECT * INTO k FROM public.store_checkout_keys WHERE buyer_id=u AND key=p_key;
 IF FOUND THEN IF k.cart<>p_items THEN RAISE EXCEPTION 'Retry key already used for different cart'; END IF; RETURN k.order_id; END IF;
 o:=public.tc42_create_order(p_items);
 INSERT INTO public.store_checkout_keys VALUES(u,p_key,p_items,o);
 RETURN o;
END $$;

CREATE OR REPLACE FUNCTION public.phase1_market_order(p_request uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.market_purchase_requests; o uuid; u uuid:=auth.uid();
BEGIN
 IF NOT public.triso_active_user() THEN RAISE EXCEPTION 'Active session required' USING errcode='28000'; END IF;
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

CREATE OR REPLACE FUNCTION public.phase1_submit_claim(p_order uuid,p_method text,p_reference text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.tc42_orders; i public.store_crypto_invoice; c public.store_payment_claims; ref text:=trim(p_reference); coin text:=upper(p_method);
BEGIN
 IF NOT public.triso_active_user() THEN RAISE EXCEPTION 'Active session required' USING errcode='28000'; END IF;
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

CREATE OR REPLACE FUNCTION public.phase1_transition(p_order uuid,p_status text,p_note text DEFAULT NULL) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.tc42_orders; u uuid:=auth.uid(); admin boolean:=public.phase1_is_admin(); allowed boolean:=false;
BEGIN
 IF NOT public.triso_active_user() THEN RAISE EXCEPTION 'Active session required' USING errcode='28000'; END IF;
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

CREATE OR REPLACE FUNCTION public.market_request_purchase(p_listing bigint, p_method text DEFAULT 'CONTACT_SUPPORT'::text, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_buyer uuid := auth.uid();
  v_seller uuid;
  v_title text;
  v_price numeric;
  v_id uuid;
  v_method text := upper(trim(coalesce(p_method, '')));
BEGIN
 IF NOT public.triso_active_user() THEN RAISE EXCEPTION 'Active session required' USING errcode='28000'; END IF;
  IF v_buyer IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING errcode = '28000';
  END IF;
  IF v_method NOT IN ('LTC', 'BTC', 'BANK', 'CONTACT_SUPPORT') THEN
    RAISE EXCEPTION 'Invalid payment preference' USING errcode = '22023';
  END IF;
  IF char_length(coalesce(p_note, '')) > 500 THEN
    RAISE EXCEPTION 'Note too long' USING errcode = '22023';
  END IF;

  -- No checkout: only approved listings may receive a review request.
  SELECT seller_id, title, price INTO v_seller, v_title, v_price
  FROM public.market_listings
  WHERE id = p_listing AND status = 'approved';

  IF v_seller IS NULL THEN
    RAISE EXCEPTION 'Listing is not currently available' USING errcode = '23514';
  END IF;
  IF v_seller = v_buyer THEN
    RAISE EXCEPTION 'Cannot purchase your own listing' USING errcode = '23514';
  END IF;

  -- Serialize concurrent requests for the same buyer/listing, across tabs and devices.
  -- Locks are transaction-scoped and release automatically on commit/rollback.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_buyer::text),
    pg_catalog.hashtext(p_listing::text)
  );

  SELECT id INTO v_id
  FROM public.market_purchase_requests
  WHERE listing_id = p_listing
    AND buyer_id = v_buyer
    AND status NOT IN ('cancelled', 'completed', 'seller_payout_recorded')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.market_purchase_requests
    (listing_id, buyer_id, seller_id, listing_title, price_usd,
     payment_method, buyer_note, status)
  VALUES
    (p_listing, v_buyer, v_seller, v_title, v_price,
     v_method, nullif(trim(p_note), ''), 'requested')
  RETURNING id INTO v_id;

  RETURN v_id;
END
$function$
;

CREATE OR REPLACE FUNCTION public.market_remove_listing(p_listing bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_actor uuid:=auth.uid();v_seller uuid;v_status text;v_admin boolean;
BEGIN
 IF NOT public.triso_active_user() THEN RAISE EXCEPTION 'Active session required' USING errcode='28000'; END IF;
 if v_actor is null then raise exception 'Sign in required' using errcode='28000';end if;
 v_admin:=public.is_admin();
 select seller_id,status into v_seller,v_status
 from public.market_listings where id=p_listing for update;
 if v_seller is null then raise exception 'Listing not found' using errcode='P0002';end if;
 if v_seller<>v_actor and not v_admin then raise exception 'Not authorized' using errcode='42501';end if;
 if v_status='removed' then return;end if;
 if exists(select 1 from public.market_purchase_requests p
   where p.listing_id=p_listing and p.status in
   ('payment_reported','payment_verified','delivery_reported','disputed')) then
   raise exception 'Listing has an active payment/delivery review. Contact an administrator before removal'
     using errcode='23514';
 end if;
 update public.market_listings set status='removed' where id=p_listing;
 insert into public.market_listing_activity(listing_id,actor_id,previous_status,action)
 values(p_listing,v_actor,v_status,case when v_admin and v_actor<>v_seller
   then 'removed_by_admin' else 'removed_by_seller' end);
end
$function$
;
COMMIT;
