-- STAGING ONLY. Synthetic users/listings exist only inside this rolled-back transaction.
-- Run with an administrative SQL connection to cxtytbjvdlngahytfilr, never production.
begin;
create temporary table gallery_fixture as select gen_random_uuid() as owner_id,gen_random_uuid() as stranger_id;
grant select on gallery_fixture to anon,authenticated;
insert into auth.users(id,email) select owner_id,owner_id::text||'@example.invalid' from gallery_fixture
 union all select stranger_id,stranger_id::text||'@example.invalid' from gallery_fixture;
create temporary table gallery_listing(id bigint);
grant select on gallery_listing to anon,authenticated;
with inserted as (insert into public.market_listings(seller_id,title,platform,description,price,status)
 select owner_id,'Gallery RLS fixture','Test','Synthetic gallery policy verification only.',10,'pending' from gallery_fixture returning id)
 insert into gallery_listing select id from inserted;
select set_config('request.jwt.claims',json_build_object('sub',(select owner_id from gallery_fixture),'role','authenticated','app_metadata',json_build_object('role','customer'))::text,true);
set local role authenticated;
insert into public.market_listing_media(listing_id,seller_id,object_path,sort_order)
 select l.id,f.owner_id,f.owner_id::text||'/'||l.id||'/'||gen_random_uuid()||'.jpg',0 from gallery_fixture f cross join gallery_listing l;
do $$ begin if (select count(*) from public.market_listing_media where listing_id=(select id from gallery_listing))<>1 then raise exception 'Owner cannot read own pending gallery';end if;end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',(select stranger_id from gallery_fixture),'role','authenticated','app_metadata',json_build_object('role','customer'))::text,true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.market_listing_media where listing_id=(select id from gallery_listing)) then raise exception 'Stranger read pending gallery';end if;
 begin
  insert into public.market_listing_media(listing_id,seller_id,object_path,sort_order)
   select l.id,f.stranger_id,f.stranger_id::text||'/'||l.id||'/'||gen_random_uuid()||'.jpg',1 from gallery_fixture f cross join gallery_listing l;
  raise exception 'Stranger inserted media into another listing';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ begin if exists(select 1 from public.market_listing_media where listing_id=(select id from gallery_listing)) then raise exception 'Anonymous read pending gallery';end if;
end $$;
reset role;
update public.market_listings set status='approved' where id=(select id from gallery_listing);
set local role anon;
do $$ begin if (select count(*) from public.market_listing_media where listing_id=(select id from gallery_listing))<>1 then raise exception 'Anonymous cannot read approved gallery';end if;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',(select owner_id from gallery_fixture),'role','authenticated','app_metadata',json_build_object('role','customer'))::text,true);
set local role authenticated;
do $$ begin
 begin
  insert into public.market_listing_media(listing_id,seller_id,object_path,sort_order)
   select l.id,f.owner_id,f.owner_id::text||'/'||l.id||'/'||gen_random_uuid()||'.jpg',1 from gallery_fixture f cross join gallery_listing l;
  raise exception 'Owner changed gallery after moderation';
 exception when insufficient_privilege then null; end;
 delete from public.market_listing_media where listing_id=(select id from gallery_listing);
 if (select count(*) from public.market_listing_media where listing_id=(select id from gallery_listing))<>1 then raise exception 'Owner deleted approved gallery';end if;
end $$;
reset role;
rollback;
select 'PASS: owner, stranger, anonymous and post-moderation gallery policies; fixtures rolled back' as result;
