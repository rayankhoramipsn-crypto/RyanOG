import {chromium} from 'playwright';import assert from 'node:assert/strict';
const base=process.env.TRISO_TEST_BASE||'http://127.0.0.1:8765',api='https://cxtytbjvdlngahytfilr.supabase.co',owner='00000000-0000-4000-8000-000000000001';
const browser=await chromium.launch({executablePath:process.env.TRISO_CHROMIUM_PATH||undefined,args:['--no-sandbox']});
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
try{
 const context=await browser.newContext();const errors=[],offsets=[],sends=[];let profile,deny=false,failSend=true,adminMode=false,proGrant;
 const own=Array.from({length:241},(_,i)=>({id:i+1,title:'Own listing '+(i+1),platform:'Gaming Gear',description:'A valid synthetic seller description',price:15,status:'pending',submitted_at:'2026-01-01'}));
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await context.addInitScript(({owner})=>{if(location.hostname!=='127.0.0.1')return;localStorage.setItem('tc35_auth_session',JSON.stringify({access_token:'mock',refresh_token:'mock-refresh',expires_at:Date.now()/1000+3600,user:{id:owner,email:'seller@example.test'}}))},{owner});
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url()),r=route.request();if(u.origin===new URL(base).origin)return route.continue();if(u.origin!==api)return route.abort();
  if(r.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  let data=[],status=200;const path=u.pathname;
  if(path.endsWith('/rpc/is_admin'))data=adminMode;
  if(path.endsWith('/rpc/market_set_pro_until')){proGrant=r.postDataJSON();data=null}
  if(path.endsWith('/rpc/market_browse_page'))data={items:[{...own[0],status:'approved'}],has_more:false};
  if(path.endsWith('/market_listings')){const n=Number(u.searchParams.get('offset')||0);offsets.push(n);data=own.slice(n,n+100)}
  if(path.endsWith('/market_seller_public_profiles')){if(r.method()==='POST'){profile=r.postDataJSON();data=null}else data=profile?[profile]:[]}
  if(path.endsWith('/rpc/market_seller_profile'))data=profile?.is_public?profile:null;
  if(path.endsWith('/rpc/market_edit_listing')){const p=r.postDataJSON();Object.assign(own.find(x=>x.id===p.p_listing),{title:p.p_title,description:p.p_description,price:p.p_price,status:'pending'});data=null}
  if(path.endsWith('/rpc/market_inbox_page'))data=[{id:1,listing_id:1,listing_title:'Chat fixture',seller_id:owner,buyer_id:'peer',unread_count:1}];
  if(path.endsWith('/market_messages')){
   if(deny){status=403;data={message:'Permission revoked'}}else{
    const oldest=u.searchParams.get('id')?1:21,max=oldest===1?20:220;
    data=Array.from({length:max-oldest+1},(_,i)=>({id:oldest+i,sender_id:'peer',body:'Message '+(oldest+i),created_at:'2026-01-01'})).reverse();
   }
  }
  if(path.endsWith('/rpc/market_send_message_once')){sends.push(r.postDataJSON());if(failSend){failSend=false;status=503;data={message:'Uncertain response'}}else data=221}
  if(path.endsWith('/rpc/market_mark_read_to'))data=null;
  return route.fulfill({status,headers:cors,contentType:'application/json',body:JSON.stringify(data)});
 });
 const page=await context.newPage();page.setDefaultTimeout(15000);
 for(const path of ['/marketplace.html','/preview/marketplace.html']){
  offsets.length=0;await page.goto(base+path);await page.locator('.submission').filter({hasText:'Own listing 241'}).waitFor();
  assert.deepEqual(offsets,[0,100,200]);await page.locator('#language').selectOption('en');
  const row=page.locator('.submission').filter({hasText:'Own listing 241'});await row.getByRole('button',{name:'Edit listing',exact:true}).click();
  await page.locator('#edit-title').fill('Updated workflow listing');await page.locator('#edit-save').click();
  await page.locator('.submission').filter({hasText:'Updated workflow listing'}).waitFor();own[240].title='Own listing 241';
  await page.locator('#seller-profile-edit').click();await page.locator('#profile-name').fill('Public Workflow Seller');await page.locator('#profile-bio').fill('<img src=x onerror=alert(1)> plain biography');await page.locator('#profile-public').check();await page.locator('#profile-save').click();
  await page.waitForFunction(()=>!document.querySelector('#profile-edit-dialog').open);assert.equal(profile.user_id,owner);assert.equal(profile.is_pro,undefined);
  await page.locator('.item-card button').first().click();await page.locator('#view-seller-profile').click();await page.locator('#public-seller-name').filter({hasText:'Public Workflow Seller'}).waitFor();assert.equal(await page.locator('#public-seller-bio img').count(),0);
  await page.locator('[data-close="profile-dialog"]').click();await page.locator('#detail-dialog .close').click();
  await page.setViewportSize({width:390,height:850});for(const lang of ['fa','ar']){await page.locator('#language').selectOption(lang);assert.equal(await page.locator('html').getAttribute('dir'),'rtl');assert(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=5)}
 }
 console.log('PASS main/preview seller history #241, edit/review form, public profile and safe RTL rendering');
 await page.locator('#open-messages').click();await page.locator('.thread-button').first().click();await page.getByText('Message 220',{exact:true}).waitFor();assert.equal(await page.getByText('Message 1',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Load earlier messages',exact:true}).click();await page.getByText('Message 1',{exact:true}).waitFor();
 await page.locator('#chat-body').fill('Retry this message');await page.locator('#chat-send').click();await page.locator('#chat-state').filter({hasText:'Message not sent'}).waitFor();await page.locator('#chat-send').click();await page.locator('#chat-state').filter({hasText:'Sent'}).waitFor();assert.equal(sends.length,2);assert.equal(sends[0].p_key,sends[1].p_key);
 deny=true;await page.locator('.thread-button').first().click();await page.locator('#chat-state').filter({hasText:'Permission revoked'}).waitFor();assert.equal(await page.locator('.bubble').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS latest messages beyond 200, earlier history, stable send retry key and permission revocation clearing');
 adminMode=true;await page.goto(base+'/admin/');await page.getByLabel('Seller user UUID').fill(owner);await page.getByLabel('Enable Seller Pro').check();await page.getByLabel('Pro expiry (optional)').fill('2027-01-01T12:00');await page.getByRole('button',{name:'Save Seller Pro',exact:true}).click();await page.getByText('Seller Pro permissions saved.',{exact:true}).waitFor();assert.equal(proGrant.p_user,owner);assert.equal(proGrant.p_enabled,true);assert(proGrant.p_until);assert.deepEqual(errors,[]);console.log('PASS authorized admin Seller Pro form with expiry and no payment activation');

 await context.close();
}finally{await browser.close()}
