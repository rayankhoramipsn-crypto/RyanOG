-- STAGING ONLY. All synthetic fixtures and aggregate changes are rolled back.
begin;
create temporary table commerce_fixture(owner_id uuid,stranger_id uuid,product_id bigint,listing_id bigint);
grant select on commerce_fixture to anon,authenticated;
insert into commerce_fixture(owner_id,stranger_id) values(gen_random_uuid(),gen_random_uuid());
insert into auth.users(id,email) select owner_id,owner_id::text||'@example.invalid' from commerce_fixture
 union all select stranger_id,stranger_id::text||'@example.invalid' from commerce_fixture;
with p as (insert into public.products(title,price,status,stock) values('Commerce RLS fixture',10,'available',10) returning id)
 update commerce_fixture set product_id=(select id from p);
with l as (insert into public.market_listings(seller_id,title,platform,description,price,status)
 select owner_id,'Commerce profile fixture','Test','Synthetic opt-in public seller policy verification.',10,'pending' from commerce_fixture returning id)
 update commerce_fixture set listing_id=(select id from l);
select set_config('request.jwt.claims',json_build_object('sub',(select owner_id from commerce_fixture),'role','authenticated','app_metadata',json_build_object('role','customer'))::text,true);
set local role authenticated;
insert into public.market_seller_public_profiles(user_id,display_name,is_public)
 select owner_id,'Fixture public seller',false from commerce_fixture;
do $$ begin
 begin perform public.refresh_product_sales_snapshots();raise exception 'Customer refreshed privileged sales statistics';exception when insufficient_privilege then null;end;
 begin insert into public.product_merchandising(product_id,featured) select product_id,true from commerce_fixture;raise exception 'Customer wrote merchandising';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ begin if exists(select 1 from public.market_seller_public_profiles where user_id=(select owner_id from commerce_fixture)) then raise exception 'Unpublished seller profile leaked';end if;end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',(select owner_id from commerce_fixture),'role','authenticated','app_metadata',json_build_object('role','customer'))::text,true);
set local role authenticated;
update public.market_seller_public_profiles set is_public=true where user_id=(select owner_id from commerce_fixture);
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ begin if exists(select 1 from public.market_seller_public_profiles where user_id=(select owner_id from commerce_fixture)) then raise exception 'Unapproved seller profile leaked';end if;end $$;
reset role;
update public.market_listings set status='approved' where id=(select listing_id from commerce_fixture);
set local role anon;
do $$ begin if not exists(select 1 from public.market_seller_public_profiles where user_id=(select owner_id from commerce_fixture)) then raise exception 'Opt-in approved seller not visible';end if;end $$;
reset role;
insert into public.tc42_orders(customer_id,total_amount,items,status)
 select owner_id,20,jsonb_build_array(jsonb_build_object('id',product_id,'title','Commerce RLS fixture','qty',2,'unit_price',10)),'paid' from commerce_fixture;
insert into public.tc42_orders(customer_id,total_amount,items,status)
 select owner_id,990,jsonb_build_array(jsonb_build_object('id',product_id,'title','Commerce RLS fixture','qty',99,'unit_price',10)),'awaiting_payment' from commerce_fixture;
select set_config('request.jwt.claims',json_build_object('sub',(select owner_id from commerce_fixture),'role','authenticated','app_metadata',json_build_object('role','admin'))::text,true);
set local role authenticated;
select public.refresh_product_sales_snapshots();
do $$ begin if (select units_sold from public.product_sales_snapshots where product_id=(select product_id from commerce_fixture))<>2 then raise exception 'Sales statistics included unpaid orders or omitted paid orders';end if;end $$;
reset role;
rollback;
select 'PASS: seller opt-in/approval privacy, customer merchandising denial, admin-only sales refresh and paid-only aggregation; all fixtures rolled back' as result;
