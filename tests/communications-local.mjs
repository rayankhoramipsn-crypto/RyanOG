// Explicit disposable local Supabase only; hosted URLs are refused.
import pg from 'pg';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {communicationsCases} from './communications-cases.mjs';import {createDeliveryWorker} from '../supabase/functions/_shared/delivery.mjs';
const local=JSON.parse(await readFile(process.env.TRISO_INTEGRATION_CONFIG,'utf8'));for(const url of [local.API_URL,local.DB_URL])assert(['127.0.0.1','localhost'].includes(new URL(url).hostname));
const db=new pg.Client({connectionString:local.DB_URL});await db.connect();const identities={};let count=0;
const one=async(c,sql,args=[])=>Object.values((await c.query(sql,args)).rows[0])[0];
async function api(path,{name='buyer',body,service=false}={}){const r=await fetch(local.API_URL+path,{method:body===undefined?'GET':'POST',headers:{apikey:local.ANON_KEY,Authorization:'Bearer '+(service?local.SERVICE_ROLE_KEY:identities[name]?.token||local.ANON_KEY),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const d=await r.json().catch(()=>null);if(!r.ok)throw Error(d?.message||d?.msg||'HTTP '+r.status);return d}
async function as(name,fn,extra={}){const c=new pg.Client({connectionString:local.DB_URL});await c.connect();const u=identities[name],role=name==='service'?'service_role':name==='anon'?'anon':'authenticated';try{await c.query('begin');await c.query('set local role '+role);await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:u?.id,session_id:u?.session,role,app_metadata:u?.app_metadata||{},...extra})]);const r=await fn(c);await c.query('commit');return r}catch(e){await c.query('rollback');throw e}finally{await c.end()}}
const check=async(name,fn)=>{await fn();count++;console.log('PASS '+name)},rpc=(name,body,who='buyer')=>api('/rest/v1/rpc/'+name,{name:who,body});
try{
 assert(await one(db,"select to_regprocedure('public.market_edit_listing(bigint,text,text,text,numeric)') is not null"));
 await db.query("update market_alert_preferences set email_enabled=false,push_enabled=false where user_id in(select id from auth.users where email like '%@integration.example.test')");
 for(const name of ['buyer','seller','other','admin','support']){const password=crypto.randomUUID()+'Aa1!',email=name+'-'+crypto.randomUUID()+'@integration.example.test',app_metadata=['admin','support'].includes(name)?{role:name}:{};const u=await api('/auth/v1/admin/users',{service:true,body:{email,password,email_confirm:true,app_metadata}}),s=await api('/auth/v1/token?grant_type=password',{body:{email,password}}),claims=JSON.parse(Buffer.from(s.access_token.split('.')[1],'base64url'));identities[name]={id:u.id,token:s.access_token,session:claims.session_id,app_metadata}}
 await db.query("insert into support_tickets(user_id,subject,message) values($1,'Legacy fixture',$2)",[identities.buyer.id,'x'.repeat(3000)]);
 if(!await one(db,"select to_regprocedure('public.support_create(text,text,uuid,uuid,boolean)') is not null"))await db.query(await readFile(new URL('../supabase/migrations/20261111185818_notifications_email_support.sql',import.meta.url),'utf8'));
 if(process.env.TRISO_REFRESH_DELIVERY==='1'){
  const source=await readFile(new URL('../supabase/migrations/20261111185818_notifications_email_support.sql',import.meta.url),'utf8');
  await db.query('alter table market_email_outbox add column if not exists event_key text;create unique index if not exists delivery_event_target_once on market_email_outbox(event_key,user_id,channel,subscription_id) nulls not distinct where event_key is not null');
  for(const match of source.matchAll(/CREATE(?: OR REPLACE)? FUNCTION public\.(delivery_[a-z]+|tc35_queue_opted_in_email|notification_page|push_register|communications_events)\([\s\S]*?\$\$;/g))await db.query(match[0].replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));
  await db.query('alter table market_notifications drop constraint market_notifications_kind_check');
  await db.query(source.match(/ALTER TABLE public[.]market_notifications ADD CONSTRAINT market_notifications_kind_check[^;]+;/)[0]);
  await db.query(source.match(/-- Supabase installations[\s\S]*?END \$\$;/)[0]);
  await db.query('drop trigger listing_notice on market_listings');
  await db.query(source.match(/CREATE TRIGGER listing_notice[^;]+;/)[0]);
  for(const line of source.split('\n').filter(l=>/^(REVOKE|GRANT).*FUNCTION.*delivery_/.test(l)))await db.query(line);
  await db.query('revoke all on function public.delivery_current(bigint,uuid) from public,anon,authenticated;grant execute on function public.delivery_current(bigint,uuid) to service_role');
 }
 // Retain previous synthetic runs, but do not deliver their pending fixture jobs.
 await db.query("update market_email_outbox set state='skipped',lease=null,lease_until=null where state in ('queued','processing')");
 await db.query("notify pgrst,'reload schema'");
 await communicationsCases({db,as,one,check,identities,local,api,rpc});
 await check('background email worker uses real leased SQL jobs with an intercepted provider, never live email',async()=>{
  await as('buyer',c=>c.query('update market_alert_preferences set email_enabled=true where user_id=$1',[identities.buyer.id]));await db.query("select notice_emit($1,$2,false,false,'support_reply','Support update','support_reply','{}')",['worker:'+crypto.randomUUID(),identities.buyer.id]);
  const values={SUPABASE_URL:local.API_URL,SUPABASE_SERVICE_ROLE_KEY:local.SERVICE_ROLE_KEY,DELIVERY_WORKER_SECRET:'s'.repeat(40),EMAIL_DELIVERY_ENABLED:'true',EMAIL_SENDER_VERIFIED:'true',RESEND_API_KEY:'test-intercepted-only'};let sends=0;
  const worker=createDeliveryWorker({env:n=>values[n],fetcher:async(url,options)=>{if(url==='https://api.resend.com/emails'){sends++;assert(options.headers['Idempotency-Key']);return Response.json({id:'mock-ack-'+crypto.randomUUID()})}assert.equal(new URL(url).origin,local.API_URL);return fetch(url,options)}});
  const result=await worker(new Request('https://worker.fixture/',{method:'POST',headers:{Authorization:'Bearer '+'s'.repeat(40)}}));assert.equal(result.status,200);assert(sends>0);
 });
 console.log('PASS '+count+' native communications scenarios; email provider intercepted, no hosted writes');
}finally{await db.end()}
