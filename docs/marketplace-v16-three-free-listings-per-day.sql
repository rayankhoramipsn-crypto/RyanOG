-- Marketplace V16: each non-Pro authenticated seller can submit up to
-- THREE listings per UTC calendar day (including pending or reviewed listings).
-- Preserve the existing signature, privilege model and serial per-seller lock.
-- The moderator review and mandatory uploaded-photo checks remain unchanged.
create or replace function public.market_submit(
  p_title text,
  p_platform text,
  p_description text,
  p_price numeric,
  p_image_url text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_id bigint;
  v_pro boolean;
  v_today_count integer;
begin
  if v_user is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;

  if char_length(trim(coalesce(p_title, ''))) not between 5 and 120
     or char_length(trim(coalesce(p_description, ''))) not between 20 and 3000
     or char_length(trim(coalesce(p_platform, ''))) not between 2 and 50
     or p_price is null or p_price < 1 or p_price > 1000000 then
    raise exception 'Invalid listing details' using errcode = '22023';
  end if;

  -- Prevent concurrent browser tabs from racing the same daily limit.
  perform pg_advisory_xact_lock(hashtext(v_user::text));
  select (is_pro and (pro_until is null or pro_until > now()))
  into v_pro
  from public.seller_profiles
  where user_id = v_user;

  if not coalesce(v_pro, false) then
    select count(*)::integer into v_today_count
    from public.market_listings
    where seller_id = v_user
      and submitted_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'
      and submitted_at < (date_trunc('day', now() at time zone 'utc') + interval '1 day') at time zone 'utc';

    if v_today_count >= 3 then
      raise exception 'Daily free listing limit reached (3 listings per UTC day)'
        using errcode = 'P0001';
    end if;
  end if;

  insert into public.market_listings
    (seller_id, title, platform, description, price, image_url)
  values
    (v_user, trim(p_title), trim(p_platform), trim(p_description), p_price,
     nullif(trim(coalesce(p_image_url, '')), ''))
  returning id into v_id;

  return v_id;
end
$function$;

-- Public cannot invoke the SECURITY DEFINER listing function anonymously.
revoke all on function public.market_submit(text,text,text,numeric,text) from public, anon;
grant execute on function public.market_submit(text,text,text,numeric,text) to authenticated, service_role;
