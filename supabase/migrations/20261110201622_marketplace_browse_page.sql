-- Additive public browse API. Keep market_browse() for older clients.
-- SECURITY DEFINER is required to read private seller Pro entitlements; expose
-- only the same approved-listing fields as market_browse(), never seller IDs,
-- moderation notes or profile rows. No table grants or RLS policies change.
create or replace function public.market_browse_page(
  p_offset integer default 0,
  p_query text default '',
  p_category text default 'all',
  p_sort text default 'new',
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_listing bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if p_offset is null or p_offset < 0
     or p_query is null or char_length(p_query) > 200
     or p_category is null or p_category not in ('all','fortnite','roblox','steam','gear','other')
     or p_sort is null or p_sort not in ('new','low','high')
     or (p_min_price is not null and (p_min_price < 0 or p_min_price::text in ('NaN','Infinity','-Infinity')))
     or (p_max_price is not null and (p_max_price < 0 or p_max_price::text in ('NaN','Infinity','-Infinity')))
     or p_min_price > p_max_price then
    raise exception 'Invalid browse filters' using errcode = '22023';
  end if;
  with visible as (
    select l.id,l.title,l.platform,l.description,l.price,l.image_url,
      coalesce(p.is_pro and (p.pro_until is null or p.pro_until > now()),false) as is_pro,
      l.submitted_at,
      case
        when lower(concat_ws(' ',l.platform,l.title)) ~ 'fortnite|فورتنایت' then 'fortnite'
        when lower(concat_ws(' ',l.platform,l.title)) ~ 'roblox|روبلاکس' then 'roblox'
        when lower(concat_ws(' ',l.platform,l.title)) ~ 'steam|استیم' then 'steam'
        when lower(concat_ws(' ',l.platform,l.title)) ~ 'gear|mouse|keyboard|headset|controller|monitor|کیبورد|هدست|موس|تجهیز' then 'gear'
        else 'other'
      end as category
    from public.market_listings l
    left join public.seller_profiles p on p.user_id=l.seller_id
    where l.status='approved'
      and (p_listing is null or l.id=p_listing)
      and (p_min_price is null or l.price >= p_min_price)
      and (p_max_price is null or l.price <= p_max_price)
      -- Literal substring search, including % and _, matches the UI semantics.
      and strpos(lower(concat_ws(' ',l.platform,l.title,l.description)),lower(btrim(p_query))) > 0
  ), page as (
    select id,title,platform,description,price,image_url,is_pro,submitted_at,
      row_number() over (order by
        case when p_sort='low' then price end asc nulls last,
        case when p_sort='high' then price end desc nulls last,
        case when p_sort='new' then is_pro end desc,
        submitted_at desc nulls last,id desc) as position
    from visible
    where p_category='all' or category=p_category
    order by position
    limit 25 offset p_offset
  )
  select jsonb_build_object(
    'items',coalesce(jsonb_agg(to_jsonb(page)-'position' order by position)
      filter (where position <= p_offset::bigint+24),'[]'::jsonb),
    'has_more',count(*) > 24
  ) into v_result from page;
  return v_result;
end
$function$;
revoke all on function public.market_browse_page(integer,text,text,text,numeric,numeric,bigint) from public;
grant execute on function public.market_browse_page(integer,text,text,text,numeric,numeric,bigint) to anon,authenticated;

-- Bound the scan for default browsing without indexing moderation/private data.
create index if not exists market_listings_approved_browse_idx
  on public.market_listings(submitted_at desc,id desc) where status='approved';
