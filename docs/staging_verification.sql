-- Read-only staging verification queries. Run in Supabase SQL editor with a privileged reviewer.
-- NEVER use this file to modify production.
select table_name, column_name, data_type from information_schema.columns
where table_schema='public' and table_name in ('blog_posts','products','product_media','product_specs')
order by table_name,ordinal_position;

select tablename,policyname,cmd,roles,qual,with_check
from pg_policies where schemaname='public' and tablename in ('blog_posts','product_media','product_specs')
order by tablename,cmd,policyname;

select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and relname in ('blog_posts','product_media','product_specs');

select proname,prosecdef,proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and proname in ('market_browse','market_send_message','market_set_pro','market_start_chat','market_submit','tc42_create_order');

-- Before production: test anon, customer and admin sessions with real JWTs.
-- Confirm anon cannot read drafts, edit posts, write media/specs, view pending listings,
-- or read other users' conversations. Confirm customer cannot promote to Pro.
-- Confirm only published articles and available products/media/specs are public.
