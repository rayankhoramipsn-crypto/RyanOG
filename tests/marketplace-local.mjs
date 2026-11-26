// Explicitly selected, already-created disposable local Supabase instance only.
import pg from 'pg';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {marketplaceCases} from './marketplace-workflow-cases.mjs';
if(!process.env.TRISO_INTEGRATION_CONFIG)throw Error('Select a disposable local Supabase config');
const local=JSON.parse(await readFile(process.env.TRISO_INTEGRATION_CONFIG,'utf8'));
for(const url of [local.API_URL,local.DB_URL])assert(['127.0.0.1','localhost'].includes(new URL(url).hostname));
const db=new pg.Client({connectionString:local.DB_URL});await db.connect();const identities={};let count=0;
const one=async(c,s,a=[])=>Object.values((await c.query(s,a)).rows[0])[0];
async function api(path,{name='buyer',body,service=false}={}){const r=await fetch(local.API_URL+path,{method:body===undefined?'GET':'POST',headers:{apikey:local.ANON_KEY,Authorization:'Bearer '+(service?local.SERVICE_ROLE_KEY:identities[name]?.token||local.ANON_KEY),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const d=await r.json().catch(()=>null);if(!r.ok)throw Error(d?.message||d?.msg||'HTTP '+r.status);return d}
async function as(name,fn){const c=new pg.Client({connectionString:local.DB_URL});await c.connect();const u=identities[name],role=name==='anon'?'anon':name==='service'?'service_role':'authenticated';try{await c.query('begin');await c.query('set local role '+role);await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:u?.id,session_id:u?.session,role,app_metadata:u?.app_metadata||{}})]);const r=await fn(c);await c.query('commit');return r}catch(e){await c.query('rollback');throw e}finally{await c.end()}}
try{
 assert(await one(db,"select to_regprocedure('public.triso_active_user()') is not null"),'Expected the isolated prior milestone schema');
 if(!await one(db,"select to_regprocedure('public.market_edit_listing(bigint,text,text,text,numeric)') is not null"))await db.query(await readFile(new URL('../supabase/migrations/20261111181536_marketplace_workflows.sql',import.meta.url),'utf8'));
 if(!await one(db,"select to_regprocedure('public.market_sync_terminal_request()') is not null")){const sql=await readFile(new URL('../supabase/migrations/20261111181536_marketplace_workflows.sql',import.meta.url),'utf8');await db.query(sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.market_set_pro_until')))}
 for(const name of ['buyer','seller','other','admin']){const password=crypto.randomUUID()+'aA1!',email=name+'-'+crypto.randomUUID()+'@integration.example.test';const app_metadata=name==='admin'?{role:'admin'}:{};const u=await api('/auth/v1/admin/users',{service:true,body:{email,password,email_confirm:true,app_metadata}});const s=await api('/auth/v1/token?grant_type=password',{body:{email,password}});const claims=JSON.parse(Buffer.from(s.access_token.split('.')[1],'base64url'));identities[name]={id:u.id,token:s.access_token,session:claims.session_id,app_metadata}}
 await marketplaceCases({db,as,one,identities,local,api,rpc:(name,args,who='buyer')=>api('/rest/v1/rpc/'+name,{name:who,body:args}),check:async(name,fn)=>{await fn();count++;console.log('PASS '+name)}});
 console.log('PASS '+count+' native local marketplace/Storage scenarios; no hosted writes');
}finally{await db.end()}
