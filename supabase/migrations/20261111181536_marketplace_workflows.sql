-- Additive marketplace workflow completion. No hosted application or payment activation.
BEGIN;
CREATE FUNCTION public.market_edit_listing(p_listing bigint,p_title text,p_platform text,p_description text,p_price numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.market_listings;
BEGIN
 IF NOT public.triso_active_user() THEN RAISE EXCEPTION 'Active session required'; END IF;
 IF char_length(trim(coalesce(p_title,''))) NOT BETWEEN 5 AND 120 OR char_length(trim(coalesce(p_platform,''))) NOT BETWEEN 2 AND 50
 OR char_length(trim(coalesce(p_description,''))) NOT BETWEEN 20 AND 3000 OR p_price IS NULL OR p_price<1 OR p_price>1000000 OR p_price::text='NaN' THEN RAISE EXCEPTION 'Invalid listing details'; END IF;
 SELECT * INTO STRICT l FROM public.market_listings WHERE id=p_listing AND seller_id=auth.uid() FOR UPDATE;
 IF l.status NOT IN ('pending','declined','approved') THEN RAISE EXCEPTION 'Listing cannot be edited'; END IF;
 IF EXISTS(SELECT 1 FROM public.market_purchase_requests WHERE listing_id=l.id AND status NOT IN ('cancelled','completed','seller_payout_recorded')) THEN RAISE EXCEPTION 'Resolve active purchase requests before editing'; END IF;
 UPDATE public.market_listings SET title=trim(p_title),platform=trim(p_platform),description=trim(p_description),price=p_price,
 status='pending',reviewed_at=NULL,reviewed_by=NULL,decline_reason=NULL WHERE id=l.id;
END $$;
CREATE FUNCTION public.market_protect_listing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.status='sold' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Sold listings are immutable'; END IF;
 IF NEW.status='sold' AND OLD.status<>'sold' AND current_setting('role',true) IN ('anon','authenticated') THEN RAISE EXCEPTION 'Only verified settlement may mark Sold'; END IF;
 IF (NEW.status,NEW.title,NEW.platform,NEW.description,NEW.price) IS DISTINCT FROM (OLD.status,OLD.title,OLD.platform,OLD.description,OLD.price)
 AND NEW.status<>'sold' AND EXISTS(SELECT 1 FROM public.tc42_orders WHERE listing_id=OLD.id AND status NOT IN ('cancelled','refunded')) THEN RAISE EXCEPTION 'Listing has a canonical order; manage the order first'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.market_protect_listing() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER market_protect_inventory BEFORE UPDATE ON public.market_listings FOR EACH ROW EXECUTE FUNCTION public.market_protect_listing();
CREATE FUNCTION public.market_validate_media()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.market_listings;
BEGIN
 SELECT * INTO STRICT l FROM public.market_listings WHERE id=NEW.listing_id FOR UPDATE;
 IF NOT public.triso_active_user() OR l.seller_id<>auth.uid() OR NEW.seller_id<>auth.uid() OR l.status<>'pending' THEN RAISE EXCEPTION 'Pending listing owner required'; END IF;
 IF (SELECT count(*) FROM public.market_listing_media WHERE listing_id=l.id)>=4 THEN RAISE EXCEPTION 'Maximum four photos per listing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='market-gallery' AND name=NEW.object_path) THEN RAISE EXCEPTION 'Upload the photo before attaching it'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.market_validate_media() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER market_media_attachment BEFORE INSERT ON public.market_listing_media FOR EACH ROW EXECUTE FUNCTION public.market_validate_media();
-- Bucket restrictions validate uploads on the Storage API, not just in a browser.
DO $$ BEGIN
 IF to_regclass('storage.buckets') IS NOT NULL THEN
 UPDATE storage.buckets SET file_size_limit=5242880,allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'] WHERE id='market-gallery';
 END IF;
END $$;
CREATE FUNCTION public.market_seller_profile(p_listing bigint)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('display_name',p.display_name,'bio',p.bio,'avatar_url',p.avatar_url,
 'is_pro',coalesce(s.is_pro AND (s.pro_until IS NULL OR s.pro_until>now()),false))
 FROM public.market_listings l JOIN public.market_seller_public_profiles p ON p.user_id=l.seller_id
 LEFT JOIN public.seller_profiles s ON s.user_id=l.seller_id
 WHERE l.id=p_listing AND l.status='approved' AND p.is_public
$$;
REVOKE ALL ON FUNCTION public.market_seller_profile(bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.market_seller_profile(bigint) TO anon,authenticated;
CREATE FUNCTION public.market_cancel_request(p_request uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.market_purchase_requests;
BEGIN
 IF NOT public.triso_active_user() THEN RAISE EXCEPTION 'Active session required'; END IF;
 SELECT * INTO STRICT r FROM public.market_purchase_requests WHERE id=p_request AND buyer_id=auth.uid() FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.tc42_orders WHERE market_request_id=r.id) THEN RAISE EXCEPTION 'Use the canonical order center'; END IF;
 IF r.status='cancelled' THEN RETURN; END IF;
 IF r.status NOT IN ('requested','awaiting_payment_setup') OR EXISTS(SELECT 1 FROM public.market_txid_claims WHERE request_id=r.id) THEN RAISE EXCEPTION 'Request requires admin review'; END IF;
 UPDATE public.market_purchase_requests SET status='cancelled',updated_at=clock_timestamp() WHERE id=r.id;
END $$;
REVOKE ALL ON FUNCTION public.market_edit_listing(bigint,text,text,text,numeric),public.market_cancel_request(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.market_edit_listing(bigint,text,text,text,numeric),public.market_cancel_request(uuid) TO authenticated;
ALTER TABLE public.market_messages ADD COLUMN client_key uuid;
CREATE UNIQUE INDEX market_message_retry_key ON public.market_messages(sender_id,client_key) WHERE client_key IS NOT NULL;
CREATE FUNCTION public.market_send_message_once(p_conversation bigint,p_body text,p_key uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.market_messages;
BEGIN
 IF NOT public.triso_active_user() OR p_key IS NULL THEN RAISE EXCEPTION 'Active session and retry key required'; END IF;
 IF char_length(trim(coalesce(p_body,''))) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Invalid message'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.market_conversations WHERE id=p_conversation AND auth.uid() IN (buyer_id,seller_id)) THEN RAISE EXCEPTION 'Conversation unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text),hashtext(p_key::text));
 SELECT * INTO m FROM public.market_messages WHERE sender_id=auth.uid() AND client_key=p_key;
 IF FOUND THEN
 IF m.conversation_id<>p_conversation OR m.body<>trim(p_body) THEN RAISE EXCEPTION 'Message retry mismatch'; END IF;
 RETURN m.id; END IF;
 INSERT INTO public.market_messages(conversation_id,sender_id,body,client_key) VALUES(p_conversation,auth.uid(),trim(p_body),p_key) RETURNING id INTO m.id;
 RETURN m.id;
END $$;
ALTER TABLE public.market_conversation_reads ADD COLUMN last_read_id bigint;
CREATE FUNCTION public.market_mark_read_to(p_conversation bigint,p_message bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE seen timestamptz;
BEGIN
 IF NOT public.triso_active_user() THEN RAISE EXCEPTION 'Active session required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.market_conversations WHERE id=p_conversation AND auth.uid() IN (buyer_id,seller_id)) THEN RAISE EXCEPTION 'Conversation unavailable'; END IF;
 SELECT created_at INTO STRICT seen FROM public.market_messages WHERE conversation_id=p_conversation AND id=p_message;
 INSERT INTO public.market_conversation_reads(conversation_id,user_id,last_read_at,last_read_id) VALUES(p_conversation,auth.uid(),seen,p_message)
 ON CONFLICT(conversation_id,user_id) DO UPDATE SET last_read_at=greatest(public.market_conversation_reads.last_read_at,excluded.last_read_at),last_read_id=greatest(public.market_conversation_reads.last_read_id,excluded.last_read_id);
END $$;
REVOKE ALL ON FUNCTION public.market_send_message_once(bigint,text,uuid),public.market_mark_read_to(bigint,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.market_send_message_once(bigint,text,uuid),public.market_mark_read_to(bigint,bigint) TO authenticated;
CREATE OR REPLACE FUNCTION public.market_inbox()
 RETURNS TABLE(id bigint, listing_id bigint, listing_title text, seller_id uuid, buyer_id uuid, created_at timestamp with time zone, last_message_at timestamp with time zone, last_message_preview text, last_sender_id uuid, unread_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select c.id,
         c.listing_id,
         coalesce(l.title, 'Listing #' || c.listing_id::text) as listing_title,
         c.seller_id, c.buyer_id, c.created_at,
         latest.created_at as last_message_at,
         left(latest.body, 180) as last_message_preview,
         latest.sender_id as last_sender_id,
         (
           select count(*)
           from public.market_messages m
           where m.conversation_id = c.id
             and m.sender_id <> auth.uid()
             and ((read_state.last_read_id IS NOT NULL AND m.id>read_state.last_read_id) OR (read_state.last_read_id IS NULL AND m.created_at>coalesce(read_state.last_read_at,'epoch'::timestamptz)))
         ) as unread_count
  from public.market_conversations c
  left join public.market_listings l on l.id = c.listing_id
  left join public.market_conversation_reads read_state
    on read_state.conversation_id = c.id and read_state.user_id = auth.uid()
  left join lateral (
    select m.body, m.created_at, m.sender_id
    from public.market_messages m
    where m.conversation_id = c.id
    order by m.created_at desc, m.id desc
    limit 1
  ) latest on true
  where auth.uid() is not null
    and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  order by coalesce(latest.created_at, c.created_at) desc, c.id desc
  limit 100
$function$
;
CREATE OR REPLACE FUNCTION public.market_inbox_page(p_offset integer DEFAULT 0)
 RETURNS TABLE(id bigint, listing_id bigint, listing_title text, seller_id uuid, buyer_id uuid, created_at timestamp with time zone, last_message_at timestamp with time zone, last_message_preview text, last_sender_id uuid, unread_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select c.id,
         c.listing_id,
         coalesce(l.title, 'Listing #' || c.listing_id::text) as listing_title,
         c.seller_id, c.buyer_id, c.created_at,
         latest.created_at as last_message_at,
         left(latest.body, 180) as last_message_preview,
         latest.sender_id as last_sender_id,
         (
           select count(*)
           from public.market_messages m
           where m.conversation_id = c.id
             and m.sender_id <> auth.uid()
             and ((read_state.last_read_id IS NOT NULL AND m.id>read_state.last_read_id) OR (read_state.last_read_id IS NULL AND m.created_at>coalesce(read_state.last_read_at,'epoch'::timestamptz)))
         ) as unread_count
  from public.market_conversations c
  left join public.market_listings l on l.id = c.listing_id
  left join public.market_conversation_reads read_state
    on read_state.conversation_id = c.id and read_state.user_id = auth.uid()
  left join lateral (
    select m.body, m.created_at, m.sender_id
    from public.market_messages m
    where m.conversation_id = c.id
    order by m.created_at desc, m.id desc
    limit 1
  ) latest on true
  where auth.uid() is not null
    and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  order by coalesce(latest.created_at, c.created_at) desc, c.id desc
  limit 100 offset greatest(0,coalesce(p_offset,0))
$function$
;
REVOKE ALL ON FUNCTION public.market_inbox_page(integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.market_inbox_page(integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.market_mark_read(p_conversation bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.market_conversations c
    where c.id = p_conversation and (c.buyer_id = v_user or c.seller_id = v_user)
  ) then
    raise exception 'Conversation unavailable' using errcode = '42501';
  end if;

  insert into public.market_conversation_reads (conversation_id, user_id, last_read_at,last_read_id)
    values (p_conversation, v_user, now(),(select max(id) from public.market_messages where conversation_id=p_conversation))
  on conflict (conversation_id, user_id)
    do update set last_read_id=greatest(public.market_conversation_reads.last_read_id,excluded.last_read_id),last_read_at = greatest(
      public.market_conversation_reads.last_read_at, excluded.last_read_at
    );
end
$function$
;
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
CREATE OR REPLACE FUNCTION public.market_set_pro_until(p_user uuid,p_enabled boolean,p_until timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.phase1_is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF p_enabled IS NULL OR (p_enabled AND p_until IS NOT NULL AND p_until<=now()) THEN RAISE EXCEPTION 'Choose a future Pro expiry'; END IF;
 PERFORM public.market_set_pro(p_user,p_enabled);
 UPDATE public.seller_profiles SET pro_until=CASE WHEN p_enabled THEN p_until END WHERE user_id=p_user;
END $$;
REVOKE ALL ON FUNCTION public.market_set_pro_until(uuid,boolean,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.market_set_pro_until(uuid,boolean,timestamptz) TO authenticated;
-- Canonical terminal transitions retire intake records, permitting safe retries.
-- The legacy guard still rejects every direct client status edit on a bridge.
CREATE OR REPLACE FUNCTION public.phase1_legacy_request_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE request uuid;
BEGIN
 IF TG_TABLE_NAME='market_txid_claims' THEN request:=NEW.request_id;
 ELSE
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  request:=NEW.id;
  IF pg_trigger_depth()>1 AND EXISTS(SELECT 1 FROM public.tc42_orders WHERE market_request_id=request
    AND ((status='cancelled' AND NEW.status='cancelled') OR (status='fulfilled' AND NEW.status='completed'))) THEN RETURN NEW; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.tc42_orders WHERE market_request_id=request) THEN RAISE EXCEPTION 'This request has a canonical order; use the order center'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.market_sync_terminal_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.market_request_id IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('cancelled','fulfilled') THEN
 UPDATE public.market_purchase_requests SET status=CASE NEW.status WHEN 'cancelled' THEN 'cancelled' ELSE 'completed' END,updated_at=clock_timestamp() WHERE id=NEW.market_request_id;
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.market_sync_terminal_request() FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE TRIGGER market_sync_terminal_request AFTER UPDATE OF status ON public.tc42_orders FOR EACH ROW EXECUTE FUNCTION public.market_sync_terminal_request();
CREATE OR REPLACE FUNCTION public.tc34_notify_purchase()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF EXISTS(SELECT 1 FROM public.tc42_orders WHERE market_request_id=NEW.id) THEN RETURN NULL; END IF;
 IF TG_OP = 'INSERT' THEN
  INSERT INTO public.market_notifications (recipient_id,kind,title,listing_id,request_id)
   VALUES (NEW.seller_id,'purchase_requested','New purchase review request',NEW.listing_id,NEW.id);
  INSERT INTO public.market_notifications (for_admin,kind,title,listing_id,request_id)
   VALUES (true,'purchase_requested','New marketplace purchase request',NEW.listing_id,NEW.id);
 ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
  INSERT INTO public.market_notifications (recipient_id,kind,title,listing_id,request_id)
   VALUES (NEW.buyer_id,'purchase_updated','Purchase request status changed',NEW.listing_id,NEW.id),
          (NEW.seller_id,'purchase_updated','Purchase request status changed',NEW.listing_id,NEW.id);
 END IF;
 RETURN NULL;
END $function$
;
COMMIT;
