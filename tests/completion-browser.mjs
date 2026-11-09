import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.TRISO_TEST_BASE||'http://127.0.0.1:8765';
const api='https://cxtytbjvdlngahytfilr.supabase.co';
const browser=await chromium.launch({executablePath:process.env.TRISO_CHROMIUM_PATH||undefined,args:['--no-sandbox']});
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
try{
 const context=await browser.newContext();const errors=[];let offsets=[],deleted=false;
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await context.addInitScript(()=>localStorage.setItem('tc35_auth_session',JSON.stringify({access_token:'mock',refresh_token:'mock-refresh',expires_at:Date.now()/1000+3600,user:{id:'admin-fixture',app_metadata:{role:'admin'}}})));
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin===new URL(base).origin)return route.continue();
  if(url.origin!==api)return route.abort();
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  let data=[];
  if(url.pathname.endsWith('/rpc/is_admin'))data=true;
  if(url.pathname.endsWith('/market_listings')){
   const offset=Number(url.searchParams.get('offset')||0);offsets.push(offset);
   data=offset===0?Array.from({length:150},(_,i)=>({id:i+1,title:'Reviewed '+i,price:10,status:'approved',seller_id:'other-seller',submitted_at:'2026-01-01'})):[{id:151,title:'Older pending from another seller',price:25,status:'pending',seller_id:'different-seller',submitted_at:'2025-01-01'}];
  }
  if(url.pathname.endsWith('/blog_posts')){
   if(route.request().method()==='DELETE')deleted=true;
   data=deleted?[]:[{id:1,slug:'fixture',title:'Journal fixture',body:'<script>unsafe()</script>',language:'fa',status:'published',published_at:'2020-01-01',cover_image_url:'https://example.test/photo.png'}];
  }
  return route.fulfill({status:200,headers:cors,contentType:'application/json',body:JSON.stringify(data)});
 });
 const page=await context.newPage();await page.goto(base+'/admin/');await page.getByText('#151 · Older pending from another seller',{exact:true}).waitFor();
 assert.deepEqual(offsets,[0,150]);console.log('PASS admin queue includes older cross-seller pending submission beyond first 150');
 for(const width of [390,768,1365]){
  await page.setViewportSize({width,height:900});await page.goto(base+'/blog/?slug=fixture');
  await page.locator('#article-title').filter({hasText:'Journal fixture'}).waitFor();
  assert.equal(await page.locator('#article-cover').getAttribute('src'),'https://example.test/photo.png');
  assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
  assert.equal(await page.locator('#article-body script').count(),0);
  assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),base+'/blog/?slug=fixture');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=5);
 }
 page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete Journal fixture',exact:true}).click();
 await page.getByText('Article deleted.',{exact:true}).waitFor();assert(deleted);console.log('PASS blog media, deletion, sanitized content and RTL at mobile/tablet/desktop');
 await page.goto(base+'/product.html?id=1');
 assert.equal(await page.evaluate(()=>safeImage('https://example.test/image.png')),'https://example.test/image.png');
 assert.equal(await page.evaluate(()=>videoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')),'dQw4w9WgXcQ');
 assert.equal(await page.evaluate(()=>videoId('https://evil.test/watch?v=dQw4w9WgXcQ')),null);
 assert.deepEqual(errors,[]);console.log('PASS product image and approved YouTube parser; no uncaught page errors');
 await context.close();
}finally{await browser.close()}
