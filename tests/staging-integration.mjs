// Full staging public-schema snapshot, with synthetic data only.
// Default: embedded PostgreSQL + explicitly documented platform stand-ins.
// TRISO_INTEGRATION_CONFIG: a disposable local Supabase CLI status JSON file;
// this runs real Auth/JWT/REST workflows too. Never accepts a remote hostname.
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import {createStoreHandler} from '../supabase/functions/_shared/store-handler.mjs';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createHmac} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const local=process.env.TRISO_INTEGRATION_CONFIG?JSON.parse(await readFile(process.env.TRISO_INTEGRATION_CONFIG,'utf8')):null;
const loopback=url=>{if(!['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname))throw Error('Integration tests require a disposable loopback endpoint')};
if(local){loopback(local.DB_URL);loopback(local.API_URL)}
const dir=await mkdtemp(tmpdir()+'/triso-staging-');
const embedded=local?null:new EmbeddedPostgres({databaseDir:dir+'/db',port:Number(process.env.TRISO_TEST_DB_PORT||15441),user:'postgres',password:'test-only',persistent:false,onLog:()=>{},onError:()=>{}});
let db,count=0;const identities={};const names=['buyer','seller','other','admin','support'];
const one=async(c,sql,args=[])=>Object.values((await c.query(sql,args)).rows[0])[0];
async function check(name,fn){await fn();count++;console.log('PASS '+name)}
async function as(name,fn,claims={}){
 const c=local?new pg.Client({connectionString:local.DB_URL}):embedded.getPgClient();await c.connect();
 const u=identities[name],role=name==='service'?'service_role':name==='anon'?'anon':'authenticated';
 try{await c.query('BEGIN');await c.query('SET LOCAL ROLE '+role);await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({role,sub:u?.id,session_id:u?.session,app_metadata:u?.app_metadata||{},...claims})]);const r=await fn(c);await c.query('COMMIT');return r}
 catch(e){await c.query('ROLLBACK');throw e}finally{await c.end()}
}
async function api(path,{name='buyer',body,method=body===undefined?'GET':'POST',service=false}={}){
 const token=service?local.SERVICE_ROLE_KEY:identities[name]?.token||local.ANON_KEY;
 const r=await fetch(local.API_URL+path,{signal:AbortSignal.timeout(15000),method,headers:{apikey:local.ANON_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json().catch(()=>null);if(!r.ok)throw Object.assign(Error(data?.message||data?.msg||'HTTP '+r.status),{status:r.status});return data;
}
const rpc=(name,body,who='buyer')=>api('/rest/v1/rpc/'+name,{name:who,body});
const order=(who='buyer',id=1,key=crypto.randomUUID())=>as(who,c=>one(c,'select phase1_create_order($1,$2)',[JSON.stringify([{id,qty:1}]),key]));
const invoice=(o,who='buyer')=>as('service',c=>one(c,"select to_jsonb(phase1_issue_invoice($1,$2,'LTC',$3,100000,'mock',$4,now()+interval '20 minutes'))",[identities[who].id,o,'fixture-address-'+o,crypto.randomUUID()]));
try{
 if(embedded){await embedded.initialise();await embedded.start()}
 db=local?new pg.Client({connectionString:local.DB_URL}):embedded.getPgClient();await db.connect();
 if(local){
  const tableCount=await one(db,"select count(*)::int from pg_tables where schemaname='public'");
  assert.equal(tableCount,0,'Refusing to alter a nonempty local public schema');
  assert.equal(await one(db,'select count(*)::int from auth.users'),0,'Refusing to reuse local Auth users');
 }else await db.query(await readFile(new URL('./fixtures/staging-platform.sql',import.meta.url),'utf8'));
 await db.query(await readFile(new URL('./fixtures/staging-public.sql',import.meta.url),'utf8'));
 await db.query(await readFile(new URL('./fixtures/staging-storage.sql',import.meta.url),'utf8'));
 await db.query(await readFile(new URL('./fixtures/staging-realtime.sql',import.meta.url),'utf8'));
 const preflight=await readFile(new URL('../docs/release-preflight.sql',import.meta.url),'utf8');
 const fingerprintSql=preflight.slice(preflight.indexOf("SELECT 'columns'"),preflight.indexOf('SELECT count(*) AS public_tables_without_rls'));
 await mkdir('work',{recursive:true});await writeFile('work/phase6-schema-fingerprint.json',JSON.stringify((await db.query(fingerprintSql)).rows));
 await check('restore all 27 staging tables, 56 policies, real grants and triggers',async()=>{
  assert.equal(await one(db,"select count(*)::int from pg_tables where schemaname='public'"),27);
  assert.equal(await one(db,"select count(*)::int from pg_policies where schemaname='public'"),56);
 });
 for(const name of names){
  if(local){
   const password=crypto.randomUUID()+'aA1!';const email=name+'@integration.example.test';
   const created=await api('/auth/v1/admin/users',{service:true,body:{email,password,email_confirm:true,app_metadata:name==='admin'?{role:'admin'}:name==='support'?{role:'support'}:{}}});
   const session=await api('/auth/v1/token?grant_type=password',{body:{email,password}});
   const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString());
   identities[name]={id:created.id,session:claims.session_id,token:session.access_token,app_metadata:created.app_metadata};
  }else{
   const id=crypto.randomUUID(),session=crypto.randomUUID();const app_metadata=name==='admin'?{role:'admin'}:name==='support'?{role:'support'}:{};
   identities[name]={id,session,app_metadata};await db.query('insert into auth.users(id,raw_app_meta_data) values($1,$2)',[id,app_metadata]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,id]);
  }
 }
 if(local)await db.query("insert into storage.buckets(id,name,public) values('market-gallery','market-gallery',false)");
 await db.query("insert into support_tickets(user_id,subject,message) values($1,'Legacy ticket',$2)",[identities.buyer.id,'x'.repeat(3000)]);
 // Seed historical rows before migrating, verifying preservation afterward.
 const historic=await one(db,"insert into tc42_orders(customer_id,total_amount,items) values($1,8,'[{\"id\":1,\"qty\":1}]') returning id",[identities.buyer.id]);
 const history=await one(db,"insert into orders(user_id,total_amount) values($1,8) returning id",[identities.buyer.id]);
 await check('all six migrations roll back atomically without changing baseline history',async()=>{
  await db.query('begin');
  try{for(const file of ['20261108214609_phase1_checkout.sql','20261110201622_marketplace_browse_page.sql','20261110204751_staging_integration_authorization.sql','20261111181536_marketplace_workflows.sql','20261111185818_notifications_email_support.sql','20261111200640_storefront_content.sql']){const source=await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');await db.query(source.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,''))}assert(await one(db,"select exists(select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='description_fa')"))}finally{await db.query('rollback')}
  assert.equal(await one(db,"select count(*)::int from pg_tables where schemaname='public'"),27);assert.equal(await one(db,"select count(*)::int from pg_policies where schemaname='public'"),56);assert.equal(await one(db,'select total_amount from tc42_orders where id=$1',[historic]),'8.00');assert.equal(await one(db,"select to_regprocedure('public.triso_active_user()') is null"),true);
 });
 await check('apply all pending migrations without discarding historical orders',async()=>{
  for(const file of ['20261108214609_phase1_checkout.sql','20261110201622_marketplace_browse_page.sql','20261110204751_staging_integration_authorization.sql','20261111181536_marketplace_workflows.sql','20261111185818_notifications_email_support.sql','20261111200640_storefront_content.sql'])await db.query(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  assert.equal(await one(db,'select total_amount from tc42_orders where id=$1',[historic]),'8.00');assert.equal(await one(db,'select total_amount from orders where id=$1',[history]),'8.00');
 });
 await db.query("insert into products(id,title,price,stock,status) values(1,'Integration product',25.50,30,'available'),(2,'Last product',10,1,'available')");
 let o,listing,conversation,request,marketOrder;
 await check('null/empty/invalid carts are rejected and client legacy bypass is closed',async()=>{
  for(const cart of [null,[],{},[{id:1}], [{id:1,qty:0}]])await assert.rejects(as('buyer',c=>one(c,'select phase1_create_order($1,$2)',[cart===null?null:JSON.stringify(cart),crypto.randomUUID()])),/Invalid cart|Invalid quantity/);
  await assert.rejects(as('buyer',c=>one(c,"select tc42_create_order('[{\"id\":1,\"qty\":1}]')")),/permission denied/);
 });
 await check('server pricing, idempotency and buyer cross-account order isolation',async()=>{
  const key=crypto.randomUUID();o=await order('buyer',1,key);assert.equal(await order('buyer',1,key),o);
  assert.equal(await one(db,'select total_amount from tc42_orders where id=$1',[o]),'25.50');
  assert.equal(await as('other',c=>one(c,'select count(*)::int from tc42_orders where id=$1',[o])),0);
  await assert.rejects(as('other',c=>one(c,"select phase1_submit_claim($1,'BANK','forged')",[o])),/no rows/);
 });
 await check('three-per-day listing quota serializes simultaneous seller submissions',async()=>{
  const results=await Promise.allSettled(Array.from({length:5},()=>as('seller',c=>one(c,"select market_submit('Integration listing','Gaming Gear','A legitimate synthetic test listing description',12,null)"))));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,3);
  assert(results.filter(x=>x.status==='rejected').every(x=>/Daily free listing limit/.test(x.reason.message)));
  listing=results.find(x=>x.status==='fulfilled').value;
 });
 await check('seller cannot self-award Pro or approve a listing; admin photo gate is enforced',async()=>{
  await assert.rejects(as('seller',c=>c.query('insert into seller_profiles(user_id,is_pro) values($1,true)',[identities.seller.id])),/permission denied/);
  assert.equal((await as('seller',c=>c.query("update market_listings set status='approved' where id=$1",[listing]))).rowCount,0);
  await assert.rejects(as('admin',c=>c.query("update market_listings set status='approved' where id=$1",[listing])),/uploaded gallery photo/);
  const path=identities.seller.id+'/'+listing+'/'+crypto.randomUUID()+'.webp';
  await as('seller',c=>c.query("insert into storage.objects(bucket_id,name) values('market-gallery',$1)",[path]));
  await as('seller',c=>c.query('insert into market_listing_media(listing_id,seller_id,object_path,sort_order) values($1,$2,$3,0)',[listing,identities.seller.id,path]));
  assert.equal((await as('admin',c=>c.query("update market_listings set status='approved' where id=$1",[listing]))).rowCount,1);
 });
 await check('admin-controlled Pro and expired entitlements preserve the free quota',async()=>{
  await as('admin',c=>c.query('select market_set_pro($1,true)',[identities.seller.id]));
  await as('seller',c=>one(c,"select market_submit('Pro fixture listing','Gaming Gear','Synthetic Pro entitlement listing',12,null)"));
  await db.query("update seller_profiles set pro_until=now()-interval '1 second' where user_id=$1",[identities.seller.id]);
  await assert.rejects(as('seller',c=>one(c,"select market_submit('Expired Pro fixture','Gaming Gear','Synthetic expired Pro listing',12,null)")),/Daily free listing limit/);
 });
 await check('buyer/seller chat permissions and authorized read-only admin oversight',async()=>{
  conversation=await as('buyer',c=>one(c,'select market_start_chat($1)',[listing]));
  assert.equal(await as('buyer',c=>one(c,'select market_start_chat($1)',[listing])),conversation);
  await as('buyer',c=>one(c,"select market_send_message($1,'Buyer fixture message')",[conversation]));
  assert.equal(await as('seller',c=>one(c,'select count(*)::int from market_messages where conversation_id=$1',[conversation])),1);
  assert.equal(await as('other',c=>one(c,'select count(*)::int from market_messages where conversation_id=$1',[conversation])),0);
  assert.equal(await as('admin',c=>one(c,'select count(*)::int from market_messages where conversation_id=$1',[conversation])),1);
  for(const who of ['other','admin'])await assert.rejects(as(who,c=>one(c,"select market_send_message($1,'forged')",[conversation])),/Conversation unavailable/);
 });
 await check('inbox unread/read state cannot be changed by another account',async()=>{
  const inbox=await as('seller',c=>c.query('select * from market_inbox()'));assert.equal(inbox.rows[0].unread_count,'1');
  await assert.rejects(as('other',c=>c.query('select market_mark_read($1)',[conversation])),/Conversation unavailable/);
  await as('seller',c=>c.query('select market_mark_read($1)',[conversation]));assert.equal((await as('seller',c=>c.query('select * from market_inbox()'))).rows[0].unread_count,'0');
 });
 await check('marketplace bridge preserves seller visibility and hides buyer payment claims',async()=>{
  request=await as('buyer',c=>one(c,"select market_request_purchase($1,'LTC',null)",[listing]));
  marketOrder=await as('buyer',c=>one(c,'select phase1_market_order($1)',[request]));
  assert.equal(await as('seller',c=>one(c,'select count(*)::int from tc42_orders where id=$1',[marketOrder])),1);
  await as('buyer',c=>one(c,"select phase1_submit_claim($1,'BANK','unverified fixture receipt')",[marketOrder]));
  assert.equal(await as('seller',c=>one(c,'select count(*)::int from store_payment_claims where order_id=$1',[marketOrder])),0);
  await assert.rejects(as('other',c=>one(c,'select phase1_market_order($1)',[request])),/no rows/);
 });
 await check('last-item reservation race permits only one trusted invoice',async()=>{
  const orders=await Promise.all([order('buyer',2),order('other',2)]);
  const issued=await Promise.allSettled([invoice(orders[0]),invoice(orders[1],'other')]);
  assert.equal(issued.filter(x=>x.status==='fulfilled').length,1);assert.match(issued.find(x=>x.status==='rejected').reason.message,/Inventory unavailable/);
 });
 await check('buyers cannot issue or settle invoices; claims never self-confirm payment',async()=>{
  await assert.rejects(as('buyer',c=>c.query('select phase1_expire_invoices()')),/permission denied/);
  await as('buyer',c=>one(c,"select phase1_submit_claim($1,'BANK','manual fixture')",[o]));
  assert.equal(await one(db,'select status from tc42_orders where id=$1',[o]),'payment_submitted');
  await assert.rejects(as('buyer',c=>one(c,"select phase1_transition($1,'paid',null)",[o])),/not authorized/);
 });
 await check('trusted simulated verification and fulfillment use actual staging constraints',async()=>{
  const paid=await order(),inv=await invoice(paid),txid='a'.repeat(64);
  await as('buyer',c=>one(c,"select phase1_submit_claim($1,'LTC',$2)",[paid,txid]));
  const evidence={provider_invoice_id:inv.provider_invoice_id,chain:'mainnet',network:'LTC',address:inv.address,units:'100000',confirmations:6,double_spend:false,txid,seen_at:new Date(Date.parse(inv.issued_at)+100).toISOString()};
  const verify=(proof,event=crypto.randomUUID())=>as('service',c=>one(c,'select phase1_record_verification($1,$2,$3,$4)',[identities.buyer.id,paid,event,proof]));
  assert.equal(await verify({...evidence,units:'99999'}),'partial');
  assert.equal(await verify({...evidence,confirmations:5}),'pending_confirmations');
  const stock=await one(db,'select stock from products where id=1'),event=crypto.randomUUID();
  assert.deepEqual(await Promise.all([verify(evidence,event),verify(evidence,event)]),['paid','paid']);
  assert.equal(await one(db,'select stock from products where id=1'),stock-1);
  await assert.rejects(as('buyer',c=>one(c,"select phase1_transition($1,'fulfilled','forged')",[paid])),/not authorized/);
  await as('admin',c=>one(c,"select phase1_transition($1,'fulfilled','Synthetic delivery')",[paid]));
  assert.equal(await one(db,'select status from tc42_orders where id=$1',[paid]),'fulfilled');
 });
 await check('audit history is append-only for service workers despite Supabase default ACLs',async()=>{
  for(const table of ['store_order_events','store_provider_events']){
   for(const privilege of ['UPDATE','DELETE','TRUNCATE'])assert.equal(await one(db,'select has_table_privilege($1,$2,$3)',['service_role',table,privilege]),false);
  }
  await assert.rejects(as('service',c=>c.query('delete from store_order_events')),/permission denied/);
  assert.equal(await one(db,"select has_table_privilege('anon','orders','TRUNCATE')"),false);
 });
 await check('forged metadata and another user session cannot grant admin',async()=>{
  assert.equal(await as('other',c=>one(c,'select is_admin()'),{app_metadata:{role:'admin'},user_metadata:{role:'admin'}}),false);
  assert.equal(await as('other',c=>one(c,'select triso_active_user()'),{session_id:identities.admin.session}),false);
 });
 if(local){
  await db.query("notify pgrst,'reload schema'");
  await check('real local Auth buyer/seller/admin JWTs enforce REST and RPC isolation',async()=>{
   assert.equal(await rpc('is_admin',{},'admin'),true);assert.equal(await rpc('is_admin',{},'other'),false);
   assert.equal((await api('/rest/v1/tc42_orders?id=eq.'+o,{name:'other'})).length,0);
   assert.equal((await api('/rest/v1/tc42_orders?id=eq.'+marketOrder,{name:'seller'})).length,1);
   await assert.rejects(rpc('market_send_message',{p_conversation:conversation,p_body:'forged'},'other'));
   const id=await rpc('phase1_create_order',{p_items:[{id:1,qty:1,unit_price:0}],p_key:crypto.randomUUID()});
   assert.equal((await api('/rest/v1/tc42_orders?id=eq.'+id))[0].total_amount,25.5);
   await api('/auth/v1/user',{name:'other',method:'PUT',body:{data:{role:'admin'}}});assert.equal(await rpc('is_admin',{},'other'),false);
   const encoded=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
   const original=JSON.parse(Buffer.from(identities.buyer.token.split('.')[1],'base64url').toString());
   const unsigned=encoded({alg:'HS256',typ:'JWT'})+'.'+encoded({...original,iat:1,exp:2});
   const expired=unsigned+'.'+createHmac('sha256',local.JWT_SECRET).update(unsigned).digest('base64url');
   const denied=await fetch(local.API_URL+'/rest/v1/tc42_orders',{headers:{apikey:local.ANON_KEY,Authorization:'Bearer '+expired}});
   assert.equal(denied.status,401);assert.match((await denied.json()).message,/expired/i);
  });
  await check('same-project handler integrates real Auth and SQL with payments disabled',async()=>{
   const values={SUPABASE_URL:local.API_URL,SUPABASE_ANON_KEY:local.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:local.SERVICE_ROLE_KEY,STORE_CRYPTO_ENABLED:'true',STORE_CRYPTO_PILOT:'true'};
   const handler=createStoreHandler({env:name=>values[name]});
   const request=(body,token=identities.buyer.token)=>new Request(local.API_URL+'/functions/v1/store-crypto',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
   assert.equal((await (await handler(new Request(local.API_URL))).json()).enabled,false);
   const created=await handler(request({action:'order',items:[{id:1,qty:1}],key:crypto.randomUUID()}));assert.equal(created.status,200);
   const id=await created.json();assert.equal((await api('/rest/v1/tc42_orders?id=eq.'+id))[0].customer_id,identities.buyer.id);
   const disabled=await handler(request({action:'create',order_id:id,network:'LTC'}));assert.equal(disabled.status,503);assert.equal((await disabled.json()).error,'payment_provider_not_configured');
   assert([401,403].includes((await handler(request({action:'history'},'forged'))).status));
  });
 }
 await (await import('./marketplace-workflow-cases.mjs')).marketplaceCases({db,as,one,check,identities,local,api,rpc});
 await (await import('./communications-cases.mjs')).communicationsCases({db,as,one,check,identities,local,api,rpc});
 await (await import('./content-cases.mjs')).contentCases({db,as,one,check,identities,local});
 await check('expired, banned and deleted identities cannot retain private permissions',async()=>{
  await db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[identities.other.session]);
  assert.equal(await as('other',c=>one(c,'select triso_active_user()')),false);
  if(local)assert.equal(await rpc('triso_active_user',{},'other'),false);
  await db.query('update auth.sessions set not_after=null where id=$1',[identities.other.session]);
  await db.query("update auth.users set banned_until=now()+interval '1 day' where id=$1",[identities.other.id]);
  assert.equal(await as('other',c=>one(c,'select triso_active_user()')),false);
  await db.query('update auth.users set banned_until=null,deleted_at=now() where id=$1',[identities.other.id]);
  assert.equal(await as('other',c=>one(c,'select triso_active_user()')),false);
  await db.query('update auth.users set deleted_at=null where id=$1',[identities.other.id]);
 });
 await check('admin revocation takes effect with the same stale JWT claims',async()=>{
  assert.equal(await as('admin',c=>one(c,'select is_admin()')),true);
  await db.query("update auth.users set raw_app_meta_data='{}' where id=$1",[identities.admin.id]);
  assert.equal(await as('admin',c=>one(c,'select is_admin()')),false);
  await assert.rejects(as('admin',c=>c.query('select market_set_pro($1,true)',[identities.seller.id])),/Admin only/);
  if(local)assert.equal(await rpc('is_admin',{},'admin'),false);
 });
 await check('revoked session blocks private reads, writes and idempotent RPC fast paths',async()=>{
  await db.query('delete from auth.sessions where id=$1',[identities.buyer.session]);
  assert.equal(await as('buyer',c=>one(c,'select count(*)::int from tc42_orders')),0);
  for(const [sql,args] of [["select market_send_message($1,'revoked')",[conversation]],["select phase1_create_order($1,$2)",[JSON.stringify([{id:1,qty:1}]),crypto.randomUUID()]],["select phase1_market_order($1)",[request]],["select market_request_purchase($1,'LTC',null)",[listing]],["select phase1_submit_claim($1,'BANK','manual fixture')",[o]]])await assert.rejects(as('buyer',c=>c.query(sql,args)),/Active session/);
  if(local){assert.deepEqual(await api('/rest/v1/tc42_orders'),[]);await assert.rejects(rpc('market_send_message',{p_conversation:conversation,p_body:'revoked'}))}
 });
 await check('operational payment retirement blocks writes while preserving every historical row',async()=>{
  const tables=['products','tc42_orders','orders','market_listings','market_messages','tc42_support_threads','tc42_support_messages','store_order_events','store_payment_claims','store_crypto_invoice'];
  const countRows=async()=>{const rows=[];for(const t of tables)rows.push(await one(db,'select count(*)::int from '+t));return rows};const counts=await countRows();
  assert.equal(await one(db,"select has_function_privilege('authenticated','public.phase1_create_order(jsonb,uuid)','EXECUTE')"),true);
  await db.query(await readFile(new URL('../docs/phase1-retire.sql',import.meta.url),'utf8'));
  await assert.rejects(as('other',c=>c.query('select phase1_create_order($1,$2)',[JSON.stringify([{id:1,qty:1}]),crypto.randomUUID()])),/permission denied/);
  await assert.rejects(as('service',c=>c.query('select phase1_expire_invoices()')),/permission denied/);
  assert.deepEqual(await countRows(),counts);
  if(local)await assert.rejects(rpc('phase1_create_order',{p_items:[{id:1,qty:1}],p_key:crypto.randomUUID()},'other'),/permission denied/);
 });
 if(process.env.RUN_ADVISORS==='1'){
  await mkdir('work',{recursive:true});
  const advisorUrl=new URL(local?.DB_URL||'postgresql://postgres:test-only@127.0.0.1:15441/postgres');advisorUrl.searchParams.set('sslmode','disable');
  try{const r=await promisify(execFile)('node_modules/.bin/supabase',['db','advisors','--db-url',advisorUrl.href,'--type','security'],{timeout:30000,maxBuffer:1024*1024});await writeFile('work/staging-integration-advisors.log',r.stdout+r.stderr);console.log('Local advisors completed')}
  catch(e){await writeFile('work/staging-integration-advisors.log',(e.stdout||'')+(e.stderr||'')+e.message);throw Error('Local security advisors failed; see ignored work/staging-integration-advisors.log')}
 }
 console.log(`PASS ${count} full staging-schema scenarios (${local?'real local Supabase Auth/JWT/REST':'embedded PostgreSQL; platform stand-ins'})`);
}finally{if(db)await db.end();if(embedded)await embedded.stop().catch(()=>{});await rm(dir,{recursive:true,force:true})}
