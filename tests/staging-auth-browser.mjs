// Mocked regression only; hosted acceptance is performed by the owner page.
import {chromium} from 'playwright';import assert from 'node:assert/strict';
const base='http://127.0.0.1:8765',api='https://cxtytbjvdlngahytfilr.supabase.co',cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
const browser=await chromium.launch({executablePath:process.env.TRISO_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),errors=[],redirects=[],recoveries=[];
 await context.addInitScript(()=>{localStorage.clear();sessionStorage.clear()});
 await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(u.origin===base)return route.continue();if(u.origin!==api)return route.abort();if(r.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});let body=[],status=200;
  if(u.pathname==='/auth/v1/recover')recoveries.push(u.searchParams.get('redirect_to'));
  if(u.pathname==='/auth/v1/signup'){redirects.push(u.searchParams.get('redirect_to'));body={user:{id:'synthetic'}}}
  if(u.pathname.endsWith('/rpc/is_admin'))body=false;
  if(u.pathname.endsWith('/rpc/notification_page'))body={items:[],unread:0,last_read_id:0};
  if(u.pathname.endsWith('/rpc/market_browse_page'))body={items:[],has_more:false};
  if(u.pathname==='/functions/v1/store-crypto'){if(r.method()==='GET')body={enabled:false,paypal_enabled:false,schema_version:1};else status=401}
  if(u.pathname==='/functions/v1/delivery-worker'){if(r.method()==='GET')body={email_enabled:false,push_enabled:false};else status=401}
  if(u.pathname==='/functions/v1/payment-webhook')return route.fulfill({status:503,headers:cors,body:'Provider not configured'});
  if(u.pathname==='/functions/v1/delivery-webhook')status=401;
  return route.fulfill({status,headers:cors,contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const path of ['/index.html','/preview/index.html']){
  await page.goto(base+path);await page.waitForFunction(()=>typeof window.tc31ShowSignup==='function');console.log('Checking signup '+path);if(path==='/index.html')await page.waitForFunction(()=>window.tcPhase1BootstrapComplete===true);
  await page.evaluate(()=>{setLang('en','ltr');showScreen('tc31-panel');tc31ShowSignup()});
  await page.locator('#tc31-signup-name').fill('Synthetic Staging');await page.locator('#tc31-signup-email').fill('synthetic@example.test');await page.locator('#tc31-signup-password').fill('synthetic-password-123');await page.locator('#tc31-signup-confirm').fill('synthetic-password-123');
  await page.keyboard.press('Escape');await page.locator('#tc31-signup-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#tc-v23-login-feedback')?.textContent.includes('Check your inbox')||document.querySelector('#tc31-status')?.textContent.includes('Check your inbox'));assert.equal(redirects.length,path==='/index.html'?1:2);assert.equal(redirects.at(-1),base+path);await page.evaluate(()=>{document.getElementById('tc31-email').value='synthetic@example.test';const forgot=document.getElementById('tc31-forgot-email');if(forgot)forgot.value='synthetic@example.test';return tc31Reset()});assert.equal(recoveries.at(-1),base+path);
 }
 await page.goto(base+'/staging-check.html');await page.locator('#check-edges').click();await page.waitForFunction(()=>document.getElementById('results').textContent.includes('Delivery webhook rejects unsigned input'));const summary=JSON.parse(await page.locator('#results').textContent());assert.equal(summary.checks.length,6);assert(summary.checks.slice(0,4).every(c=>c.pass));assert(summary.checks.slice(4).every(c=>c.pass===null));assert(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=5);assert.deepEqual(errors,[]);
 console.log('PASS main/preview signup/recovery bind callbacks to current path; owner diagnostics verify safe Edge checks and explicit manual webhook outcomes at 390px (mocked only)');await context.close();
}finally{await browser.close()}
