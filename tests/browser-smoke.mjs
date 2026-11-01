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
 await home.waitForFunction(()=>getComputedStyle(document.querySelector('#tc-v23-login-feedback')).borderTopColor==='rgb(255, 100, 120)',null,{timeout:4000});
 await home.unroute(origin+'/auth/v1/token?**');
 await home.getByRole('button',{name:'Create your account'}).click();
 assert.equal(await home.locator('#tc31-signup-view:visible').count(),1,'signup should have own view');
 assert.equal(await home.locator('#tc31-guest:visible').count(),0,'signup should hide login');
 await home.locator('#tc31-signup-name').fill('Example User');
 await home.locator('#tc31-signup-email').fill('demo@example.test');
 await home.locator('#tc31-signup-password').fill('password123');
 await home.locator('#tc31-signup-confirm').fill('password456');
 await home.evaluate(()=>window.tc31Register()); // JS validation only; browser-native validation is tested separately
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
 // V28: checkout is manual enquiry only; never initiate transfers in tests.
 await home.evaluate(()=>showScreen('checkout-screen'));
 await home.locator('#tc28-checkout-notice:visible').waitFor();
 assert.match(await home.locator('#tc28-checkout-notice').textContent(),/NO VERIFIED INVOICE/);
 assert.match(await home.locator('#tc28-checkout-notice').textContent(),/does not confirm a payment/i);
 assert.match(await home.locator('#tc44-crypto .tc44-warning').textContent(),/Do not treat this quote as a payment request/);
 assert.equal(await home.locator('.tc44-kicker').textContent(),'CHECKOUT ENQUIRY / TRISOCMD');
 await home.evaluate(()=>setLang('fa','rtl','navbar'));
 assert.match(await home.locator('#co-title').textContent(),/بررسی روش‌های پرداخت/);
 await home.evaluate(()=>setLang('en','ltr','navbar'));
 assert.match(await home.locator('#co-title').textContent(),/Review payment options/);
 // V30: mock the order RPC, not a real order or payment.
 let saveCalls=0;
 await home.route(origin+'/rest/v1/rpc/tc42_create_order',async route=>{
  saveCalls++;
  await new Promise(resolve=>setTimeout(resolve,120));
  return route.fulfill({status:200,headers:cors,body:JSON.stringify('11111111-2222-4333-8444-555555555555')});
 });
 await home.evaluate(()=>{
  window.tc42AccessToken=async()=> 'mock-signed-in-token';
  window.tc42OrderItems=[{id:901,qty:1}];
 });
 const saves=home.evaluate(()=>Promise.all([window.tc42SaveOrder(),window.tc42SaveOrder()]));
 await saves;
 assert.equal(saveCalls,1,'double click must send only one server order request');
 assert.match(await home.locator('#tc42-order-result').textContent(),/Not paid and not confirmed/);
 assert.equal(await home.locator('#tc42-order-result').getAttribute('data-state'),'success');
 await home.unroute(origin+'/rest/v1/rpc/tc42_create_order');
 await home.route(origin+'/rest/v1/rpc/tc42_create_order',route=>route.fulfill({status:503,headers:cors,body:JSON.stringify({message:'Temporary test failure'})}));
 await home.evaluate(()=>window.tc42SaveOrder());
 assert.equal(await home.locator('#tc42-order-result').getAttribute('data-state'),'error');
 assert.match(await home.locator('#tc42-order-result').textContent(),/check My Orders before retrying/i);
 await home.unroute(origin+'/rest/v1/rpc/tc42_create_order');
 console.log('OK V30 order double-submit guard, saved-not-paid status and retry warning (mocked)');
 // V32: no active invoice controls or client-only payment success.
 assert.equal(await home.locator('#tc43-invoice-btn').isDisabled(),true);
 assert.equal(await home.locator('#tc43-verify-btn').isDisabled(),true);
 assert.equal(await home.locator('#tc43-txid').isDisabled(),true);
 assert.match(await home.locator('#tc43-status').textContent(),/No hosted invoice or TXID verification is active/);
 await home.evaluate(()=>window.tc43CreateInvoice());
 assert.match(await home.locator('#tc43-status').textContent(),/invoices are not available/i);
 const localeCases={en:'Review payment options',fa:'بررسی روش‌های پرداخت',ar:'مراجعة خيارات الدفع',fr:'Consulter les options de paiement',de:'Zahlungsoptionen prüfen',ru:'Проверить варианты оплаты',ro:'Verifică opțiunile de plată',es:'Revisar opciones de pago'};
 for(const [lang,label] of Object.entries(localeCases)){
  await home.evaluate(l=>setLang(l,['fa','ar'].includes(l)?'rtl':'ltr','navbar'),lang);
  assert.equal(await home.locator('#co-title').textContent(),label,lang+' checkout disclaimer was not translated');
  assert.equal(await home.locator('#tc28-checkout-notice').count(),1);
 }
 await home.evaluate(()=>setLang('en','ltr','navbar'));
 console.log('OK V32 disabled invoice/TXID controls and all eight checkout locales');
 console.log('OK V28 manual checkout warning and EN/FA localized non-payment wording');
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
 await market.waitForFunction(()=>!document.querySelector('#seller-panel')?.classList.contains('hidden'));
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

 // V27: review-only requests, duplicate prevention, ownership filters; no live writes.
 const orderPage=await open('/marketplace.html');
 const buyer='00000000-0000-4000-8000-000000000088';
 const orderId='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
 const rows=[{id:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',listing_id:702,listing_title:'Demo Gaming Keyboard',price_usd:49.99,payment_method:'CONTACT_SUPPORT',status:'awaiting_payment_setup',buyer_id:'00000000-0000-4000-8000-000000000077',seller_id:buyer,created_at:'2026-11-01T12:00:00Z',admin_note:'Payment service has not been enabled.'}];
 let requests=0;
 await orderPage.route(origin+'/rest/v1/market_purchase_requests?**',route=>route.fulfill({status:200,headers:cors,body:JSON.stringify(rows)}));
 await orderPage.route(origin+'/rest/v1/rpc/market_request_purchase',route=>{
  const payload=JSON.parse(route.request().postData());
  assert.equal(payload.p_listing,701);
  requests++;
  if(!rows.some(x=>x.id===orderId))rows.push({id:orderId,listing_id:701,listing_title:'Fortnite Demo Listing',price_usd:19.99,payment_method:payload.p_method,status:'requested',buyer_id:buyer,seller_id:'00000000-0000-4000-8000-000000000087',created_at:'2026-11-01T12:05:00Z',admin_note:null});
  return route.fulfill({status:200,headers:cors,body:JSON.stringify(orderId)});
 });
 await orderPage.evaluate(id=>window.TrisoAuth.write({access_token:'buyer-order-mock',refresh_token:'buyer-order-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id,email:'order-buyer@example.test'}},true),buyer);
 await orderPage.reload({waitUntil:'domcontentloaded'});
 await orderPage.waitForFunction(()=>document.querySelectorAll('#cards .item-card').length===2);
 await orderPage.locator('#tc27-my-filter').selectOption('seller');
 assert.equal(await orderPage.locator('#purchase-requests .tc27-request-card').count(),1);
 await orderPage.locator('#tc27-my-filter').selectOption('buyer');
 assert.equal(await orderPage.locator('#purchase-requests .tc27-request-card').count(),0);
 await orderPage.locator('#tc27-my-filter').selectOption('all');
 await orderPage.locator('#cards .item-card').filter({hasText:'Fortnite Demo Listing'}).getByRole('button').first().click();
 await orderPage.locator('#detail-dialog[open]').waitFor();
 await orderPage.locator('#accept').check();
 orderPage.once('dialog',d=>d.accept());
 await orderPage.locator('#request-purchase').click();
 await orderPage.locator('#purchase-status[data-state="success"]').waitFor();
 assert.equal(requests,1,'only one review request created');
 assert.equal(await orderPage.locator('#request-purchase').isDisabled(),true,'repeat submission must be disabled');
 await orderPage.locator('#request-purchase').evaluate(el=>el.click());
 assert.equal(requests,1,'duplicate click must not create second request');
 await orderPage.keyboard.press('Escape');
 await orderPage.locator('#tc27-my-filter').selectOption('buyer');
 assert.equal(await orderPage.locator('#purchase-requests .tc27-request-card').count(),1);
 assert.match(await orderPage.locator('#purchase-requests').textContent(),/no payment, delivery confirmation or escrow is active/i);
 console.log('OK review request, duplicate guard and buyer/seller status filters (mocked)');
 await orderPage.evaluate(()=>{localStorage.removeItem('tc35_auth_session');sessionStorage.removeItem('tc35_auth_session')});
 await orderPage.close();

 // V26: exercise buyer/seller inbox filtering and retry without sending real messages.
 const chatPage=await open('/marketplace.html');
 const chatUser='00000000-0000-4000-8000-000000000091';
 const chatRows=[
 {id:801,listing_id:101,listing_title:'Smoke headset',seller_id:'00000000-0000-4000-8000-000000000092',buyer_id:chatUser,created_at:'2026-10-30T11:00:00Z',last_message_at:'2026-11-01T10:00:00Z',last_message_preview:'Is the headset available?',last_sender_id:'00000000-0000-4000-8000-000000000092',unread_count:3},
 {id:802,listing_id:102,listing_title:'Smoke keyboard',seller_id:chatUser,buyer_id:'00000000-0000-4000-8000-000000000093',created_at:'2026-10-29T11:00:00Z',last_message_at:'2026-10-31T10:00:00Z',last_message_preview:'Thank you!',last_sender_id:chatUser,unread_count:0}
 ];
 const serverMessages=[{id:9001,sender_id:chatRows[0].seller_id,body:'Is the headset available?',created_at:'2026-11-01T10:00:00Z'}];
 let sendAttempts=0;
 await chatPage.route(origin+'/rest/v1/rpc/market_inbox',route=>route.fulfill({status:200,headers:cors,body:JSON.stringify(chatRows)}));
 await chatPage.route(origin+'/rest/v1/rpc/market_mark_read',route=>{
   chatRows[0].unread_count=0;
   return route.fulfill({status:200,headers:cors,body:'null'});
 });
 await chatPage.route(origin+'/rest/v1/market_messages?**',route=>route.fulfill({status:200,headers:cors,body:JSON.stringify(serverMessages)}));
 await chatPage.route(origin+'/rest/v1/rpc/market_send_message',route=>{
   const payload=JSON.parse(route.request().postData());
   assert.equal(payload.p_conversation,801);
   assert.equal(payload.p_body,'I am interested in the headset.');
   sendAttempts++;
   if(sendAttempts===1)return route.fulfill({status:503,headers:cors,body:JSON.stringify({message:'Temporary test error'})});
   serverMessages.push({id:9002,sender_id:chatUser,body:payload.p_body,created_at:'2026-11-01T10:02:00Z'});
   return route.fulfill({status:200,headers:cors,body:'9002'});
 });
 await chatPage.evaluate(userId=>window.TrisoAuth.write({access_token:'chat-mock',refresh_token:'chat-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:userId,email:'buyer@example.test'}},true),chatUser);
 await chatPage.reload({waitUntil:'domcontentloaded'});
 await chatPage.locator('#nav-unread:not(.hidden)').waitFor();
 assert.equal((await chatPage.locator('#nav-unread').textContent()).trim(),'3');
 assert.match(await chatPage.title(),/^\(3\) /);
 await chatPage.locator('#nav-messages').click();
 await chatPage.locator('#chat-dialog[open]').waitFor();
 await chatPage.locator('#tc26-unread-only').check();
 assert.equal(await chatPage.locator('#thread-list .thread-button').count(),1);
 await chatPage.locator('#tc26-thread-search').fill('keyboard');
 await chatPage.locator('#thread-list .thread-button').first().waitFor({state:'detached'});
 assert.match(await chatPage.locator('#thread-list').textContent(),/No conversations match/);
 await chatPage.locator('#tc26-thread-search').fill('');
 await chatPage.locator('#tc26-unread-only').uncheck();
 await chatPage.locator('#thread-list .thread-button').filter({hasText:'Smoke headset'}).click();
 await chatPage.locator('#chat-form:not(.hidden)').waitFor();
 await chatPage.waitForFunction(()=>document.getElementById('nav-unread')?.classList.contains('hidden'));
 assert.doesNotMatch(await chatPage.title(),/^\(3\) /);
 await chatPage.locator('#chat-body').fill('I am interested in the headset.');
 await chatPage.locator('#chat-send').click();
 await chatPage.locator('#chat-state.chat-error').waitFor();
 assert.equal(await chatPage.locator('#chat-body').inputValue(),'I am interested in the headset.','failed send must preserve draft');
 await chatPage.locator('#chat-send').click();
 await chatPage.waitForFunction(()=>document.querySelector('#chat-body')?.value==='');
 assert.equal(sendAttempts,2);
 await chatPage.locator('#bubbles').getByText('I am interested in the headset.').waitFor();
 console.log('OK inbox unread filter, search, read receipts and retryable sending (all mocked)');
 await chatPage.evaluate(()=>{localStorage.removeItem('tc35_auth_session');sessionStorage.removeItem('tc35_auth_session')});
 await chatPage.close();

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
 assert.equal(await admin.locator('#tc28-readiness:visible').count(),0,'checkout readiness may not be exposed before admin auth');
 console.log('OK admin sign-in gate');

 // V25 admin review tests are 100% mocked and must never write live records.
 const moderationFixture=[
  {id:111,title:'Demo headset with real photo',platform:'Gaming Gear',description:'Owned, complete working gaming headset with original cable.',price:42,status:'pending',seller_id:'00000000-0000-4000-8000-000000000009',submitted_at:'2026-10-31T16:00:00Z'},
  {id:112,title:'Demo listing missing gallery',platform:'Fortnite',description:'Demo account with no seller photo for approval testing.',price:30,status:'pending',seller_id:'00000000-0000-4000-8000-000000000008',submitted_at:'2026-10-31T15:00:00Z'},
  {id:113,title:'Previously approved demo',platform:'Steam',description:'Demo previously moderated item with clear description.',price:18,status:'approved',seller_id:'00000000-0000-4000-8000-000000000007',submitted_at:'2026-10-29T16:00:00Z'},
  {id:114,title:'Removed old demonstration',platform:'Roblox',description:'Removed historical test listing shown with all filter.',price:11,status:'removed',seller_id:'00000000-0000-4000-8000-000000000006',submitted_at:'2026-10-28T16:00:00Z'}
 ];
 let mockedModerations=0;
 await admin.route(origin+'/rest/v1/rpc/is_admin',route=>route.fulfill({status:200,headers:cors,body:'true'}));
 await admin.route(origin+'/rest/v1/market_listings?**',async route=>{
  if(route.request().method()==='PATCH'){
   const payload=JSON.parse(route.request().postData());
   const id=Number(new URL(route.request().url()).searchParams.get('id')?.replace('eq.',''));
   const row=moderationFixture.find(x=>x.id===id);
   assert(row&&row.status==='pending','moderation should update a pending row only');
   assert(['approved','declined'].includes(payload.status));
   if(payload.status==='declined')assert(payload.decline_reason.length>=5);
   row.status=payload.status;
   mockedModerations++;
   return route.fulfill({status:200,headers:cors,body:JSON.stringify([row])});
  }
  return route.fulfill({status:200,headers:cors,body:JSON.stringify(moderationFixture)});
 });
 await admin.route(origin+'/rest/v1/market_listing_media?**',route=>route.fulfill({status:200,headers:cors,body:JSON.stringify([{listing_id:111,object_path:'demo/photo.png',sort_order:0}])}));
 await admin.route(origin+'/storage/v1/object/sign/market-gallery/**',route=>route.fulfill({status:200,headers:cors,body:JSON.stringify({signedURL:base+'/assets/trisocmd-icon-64.png'})}));
 await admin.evaluate(()=>window.TrisoAuth.write({
   access_token:'admin-mock',refresh_token:'admin-refresh',
   expires_at:Math.floor(Date.now()/1000)+3600,
   user:{id:'00000000-0000-4000-8000-000000000099',email:'admin@example.test',app_metadata:{role:'admin'}}
 },true));
 await admin.reload({waitUntil:'domcontentloaded'});
 await admin.locator('#dashboard:not(.hidden)').waitFor({timeout:12000});
 await admin.locator('#tc28-readiness:visible').waitFor();
 assert.match(await admin.locator('#tc28-readiness').textContent(),/NOT READY FOR AUTOMATED PAYMENT OR ESCROW/);
 assert.match(await admin.locator('#tc28-readiness').textContent(),/No server-issued invoice/);
 // Moderator chat search is read-only; fetch replies are local fixtures.
 const adminChatRows=[
  {id:811,listing_id:101,buyer_id:'00000000-0000-4000-8000-000000000091',seller_id:'00000000-0000-4000-8000-000000000092',created_at:'2026-10-31T10:00:00Z'},
  {id:812,listing_id:102,buyer_id:'00000000-0000-4000-8000-000000000094',seller_id:'00000000-0000-4000-8000-000000000095',created_at:'2026-10-31T11:00:00Z'}
 ];
 await admin.route(origin+'/rest/v1/market_conversations?**',route=>route.fulfill({status:200,headers:cors,body:JSON.stringify(adminChatRows)}));
 await admin.route(origin+'/rest/v1/market_messages?**',route=>route.fulfill({status:200,headers:cors,body:JSON.stringify([{id:991,conversation_id:811,sender_id:adminChatRows[0].buyer_id,body:'Demo inquiry only',created_at:'2026-10-31T10:02:00Z'}])}));
 await admin.evaluate(()=>window.tc18Refresh?.());
 await admin.waitForFunction(()=>document.querySelectorAll('#tc18-chat-list .tc18-conversation').length===2);
 await admin.locator('#tc26-admin-chat-search').fill('811');
 assert.equal(await admin.locator('#tc18-chat-list .tc18-conversation').count(),1);
 await admin.locator('#tc18-chat-list .tc18-conversation').first().click();
 await admin.locator('#tc18-chat-messages').getByText('Demo inquiry only').waitFor();
 assert.equal(await admin.locator('#tc18-chat-messages textarea').count(),0,'admin conversation viewing must remain read-only');
 await admin.locator('#tc26-admin-chat-search').fill('');
 // V27: mock admin status review; no real purchases or payouts.
 const adminOrders=[
 {id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',listing_id:111,listing_title:'Demo headset with real photo',buyer_id:'00000000-0000-4000-8000-000000000081',seller_id:'00000000-0000-4000-8000-000000000082',price_usd:42,payment_method:'CONTACT_SUPPORT',status:'requested',created_at:'2026-11-01T13:00:00Z',buyer_note:null,admin_note:null},
 {id:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',listing_id:112,listing_title:'Cancelled demo order',buyer_id:'00000000-0000-4000-8000-000000000083',seller_id:'00000000-0000-4000-8000-000000000084',price_usd:16,payment_method:'LTC',status:'cancelled',created_at:'2026-10-31T13:00:00Z',buyer_note:null,admin_note:'Cancelled'}
 ];
 let reviews=0;
 await admin.route(origin+'/rest/v1/market_purchase_requests?**',route=>route.fulfill({status:200,headers:cors,body:JSON.stringify(adminOrders)}));
 await admin.route(origin+'/rest/v1/rpc/market_admin_update_purchase',route=>{
  const x=JSON.parse(route.request().postData());
  assert.equal(x.p_status,'awaiting_payment_setup');
  assert.match(x.p_note,/not enabled/);
  adminOrders[0].status=x.p_status;adminOrders[0].admin_note=x.p_note;reviews++;
  return route.fulfill({status:200,headers:cors,body:'null'});
 });
 await admin.locator('#tc18-orders-refresh').click();
 await admin.waitForFunction(()=>document.querySelectorAll('#tc18-order-list .tc27-admin-order-card').length===1);
 await admin.locator('#tc27-admin-order-filter').selectOption('all');
 assert.equal(await admin.locator('#tc18-order-list .tc27-admin-order-card').count(),2);
 await admin.locator('#tc27-admin-order-search').fill('Cancelled demo');
 assert.equal(await admin.locator('#tc18-order-list .tc27-admin-order-card').count(),1);
 await admin.locator('#tc27-admin-order-search').fill('');
 await admin.locator('#tc27-admin-order-filter').selectOption('open');
 await admin.locator('#tc18-order-list .tc27-admin-order-card').first().getByRole('button',{name:'Review request'}).click();
 await admin.locator('#tc27-order-dialog[open]').waitFor();
 await admin.locator('#tc27-order-note').fill('Payment processing is not enabled; this is a review status only.');
 await admin.locator('#tc27-order-confirm').click();
 await admin.locator('#tc27-order-dialog').waitFor({state:'hidden'});
 await admin.locator('#tc27-admin-order-feedback[data-state="success"]').waitFor();
 assert.equal(reviews,1,'admin review-only RPC should be called once');
 console.log('OK admin order review status, search and no-payment messaging (mocked)');
 console.log('OK moderator conversation search and read-only viewer (mocked)');
 await admin.locator('#listings tbody tr').first().waitFor();
 assert.equal(await admin.locator('#listings tbody tr:visible').count(),2,'pending moderation should be default filter');
 assert.equal(await admin.locator('#listings tbody tr:visible button:disabled').count(),1,'missing-photo listing must not be approvable');
 await admin.locator('#tc25-filter').selectOption('all');
 assert.equal(await admin.locator('#listings tbody tr:visible').count(),4,'all filter should show reviewed/removed listings');
 await admin.locator('#tc25-search').fill('Demo listing missing gallery');
 assert.equal(await admin.locator('#listings tbody tr:visible').count(),1,'listing search did not filter rows');
 await admin.locator('#tc25-search').fill('');
 await admin.locator('#tc25-filter').selectOption('pending');
 await admin.locator('#listings tbody tr').filter({hasText:'Demo listing missing gallery'}).getByRole('button',{name:'Decline'}).click();
 await admin.locator('#tc25-decline-dialog[open]').waitFor();
 await admin.locator('#tc25-decline-reason').fill('Please provide actual item photographs before resubmitting.');
 await admin.locator('#tc25-decline-confirm').click();
 await admin.locator('#tc25-decline-dialog').waitFor({state:'hidden'});
 await admin.locator('#tc25-action-status[data-state="success"]').waitFor();
 assert.equal(mockedModerations,1,'admin decline must call only mocked PATCH');
 assert.equal(await admin.locator('#listings tbody tr:visible').count(),1,'declined row should leave pending queue');
 admin.once('dialog',d=>d.accept());
 await admin.locator('#listings tbody tr').filter({hasText:'Demo headset with real photo'}).getByRole('button',{name:'Approve'}).click();
 await admin.locator('#tc25-action-status[data-state="success"]').waitFor();
 assert.equal(mockedModerations,2,'admin approval must call only mocked PATCH');
 assert.equal(await admin.locator('#listings tbody tr:visible').count(),0,'approved row should leave pending queue');
 console.log('OK authorized moderation queue, status filters, photo gate and decline reason (mocked)');
 await admin.evaluate(()=>{localStorage.removeItem('tc35_auth_session');sessionStorage.removeItem('tc35_auth_session')});
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
