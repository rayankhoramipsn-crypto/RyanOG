-- Additive communications infrastructure; never activates external delivery.
BEGIN;
CREATE FUNCTION public.support_is_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT public.triso_active_user() AND EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid() AND raw_app_meta_data->>'role' IN ('admin','support')) $$;
REVOKE ALL ON FUNCTION public.support_is_staff() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.support_is_staff() TO authenticated;
ALTER TABLE public.market_alert_preferences ADD COLUMN browser_enabled boolean NOT NULL DEFAULT false,ADD COLUMN push_enabled boolean NOT NULL DEFAULT false,ADD COLUMN language text NOT NULL DEFAULT 'en' CHECK(language IN ('en','fa','ar'));
GRANT INSERT(browser_enabled,push_enabled,language),UPDATE(browser_enabled,push_enabled,language) ON public.market_alert_preferences TO authenticated;
ALTER TABLE public.market_notifications ADD COLUMN event_key text,ADD COLUMN email_kind text,ADD COLUMN support_id uuid,ADD COLUMN for_support boolean NOT NULL DEFAULT false,ADD COLUMN order_id uuid REFERENCES public.tc42_orders(id);
ALTER TABLE public.market_notifications DROP CONSTRAINT market_notifications_kind_check;
ALTER TABLE public.market_notifications ADD CONSTRAINT market_notifications_kind_check CHECK(kind IN ('purchase_requested','purchase_updated','message','listing_approved','listing_declined','listing_pending','support_reply','support_created','support_status','payment'));
CREATE UNIQUE INDEX notification_event_once ON public.market_notifications(event_key,recipient_id) NULLS NOT DISTINCT WHERE event_key IS NOT NULL;
CREATE POLICY support_notifications ON public.market_notifications FOR SELECT TO authenticated USING(for_support AND (SELECT public.support_is_staff()));
CREATE TABLE public.market_notification_reads(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,last_read_id bigint NOT NULL DEFAULT 0);
ALTER TABLE public.market_notification_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.market_notification_reads FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.market_notification_reads TO authenticated;
CREATE POLICY notification_read_owner ON public.market_notification_reads FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) AND (SELECT public.triso_active_user()));
CREATE FUNCTION public.notification_page(p_before bigint DEFAULT NULL,p_limit int DEFAULT 40) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH visible AS (SELECT DISTINCT ON (coalesce(event_key,'legacy:'||id)) id,kind,title,listing_id,request_id,conversation_id,support_id,order_id,created_at,event_key FROM public.market_notifications ORDER BY coalesce(event_key,'legacy:'||id),id DESC)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(n)-'event_key' ORDER BY id DESC) FROM (SELECT * FROM visible WHERE p_before IS NULL OR id<p_before ORDER BY id DESC LIMIT greatest(1,least(100,p_limit))) n),'[]'::jsonb),'last_read_id',coalesce((SELECT last_read_id FROM public.market_notification_reads WHERE user_id=auth.uid()),0),'unread',(SELECT count(*) FROM visible WHERE id>coalesce((SELECT last_read_id FROM public.market_notification_reads WHERE user_id=auth.uid()),0)))
$$;
CREATE FUNCTION public.notification_read(p_id bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.triso_active_user() OR NOT EXISTS(SELECT 1 FROM public.market_notifications WHERE id=p_id AND (recipient_id=auth.uid() OR (for_admin AND public.phase1_is_admin()) OR (for_support AND public.support_is_staff()))) THEN RAISE EXCEPTION 'Notification unavailable'; END IF;
 INSERT INTO public.market_notification_reads VALUES(auth.uid(),p_id) ON CONFLICT(user_id) DO UPDATE SET last_read_id=greatest(public.market_notification_reads.last_read_id,excluded.last_read_id);
END $$;
REVOKE ALL ON FUNCTION public.notification_page(bigint,int),public.notification_read(bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.notification_page(bigint,int),public.notification_read(bigint) TO authenticated;
-- Extend the existing thread/message model and retain original legacy records.
ALTER TABLE public.tc42_support_threads DROP CONSTRAINT tc42_support_threads_customer_id_key;
ALTER TABLE public.tc42_support_threads ADD COLUMN legacy_ticket_id uuid UNIQUE REFERENCES public.support_tickets(id),ADD COLUMN status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','waiting_support','waiting_customer','resolved','closed')),ADD COLUMN assigned_to uuid REFERENCES auth.users(id),ADD COLUMN order_id uuid REFERENCES public.tc42_orders(id),ADD COLUMN is_dispute boolean NOT NULL DEFAULT false,ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),ADD COLUMN client_key uuid;
CREATE UNIQUE INDEX support_create_key ON public.tc42_support_threads(customer_id,client_key) WHERE client_key IS NOT NULL;
ALTER TABLE public.tc42_support_messages ADD COLUMN client_key uuid,ADD COLUMN legacy_ticket_id uuid UNIQUE REFERENCES public.support_tickets(id);
CREATE UNIQUE INDEX support_reply_key ON public.tc42_support_messages(sender_id,client_key) WHERE client_key IS NOT NULL;
-- Never truncate long historical initial messages; new RPCs impose a 4000-char cap.
ALTER TABLE public.tc42_support_messages DROP CONSTRAINT tc42_support_messages_body_check;
ALTER TABLE public.tc42_support_messages ADD CONSTRAINT tc42_support_messages_body_check CHECK(char_length(trim(body))>=1);
INSERT INTO public.tc42_support_threads(customer_id,subject,status,created_at,updated_at,legacy_ticket_id) SELECT user_id,left(subject,120),CASE status WHEN 'closed' THEN 'closed' WHEN 'resolved' THEN 'resolved' ELSE 'open' END,created_at,updated_at,id FROM public.support_tickets ON CONFLICT(legacy_ticket_id) DO NOTHING;
INSERT INTO public.tc42_support_messages(thread_id,sender_id,body,created_at,legacy_ticket_id) SELECT t.id,l.user_id,l.message,l.created_at,l.id FROM public.support_tickets l JOIN public.tc42_support_threads t ON t.legacy_ticket_id=l.id ON CONFLICT(legacy_ticket_id) DO NOTHING;
CREATE INDEX support_inbox_status ON public.tc42_support_threads(status,updated_at DESC,id);
CREATE INDEX support_history ON public.tc42_support_messages(thread_id,id DESC);
CREATE POLICY support_staff_threads ON public.tc42_support_threads FOR SELECT TO authenticated USING((SELECT public.support_is_staff()));
CREATE POLICY support_staff_messages ON public.tc42_support_messages FOR SELECT TO authenticated USING((SELECT public.support_is_staff()));
REVOKE INSERT,UPDATE,DELETE ON public.tc42_support_threads,public.tc42_support_messages FROM authenticated,anon;
CREATE FUNCTION public.support_create(p_subject text,p_body text,p_key uuid,p_order uuid DEFAULT NULL,p_dispute boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.tc42_support_threads;v uuid;
BEGIN
 IF NOT public.triso_active_user() OR p_key IS NULL THEN RAISE EXCEPTION 'Active session and retry key required'; END IF;
 IF char_length(trim(coalesce(p_subject,''))) NOT BETWEEN 1 AND 120 OR char_length(trim(coalesce(p_body,''))) NOT BETWEEN 1 AND 4000 OR p_dispute IS NULL THEN RAISE EXCEPTION 'Invalid ticket'; END IF;
 IF p_order IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.tc42_orders WHERE id=p_order AND auth.uid() IN (customer_id,seller_id)) THEN RAISE EXCEPTION 'Order unavailable'; END IF;
 IF p_dispute AND p_order IS NULL THEN RAISE EXCEPTION 'Dispute order required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text),hashtext(p_key::text));
 SELECT * INTO t FROM public.tc42_support_threads WHERE customer_id=auth.uid() AND client_key=p_key;
 IF FOUND THEN IF t.subject<>trim(p_subject) OR t.order_id IS DISTINCT FROM p_order OR t.is_dispute<>p_dispute OR NOT EXISTS(SELECT 1 FROM public.tc42_support_messages WHERE thread_id=t.id AND client_key=p_key AND body=trim(p_body)) THEN RAISE EXCEPTION 'Ticket retry mismatch'; END IF;RETURN t.id;END IF;
 INSERT INTO public.tc42_support_threads(customer_id,subject,client_key,order_id,is_dispute) VALUES(auth.uid(),trim(p_subject),p_key,p_order,p_dispute) RETURNING id INTO v;
 INSERT INTO public.tc42_support_messages(thread_id,sender_id,body,client_key) VALUES(v,auth.uid(),trim(p_body),p_key);RETURN v;
END $$;
CREATE FUNCTION public.support_reply(p_thread uuid,p_body text,p_key uuid) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.tc42_support_threads;m public.tc42_support_messages;
BEGIN
 IF NOT public.triso_active_user() OR p_key IS NULL OR char_length(trim(coalesce(p_body,''))) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Invalid reply or session'; END IF;
 SELECT * INTO STRICT t FROM public.tc42_support_threads WHERE id=p_thread AND (customer_id=auth.uid() OR public.support_is_staff()) FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text),hashtext(p_key::text));
 SELECT * INTO m FROM public.tc42_support_messages WHERE sender_id=auth.uid() AND client_key=p_key;
 IF FOUND THEN IF m.thread_id<>p_thread OR m.body<>trim(p_body) THEN RAISE EXCEPTION 'Reply retry mismatch'; END IF;RETURN m.id; END IF;
 IF t.status='closed' THEN RAISE EXCEPTION 'Ticket is closed'; END IF;
 INSERT INTO public.tc42_support_messages(thread_id,sender_id,body,client_key) VALUES(t.id,auth.uid(),trim(p_body),p_key) RETURNING * INTO m;
 RETURN m.id;
