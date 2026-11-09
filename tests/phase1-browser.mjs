// All external requests are intercepted; no real order, payment or auth writes.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.TRISO_TEST_BASE||'http://127.0.0.1:8765';
const api='https://cxtytbjvdlngahytfilr.supabase.co';
const buyer='00000000-0000-4000-8000-000000000001',order='11111111-1111-4111-8111-111111111111';
const row={id:order,customer_id:buyer,status:'awaiting_payment',total_amount:'25.00',currency:'USD',items:[{id:1,title:'Fixture',qty:1,unit_price:25}]};
const invoice={id:crypto.randomUUID(),order_id:order,chain:'mainnet',network:'LTC',address:'test-only-mocked-address-do-not-pay',units:'100000',provider:'mock',provider_invoice_id:'fixture',state:'awaiting_payment',expires_at:new Date(Date.now()+600000).toISOString()};
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
const browser=await chromium.launch({executablePath:process.env.TRISO_CHROMIUM_PATH||undefined,headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
let claims=0,creates=0;
await context.route('**/*',async route=>{
 const url=route.request().url();if(url.startsWith(base))return route.continue();
 if(!url.startsWith(api))return route.abort();
 const path=new URL(url).pathname;let value=[];
 if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
 if(path==='/auth/v1/user')value={id:buyer,email:'fixture@example.test'};
 else if(path.endsWith('/rpc/is_admin')||path.endsWith('/rpc/phase1_is_admin'))value=false;
 else if(path.endsWith('/rpc/phase1_create_order')){creates++;const body=route.request().postDataJSON();assert.match(body.p_key,/^[a-f0-9-]{36}$/);value=order;}
 else if(path.endsWith('/rpc/phase1_submit_claim')){claims++;value=crypto.randomUUID();row.status='payment_submitted';}
 else if(path==='/rest/v1/tc42_orders')value=[row];
 else if(path==='/functions/v1/store-crypto'){
   if(route.request().method()==='GET')value={enabled:true,schema_version:1};
   else{const body=route.request().postDataJSON();if(body.action==='create'||body.action==='resume')value=invoice;else if(body.action==='verify')value={status:'pending_confirmations'};else throw Error('Unexpected action');}
 }
 return route.fulfill({status:200,headers:cors,contentType:'application/json',body:JSON.stringify(value)});
});
await context.addInitScript(({buyer,base})=>{if(location.origin!==new URL(base).origin||location.search.includes('anonymous-bootstrap'))return;localStorage.setItem('tc35_auth_session',JSON.stringify({access_token:'mock-user-token',refresh_token:'mock-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:buyer,email:'fixture@example.test'}}));},{buyer,base});
try{
 const page=await context.newPage();await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.TrisoOrders);
 await page.evaluate(()=>{showScreen('store-screen');document.getElementById('phase1-order-center').scrollIntoView();});
 await page.locator('#phase1-order-center').getByRole('button',{name:'Refresh orders'}).click();
 await page.locator('#phase1-order-center article').waitFor();
 assert.equal(await page.locator('#phase1-order-center article').count(),1);
 await page.locator('#phase1-order-center select[aria-label="Order status"]').selectOption('fulfilled');
 assert.equal(await page.locator('#phase1-order-center article').count(),0);
 await page.locator('#phase1-order-center select[aria-label="Order status"]').selectOption('all');
 await page.locator('#phase1-order-center input[aria-label="Payment reference"]').fill('Mock bank reference');
 await page.locator('#phase1-order-center').getByRole('button',{name:'Submit claim',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#phase1-order-center article')?.textContent.includes('payment submitted'));
 assert.equal(claims,1);assert(!await page.locator('#phase1-order-center article').textContent().then(t=>t.includes('payment confirmed')));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)<=5);
 await page.evaluate(()=>{document.documentElement.lang='fa';document.documentElement.dir='rtl';});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)<=5);
 console.log('PASS mobile order history, status filter, unverified manual claim and RTL (mocked)');
 await page.evaluate(()=>{document.documentElement.lang='en';document.documentElement.dir='ltr';currentLang='en';window.tc42OrderItems=[{id:1,qty:1}];document.getElementById('tc41-checkout').classList.add('open');document.getElementById('tc41-checkout').setAttribute('aria-hidden','false');document.getElementById('tc43-pay').hidden=false;});
 await page.locator('#tc43-pay').getByRole('button',{name:'Create invoice',exact:true}).click();
 await page.locator('#tc43-pay').getByText(invoice.address,{exact:false}).waitFor();
 assert.equal(creates,1);
 assert(await page.locator('#tc43-pay').evaluate(e=>e.scrollWidth-e.clientWidth)<=5);
 await page.locator('#tc43-pay input[aria-label="TXID"]').fill('a'.repeat(64));
 await page.locator('#tc43-pay').getByRole('button',{name:'Check TXID',exact:true}).click();
 await page.locator('#tc43-pay [role="status"]').getByText('pending_confirmations',{exact:true}).waitFor();
 invoice.expires_at=new Date(Date.now()-1000).toISOString();
 await page.locator('#tc43-pay input[aria-label="Order ID"]').fill(order);
 await page.locator('#tc43-pay').getByRole('button',{name:'Reopen invoice',exact:true}).click();
 await page.locator('#tc43-pay [role="status"]').getByText('Expired.',{exact:false}).waitFor();
 assert.equal(await page.locator('#tc43-pay').getByRole('button',{name:'Copy address'}).count(),0);
 console.log('PASS mocked invoice creation, integer amount, mobile layout, pending confirmations and expired payment instructions');
 await page.evaluate(()=>{document.getElementById('tc41-checkout').classList.remove('open');window.TrisoAuth.clear();});
 await page.waitForTimeout(1200);
 assert.equal(await page.locator('#phase1-order-center article').count(),0);
 console.log('PASS sign-out clears private order DOM');
 const delayed=await context.newPage();let release;const gate=new Promise(r=>release=r);
 await delayed.route(api+'/rest/v1/products?order=id.asc&select=*',async route=>{await gate;await route.fulfill({status:200,headers:cors,contentType:'application/json',body:'[]'});});
 await delayed.goto(base+'/index.html?anonymous-bootstrap=1',{waitUntil:'domcontentloaded'});
 await delayed.evaluate(()=>{window.TrisoAuth.clear();setLang('en','ltr');});
 await delayed.locator('#tc31-panel.active').waitFor();release();
 await delayed.waitForFunction(()=>window.tcPhase1BootstrapComplete===true);
 assert.equal(await delayed.locator('#tc31-panel.active').count(),1,'late catalog fetch must preserve account navigation');
 await delayed.getByRole('button',{name:'Create your account'}).click();
 await delayed.locator('#tc31-signup-view:visible').waitFor();
 console.log('PASS delayed product bootstrap preserves language/account navigation');
 await delayed.close();
 assert.deepEqual(errors,[]);
}finally{await context.close();await browser.close();}
