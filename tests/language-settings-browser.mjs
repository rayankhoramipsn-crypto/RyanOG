// Isolated API fixtures; actual page navigation, persistent browser profile and rendered UI.
import{chromium}from'playwright';import assert from'node:assert/strict';import{mkdir,mkdtemp,rm,readFile}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';
const base='http://127.0.0.1:8765',api='https://cxtytbjvdlngahytfilr.supabase.co',a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'},out='work/language-settings';
const launch={executablePath:process.env.TRISO_CHROMIUM_PATH||undefined,args:['--no-sandbox']};await mkdir(out,{recursive:true});let cases=0;
async function mocks(context){
 const user=id=>({id,email:id===a?'player@example.test':'second@example.test',created_at:'2025-01-21T12:00:00Z',app_metadata:{provider:'google',role:'user'},user_metadata:{display_name:id===a?'Staging Player':'Second Player'}}),s={profiles:{[a]:user(a),[b]:user(b)},saves:0,orders:0,saveStatus:200,saveGate:null,notices:'empty'};
 await context.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());if(u.origin===base)return route.continue();if(u.origin!==api)return route.abort();if(r.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});const owner=r.headers().authorization==='Bearer synthetic-b'?b:a;let body=[];
  if(u.pathname==='/auth/v1/token'){const id=r.postDataJSON().email?.startsWith('second')?b:a;body={access_token:id===a?'synthetic-a':'synthetic-b',refresh_token:'synthetic-refresh',expires_in:3600,user:s.profiles[id]}}
  if(u.pathname==='/auth/v1/user'){
   body=s.profiles[owner];if(r.method()==='PUT'){s.saves++;const data=r.postDataJSON();assert.deepEqual(Object.keys(data),['data']);assert.deepEqual(Object.keys(data.data),['display_name']);const captured={...body,user_metadata:{...body.user_metadata,display_name:data.data.display_name}};if(s.saveGate){const gate=s.saveGate;s.saveGate=null;await gate}if(s.saveStatus!==200)return route.fulfill({status:s.saveStatus,headers:cors,contentType:'application/json',body:'{"error_code":"forbidden"}'});s.profiles[owner]=captured;body=captured}
  }
  if(u.pathname.endsWith('/rpc/is_admin')||u.pathname.endsWith('/rpc/support_is_staff'))body=false;
  if(u.pathname.endsWith('/tc42_orders')){s.orders++;body=[]}
  if(u.pathname.endsWith('/rpc/notification_page')){if(s.notices==='error')return route.fulfill({status:503,headers:cors,body:'{}'});body={items:s.notices==='empty'?[]:[{id:1,title:'Authorized synthetic account update',created_at:'2026-11-23T00:00:00Z'}],unread:s.notices==='empty'?0:1,last_read_id:0}}
  if(u.pathname.endsWith('/rpc/market_browse_page'))body={items:[],has_more:false};
  if(u.pathname.endsWith('/products'))body=[{id:1,title:'Synthetic keyboard',description:'Product',description_fa:'محصول',description_ar:'منتج',price:25,stock:5,status:'available',category:'Gear'}];
  if(u.pathname.endsWith('/blog_posts'))body=[{id:'post1',title:'Synthetic guide',slug:'guide',body:'Article',excerpt:'Guide',language:'en',category:'Guides',status:'published',published_at:'2020-01-01T00:00:00Z'}];
  if(u.pathname==='/auth/v1/settings')body={external:{google:true}};
  if(u.pathname==='/auth/v1/authorize')return route.fulfill({status:302,headers:{location:u.searchParams.get('redirect_to')+'?code=synthetic-oauth&lang=en'}});
  if(u.pathname==='/functions/v1/store-crypto')body={enabled:false,paypal_enabled:false};
  return route.fulfill({status:200,headers:cors,contentType:'application/json',body:JSON.stringify(body)});
 });return s;
}
const browser=await chromium.launch(launch);
try{
 const context=await browser.newContext();await mocks(context);const p=await context.newPage(),errors=[];p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{window.languageFlicker=false;let frames=0;const check=()=>{const s=document.getElementById('lang-screen');if(window.TrisoLanguage?.has()&&s&&s.classList.contains('active')&&!document.documentElement.hasAttribute('data-language-picker')&&getComputedStyle(s).display!=='none')window.languageFlicker=true;if(frames++<45)requestAnimationFrame(check)};requestAnimationFrame(check)});
 await p.goto(base+'/index.html');await p.waitForFunction(()=>window.tcPhase1BootstrapComplete);assert.equal(await p.locator('#lang-screen').isVisible(),true);await p.locator('#lang-screen button').filter({hasText:'فارسی'}).click();assert.equal(await p.evaluate(()=>localStorage.getItem('triso_language')),'fa');await p.reload();await p.waitForFunction(()=>window.tcPhase1BootstrapComplete);assert.equal(await p.locator('#lang-screen').isVisible(),false);assert.equal(await p.evaluate(()=>document.documentElement.dir),'rtl');assert.equal(await p.evaluate(()=>window.languageFlicker),false);cases++;
 await p.evaluate(()=>{const a=document.createElement('a');a.id='stale-language-link';a.href='/marketplace.html?lang=en';a.textContent='test link';document.body.append(a)});await p.locator('#stale-language-link').evaluate(el=>el.click());await p.waitForFunction(()=>document.getElementById('language')?.value==='fa');assert.equal(new URL(p.url()).searchParams.has('lang'),false);await p.locator('#language').selectOption('ar');assert.equal(await p.evaluate(()=>TrisoLanguage.get()),'ar');cases++;
 for(const path of ['/blog/','/product.html?id=1','/help/','/policies/','/videos/','/404.html','/preview/index.html','/preview/marketplace.html','/preview/blog/']){await p.goto(base+path);await p.waitForFunction(()=>document.documentElement.lang==='ar'&&document.documentElement.dir==='rtl');assert.equal(await p.evaluate(()=>TrisoLanguage.get()),'ar');if(await p.locator('#lang-screen').count())assert.equal(await p.locator('#lang-screen').isVisible(),false);cases++}
 await p.goto(base+'/blog/?lang=fa');assert.equal(await p.evaluate(()=>TrisoLanguage.get()),'fa');assert.equal(new URL(p.url()).searchParams.has('lang'),false);await p.locator('[data-content-aria=Language]').selectOption('ar');await p.reload();assert.equal(await p.evaluate(()=>TrisoLanguage.get()),'ar');cases++;
 await p.goto(base+'/index.html');await p.waitForFunction(()=>window.tcPhase1BootstrapComplete);await p.goto(base+'/marketplace.html');await p.locator('#language').selectOption('en');await p.goBack();await p.waitForFunction(()=>document.documentElement.lang==='en');assert.equal(await p.locator('#lang-screen').isVisible(),false);await p.goForward();await p.waitForFunction(()=>document.getElementById('language')?.value==='en');cases++;
 // Google itself is mocked. The real callback consumes PKCE and keeps the newer stored language.
 await p.goto(base+'/index.html');await p.waitForFunction(()=>!!window.TrisoAuthOAuth&&window.tcPhase1BootstrapComplete);await p.evaluate(()=>{TrisoAuthUI.language('ar');tc31CallbackMode('signin')});await p.locator('#tc31-login-form .tc-auth-google').click();await p.waitForFunction(()=>document.getElementById('tc31-panel')?.dataset.authMode==='account');assert.equal(await p.evaluate(()=>TrisoLanguage.get()),'ar');assert.equal(await p.evaluate(()=>document.documentElement.dir),'rtl');assert.equal(await p.locator('#lang-screen').isVisible(),false);assert.equal(await p.evaluate(()=>window.languageFlicker),false);cases++;
 assert.deepEqual(errors,[]);await context.close();
 // Full account settings coverage lives in settings-browser.mjs after the dashboard-view upgrade.
}finally{await browser.close()}
// Actually close/reopen Chromium using the same disposable on-disk browser profile.
const profile=await mkdtemp(join(tmpdir(),'triso-language-profile-'));
try{let c=await chromium.launchPersistentContext(profile,launch);await mocks(c);let p=await c.newPage();await p.goto(base+'/index.html?lang=fa');await p.waitForFunction(()=>window.tcPhase1BootstrapComplete);await c.close();c=await chromium.launchPersistentContext(profile,launch);await mocks(c);p=await c.newPage();await p.goto(base+'/index.html');await p.waitForFunction(()=>window.tcPhase1BootstrapComplete);assert.equal(await p.evaluate(()=>TrisoLanguage.get()),'fa');assert.equal(await p.locator('#lang-screen').isVisible(),false);await c.close();cases++}finally{await rm(profile,{recursive:true,force:true})}
console.log('PASS '+cases+' language/settings scenarios including browser restart; all external API calls mocked');
