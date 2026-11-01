-- V27: make market_request_purchase idempotent for concurrent requests.
-- This migration does not enable payment collection, escrow, delivery or payouts.
-- Request rows remain review-only and are readable only through existing RLS.
CREATE OR REPLACE FUNCTION public.market_request_purchase(
  p_listing bigint,
  p_method text DEFAULT 'CONTACT_SUPPORT'::text,
  p_note text DEFAULT NULL::text
)
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
$function$;
