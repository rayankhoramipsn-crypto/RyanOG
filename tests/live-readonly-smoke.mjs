// TRISOCMD production smoke: live read-only navigation only.
// No sign-ins, data mutations, payment attempts, chat sending, or requests for secrets.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const root='https://trisocmd.shop';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const failures=[];
const results=[];
const cases=[
 {path:'/',must:['lang-screen','tc31-panel','tc28-checkout-notice','tc43-invoice-btn'],v32:true},
 {path:'/marketplace.html',must:['cards','thread-list','tc26-thread-search','tc27-my-filter']},
 {path:'/admin/',must:['admin-auth','dashboard','tc25-filter','tc28-readiness'],admin:true},
 {path:'/preview/',must:[]},
 {path:'/preview/admin/',must:[]},
 {path:'/preview/marketplace.html',must:[]}
];
async function inspect(target){
 const page=await browser.newPage({viewport:{width:1365,height:900}});
 const pageErrors=[],localFailed=[];
 page.on('pageerror',e=>pageErrors.push(String(e.message).slice(0,250)));
 page.on('requestfailed',r=>{
  const u=r.url();if(u.startsWith(root))localFailed.push(r.method()+' '+new URL(u).pathname+' '+r.failure()?.errorText);
 });
 try{
  const response=await page.goto(root+target.path,{waitUntil:'domcontentloaded',timeout:25000});
  const status=response?.status();
  await page.waitForTimeout(1200);
  const current=page.url(),title=await page.title(),bodyLength=(await page.locator('body').textContent())?.length||0;
  const missing=[];
  for(const id of target.must)if(!await page.locator('#'+id).count())missing.push('#'+id);
  let v32='n/a';
  if(target.v32){
   v32={invoiceDisabled:await page.locator('#tc43-invoice-btn').isDisabled(),txidDisabled:await page.locator('#tc43-txid').isDisabled(),checkoutDisclosure:(await page.locator('#tc28-checkout-notice').count())>0};
  }
  let adminGate='n/a';
  if(target.admin)adminGate={authVisible:await page.locator('#admin-auth').isVisible(),dashboardHidden:!(await page.locator('#dashboard').isVisible())};
  const summary={path:target.path,status,current,title,bodyLength,missing,v32,adminGate,pageErrors,localFailed:localFailed.slice(0,12)};
  results.push(summary);
  console.log('LIVE '+JSON.stringify(summary));
  if(status!==200)failures.push(target.path+': HTTP '+status);
  if(missing.length)failures.push(target.path+': missing '+missing.join(', '));
  if(target.v32&&(!v32.invoiceDisabled||!v32.txidDisabled||!v32.checkoutDisclosure))failures.push(target.path+': V32 not fully deployed');
  if(target.admin&&(!adminGate.authVisible||!adminGate.dashboardHidden))failures.push(target.path+': anonymous admin auth gate failed');
  if(localFailed.length)failures.push(target.path+': failed same-origin requests '+localFailed.join('; '));
  if(pageErrors.length)failures.push(target.path+': JS errors '+pageErrors.join('; '));
  if(target.path==='/marketplace.html'){
   const filters=page.locator('[data-cat]');
   if(await filters.count()){
    await filters.first().click({timeout:4000}).catch(e=>console.log('LIVE FILTER read-only check skipped: '+e.message.slice(0,120)));
    console.log('LIVE marketplace category controls present:',await filters.count());
   }
  }
  await page.setViewportSize({width:390,height:844});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+18);
  console.log('LIVE mobile overflow '+target.path+': '+overflow);
  if(overflow&&['/marketplace.html','/admin/'].includes(target.path))failures.push(target.path+': horizontal overflow mobile');
 }catch(e){
  console.log('LIVE ERROR '+target.path+': '+String(e?.stack||e).slice(0,1500));
  failures.push(target.path+': '+String(e.message||e).slice(0,300));
 }finally{await page.close()}
}
try{
 for(const target of cases)await inspect(target);
 console.log('LIVE READ-ONLY SUMMARY '+results.length+'/'+cases.length+' accessible; issues='+failures.length);
 if(failures.length){for(const f of failures)console.error('LIVE FAIL: '+f);process.exitCode=1}
}finally{await browser.close()}
