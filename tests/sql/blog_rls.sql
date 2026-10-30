-- STAGING ONLY: execute as one transaction against cxtytbjvdlngahytfilr.
-- These are PostgreSQL role/claim simulations, NOT signed JWT or Auth login tests.
-- All users, posts, and temp grants created here roll back, including on failure.
begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';
create temporary table blog_test_context (user_id uuid, prefix text) on commit drop;
insert into blog_test_context values (gen_random_uuid(), 'blog-rls-' || replace(gen_random_uuid()::text,'-',''));
create temporary table blog_test_results (test text, passed boolean) on commit drop;
grant select on blog_test_context to anon, authenticated;
grant insert, select on blog_test_results to anon, authenticated;
-- Disposable FK parent only; this does not create a usable Auth account/session.
insert into auth.users(id) select user_id from blog_test_context;
insert into public.blog_posts(slug,title,body,status,published_at,author_id,language)
select prefix || '-' || state, 'RLS test article', '<script>not executed</script>',
 case when state='future' then 'published' else state end,
 case when state='future' then now()+interval '1 day' when state='published' then now()-interval '1 day' else null end,
 user_id,'en'
from blog_test_context cross join (values ('draft'),('archived'),('future'),('published')) s(state);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$
declare n int; p text;
begin
 if current_user <> 'anon' then raise exception 'Role switch failed'; end if;
 select prefix into p from blog_test_context;
 select count(*) into n from public.blog_posts where slug like p||'-%';
 if n<>1 then raise exception 'Guest read isolation failed: %',n; end if;
 insert into blog_test_results values ('guest sees only due published fixture',true);
 begin
  insert into public.blog_posts(slug,title,body) values(p||'-anon','Guest write','body');
  raise exception 'Guest INSERT allowed';
 exception when insufficient_privilege then insert into blog_test_results values ('guest INSERT denied',true); end;
 begin
  update public.blog_posts set title='Guest changed' where slug like p||'-%';
  raise exception 'Guest UPDATE allowed';
 exception when insufficient_privilege then insert into blog_test_results values ('guest UPDATE denied',true); end;
 begin
  delete from public.blog_posts where slug like p||'-%';
  raise exception 'Guest DELETE allowed';
 exception when insufficient_privilege then insert into blog_test_results values ('guest DELETE denied',true); end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',user_id,'role','authenticated','app_metadata',jsonb_build_object('role','customer'),'user_metadata',jsonb_build_object('role','admin'))::text,true) from blog_test_context;
set local role authenticated;
do $$
declare n int; p text; u uuid;
begin
 if current_user <> 'authenticated' then raise exception 'Role switch failed'; end if;
 select prefix,user_id into p,u from blog_test_context;
 select count(*) into n from public.blog_posts where slug like p||'-%';
 if n<>1 then raise exception 'Customer read isolation failed: %',n; end if;
 insert into blog_test_results values ('customer with forged user_metadata sees only due published fixture',true);
 begin
  insert into public.blog_posts(slug,title,body,author_id) values(p||'-customer','Customer write','body',u);
  raise exception 'Customer INSERT allowed';
 exception when insufficient_privilege then insert into blog_test_results values ('customer INSERT denied despite user_metadata admin',true); end;
 update public.blog_posts set title='Customer changed' where slug like p||'-%';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Customer UPDATE allowed';end if;
 insert into blog_test_results values ('customer UPDATE affects zero rows',true);
 delete from public.blog_posts where slug like p||'-%';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Customer DELETE allowed';end if;
 insert into blog_test_results values ('customer DELETE affects zero rows',true);
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',user_id,'role','authenticated','app_metadata',jsonb_build_object('role','admin'),'user_metadata',jsonb_build_object('role','customer'))::text,true) from blog_test_context;
set local role authenticated;
do $$
declare n int; p text; u uuid; article uuid;
begin
 select prefix,user_id into p,u from blog_test_context;
 select count(*) into n from public.blog_posts where slug like p||'-%';
 if n<>4 then raise exception 'Admin cannot read all fixtures';end if;
 insert into blog_test_results values ('app_metadata admin reads all four states',true);
 insert into public.blog_posts(slug,title,body,author_id,language) values(p||'-admin','Admin created','متن <img src=x onerror=alert(1)>',u,'fa') returning id into article;
 insert into blog_test_results values ('admin creates draft',true);
 update public.blog_posts set body='Updated العربية',language='ar' where id=article;
 if not found then raise exception 'Admin edit failed';end if;
 insert into blog_test_results values ('admin edits draft and EN/FA/AR constraints permit valid languages',true);
 update public.blog_posts set status='published',published_at=now()-interval '1 second' where id=article;
 if not found then raise exception 'Admin publication failed';end if;
 insert into blog_test_results values ('admin publishes',true);
 update public.blog_posts set status='archived' where id=article;
 if not found then raise exception 'Admin archive failed';end if;
 insert into blog_test_results values ('admin archives',true);
 begin
  insert into public.blog_posts(slug,title,body,author_id) values(p||'-admin','Duplicate slug','body',u);
  raise exception 'Duplicate slug allowed';
 exception when unique_violation then insert into blog_test_results values ('duplicate slug rejected',true); end;
 begin
  update public.blog_posts set cover_image_url='http://invalid.example/image.png' where id=article;
  raise exception 'HTTP cover allowed';
 exception when check_violation then insert into blog_test_results values ('HTTP cover rejected by constraint',true); end;
 update public.blog_posts set cover_image_url='https://example.invalid/image.png' where id=article;
 insert into blog_test_results values ('HTTPS cover accepted (external availability untested)',true);
 begin
  update public.blog_posts set status='published',published_at=null where id=article;
  raise exception 'Published NULL date allowed';
 exception when check_violation then insert into blog_test_results values ('publication requires date',true); end;
 begin
  update public.blog_posts set language='xx' where id=article;
  raise exception 'Unsupported language allowed';
 exception when check_violation then insert into blog_test_results values ('invalid language rejected',true); end;
 delete from public.blog_posts where id=article;
 if not found then raise exception 'Admin deletion failed';end if;
 insert into blog_test_results values ('admin deletes own test article',true);
end $$;
reset role;
select jsonb_build_object('suite','blog RLS with simulated database roles/claims; not JWT E2E','checks',count(*),'passed',bool_and(passed),'results',jsonb_agg(test order by test)) as result from blog_test_results;
rollback;
