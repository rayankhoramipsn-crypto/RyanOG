// Run against the local static server: node tests/browser/blog.cjs
// API responses are fixtures; this never contacts or mutates a real database.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 let checks=0;
 try{
 for(const base of ['', '/preview']){
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let trustedAdmin=true;let posts=[{id:1,slug:'guide',title:'راهنمای بازی',body:'متن امن <script>alert(1)</script>',excerpt:'راهنمای فارسی',category:'Guides',language:'fa',status:'published',published_at:'2026-01-01T00:00:00Z',cover_image_url:'https://images.example/cover.png',seo_description:'Article description'}];
 const writes=[];let refreshes=0;let writeToken='';let nextFailure=null;let rejectUserOnce=false;
 if(process.env.BLOG_BASELINE)await context.route('http://127.0.0.1:8000'+base+'/blog/',route=>route.fulfill({contentType:'text/html',body:require('node:fs').readFileSync(process.env.BLOG_BASELINE,'utf8')}));
 await context.route('https://**/*',async route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.hostname!=='cxtytbjvdlngahytfilr.supabase.co')return route.fulfill({status:200,body:''});
 let data=[];if(url.pathname.endsWith('/auth/v1/token')){refreshes++;data={access_token:'renewed-'+refreshes,refresh_token:'rotated-'+refreshes,expires_in:3600,user:{id:'fixture-admin',app_metadata:{role:'admin'}}};}
 if(url.pathname.endsWith('/auth/v1/user')&&rejectUserOnce){rejectUserOnce=false;return route.fulfill({status:401,body:'Expired session'})}
 if(url.pathname.endsWith('/auth/v1/user'))data={id:'fixture-admin',app_metadata:{role:trustedAdmin?'admin':'customer'}};
 if(url.pathname.endsWith('/blog_posts')){
 if(req.method()==='POST'||req.method()==='PATCH'){
 if(nextFailure){const failure=nextFailure;nextFailure=null;return route.fulfill({status:failure==='empty'?200:500,contentType:'application/json',body:failure==='empty'?'[]':'Save unavailable'})}
 const body=req.postDataJSON();writeToken=req.headers().authorization;writes.push(req.method());
 if(body.slug==='duplicate')return route.fulfill({status:409,body:'Duplicate slug'});
 if(req.method()==='POST'){data=[{...body,id:2}];posts.push(data[0])}else{const p=posts.find(p=>String(p.id)===url.searchParams.get('id').slice(3));Object.assign(p,body);data=[p]}
 }else data=url.searchParams.has('status')?posts.filter(p=>p.status==='published'):posts;
 }else if(url.pathname.endsWith('/products'))data=[{id:1,title:'Keyboard',stock:2,price:10,image_url:'https://images.example/product.png'}];
 else if(url.pathname.endsWith('/product_media'))data=[{id:1,media_type:'youtube',media_url:'https://youtu.be/abcdefghijk'}];
 return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1:8000'+base+'/blog/');
 await page.getByRole('link',{name:'Read article →'}).waitFor();
 assert.equal(await page.locator('.card img').count(),1);checks++;
 await page.locator('#search').fill('missing');await page.getByText('No matching articles').waitFor();checks++;
 await page.locator('#search').fill('');await page.getByRole('link',{name:'Read article →'}).click();
 await page.locator('#article:not(.hidden)').waitFor();assert.equal(await page.locator('#article').getAttribute('dir'),'rtl');assert.match(await page.locator('#article-body').textContent(),/<script>/);checks++;
 await page.locator('#back').click();assert.equal(await page.locator('meta[name=description]').getAttribute('content'),'Gaming guides, product insights and community news from TRISOCMD.');checks++;
 assert.equal(await page.locator('#admin').isVisible(),false);checks++;
 await page.evaluate(()=>sessionStorage.setItem('tc35_auth_session',JSON.stringify({access_token:'fixture-token',refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'fixture-admin',app_metadata:{role:'admin'}}})));
 await page.reload();await page.locator('#admin').waitFor({state:'visible'});await page.locator('#ui-language').selectOption('fa');assert.equal(await page.locator('html').getAttribute('dir'),'rtl');await page.getByRole('button',{name:'ذخیره مقاله',exact:true}).waitFor();await page.locator('#ui-language').selectOption('en');checks++;
 await page.locator('#title').fill('New article');await page.locator('#body').fill('Draft body');await page.locator('#cover').fill('http://unsafe.example/image');
 await page.getByRole('button',{name:'Save article',exact:true}).click();await page.getByText('Cover image must use HTTPS').waitFor();assert.equal(writes.length,0);checks++;
 await page.locator('#cover').fill('https://images.example/cover.png');await page.locator('#preview-draft').click();assert.match(await page.locator('#editor-preview').textContent(),/Draft body/);checks++;
 await page.getByRole('button',{name:'Save article',exact:true}).click();await page.getByText('Saved successfully').waitFor();assert.equal(await page.locator('#post-id').inputValue(),'2');checks++;
 await page.locator('#body').fill('Updated body');await page.getByRole('button',{name:'Save article',exact:true}).click();await page.getByText('Saved successfully').waitFor();assert.deepEqual(writes,['POST','PATCH']);checks++;
 await page.locator('#slug').fill('duplicate');await page.getByRole('button',{name:'Save article',exact:true}).click();await page.getByText('Request failed: 409').waitFor();assert.equal(await page.getByRole('button',{name:'Save article',exact:true}).isEnabled(),true);checks++;
 await page.locator('#slug').fill('new-article');
 for(const failure of ['empty','server']){
 nextFailure=failure;await page.getByRole('button',{name:'Save article',exact:true}).click();
 await page.getByText(failure==='empty'?'No article was saved.':'Request failed: 500',{exact:false}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Save article',exact:true}).isEnabled(),true);
 assert.equal(await page.locator('#post-id').inputValue(),'2');checks++;
 }
 await page.locator('#ui-language').selectOption('ar');
 assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
 await page.getByRole('button',{name:'حفظ المقال',exact:true}).waitFor();
 await page.locator('#language').selectOption('ar');
 await page.locator('#body').fill('<img src=x onerror=alert(1)> نص تجريبي');
 await page.locator('#preview-draft').click();
 assert.equal(await page.locator('#editor-preview').getAttribute('dir'),'rtl');
 assert.equal(await page.locator('#editor-preview img').count(),0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));checks++;
 await page.locator('#ui-language').selectOption('en');
 await page.locator('#slug').fill('new-article');await page.locator('#status').selectOption('published');await page.getByRole('button',{name:'Save article',exact:true}).click();await page.getByText('Saved successfully').waitFor();assert.ok(posts[1].published_at);checks++;
 await page.locator('#status').selectOption('archived');await page.getByRole('button',{name:'Save article',exact:true}).click();await page.getByText('Saved successfully').waitFor();assert.equal(posts[1].published_at,null);assert.equal(posts[1].status,'archived');checks++;
 // Keep the editor open past token expiry: saving must refresh without reload.
 await page.clock.install();await page.clock.setFixedTime(Date.now()+3700*1000);
 await page.locator('#body').fill('Saved after session expiry');
 const beforeRefresh=refreshes;await page.getByRole('button',{name:'Save article',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('message').textContent.includes('Saved successfully'));
 assert.equal(refreshes,beforeRefresh+1);assert.equal(writeToken,'Bearer renewed-'+refreshes);checks++;
 const renewed=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('tc35_auth_session')));
 assert.ok(renewed.expires_at>Math.floor(Date.now()/1000)+3600);checks++;
 // A server 401 must also renew sessions whose cached expiry appears valid.
 rejectUserOnce=true;const before401=refreshes;
 await page.getByRole('button',{name:'Save article',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('message').textContent.includes('Saved successfully'));
 assert.equal(refreshes,before401+1);assert.equal(writeToken,'Bearer renewed-'+refreshes);checks++;
 // Changing the server-confirmed role must block an already-open editor.
 trustedAdmin=false;const beforeDenied=writes.length;
 await page.getByRole('button',{name:'Save article',exact:true}).click();
 await page.locator('#admin').waitFor({state:'hidden'});assert.equal(writes.length,beforeDenied);checks++;
 trustedAdmin=false;await page.reload();await page.getByRole('link',{name:'Read article →'}).waitFor();assert.equal(await page.locator('#admin').isVisible(),false);checks++;
 await page.goto('http://127.0.0.1:8000'+base+'/product.html?id=1');await page.getByRole('heading',{name:'Keyboard',exact:true}).waitFor();assert.equal(await page.locator('#hero').getAttribute('src'),'https://images.example/product.png');assert.equal(await page.locator('iframe').getAttribute('src'),'https://www.youtube-nocookie.com/embed/abcdefghijk');checks++;
 assert.deepEqual(errors,[]);checks++;await context.close();
 }
 console.log(`${checks} browser checks passed (root and preview; mocked API).`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
