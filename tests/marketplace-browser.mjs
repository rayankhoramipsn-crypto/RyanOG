import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.TRISO_TEST_BASE||'http://127.0.0.1:8765';
const api='https://cxtytbjvdlngahytfilr.supabase.co';
const browser=await chromium.launch({executablePath:process.env.TRISO_CHROMIUM_PATH||undefined,args:['--no-sandbox']});
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
const listings=Array.from({length:241},(_,i)=>({id:241-i,title:'Listing '+(241-i),platform:'Gaming Gear',description:'Approved fixture',price:241-i,is_pro:false,submitted_at:'2026-01-01'}));
try{
 const context=await browser.newContext();const errors=[];const requests=[];
 let legacy=false,fail=false,held,release;
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin===new URL(base).origin)return route.continue();
  if(url.origin!==api)return route.abort();
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  let data=[];let status=200;
  if(url.pathname.endsWith('/rpc/market_browse_page')){
   const p=route.request().postDataJSON();requests.push(p);
   if(legacy){status=404;data={code:'PGRST202',message:'Function unavailable'}}
   else if(fail){status=503;data={message:'Fixture offline'}}
   else{
    let rows=listings.filter(x=>(!p.p_listing||x.id===p.p_listing)&&x.title.toLowerCase().includes((p.p_query||'').toLowerCase())&&(p.p_min_price==null||x.price>=p.p_min_price)&&(p.p_max_price==null||x.price<=p.p_max_price));
    if(p.p_sort==='low')rows.sort((a,b)=>a.price-b.price);
    const offset=p.p_offset||0;data={items:rows.slice(offset,offset+24),has_more:rows.length>offset+24};
    if(p.p_query==='listing 2'){
     held=true;await new Promise(resolve=>{release=resolve});
    }
   }
  }else if(url.pathname.endsWith('/rpc/market_browse'))data=listings.slice(0,100);
  else if(url.pathname.endsWith('/rpc/is_admin'))data=false;
  return route.fulfill({status,headers:cors,contentType:'application/json',body:JSON.stringify(data)});
 });
 const page=await context.newPage();page.setDefaultTimeout(10000);
 async function search(value){await page.locator('#search').click();await page.locator('#search').fill(value)}
 async function ready(){await page.waitForFunction(()=>document.querySelector('#cards')?.getAttribute('aria-busy')==='false')}
 for(const path of ['/marketplace.html','/preview/marketplace.html']){
  await page.goto(base+path);await ready();
  assert.equal(await page.locator('.item-card').count(),24);
  const ids=[];
  for(let n=0;n<11;n++){
   ids.push(...await page.locator('.item-title').allTextContents());
   if(n<10){await page.locator('#browse-next').click();await ready()}
  }
  assert.equal(ids.length,241);assert.equal(new Set(ids).size,241);assert(await page.locator('#browse-next').isDisabled());
  await search('Listing 20');await page.getByText('Listing 200',{exact:true}).waitFor();await ready();
  assert.equal(requests.at(-1).p_offset,0);assert(await page.locator('#browse-prev').isDisabled());
  await search('');await page.locator('#price-min').fill('100');await page.locator('#price-max').fill('110');
  await page.waitForFunction(()=>document.querySelectorAll('.item-card').length===11);await ready();
  await page.locator('#sort').selectOption('low');await ready();
  assert.equal(await page.locator('.item-title').first().textContent(),'Listing 100');
  await page.locator('#price-max').fill('90');await page.getByText('Enter a valid price range.',{exact:true}).waitFor();
  assert.equal(await page.locator('.item-card').count(),0);
  for(const lang of ['fa','ar']){
   await page.locator('#language').selectOption(lang);assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
   await page.setViewportSize({width:390,height:850});assert(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=5);
  }
  await page.locator('#language').selectOption('en');
 }
 console.log('PASS main/preview browse all 241 listings; filter resets, range validation, price sorting and mobile RTL');
 await page.goto(base+'/marketplace.html?listing=1');await page.locator('#detail-dialog[open]').waitFor();
 assert.equal(await page.locator('#detail-title').textContent(),'Listing 1');await page.locator('#detail-dialog').evaluate(d=>d.close());
 await search('listing 2');
 await page.waitForRequest(r=>r.url().endsWith('/rpc/market_browse_page')&&r.postDataJSON().p_query==='listing 2');
 // Wait for the route handler, then issue a newer filter while the old request is held.
 while(!held)await new Promise(resolve=>setImmediate(resolve));
 await search('listing 100');await page.getByText('Listing 100',{exact:true}).waitFor();
 const oldResponse=page.waitForResponse(r=>r.url().endsWith('/rpc/market_browse_page')&&r.request().postDataJSON().p_query==='listing 2');
 release();await oldResponse;await ready();
 assert.deepEqual(await page.locator('.item-title').allTextContents(),['Listing 100']);
 console.log('PASS deep link outside first page and late search response cannot replace newer results');
 fail=true;await search('anything');await page.getByRole('button',{name:'Retry',exact:true}).waitFor();
 fail=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await ready();assert.equal(await page.locator('.item-card').count(),0);
 legacy=true;await page.goto(base+'/marketplace.html');await ready();
 assert.match(await page.locator('#browse-status').textContent(),/only the first 100/);assert(await page.locator('#browse-next').isDisabled());
 assert.deepEqual(errors,[]);console.log('PASS empty/error/retry states and explicit legacy migration warning; no uncaught errors');
 await context.close();
}finally{await browser.close()}
