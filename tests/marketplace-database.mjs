// Isolated browse contract fixture, based on read-only staging metadata.
// Not a full staging clone; never connects to a live database.
import EmbeddedPostgres from 'embedded-postgres';
import {readFile,mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'triso-browse-'));
const pg=new EmbeddedPostgres({databaseDir:join(dir,'db'),user:'postgres',password:'test-only',port:15440,persistent:false,onLog:()=>{},onError:()=>{}});
const owner='00000000-0000-4000-8000-000000000001',pro='00000000-0000-4000-8000-000000000002';
let db,count=0;
async function check(name,fn){await fn();count++;console.log('PASS '+name)}
async function browse(role='anon',args={},user=''){
 const c=pg.getPgClient();await c.connect();
 try{
  await c.query('begin');await c.query('set local role '+role);
  await c.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);
  const values={p_offset:0,p_query:'',p_category:'all',p_sort:'new',p_min_price:null,p_max_price:null,p_listing:null,...args};
  const {rows}=await c.query('select market_browse_page($1,$2,$3,$4,$5,$6,$7) as page',Object.values(values));
  await c.query('commit');return rows[0].page;
 }finally{await c.end()}
}
try{
 await pg.initialise();await pg.start();db=pg.getPgClient();await db.connect();
 await db.query(`create role anon;create role authenticated;create role service_role;
 create schema auth;grant usage on schema auth,public to anon,authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table market_listings(id bigint primary key,seller_id uuid,title text,platform text,description text,price numeric,image_url text,status text,submitted_at timestamptz,decline_reason text);
 create table seller_profiles(user_id uuid primary key,is_pro boolean,pro_until timestamptz);
 alter table market_listings enable row level security;alter table seller_profiles enable row level security;
 grant select on market_listings to anon,authenticated;grant select on seller_profiles to authenticated;
 create policy browse on market_listings for select to anon,authenticated using(status='approved' or seller_id=auth.uid());
 create policy profile on seller_profiles for select to authenticated using(user_id=auth.uid());
 insert into market_listings select i,'${owner}', 'Listing '||i,case when i%2=0 then 'Gaming Gear' else 'Fortnite' end,'Searchable offer',i,null,'approved','2026-01-01',null from generate_series(1,241) i;
 insert into market_listings values(999,'${owner}','Private draft','Steam','not public',5,null,'pending',now(),'private note');
 insert into seller_profiles values('${pro}',true,now()+interval '1 day'),('${owner}',true,now()-interval '1 day');
 update market_listings set seller_id='${pro}' where id=1;`);
 await db.query(await readFile(new URL('../supabase/migrations/20261110201622_marketplace_browse_page.sql',import.meta.url),'utf8'));
 await check('all 241 approved listings are reachable without duplicates for visitor, buyer and owner',async()=>{
  for(const [role,user] of [['anon',''],['authenticated',pro],['authenticated',owner]]){
   const ids=[];let offset=0;
   for(;;){const page=await browse(role,{p_offset:offset},user);assert(page.items.length<=24);ids.push(...page.items.map(x=>x.id));if(!page.has_more)break;offset+=24}
   assert.equal(ids.length,241);assert.equal(new Set(ids).size,241);assert.equal(ids[0],1);assert.equal(ids[1],241);assert(!ids.includes(999));
  }
 });
 await check('server search finds older results and treats SQL and wildcard text literally',async()=>{
  assert.deepEqual((await browse('anon',{p_query:'Listing 200'})).items.map(x=>x.id),[200]);
  for(const q of ['%', '_', "' or true --"]){assert.deepEqual((await browse('anon',{p_query:q})).items,[])}
 });
 await check('category, price boundaries and price sorts apply before pagination',async()=>{
  assert.deepEqual((await browse('anon',{p_category:'gear',p_min_price:100,p_max_price:110,p_sort:'low'})).items.map(x=>x.id),[100,102,104,106,108,110]);
  assert.deepEqual((await browse('anon',{p_min_price:239,p_sort:'high'})).items.map(x=>x.id),[241,240,239]);
  assert.equal((await browse('anon',{p_min_price:100,p_max_price:100})).items[0].id,100);
 });
 await check('invalid and nonfinite filters are rejected',async()=>{
  for(const args of [{p_offset:-1},{p_offset:null},{p_query:'a'.repeat(201)},{p_query:null},{p_category:'unknown'},{p_sort:null},{p_min_price:-1},{p_min_price:20,p_max_price:10},{p_max_price:'NaN'},{p_max_price:'Infinity'}])await assert.rejects(browse('anon',args),/Invalid browse filters/);
 });
 await check('approved deep links work beyond first page; private owner drafts stay private',async()=>{
  assert.equal((await browse('anon',{p_listing:200})).items[0].id,200);
  assert.deepEqual((await browse('authenticated',{p_listing:999},owner)).items,[]);
 });
 await check('public output excludes private profile and moderation fields',async()=>{
  assert.deepEqual(Object.keys((await browse()).items[0]).sort(),['id','title','platform','description','price','image_url','is_pro','submitted_at'].sort());
  assert.equal((await db.query('select count(*)::int as n from seller_profiles')).rows[0].n,2);
  const c=pg.getPgClient();await c.connect();try{await c.query('set role anon');await assert.rejects(c.query('select * from seller_profiles'),/permission denied/)}finally{await c.end()}
 });
 await check('Pro priority expires; price sort stays authoritative and tie order stable',async()=>{
  assert.equal((await browse()).items[0].is_pro,true);
  assert.equal((await browse('anon',{p_sort:'low'})).items[0].id,1);
  await db.query("update seller_profiles set pro_until=now()-interval '1 second'");
  assert.equal((await browse()).items[0].id,241);assert((await browse()).items.every(x=>x.is_pro===false));
 });
 await check('explicit RPC grants and pinned search path; no PUBLIC execute',async()=>{
  const {rows}=await db.query("select proconfig,proacl::text as acl from pg_proc where proname='market_browse_page'");
  assert(rows[0].proconfig.includes('search_path=""'));assert(!rows[0].acl.includes('{=X/'));
  assert.equal((await db.query("select has_function_privilege('service_role','market_browse_page(integer,text,text,text,numeric,numeric,bigint)','execute') as allowed")).rows[0].allowed,false);
 });
 if(process.env.RUN_ADVISORS==='1'){
  await mkdir('work',{recursive:true});
  try{const r=await promisify(execFile)('node_modules/.bin/supabase',['db','advisors','--db-url','postgresql://postgres:test-only@127.0.0.1:15440/postgres?sslmode=disable','--type','security'],{timeout:30000,maxBuffer:1024*1024});await writeFile('work/marketplace-advisors.log',r.stdout+r.stderr);console.log('Advisors: see work/marketplace-advisors.log')}
  catch(e){await writeFile('work/marketplace-advisors.log',(e.stdout||'')+(e.stderr||'')+e.message);console.log('Advisors blocked: see work/marketplace-advisors.log')}
 }
 console.log(`PASS ${count} marketplace PostgreSQL scenarios`);
}finally{if(db)await db.end();await pg.stop().catch(()=>{});await rm(dir,{recursive:true,force:true})}
