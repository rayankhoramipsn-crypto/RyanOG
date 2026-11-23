-- Review only. No order/invoice writes, provider activation or seller-payout changes.
-- Requires Phase 1 checkout + staging integration active-session guard.
BEGIN;
CREATE FUNCTION public.market_checkout_quote(p_order uuid,p_method text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE o public.tc42_orders; l public.market_listings; item numeric; discount numeric; commission numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT public.triso_active_user() THEN
  RAISE EXCEPTION 'Active session required' USING ERRCODE='28000';
 END IF;
 IF p_method IS NULL OR p_method NOT IN ('crypto','paypal') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
 SELECT * INTO o FROM public.tc42_orders WHERE id=p_order AND customer_id=auth.uid();
 IF NOT FOUND OR o.market_request_id IS NULL OR o.seller_id IS NULL OR o.seller_id=auth.uid()
  OR o.currency IS DISTINCT FROM 'USD' OR o.status IS DISTINCT FROM 'awaiting_payment' THEN
  RAISE EXCEPTION 'Checkout unavailable';
 END IF;
 SELECT * INTO l FROM public.market_listings WHERE id=o.listing_id AND status='approved' AND seller_id=o.seller_id;
 IF NOT FOUND OR l.price IS NULL OR l.price::numeric<=0 OR l.price::numeric>9999999999.99 THEN RAISE EXCEPTION 'Listing unavailable'; END IF;
 item:=round(l.price::numeric,2);
 IF item<=0 THEN RAISE EXCEPTION 'Listing unavailable'; END IF;
 IF jsonb_typeof(o.items) IS DISTINCT FROM 'array' OR jsonb_array_length(o.items)<>1
  OR (o.items->0->>'qty') IS DISTINCT FROM '1'
  OR (o.items->0->>'listing_id') IS DISTINCT FROM l.id::text
  OR (o.items->0->>'unit_price') IS NULL
  OR round((o.items->0->>'unit_price')::numeric,2) IS DISTINCT FROM item
  OR o.total_amount IS DISTINCT FROM item THEN RAISE EXCEPTION 'Listing price changed; return to listing'; END IF;
 -- Current canonical marketplace orders have no buyer fee. Seller commission is separate.
 discount:=CASE WHEN p_method='crypto' THEN round(item*0.10,2) ELSE 0 END;
 commission:=o.commission_usd;
 RETURN jsonb_build_object('order_id',o.id,'listing_id',l.id,'method',p_method,'policy','market-crypto-10-v1',
  'item_cents',(item*100)::bigint::text,'fee_cents','0','discount_cents',(discount*100)::bigint::text,
  'total_cents',((item-discount)*100)::bigint::text,'payable',false,'settlement_enabled',false,
  'funding_approved',false,'promotion_funder','platform',
  'seller_entitlement_cents',((item-commission)*100)::bigint::text,
  'platform_net_before_provider_costs_cents',((commission-discount)*100)::bigint::text);
END $$;
REVOKE ALL ON FUNCTION public.market_checkout_quote(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.market_checkout_quote(uuid,text) TO authenticated;
COMMENT ON FUNCTION public.market_checkout_quote(uuid,text) IS 'Nonpayable review quote. Crypto promotion is platform funded, subject to funding approval. No invoice/settlement integration.';
COMMIT;
