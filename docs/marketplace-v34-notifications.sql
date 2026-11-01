-- TRISOCMD V34: private in-site notifications, no payment verification or funds movement.
CREATE TABLE IF NOT EXISTS public.market_notifications (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
 for_admin boolean NOT NULL DEFAULT false,
 kind text NOT NULL CHECK (kind IN ('purchase_requested','purchase_updated','message')),
 title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 150),
 listing_id bigint,
 request_id uuid,
 conversation_id bigint,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT tc34_target CHECK (
   (recipient_id IS NOT NULL AND for_admin = false)
   OR (recipient_id IS NULL AND for_admin = true)
 )
);
CREATE INDEX IF NOT EXISTS market_notifications_recipient_idx ON public.market_notifications(recipient_id,id DESC);
CREATE INDEX IF NOT EXISTS market_notifications_admin_idx ON public.market_notifications(id DESC) WHERE for_admin;
ALTER TABLE public.market_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS market_notifications_read ON public.market_notifications;
CREATE POLICY market_notifications_read ON public.market_notifications FOR SELECT
 TO authenticated USING (
  recipient_id = (SELECT auth.uid()) OR
  (for_admin AND (SELECT public.is_admin()))
 );
REVOKE ALL ON TABLE public.market_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.market_notifications TO authenticated;
REVOKE ALL ON SEQUENCE public.market_notifications_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tc34_notify_purchase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
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
END $$;
REVOKE ALL ON FUNCTION public.tc34_notify_purchase() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS tc34_purchase_notice ON public.market_purchase_requests;
CREATE TRIGGER tc34_purchase_notice
AFTER INSERT OR UPDATE OF status ON public.market_purchase_requests
FOR EACH ROW EXECUTE FUNCTION public.tc34_notify_purchase();

CREATE OR REPLACE FUNCTION public.tc34_notify_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_buyer uuid; v_seller uuid;
BEGIN
 SELECT buyer_id,seller_id INTO v_buyer,v_seller
 FROM public.market_conversations WHERE id=NEW.conversation_id;
 IF v_buyer IS NULL OR v_seller IS NULL THEN RETURN NULL; END IF;
 INSERT INTO public.market_notifications(recipient_id,kind,title,conversation_id)
 VALUES (CASE WHEN NEW.sender_id=v_buyer THEN v_seller ELSE v_buyer END,
         'message','New marketplace message',NEW.conversation_id);
 INSERT INTO public.market_notifications(for_admin,kind,title,conversation_id)
 VALUES (true,'message','New marketplace conversation message',NEW.conversation_id);
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.tc34_notify_message() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS tc34_message_notice ON public.market_messages;
CREATE TRIGGER tc34_message_notice
AFTER INSERT ON public.market_messages
FOR EACH ROW EXECUTE FUNCTION public.tc34_notify_message();