END $$;
CREATE FUNCTION public.support_manage(p_thread uuid,p_status text,p_assignee uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.support_is_staff() THEN RAISE EXCEPTION 'Support staff required'; END IF;
 IF p_status NOT IN ('open','waiting_support','waiting_customer','resolved','closed') OR p_status IS NULL THEN RAISE EXCEPTION 'Invalid support status'; END IF;
 IF p_assignee IS NOT NULL AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_assignee AND raw_app_meta_data->>'role' IN ('admin','support') AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now())) THEN RAISE EXCEPTION 'Invalid assignee'; END IF;
 UPDATE public.tc42_support_threads SET status=p_status,assigned_to=p_assignee,updated_at=clock_timestamp() WHERE id=p_thread;IF NOT FOUND THEN RAISE EXCEPTION 'Ticket unavailable'; END IF;
END $$;
CREATE FUNCTION public.support_history(p_thread uuid,p_before bigint DEFAULT NULL) RETURNS SETOF public.tc42_support_messages LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM public.tc42_support_messages WHERE thread_id=p_thread AND (p_before IS NULL OR id<p_before) ORDER BY id DESC LIMIT 100 $$;
REVOKE ALL ON FUNCTION public.support_create(text,text,uuid,uuid,boolean),public.support_reply(uuid,text,uuid),public.support_manage(uuid,text,uuid),public.support_history(uuid,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.support_create(text,text,uuid,uuid,boolean),public.support_reply(uuid,text,uuid),public.support_manage(uuid,text,uuid),public.support_history(uuid,bigint) TO authenticated;
CREATE FUNCTION public.support_bridge_legacy() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid;
BEGIN
 INSERT INTO public.tc42_support_threads(customer_id,subject,status,created_at,updated_at,legacy_ticket_id) VALUES(NEW.user_id,left(NEW.subject,120),CASE NEW.status WHEN 'closed' THEN 'closed' WHEN 'resolved' THEN 'resolved' ELSE 'open' END,NEW.created_at,NEW.updated_at,NEW.id) ON CONFLICT(legacy_ticket_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at RETURNING id INTO t;
 IF TG_OP='INSERT' THEN INSERT INTO public.tc42_support_messages(thread_id,sender_id,body,created_at,legacy_ticket_id) VALUES(t,NEW.user_id,NEW.message,NEW.created_at,NEW.id) ON CONFLICT(legacy_ticket_id) DO NOTHING;END IF;RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.support_bridge_legacy() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER support_bridge_legacy AFTER INSERT OR UPDATE OF status ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.support_bridge_legacy();
CREATE TABLE public.market_push_subscriptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,endpoint text UNIQUE NOT NULL,p256dh text NOT NULL,auth text NOT NULL,active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.market_push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.market_push_subscriptions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.market_push_subscriptions TO authenticated;
CREATE POLICY push_subscription_owner ON public.market_push_subscriptions FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) AND (SELECT public.triso_active_user()));
CREATE FUNCTION public.push_register(p_endpoint text,p_p256dh text,p_auth text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v uuid;
BEGIN
 IF NOT public.triso_active_user() THEN RAISE EXCEPTION 'Active session required'; END IF;
 IF p_endpoint IS NULL OR char_length(p_endpoint)>2048 OR p_endpoint !~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com|[a-z0-9-]+[.]notify[.]windows[.]com)/[^[:space:]#]+$' OR p_p256dh IS NULL OR p_p256dh !~ '^[A-Za-z0-9_-]{87}$' OR p_auth IS NULL OR p_auth !~ '^[A-Za-z0-9_-]{22}$' THEN RAISE EXCEPTION 'Invalid push subscription'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text));
 IF (SELECT count(*) FROM public.market_push_subscriptions WHERE user_id=auth.uid() AND active)>=10 AND NOT EXISTS(SELECT 1 FROM public.market_push_subscriptions WHERE user_id=auth.uid() AND endpoint=p_endpoint AND active) THEN RAISE EXCEPTION 'Subscription limit reached';END IF;
 INSERT INTO public.market_push_subscriptions(user_id,endpoint,p256dh,auth) VALUES(auth.uid(),p_endpoint,p_p256dh,p_auth) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,active=true WHERE market_push_subscriptions.user_id=auth.uid() RETURNING id INTO v;
 IF v IS NULL THEN RAISE EXCEPTION 'Subscription belongs to another session'; END IF;RETURN v;
END $$;
CREATE FUNCTION public.push_remove(p_endpoint text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF NOT public.triso_active_user() THEN RAISE EXCEPTION 'Active session required';END IF;UPDATE public.market_push_subscriptions SET active=false WHERE user_id=auth.uid() AND endpoint=p_endpoint;END $$;
REVOKE ALL ON FUNCTION public.push_register(text,text,text),public.push_remove(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.push_register(text,text,text),public.push_remove(text) TO authenticated;
ALTER TABLE public.market_email_outbox DROP CONSTRAINT market_email_outbox_state_check,DROP CONSTRAINT market_outbox_one_per_user;
ALTER TABLE public.market_email_outbox ADD COLUMN channel text NOT NULL DEFAULT 'email' CHECK(channel IN ('email','push')),ADD COLUMN subscription_id uuid REFERENCES public.market_push_subscriptions(id) ON DELETE CASCADE,ADD COLUMN lease uuid,ADD COLUMN lease_until timestamptz,ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now(),ADD COLUMN first_attempt_at timestamptz,ADD COLUMN provider_id text,ADD COLUMN delivery_state text,ADD COLUMN last_error text,ADD COLUMN event_key text,
 ADD CONSTRAINT market_email_outbox_state_check CHECK(state IN ('queued','processing','sent','failed','skipped')),
 ADD CONSTRAINT delivery_target_once UNIQUE NULLS NOT DISTINCT(notification_id,user_id,channel,subscription_id),ADD CONSTRAINT delivery_target_valid CHECK((channel='email' AND subscription_id IS NULL) OR (channel='push' AND subscription_id IS NOT NULL));
CREATE UNIQUE INDEX delivery_event_target_once ON public.market_email_outbox(event_key,user_id,channel,subscription_id) NULLS NOT DISTINCT WHERE event_key IS NOT NULL;
CREATE INDEX delivery_due ON public.market_email_outbox(channel,next_attempt_at) WHERE state IN ('queued','processing');
CREATE TABLE public.market_delivery_log(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,job_id bigint REFERENCES public.market_email_outbox(id) ON DELETE SET NULL,stage text NOT NULL,code text,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.market_delivery_webhooks(event_id text PRIMARY KEY,provider_id text NOT NULL,event_type text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.market_delivery_log ENABLE ROW LEVEL SECURITY;ALTER TABLE public.market_delivery_webhooks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.market_email_outbox,public.market_delivery_log,public.market_delivery_webhooks FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE public.market_delivery_log_id_seq FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.tc35_queue_opted_in_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.market_email_outbox(notification_id,user_id,channel,event_key) SELECT NEW.id,u.id,'email',coalesce(NEW.event_key,'legacy:'||NEW.id) FROM auth.users u JOIN public.market_alert_preferences p ON p.user_id=u.id AND p.email_enabled WHERE u.id=NEW.recipient_id OR (NEW.for_admin AND u.raw_app_meta_data->>'role'='admin') OR (NEW.for_support AND u.raw_app_meta_data->>'role'='support') ON CONFLICT DO NOTHING;
 INSERT INTO public.market_email_outbox(notification_id,user_id,channel,subscription_id,event_key) SELECT NEW.id,s.user_id,'push',s.id,coalesce(NEW.event_key,'legacy:'||NEW.id) FROM public.market_push_subscriptions s JOIN public.market_alert_preferences p ON p.user_id=s.user_id AND p.push_enabled JOIN auth.users u ON u.id=s.user_id WHERE s.active AND (u.id=NEW.recipient_id OR (NEW.for_admin AND u.raw_app_meta_data->>'role'='admin') OR (NEW.for_support AND u.raw_app_meta_data->>'role'='support')) ON CONFLICT DO NOTHING;RETURN NULL;
END $$;
CREATE FUNCTION public.delivery_allowed(p_id bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.market_email_outbox j JOIN public.market_notifications n ON n.id=j.notification_id JOIN auth.users u ON u.id=j.user_id JOIN public.market_alert_preferences p ON p.user_id=u.id WHERE j.id=p_id AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now()) AND ((j.channel='email' AND p.email_enabled AND u.email_confirmed_at IS NOT NULL AND u.email IS NOT NULL) OR (j.channel='push' AND p.push_enabled AND n.id>coalesce((SELECT last_read_id FROM public.market_notification_reads WHERE user_id=u.id),0) AND EXISTS(SELECT 1 FROM public.market_push_subscriptions WHERE id=j.subscription_id AND active))) AND (n.recipient_id=u.id OR (n.for_admin AND u.raw_app_meta_data->>'role'='admin') OR (n.for_support AND u.raw_app_meta_data->>'role'='support')))
$$;
CREATE FUNCTION public.delivery_lease(p_channel text,p_limit int DEFAULT 5) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.market_email_outbox;n public.market_notifications;u record;sub record;rows jsonb:='[]';token uuid;
BEGIN
 IF p_channel NOT IN ('email','push') OR p_channel IS NULL THEN RAISE EXCEPTION 'Invalid channel';END IF;
 FOR j IN SELECT * FROM public.market_email_outbox WHERE channel=p_channel AND ((state='queued' AND next_attempt_at<=now()) OR (state='processing' AND lease_until<=now())) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(10,p_limit)) LOOP
  IF j.attempts>=6 OR j.first_attempt_at<now()-interval '23 hours' THEN UPDATE public.market_email_outbox SET state='failed',lease=NULL,lease_until=NULL,last_error='retry_limit' WHERE id=j.id;CONTINUE;END IF;
  IF NOT public.delivery_allowed(j.id) THEN UPDATE public.market_email_outbox SET state='skipped',lease=NULL,lease_until=NULL,last_error='preference_or_access' WHERE id=j.id;CONTINUE;END IF;
  token:=gen_random_uuid();UPDATE public.market_email_outbox SET state='processing',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),lease=token,lease_until=now()+interval '5 minutes' WHERE id=j.id;
  INSERT INTO public.market_delivery_log(job_id,stage) VALUES(j.id,'leased');
  SELECT * INTO n FROM public.market_notifications WHERE id=j.notification_id;
  SELECT a.email,p.language INTO u FROM auth.users a JOIN public.market_alert_preferences p ON p.user_id=a.id WHERE a.id=j.user_id;
  SELECT endpoint,p256dh,auth INTO sub FROM public.market_push_subscriptions WHERE id=j.subscription_id;
  rows:=rows||jsonb_build_array(jsonb_build_object('id',j.id,'lease',token,'user_id',j.user_id,'to',u.email,'kind',coalesce(n.email_kind,CASE n.kind WHEN 'message' THEN 'message' WHEN 'purchase_requested' THEN 'seller_order' ELSE 'order' END),'message',n.title,'url',CASE WHEN n.support_id IS NOT NULL THEN 'https://trisocmd.shop/help/?ticket='||n.support_id ELSE 'https://trisocmd.shop/marketplace.html' END,'language',u.language,'optional',true,'subscription',CASE WHEN sub.endpoint IS NULL THEN NULL ELSE jsonb_build_object('endpoint',sub.endpoint,'keys',jsonb_build_object('p256dh',sub.p256dh,'auth',sub.auth)) END));
 END LOOP;RETURN rows;
END $$;
CREATE FUNCTION public.delivery_finish(p_id bigint,p_lease uuid,p_action text,p_provider text DEFAULT NULL,p_code text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.market_email_outbox;
BEGIN
 SELECT * INTO STRICT j FROM public.market_email_outbox WHERE id=p_id FOR UPDATE;
 IF j.state='sent' AND p_action='sent' AND j.provider_id=p_provider THEN RETURN; END IF;
 IF j.state<>'processing' OR j.lease IS DISTINCT FROM p_lease OR j.lease_until<=now() THEN RAISE EXCEPTION 'Stale delivery lease'; END IF;
 IF p_action NOT IN ('sent','retry','skip','gone','permanent') OR p_action IS NULL THEN RAISE EXCEPTION 'Invalid result';END IF;
 IF p_action='sent' AND (p_provider IS NULL OR char_length(p_provider)>200) THEN RAISE EXCEPTION 'Provider acknowledgement required';END IF;
 UPDATE public.market_email_outbox SET state=CASE WHEN p_action='sent' THEN 'sent' WHEN p_action IN ('skip','gone') THEN 'skipped' WHEN p_action='permanent' OR attempts>=6 OR first_attempt_at<now()-interval '23 hours' THEN 'failed' ELSE 'queued' END,sent_at=CASE WHEN p_action='sent' THEN now() ELSE sent_at END,provider_id=CASE WHEN p_action='sent' THEN p_provider ELSE provider_id END,delivery_state=CASE WHEN p_action='sent' THEN coalesce((SELECT substring(event_type from 7) FROM public.market_delivery_webhooks WHERE provider_id=p_provider ORDER BY CASE event_type WHEN 'email.complained' THEN 5 WHEN 'email.bounced' THEN 4 WHEN 'email.failed' THEN 3 WHEN 'email.delivered' THEN 2 ELSE 1 END DESC LIMIT 1),'accepted') ELSE delivery_state END,last_error=CASE WHEN p_action='sent' THEN NULL WHEN p_code ~ '^[a-z_]{1,64}$' THEN p_code ELSE 'delivery_failed' END,lease=NULL,lease_until=NULL,next_attempt_at=now()+least(3600,60*power(2,attempts)) * interval '1 second' WHERE id=j.id;
 INSERT INTO public.market_delivery_log(job_id,stage,code) VALUES(j.id,p_action,CASE WHEN p_code ~ '^[a-z_]{1,64}$' THEN p_code END);
 IF p_action='gone' THEN UPDATE public.market_push_subscriptions SET active=false WHERE id=j.subscription_id;END IF;
END $$;
CREATE FUNCTION public.delivery_webhook(p_event text,p_provider text,p_type text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE inserted int;
BEGIN
 IF p_event IS NULL OR length(p_event)>200 OR p_provider IS NULL OR length(p_provider)>200 OR p_type IS NULL OR p_type NOT IN ('email.sent','email.delivered','email.bounced','email.complained','email.failed') THEN RAISE EXCEPTION 'Invalid delivery event';END IF;
 INSERT INTO public.market_delivery_webhooks VALUES(p_event,p_provider,p_type,now()) ON CONFLICT DO NOTHING;GET DIAGNOSTICS inserted=ROW_COUNT;IF inserted=0 THEN RETURN false;END IF;
 UPDATE public.market_email_outbox SET delivery_state=CASE WHEN delivery_state IN ('bounced','complained') THEN delivery_state WHEN p_type='email.sent' AND delivery_state='delivered' THEN delivery_state ELSE substring(p_type from 7) END WHERE provider_id=p_provider AND channel='email';
 INSERT INTO public.market_delivery_log(job_id,stage,code) SELECT id,'webhook',replace(p_type,'.','_') FROM public.market_email_outbox WHERE provider_id=p_provider AND channel='email';RETURN true;
END $$;
CREATE FUNCTION public.delivery_health() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF NOT public.phase1_is_admin() THEN RAISE EXCEPTION 'Admin only';END IF;RETURN(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM(SELECT channel,state,delivery_state,count(*) FROM public.market_email_outbox GROUP BY channel,state,delivery_state)x);END $$;
REVOKE ALL ON FUNCTION public.delivery_allowed(bigint),public.delivery_lease(text,int),public.delivery_finish(bigint,uuid,text,text,text),public.delivery_webhook(text,text,text),public.delivery_health() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.delivery_allowed(bigint),public.delivery_lease(text,int),public.delivery_finish(bigint,uuid,text,text,text),public.delivery_webhook(text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.delivery_health() TO authenticated;
CREATE FUNCTION public.notice_emit(p_event text,p_user uuid,p_admin boolean,p_support boolean,p_kind text,p_title text,p_email text,p_context jsonb DEFAULT '{}') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.market_notifications(event_key,recipient_id,for_admin,for_support,kind,title,email_kind,listing_id,request_id,conversation_id,support_id,order_id)
 VALUES(p_event,p_user,p_admin,p_support,p_kind,p_title,p_email,(p_context->>'listing')::bigint,(p_context->>'request')::uuid,(p_context->>'conversation')::bigint,(p_context->>'support')::uuid,(p_context->>'order')::uuid) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.notice_emit(text,uuid,boolean,boolean,text,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.tc34_notify_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.market_conversations;ctx jsonb;
BEGIN
 SELECT * INTO c FROM public.market_conversations WHERE id=NEW.conversation_id;ctx:=jsonb_build_object('conversation',c.id);
 PERFORM public.notice_emit('message:'||NEW.id,CASE NEW.sender_id WHEN c.buyer_id THEN c.seller_id ELSE c.buyer_id END,false,false,'message','New marketplace message','message',ctx);
 PERFORM public.notice_emit('message:'||NEW.id,NULL,true,false,'message','New marketplace conversation message','message',ctx);RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.tc34_notify_purchase() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE event text;ctx jsonb;label text;
BEGIN
 IF EXISTS(SELECT 1 FROM public.tc42_orders WHERE market_request_id=NEW.id) THEN RETURN NULL;END IF;
 IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL;END IF;
 event:='request:'||NEW.id||':'||CASE WHEN TG_OP='INSERT' THEN 'created' ELSE NEW.status||':'||NEW.updated_at::text END;
 ctx:=jsonb_build_object('request',NEW.id,'listing',NEW.listing_id);label:=CASE WHEN TG_OP='INSERT' THEN 'New purchase review request' ELSE 'Purchase request status changed' END;
 PERFORM public.notice_emit(event,NEW.buyer_id,false,false,CASE WHEN TG_OP='INSERT' THEN 'purchase_requested' ELSE 'purchase_updated' END,label,'order',ctx);
 PERFORM public.notice_emit(event,NEW.seller_id,false,false,CASE WHEN TG_OP='INSERT' THEN 'purchase_requested' ELSE 'purchase_updated' END,label,'seller_order',ctx);
 PERFORM public.notice_emit(event,NULL,true,false,CASE WHEN TG_OP='INSERT' THEN 'purchase_requested' ELSE 'purchase_updated' END,label,'order',ctx);RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.phase1_order_notice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE label text;event text;ctx jsonb;template text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.status=OLD.status THEN RETURN NULL; END IF;
 label:=CASE WHEN TG_OP='INSERT' THEN 'Purchase request created' ELSE 'Order status: '||NEW.status END;
 event:=NEW.id::text||':'||CASE WHEN TG_OP='INSERT' THEN 'created' ELSE NEW.status||':'||NEW.updated_at::text END;
 INSERT INTO public.store_order_events(order_id,event_key,kind,actor,detail) VALUES(NEW.id,event,CASE WHEN TG_OP='INSERT' THEN 'order_created' ELSE 'status_changed' END,auth.uid(),jsonb_build_object('status',NEW.status));
 template:=CASE NEW.status WHEN 'cancelled' THEN 'cancelled' WHEN 'disputed' THEN 'disputed' WHEN 'paid' THEN 'payment' ELSE 'order' END;
 ctx:=jsonb_build_object('order',NEW.id,'request',NEW.market_request_id);
 PERFORM public.notice_emit('order:'||event,NEW.customer_id,false,false,'purchase_updated',label,template,ctx);
 IF NEW.seller_id IS NOT NULL THEN PERFORM public.notice_emit('order:'||event,NEW.seller_id,false,false,'purchase_updated',label,CASE WHEN template='order' THEN 'seller_order' ELSE template END,ctx);END IF;
 PERFORM public.notice_emit('order:'||event,NULL,true,false,'purchase_updated',label,template,ctx);RETURN NULL;
END $$;
CREATE FUNCTION public.communications_events() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ctx jsonb;event text;o public.tc42_orders;t public.tc42_support_threads;first_message boolean;
BEGIN
 IF TG_TABLE_NAME='market_listings' THEN
  IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL;END IF;
  IF NEW.status NOT IN ('pending','approved','declined') THEN RETURN NULL;END IF;
  event:='listing:'||NEW.id||':'||NEW.status||':'||txid_current();ctx:=jsonb_build_object('listing',NEW.id);
  IF NEW.status<>'pending' THEN PERFORM public.notice_emit(event,NEW.seller_id,false,false,'listing_'||NEW.status,'Listing review: '||NEW.status,'listing_'||NEW.status,ctx);END IF;
  PERFORM public.notice_emit(event,NULL,true,false,'listing_'||NEW.status,'Listing moderation completed','listing_'||NEW.status,ctx);
 ELSIF TG_TABLE_NAME='store_crypto_invoice' THEN
  IF NEW.state IS NOT DISTINCT FROM OLD.state THEN RETURN NULL;END IF;
  SELECT * INTO o FROM public.tc42_orders WHERE id=NEW.order_id;ctx:=jsonb_build_object('order',o.id);event:='invoice:'||NEW.id||':'||NEW.state;
  PERFORM public.notice_emit(event,o.customer_id,false,false,'payment','Payment status: '||NEW.state,'payment',ctx);
  IF o.seller_id IS NOT NULL THEN PERFORM public.notice_emit(event,o.seller_id,false,false,'payment','Payment status: '||NEW.state,'payment',ctx);END IF;
  PERFORM public.notice_emit(event,NULL,true,false,'payment','Payment status: '||NEW.state,'payment',ctx);
 ELSIF TG_TABLE_NAME='tc42_support_threads' THEN
  ctx:=jsonb_build_object('support',NEW.id);
  IF TG_OP='INSERT' THEN
   PERFORM public.notice_emit('ticket:'||NEW.id,NEW.customer_id,false,false,'support_created','Support ticket opened','support_reply',ctx);
   PERFORM public.notice_emit('ticket:'||NEW.id,NULL,true,true,'support_created','New customer support ticket','support_reply',ctx);
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND pg_trigger_depth()=1 THEN
   PERFORM public.notice_emit('ticket:'||NEW.id||':'||NEW.status||':'||NEW.updated_at,NEW.customer_id,false,false,'support_status','Support status: '||NEW.status,'support_reply',ctx);
  END IF;
 ELSE
  SELECT * INTO t FROM public.tc42_support_threads WHERE id=NEW.thread_id;ctx:=jsonb_build_object('support',t.id);
  first_message:=(SELECT count(*)=1 FROM public.tc42_support_messages WHERE thread_id=t.id);
  UPDATE public.tc42_support_threads SET status=CASE WHEN NEW.sender_id=t.customer_id THEN 'waiting_support' ELSE 'waiting_customer' END,updated_at=clock_timestamp() WHERE id=t.id;
  IF first_message AND (NEW.client_key=t.client_key OR NEW.legacy_ticket_id=t.legacy_ticket_id) THEN RETURN NULL;END IF;
  IF NEW.sender_id=t.customer_id THEN PERFORM public.notice_emit('support-message:'||NEW.id,NULL,true,true,'support_reply','Customer replied to support','support_reply',ctx);
  ELSE PERFORM public.notice_emit('support-message:'||NEW.id,t.customer_id,false,false,'support_reply','Support replied to your ticket','support_reply',ctx);END IF;
 END IF;RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.communications_events() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER listing_notice AFTER INSERT OR UPDATE OF status ON public.market_listings FOR EACH ROW EXECUTE FUNCTION public.communications_events();
CREATE TRIGGER invoice_notice AFTER UPDATE OF state ON public.store_crypto_invoice FOR EACH ROW EXECUTE FUNCTION public.communications_events();
CREATE TRIGGER support_notice AFTER INSERT OR UPDATE OF status ON public.tc42_support_threads FOR EACH ROW EXECUTE FUNCTION public.communications_events();
CREATE TRIGGER support_message_notice AFTER INSERT ON public.tc42_support_messages FOR EACH ROW EXECUTE FUNCTION public.communications_events();
CREATE FUNCTION public.delivery_current(p_id bigint,p_lease uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('to',u.email,'language',p.language,'subscription',CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth)) END)
 FROM public.market_email_outbox j JOIN auth.users u ON u.id=j.user_id JOIN public.market_alert_preferences p ON p.user_id=u.id LEFT JOIN public.market_push_subscriptions s ON s.id=j.subscription_id
 WHERE j.id=p_id AND j.lease=p_lease AND j.state='processing' AND j.lease_until>now() AND public.delivery_allowed(j.id)
$$;
REVOKE ALL ON FUNCTION public.delivery_current(bigint,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.delivery_current(bigint,uuid) TO service_role;
REVOKE ALL ON SEQUENCE public.market_email_outbox_id_seq FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.delivery_attempts(p_before bigint DEFAULT NULL) RETURNS SETOF public.market_delivery_log LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN IF NOT public.phase1_is_admin() THEN RAISE EXCEPTION 'Admin only';END IF;RETURN QUERY SELECT * FROM public.market_delivery_log WHERE p_before IS NULL OR id<p_before ORDER BY id DESC LIMIT 100;END $$;
CREATE FUNCTION public.delivery_retry(p_id bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN IF NOT public.phase1_is_admin() THEN RAISE EXCEPTION 'Admin only';END IF;UPDATE public.market_email_outbox SET state='queued',attempts=0,next_attempt_at=now() WHERE id=p_id AND state='failed' AND provider_id IS NULL AND delivery_state IS NULL AND first_attempt_at>now()-interval '23 hours';IF NOT FOUND THEN RAISE EXCEPTION 'Reconcile provider before retrying';END IF;INSERT INTO public.market_delivery_log(job_id,stage) VALUES(p_id,'manual_retry');END $$;
REVOKE ALL ON FUNCTION public.delivery_attempts(bigint),public.delivery_retry(bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.delivery_attempts(bigint),public.delivery_retry(bigint) TO authenticated;
-- Supabase installations expose only explicitly published tables; polling remains a fallback.
DO $$ DECLARE t text; BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  FOREACH t IN ARRAY ARRAY['market_notifications','market_notification_reads'] LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t);END IF;
  END LOOP;
 END IF;
END $$;
COMMIT;
