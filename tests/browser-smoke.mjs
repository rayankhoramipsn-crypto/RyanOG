// TRISOCMD safe headless browser smoke test.
// Entirely mocked staging network: never sign up, create orders, send messages or
// modify users' real records. Tests UI/DOM transitions, not payment processing.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.TRISO_TEST_BASE || 'http://127.0.0.1:8765';
const origin = 'https://cxtytbjvdlngahytfilr.supabase.co';
const fixtureProducts = [{
 id: 901, title: 'Smoke Test Gaming Headset', description: 'Read-only browser test fixture',
 image_url: null, price: 39.95, category: 'Gaming Accessories',
 status: 'available',stock: 12,min_qty: 1,max_qty: 12,created_at: new Date().toISOString()
}];
const fixtureListings = [{
 id: 701, title: 'Fortnite Demo Listing',platform: 'Fortnite',
 description: 'Demo listing for a harmless automated browser smoke test',
 price: 19.99, image_url: null,is_pro: false,
 submitted_at: new Date().toISOString()
},{
 id: 702,title: 'Demo Gaming Keyboard',platform: 'Gaming Gear',
 description: 'Another fixture for testing marketplace category filtering',
 price: 49.99,image_url:null,is_pro:false,submitted_at:new Date().toISOString()
}];
const cors = {
 'access-control-allow-origin':'*',
 'access-control-allow-methods':'GET,POST,PATCH,OPTIONS',
 'access-control-allow-headers':'apikey,authorization,content-type,prefer,x-client-info',
 'content-type':'application/json'
};
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const context = await browser.newContext({viewport:{width:1365,height:900},reducedMotion:'reduce'});
const pageErrors=[];
const failed=[];
context.on('page', p => p.on('pageerror',e=>pageErrors.push({page:p.url(),message:e.message})));
await context.route(origin+'/**', async route=>{
 const request = route.request();
 const url=new URL(request.url());
 if(request.method()==='OPTIONS'){
  return route.fulfill({status:204,headers:cors,body:''});
 }
 const path=url.pathname;
 let result=[];
 if(path.endsWith('/rpc/market_browse'))result=fixtureListings;
 else if(path.endsWith('/rpc/is_admin'))result=false;
 else if(path.endsWith('/rpc/market_inbox'))result=[];
 else if(path.endsWith('/auth/v1/user'))result={id:'00000000-0000-4000-8000-000000000001',email:'smoke@example.test'};
 else if(path.endsWith('/rest/v1/products'))result=fixtureProducts;
 else if(path.includes('/products'))result=url.searchParams.has('id')?fixtureProducts:fixtureProducts;
 else if(path.includes('/blog_posts'))result=[];
 else if(path.includes('/market_listing_media'))result=[];
 else if(path.includes('/market_messages'))result=[];
 else if(path.includes('/market_conversations'))result=[];
 else if(path.includes('/market_purchase_requests'))result=[];
 else if(path.includes('/market_listings'))result=[];
 // No write action is allowed by this test. The only POSTs above are
 // read-only RPCs; all other write requests receive a 403 failure.
 const safeReadRPC=path.endsWith('/rpc/is_admin')||path.endsWith('/rpc/market_browse')||path.endsWith('/rpc/market_inbox');
 if(!['GET','HEAD'].includes(request.method())&&!safeReadRPC){
  failed.push('unexpected network mutation blocked: '+request.method()+' '+path);
  return route.fulfill({status:403,headers:cors,body:JSON.stringify({message:'Test never performs writes'})});
 }
 return route.fulfill({status:200,headers:cors,body:JSON.stringify(result)});
});
await context.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.supabase=window.supabase||{};'}));
await context.route('https://api.coingecko.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({litecoin:{usd:110},bitcoin:{usd:95000}})}));
await context.route('https://fonts.googleapis.com/**',route=>route.abort());
await context.route('https://fonts.gstatic.com/**',route=>route.abort());

async function open(route){
 const page=await context.newPage();
 page.setDefaultTimeout(12000);
 const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});
 assert(response&&response.status()===200,route+' did not return 200');
 assert(await page.locator('body').count()===1,route+' missing body');
 assert.equal(await page.locator('link[rel="icon"][type="image/svg+xml"]').count(),1,route+' missing shared favicon');
 console.log('OK route '+route);
 return page;
}
try{
 const home=await open('/index.html');
 assert(await home.locator('#lang-screen').count()===1);
 assert.equal(await home.locator('meta[name="twitter:card"]').getAttribute('content'),'summary_large_image');
 assert.equal(await home.locator('meta[property="og:image:width"]').getAttribute('content'),'1200');
 assert.equal(await home.locator('meta[property="og:image:height"]').getAttribute('content'),'630');
 assert.match(await home.locator('meta[property="og:image"]').getAttribute('content'),/^https:\/\/trisocmd\.shop\/assets\/trisocmd-social\.png/);
 const socialDimensions=await home.evaluate(async()=>{
   const image=new Image();
   image.src='/assets/trisocmd-social.png';
   await image.decode();
   return [image.naturalWidth,image.naturalHeight];
 });
 assert.deepEqual(socialDimensions,[1200,630],'social preview image is not a valid 1200×630 PNG');
 const iconDimensions=await home.evaluate(async()=>{
   const image=new Image();
   image.src='/assets/trisocmd-icon-64.png';
   await image.decode();
   return [image.naturalWidth,image.naturalHeight];
 });
 assert.deepEqual(iconDimensions,[64,64],'favicon PNG failed to decode');
 console.log('OK Open Graph and Twitter sharing metadata, favicon and image decoding');
 await home.evaluate(()=>{
  localStorage.setItem('tc35_auth_session',JSON.stringify({
   access_token:'smoke-token',refresh_token:'smoke-refresh',expires_at:Math.floor(Date.now()/1000)+3600,
   user:{id:'00000000-0000-4000-8000-000000000001',email:'smoke@example.test'}
  }));
 });
 await home.reload({waitUntil:'domcontentloaded'});
 await home.locator('#lang-screen.active').waitFor({timeout:12000});
 assert(await home.locator('#lang-screen.active').count(),'original language selection should remain first');
 console.log('OK language-first onboarding even with remembered login');
 await home.evaluate(()=>{localStorage.removeItem('tc35_auth_session');sessionStorage.removeItem('tc35_auth_session')});
 await home.reload({waitUntil:'domcontentloaded'});
 await home.locator('#lang-screen.active').waitFor({timeout:12000});
 await home.evaluate(()=>setLang('en','ltr'));
 await home.locator('#tc31-panel.active').waitFor();
 assert.equal(await home.locator('#tc31-guest:visible').count(),1,'login mode should be visible');
 assert.equal(await home.locator('#tc31-forgot-view:visible').count(),0,'forgot mode should start hidden');
 // A mocked rejected sign-in must produce an unmistakable red alert.
 await home.route(origin+'/auth/v1/token?**',route=>route.fulfill({status:400,headers:cors,body:JSON.stringify({message:'Invalid login credentials'})}));
 await home.locator('#tc31-email').fill('demo@example.test');
 await home.locator('#tc31-password').fill('not-the-password');
 await home.locator('#tc-v22-login-submit').click();
 await home.locator('#tc-v23-login-feedback[data-state="error"]:visible').waitFor();
 assert.match(await home.locator('#tc-v23-login-feedback').textContent(),/Invalid login credentials/);
 assert.equal(await home.locator('#tc-v23-login-feedback').getAttribute('role'),'alert');
 assert.equal(await home.locator('#tc-v23-login-feedback').evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(255, 100, 120)');
 await home.unroute(origin+'/auth/v1/token?**');
 await home.getByRole('button',{name:'Create your account'}).click();
 assert.equal(await home.locator('#tc31-signup-view:visible').count(),1,'signup should have own view');
 assert.equal(await home.locator('#tc31-guest:visible').count(),0,'signup should hide login');
 await home.locator('#tc31-signup-name').fill('Example User');
 await home.locator('#tc31-signup-email').fill('demo@example.test');
 await home.locator('#tc31-signup-password').fill('password123');
 await home.locator('#tc31-signup-confirm').fill('password456');
 await home.locator('#tc31-signup-form').getByRole('button',{name:'CREATE ACCOUNT'}).click();
 await home.locator('#tc-v23-signup-feedback[data-state="error"]:visible').waitFor();
 assert.match(await home.locator('#tc-v23-signup-feedback').textContent(),/Passwords do not match/);
 await home.locator('#tc31-signup-view').getByRole('button',{name:'Sign in instead'}).click();
 assert.equal(await home.locator('#tc31-guest:visible').count(),1,'back to sign in should return to login');
 await home.locator('#tc31-login-form').getByRole('button',{name:'Forgot password?'}).click();
 assert.equal(await home.locator('#tc31-forgot-view:visible').count(),1,'forgot password must have dedicated view');
 assert.equal(await home.locator('#tc31-guest:visible').count(),0,'forgot password must hide login');
 assert.equal(await home.locator('#tc31-signup-view:visible').count(),0,'forgot password must hide signup');
 // Mocked email request only: no live reset email is sent.
 let recoveryRedirect=null;
 await home.route(origin+'/auth/v1/recover**',async route=>{
   const target=new URL(route.request().url());
   assert.equal(route.request().method(),'POST');
   assert.equal(JSON.parse(route.request().postData()).email,'demo@example.test');
   recoveryRedirect=target.searchParams.get('redirect_to');
   await route.fulfill({status:200,headers:cors,body:'{}'});
 });
 await home.locator('#tc31-forgot-email').fill('demo@example.test');
 await home.locator('#tc31-reset-button').click();
 await home.locator('#tc31-reset-feedback[data-state="success"]:visible').waitFor();
 await home.locator('#tc31-reset-feedback').getByText('we sent a reset link',{exact:false}).waitFor();
 assert.equal(recoveryRedirect,base+'/index.html','recovery redirect must point at callback-aware route');
 await home.unroute(origin+'/auth/v1/recover**');
 await home.setViewportSize({width:390,height:844});
 assert.equal(await home.locator('#tc31-forgot-view:visible').count(),1);
 const cardWidth=await home.locator('#tc31-forgot-view').evaluate(el=>el.getBoundingClientRect().width);
 assert(cardWidth<=390,'forgot-password card must fit mobile viewport');
 await home.locator('#tc31-forgot-view').getByRole('button',{name:'Back to sign in'}).click();
 assert.equal(await home.locator('#tc31-guest:visible').count(),1);
 console.log('OK separate login, signup and forgot-password views');
 await home.close();

 const callback=await open('/index.html#access_token=smoke-token&refresh_token=smoke-refresh&type=recovery&expires_in=3600');
 await callback.locator('#tc31-recovery-shell:visible').waitFor({timeout:12000});
 assert.equal(await callback.locator('#tc31-guest:visible').count(),0,'valid recovery callback must never show login');
 assert.equal(await callback.locator('#tc31-signup-view:visible').count(),0,'valid recovery callback must never show signup');
 assert.equal(await callback.locator('#tc31-recovery-form:visible').count(),1,'valid recovery callback must show new password fields');
 assert.equal(new URL(callback.url()).hash,'','sensitive callback fragment should be removed');
 // Verify password update UI with mocked Supabase API; never change an actual password.
 let changed=false;
 await callback.route(origin+'/auth/v1/user',async route=>{
   if(route.request().method()!=='PUT')return route.fallback();
   const request=JSON.parse(route.request().postData());
   assert.equal(request.password,'mock-password-123');
   changed=true;
   await route.fulfill({status:200,headers:cors,body:'{}'});
 });
 await callback.route(origin+'/auth/v1/logout',async route=>route.fulfill({status:204,headers:cors,body:''}));
 await callback.locator('#tc31-new-password').fill('mock-password-123');
 await callback.locator('#tc31-confirm-new-password').fill('bad-password-123');
 await callback.locator('#tc31-update-password-button').click();
 await callback.locator('#tc-v22-recovery-feedback[data-state="error"]:visible').waitFor();
 assert.match(await callback.locator('#tc-v22-recovery-feedback').textContent(),/Passwords do not match/);
 await callback.locator('#tc31-confirm-new-password').fill('mock-password-123');
 await callback.locator('#tc31-update-password-button').click();
 await callback.waitForFunction(()=>document.querySelector('#tc31-panel')?.dataset.authMode==='signin');
 assert(changed,'mock reset request was not sent');
 assert.equal(await callback.locator('#tc31-recovery-shell:visible').count(),0,'password reset should close recovery form');
 assert.equal(await callback.locator('#tc31-guest:visible').count(),1,'password reset should return to sign in');
 console.log('OK sign-in, signup and password reset errors render clear red alerts; recovery success is green');
 console.log('OK verified callback and new password submission (fully mocked)');
 await callback.close();

 const market=await open('/marketplace.html');
 await market.waitForFunction(()=>document.querySelectorAll('#cards .item-card').length===2,null,{timeout:15000});
 assert.equal(await market.locator('.item-card').count(),2);
 await market.locator('.item-card button').first().click();
 await market.locator('#detail-dialog[open]').waitFor();
 assert(await market.locator('#request-purchase').isDisabled());
 await market.locator('#accept').check();
 assert(await market.locator('#chat-seller').isEnabled());
 assert(await market.locator('#request-purchase').isEnabled());
 await market.keyboard.press('Escape');
 await market.locator('[data-cat="gear"]').first().click();
 assert.equal(await market.locator('#cards .item-card').count(),1,'category filter broken');
 await market.locator('#search').fill('not-a-product');
 assert.equal(await market.locator('#cards .item-card').count(),0,'marketplace search broken');
 console.log('OK listing detail, policy gating, category filter and search');

 // Seller UI regression; all Supabase writes are intercepted by local mocks.
 await market.evaluate(()=>window.TrisoAuth.write({
   access_token:'seller-mock',refresh_token:'seller-refresh',expires_at:Math.floor(Date.now()/1000)+3600,
   user:{id:'00000000-0000-4000-8000-000000000009',email:'seller@example.test'}
 },true));
 await market.reload({waitUntil:'domcontentloaded'});
 await market.locator('#seller-panel:not(.hidden)').waitFor();
 await market.locator('#open-sell').click();
 await market.locator('#sell-dialog[open]').waitFor();
 await market.locator('#title').fill('Gaming headset for sale');
 await market.locator('#platform').selectOption('Gaming Gear');
 await market.locator('#price').fill('29.95');
 await market.locator('#description').fill('An owned and working gaming headset with ear pads and cable included.');
 const smallFile={name:'wrong.txt',mimeType:'text/plain',buffer:Buffer.from('not an image')};
 await market.locator('#photos').setInputFiles(smallFile);
 await market.locator('#listing-form').evaluate(el=>el.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 await market.locator('#sell-status[data-state="error"]:visible').waitFor();
 assert.match(await market.locator('#sell-status').textContent(),/JPG, PNG or WebP/);
 assert.equal(await market.locator('#sell-status').evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(255, 115, 132)');

 // Mocked daily quota rejection: verify the server message remains visible.
 const photo={name:'item.png',mimeType:'image/png',
   buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/n8cAAAAASUVORK5CYII=','base64')};
 await market.locator('#photos').setInputFiles(photo);
 let quotaChecks=0;
 await market.route(origin+'/rest/v1/rpc/market_submit',async route=>{
   quotaChecks++;
   await route.fulfill({status:400,headers:cors,body:JSON.stringify({message:'Daily free listing limit reached (3 listings per UTC day)'})});
 });
 await market.locator('#post').click();
 await market.locator('#sell-status[data-state="error"]:visible').waitFor();
 assert.match(await market.locator('#sell-status').textContent(),/Daily free listing limit reached/);
 assert.equal(quotaChecks,1,'quota is enforced by server response');
 await market.unroute(origin+'/rest/v1/rpc/market_submit');
 console.log('OK invalid gallery photos and 3/day limit errors (all mocked)');
 await market.evaluate(()=>{localStorage.removeItem('tc35_auth_session');sessionStorage.removeItem('tc35_auth_session')});
 await market.close();

 // Mobile and RTL smoke: no horizontal scroll traps, searchable items remain
 // reachable in both English and Persian layouts.
 const mobile=await context.newPage();
 mobile.setDefaultTimeout(12000);
 await mobile.setViewportSize({width:390,height:844});
 const mobileResponse=await mobile.goto(base+'/marketplace.html',{waitUntil:'domcontentloaded'});
 assert(mobileResponse&&mobileResponse.status()===200);
 await mobile.waitForFunction(()=>document.querySelectorAll('#cards .item-card').length===2,null,{timeout:15000});
 const mobileOverflow=await mobile.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 assert(mobileOverflow<=5,'Mobile marketplace horizontal overflow: '+mobileOverflow+'px');
 await mobile.locator('#language').selectOption('fa');
 assert.equal(await mobile.locator('html').getAttribute('dir'),'rtl','Persian layout must be RTL');
 await mobile.locator('.item-card button').first().click();
 await mobile.locator('#detail-dialog[open]').waitFor();
 await mobile.keyboard.press('Escape');
 console.log('OK mobile marketplace and Persian RTL details');
 await mobile.close();

 const missing=await open('/404.html');
 await missing.getByRole('heading',{name:'Looks like this page went offline.'}).waitFor();
 assert.equal(await missing.locator('a[href="/"]').count(),3,'404 needs home navigation in logo, header and action');
 assert.equal(await missing.locator('a[href="/marketplace.html"]').count(),2,'404 needs marketplace navigation');
 assert.equal(await missing.locator('a[href="/help/"]').count(),2,'404 needs support navigation');
 assert.equal(await missing.locator('html').getAttribute('lang'),'en');
 await missing.locator('#language-switch').click();
 assert.equal(await missing.locator('html').getAttribute('lang'),'fa');
 assert.equal(await missing.locator('html').getAttribute('dir'),'rtl');
 await missing.reload({waitUntil:'domcontentloaded'});
 assert.equal(await missing.locator('html').getAttribute('lang'),'fa','language preference not retained');
 await missing.setViewportSize({width:390,height:844});
 const missingOverflow=await missing.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 assert(missingOverflow<=5,'404 mobile page overflows horizontally by '+missingOverflow+'px');
 await missing.getByRole('link',{name:/مارکت‌پلیس/}).first().click();
 assert(missing.url().includes('/marketplace.html'),'404 marketplace recovery navigation failed');
 console.log('OK branded 404, EN/FA toggle, RTL/mobile layout and marketplace link');
 await missing.close();

 const admin=await open('/admin/');
 await admin.locator('#admin-auth').waitFor({state:'visible'});
 assert(await admin.locator('#dashboard.hidden').count()===1,'admin exposed without login');
 console.log('OK admin sign-in gate');
 await admin.close();

 for(const route of ['/blog/','/videos/','/help/','/policies/','/product.html',
     '/preview/index.html','/preview/marketplace.html','/preview/admin/',
     '/preview/blog/','/preview/videos/','/preview/help/','/preview/policies/','/preview/product.html']){
  const p=await open(route);
  await p.close();
 }
 if(pageErrors.length)throw Error('Uncaught JS errors: '+JSON.stringify(pageErrors.slice(0,12)));
 if(failed.length)throw Error('Unexpected writes: '+failed.join('; '));
 console.log('PASS TRISOCMD safe browser smoke checks');
}finally{
 await context.close();
 await browser.close();
}
