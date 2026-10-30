// REAL staging integration runner. No fixtures, admin key, traces, or token logs.
// node tests/browser/blog-live.cjs [--preflight]
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {randomUUID}=require('node:crypto');
// Disable optional Playwright diagnostics before loading it: fill() carries passwords.
delete process.env.DEBUG;delete process.env.PWDEBUG;delete process.env.DEBUG_FILE;
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../..');
const API='https://cxtytbjvdlngahytfilr.supabase.co';
const NAMES=['TRISO_TEST_ADMIN_EMAIL','TRISO_TEST_ADMIN_PASSWORD','TRISO_TEST_USER_EMAIL','TRISO_TEST_USER_PASSWORD'];
const KEY=fs.readFileSync(path.join(ROOT,'blog/index.html'),'utf8').match(/KEY='(sb_publishable_[^']+)'/)?.[1];
const CASES=['admin_login','customer_login','separate_accounts_and_verified_roles','guest_editor_hidden','customer_editor_hidden','admin_create_draft_ui','admin_edit_same_id_ui','seed_four_publication_states',...['guest','customer'].flatMap(r=>['due_published_only','draft_hidden','archived_hidden','future_hidden','insert_denied','update_denied','delete_denied'].map(t=>r+'_'+t)),'duplicate_slug_rejected','admin_publish_ui','admin_archive_ui','real_refresh_and_save','cleanup_test_articles','logout_test_sessions'];
function ensure(value){if(!value)throw Error('Check failed');}
function launchOptions(env=process.env){
 const proxy=env.HTTPS_PROXY||env.https_proxy||env.HTTP_PROXY||env.http_proxy;
 const childEnv=Object.fromEntries(Object.entries(env).filter(([name])=>!NAMES.includes(name)&&!/^(DEBUG|DEBUG_FILE|PWDEBUG)$|SUPABASE.*(SECRET|SERVICE)/i.test(name)));
 return {env:childEnv,executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox'],...(proxy?{proxy:{server:proxy,bypass:'127.0.0.1,localhost'}}:{})};
}
function allowMutation(method,url,body,ids,prefix){
 if(!['POST','PATCH','DELETE'].includes(method))return false;
 const ownSlug=value=>typeof value==='string'&&value.startsWith(prefix+'-');
 if(method==='POST')return ownSlug(body?.slug);
 if(body?.slug&&!ownSlug(body.slug))return false;
 return ids.has(url.searchParams.get('id')?.replace(/^eq\./,''))||url.searchParams.get('slug')==='like.'+prefix+'*';
}
function server(){return http.createServer((req,res)=>{
 // Serve only application assets. Never expose work/, .git, tests, or secret files.
 const name=new URL(req.url,'http://localhost').pathname;
 const allowed=new Set(['/index.html','/blog/','/preview/index.html','/preview/blog/','/snowflake.png','/app.js','/preview/app.js']);
 if(req.method!=='GET'||!allowed.has(name)){res.writeHead(404).end();return;}
 const relative=name.endsWith('/')?name+'index.html':name;
 try{const content=fs.readFileSync(path.join(ROOT,relative.slice(1)));res.writeHead(200,{'Content-Type':name.endsWith('.png')?'image/png':name.endsWith('.js')?'text/javascript':'text/html'}).end(content)}catch{res.writeHead(404).end()}
});}
async function main(env=process.env){
 const preflight=process.argv.includes('--preflight');
 const results=CASES.map(name=>({name,status:'NOT_RUN'}));
 const mark=(name,status)=>{results.find(r=>r.name===name).status=status;};
 const missing=NAMES.filter(n=>!env[n]);
 if(!preflight&&missing.length){console.log(JSON.stringify({mode:'LIVE',blocked:'missing_secret_bindings',missing,results},null,2));return 2;}
 ensure(KEY&&API==='https://cxtytbjvdlngahytfilr.supabase.co');
 let browser,web;const contexts=[];let admin,customer,guest,origin;let cleanupNeeded=false;let failed=false;let blockedReason=null;
 const prefix='live-blog-'+randomUUID().replaceAll('-','');
 const ids=new Set();
 let active='startup';
 const step=async(name,fn)=>{active=name;try{await fn();mark(name,'PASS')}catch{mark(name,'FAIL');throw Error('Step failed')}};
 // Only browser memory holds sessions. Return blog data/status, never Auth payloads.
 const api=async(page,method,query='',body=null,ownAuthor=false)=>page.evaluate(async({url,key,method,query,body,ownAuthor})=>{
  const s=JSON.parse(sessionStorage.getItem('tc35_auth_session')||'null');
  if(ownAuthor)body={...body,author_id:s.user.id};
  const r=await fetch(url+'/rest/v1/blog_posts'+query,{method,signal:AbortSignal.timeout(15000),headers:{apikey:key,'Content-Type':'application/json',Prefer:'return=representation',...(s?.access_token?{Authorization:'Bearer '+s.access_token}:{})},...(body?{body:JSON.stringify(body)}:{})});
  let data=null;try{data=await r.json()}catch{}
  return {status:r.status,data};
 },{url:API,key:KEY,method,query,body,ownAuthor});
 const fixtureQuery='?slug=like.'+prefix+'*';
 const byId=id=>'?id=eq.'+encodeURIComponent(id);
 const rows=r=>{ensure(r.status===200&&Array.isArray(r.data));return r.data;};
 try{
  browser=await chromium.launch(launchOptions(env));
  const probe=await browser.newContext();contexts.push(probe);
  const p=await probe.newPage();
  // A real HTTPS request through the configured proxy, before using credentials.
  const response=await p.goto(API+'/auth/v1/health',{timeout:15000,waitUntil:'domcontentloaded'});
  ensure(response&&response.status()<500);
  if(preflight){console.log(JSON.stringify({mode:'PREFLIGHT',network:'REACHABLE',httpStatus:response.status(),missing,liveTests:'NOT_RUN'},null,2));return missing.length?2:0;}
  await probe.close();
  web=server();await new Promise((resolve,reject)=>{web.once('error',reject);web.listen(0,'127.0.0.1',resolve)});
  origin='http://127.0.0.1:'+web.address().port;
  const pageFor=async()=>{
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});contexts.push(context);
   // Routing only BLOCKS unrelated traffic. No fulfill(), API mocks, or response replacement.
   await context.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(u.origin===origin)return route.continue();
    if(u.origin!==API)return route.abort();
    if(u.pathname.startsWith('/auth/v1/')){
     if(!['/auth/v1/token','/auth/v1/user','/auth/v1/logout'].includes(u.pathname))return route.abort();
     return route.continue();
    }
    if(u.pathname!=='/rest/v1/blog_posts')return route.abort();
    if(['POST','PATCH','DELETE'].includes(req.method())){
     let body;try{body=req.postDataJSON()}catch{}
     if(!allowMutation(req.method(),u,body,ids,prefix))return route.abort();
    }
    return route.continue();
   });
   const page=await context.newPage();page.setDefaultTimeout(20000);return page;
  };
  admin=await pageFor();customer=await pageFor();guest=await pageFor();
  const login=async(page,email,password)=>{
   await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof window.tc31Email==='function');
   await page.evaluate(()=>showScreen('tc31-panel'));
   await page.locator('#tc31-email').fill(email);await page.locator('#tc31-password').fill(password);
   const response=page.waitForResponse(r=>r.url().startsWith(API+'/auth/v1/token?grant_type=password')&&r.request().method()==='POST');
   const [reply]=await Promise.all([response,page.locator('#tc31-guest').getByRole('button',{name:'Sign in',exact:true}).click()]);
   ensure(reply.status()===200);
   await page.waitForFunction(()=>!!JSON.parse(sessionStorage.getItem('tc35_auth_session')||'null')?.access_token);
   await page.goto(origin+'/blog/',{waitUntil:'domcontentloaded'});
  };
  await step('admin_login',()=>login(admin,env.TRISO_TEST_ADMIN_EMAIL,env.TRISO_TEST_ADMIN_PASSWORD));
  await step('customer_login',()=>login(customer,env.TRISO_TEST_USER_EMAIL,env.TRISO_TEST_USER_PASSWORD));
  const verified=page=>page.evaluate(async({url,key})=>{
   const s=JSON.parse(sessionStorage.getItem('tc35_auth_session'));const r=await fetch(url+'/auth/v1/user',{signal:AbortSignal.timeout(15000),headers:{apikey:key,Authorization:'Bearer '+s.access_token}});
   if(!r.ok)return null;const u=await r.json();return {id:u.id,admin:u.app_metadata?.role==='admin'};
  },{url:API,key:KEY});
  await step('separate_accounts_and_verified_roles',async()=>{const a=await verified(admin),u=await verified(customer);ensure(a?.admin&&!u?.admin&&u?.id&&a.id!==u.id)});
  await guest.goto(origin+'/blog/',{waitUntil:'domcontentloaded'});
  await step('guest_editor_hidden',async()=>{ensure(!await guest.locator('#admin').isVisible())});
  await step('customer_editor_hidden',async()=>{ensure(!await customer.locator('#admin').isVisible())});
  const save=async()=>{
   await admin.locator('#editor button[type=submit]').click();
   await admin.waitForFunction(()=>document.getElementById('message').textContent.includes('Saved successfully'));
  };
  let article;
  await step('admin_create_draft_ui',async()=>{
   await admin.locator('#admin').waitFor({state:'visible'});
   await admin.locator('#title').fill('Live test article');await admin.locator('#slug').fill(prefix+'-editor');await admin.locator('#body').fill('Original test body');
   cleanupNeeded=true;await save();article=await admin.locator('#post-id').inputValue();ensure(article);ids.add(article);
   const data=rows(await api(admin,'GET',byId(article)));ensure(data.length===1&&data[0].status==='draft');
  });
  await step('admin_edit_same_id_ui',async()=>{
   await admin.locator('#body').fill('ویرایش آزمایشی <script>not executable</script>');await save();
   ensure(await admin.locator('#post-id').inputValue()===article);const data=rows(await api(admin,'GET',fixtureQuery));ensure(data.length===1&&data[0].body.includes('ویرایش'));
  });
  const states={};
  await step('seed_four_publication_states',async()=>{
   for(const state of ['draft','archived','future','published']){
    const r=await api(admin,'POST','',{slug:prefix+'-'+state,title:'Live fixture '+state,body:'Owned test fixture',language:'en',status:state==='future'?'published':state,published_at:state==='future'?new Date(Date.now()+86400000).toISOString():state==='published'?new Date(Date.now()-60000).toISOString():null},true);
    ensure(r.status===201&&r.data?.length===1);states[state]=r.data[0].id;ids.add(states[state]);
   }
  });
  for(const [role,page] of [['guest',guest],['customer',customer]]){
   await step(role+'_due_published_only',async()=>{const data=rows(await api(page,'GET',fixtureQuery));ensure(data.length===1&&data[0].id===states.published)});
   for(const state of ['draft','archived','future'])await step(role+'_'+state+'_hidden',async()=>{ensure(rows(await api(page,'GET',byId(states[state]))).length===0)});
   await step(role+'_insert_denied',async()=>{
    const r=await api(page,'POST','',{slug:prefix+'-denied-'+role,title:'Denied creation',body:'Denied fixture',status:'draft'},role==='customer');ensure([401,403].includes(r.status));
   });
   await step(role+'_update_denied',async()=>{
    const r=await api(page,'PATCH',byId(states.published),{body:'Unauthorized update'});
    ensure([401,403].includes(r.status)||(r.status===200&&Array.isArray(r.data)&&r.data.length===0));ensure(rows(await api(admin,'GET',byId(states.published)))[0]?.body==='Owned test fixture');
   });
   await step(role+'_delete_denied',async()=>{
    const r=await api(page,'DELETE',byId(states.published));ensure([401,403].includes(r.status)||(r.status===200&&Array.isArray(r.data)&&r.data.length===0));ensure(rows(await api(admin,'GET',byId(states.published))).length===1);
   });
  }
  await step('duplicate_slug_rejected',async()=>{ensure((await api(admin,'POST','',{slug:prefix+'-editor',title:'Duplicate article',body:'Duplicate'},true)).status===409)});
  await step('admin_publish_ui',async()=>{await admin.locator('#status').selectOption('published');await save();const data=rows(await api(guest,'GET',byId(article)));ensure(data.length===1&&Date.parse(data[0].published_at)<=Date.now())});
  await step('admin_archive_ui',async()=>{await admin.locator('#status').selectOption('archived');await save();ensure(rows(await api(guest,'GET',byId(article))).length===0);ensure(rows(await api(admin,'GET',byId(article)))[0]?.status==='archived')});
  await step('real_refresh_and_save',async()=>{
   // Force the app expiry check; this does not claim cryptographic JWT expiry.
   await admin.clock.install();await admin.clock.setFixedTime(Date.now()+3700*1000);
   const refreshed=admin.waitForResponse(r=>r.url().startsWith(API+'/auth/v1/token?grant_type=refresh_token')&&r.request().method()==='POST');
   await admin.locator('#body').fill('Saved with genuinely refreshed session');const [reply]=await Promise.all([refreshed,save()]);ensure(reply.status()===200);
   ensure(rows(await api(admin,'GET',byId(article)))[0]?.body==='Saved with genuinely refreshed session');
  });
 }catch{
  failed=true;
  if(preflight)console.log(JSON.stringify({mode:'PREFLIGHT',network:'UNAVAILABLE',liveTests:'NOT_RUN'}));
  else if(!results.some(r=>r.status==='FAIL'))blockedReason=active==='startup'?'startup_or_network_unavailable':'runtime_error';
 }finally{
  if(!preflight){
   if(cleanupNeeded&&admin){
    try{
     // Discover even a committed POST whose response was lost. Prefix is per-run random.
     const existing=rows(await api(admin,'GET',fixtureQuery));for(const row of existing)ids.add(row.id);
     const r=await api(admin,'DELETE',fixtureQuery);ensure(r.status===200&&Array.isArray(r.data));ensure(rows(await api(admin,'GET',fixtureQuery)).length===0);mark('cleanup_test_articles','PASS');
    }catch{mark('cleanup_test_articles','FAIL');failed=true;}
   }
   let logoutOK=true,attempted=false;
   for(const page of [admin,customer].filter(Boolean)){
    try{
     const result=await page.evaluate(async({url,key})=>{
      const s=JSON.parse(sessionStorage.getItem('tc35_auth_session')||'null');if(!s?.access_token)return null;
      const r=await fetch(url+'/auth/v1/logout?scope=global',{method:'POST',signal:AbortSignal.timeout(15000),headers:{apikey:key,Authorization:'Bearer '+s.access_token}});sessionStorage.clear();return r.status;
     },{url:API,key:KEY});
     if(result!==null){attempted=true;if(result<200||result>=300)logoutOK=false}
    }catch{logoutOK=false}
   }
   if(attempted){mark('logout_test_sessions',logoutOK?'PASS':'FAIL');if(!logoutOK)failed=true}
  }
  for(const c of contexts)await c.close().catch(()=>{});
  if(browser)await browser.close().catch(()=>{});
  if(web)await new Promise(resolve=>web.close(resolve));
 }
 if(!preflight)console.log(JSON.stringify({mode:'LIVE',project:'cxtytbjvdlngahytfilr',...(blockedReason?{blocked:blockedReason}:{}),results,sqlSuite:'NOT_RUN_BY_THIS_RUNNER',actualJwtExpiry:'NOT_TESTED',...(cleanupNeeded?{cleanupPrefix:prefix}:{})},null,2));
 return failed?1:0;
}
if(require.main===module)main().then(code=>{process.exitCode=code}).catch(()=>{console.log(JSON.stringify({mode:'LIVE',blocked:'runner_initialization_failed',liveTests:'NOT_RUN'}));process.exitCode=1});
module.exports={NAMES,CASES,launchOptions,allowMutation,main};
