// Render actual styles at each acceptance width; only API responses are synthetic.
import{chromium}from'playwright';import assert from'node:assert/strict';import{mkdir,writeFile,readFile}from'node:fs/promises';import{createHash}from'node:crypto';
const base='http://127.0.0.1:8765',api='https://cxtytbjvdlngahytfilr.supabase.co',out='work/auth-layout',cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
const fixture={access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600,user:{id:'00000000-0000-4000-8000-000000000001',email:'synthetic@example.test'}};
await mkdir(out,{recursive:true});const browser=await chromium.launch({executablePath:process.env.TRISO_CHROMIUM_PATH||undefined,args:['--no-sandbox']});const evidence=[];let renderings=0,statusRenderings=0,oauthCases=0;
try{
 for(const path of ['/index.html','/preview/index.html']){
  const context=await browser.newContext({viewport:{width:1365,height:1000}}),errors=[];let google=true,settingsStatus=200,settingsOffline=false,settingsCalls=0,authorizations=0,exchanges=0,expectedChallenge='';
  await context.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url());if(u.origin===base)return route.continue();if(u.origin!==api)return route.abort();if(r.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});let body=[];
   if(u.pathname==='/auth/v1/settings'){settingsCalls++;await new Promise(resolve=>setTimeout(resolve,60));if(settingsOffline)return route.abort();return route.fulfill({status:settingsStatus,headers:cors,contentType:'application/json',body:JSON.stringify({external:{google}})})}
   if(u.pathname==='/auth/v1/authorize'){
    authorizations++;assert.equal(u.searchParams.get('provider'),'google');assert.equal(u.searchParams.get('redirect_to'),base+path);assert.equal(u.searchParams.get('code_challenge_method'),'s256');
    expectedChallenge=u.searchParams.get('code_challenge');assert(expectedChallenge);
    return route.fulfill({status:302,headers:{location:base+path+'?code=synthetic-google-code'}});
   }
   if(u.pathname==='/auth/v1/token'&&u.searchParams.get('grant_type')==='pkce'){exchanges++;assert.equal(r.postDataJSON().auth_code,'synthetic-google-code');assert.equal(createHash('sha256').update(r.postDataJSON().code_verifier).digest('base64url'),expectedChallenge);body=fixture}
   if(u.pathname==='/auth/v1/user')body=fixture.user;
   if(u.pathname.endsWith('/rpc/is_admin'))body=false;
   if(u.pathname.endsWith('/rpc/notification_page'))body={items:[],unread:0,last_read_id:0};
   if(u.pathname.endsWith('/rpc/market_browse_page'))body={items:[],has_more:false};
   return route.fulfill({status:200,headers:cors,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+path);await page.waitForFunction(()=>!!window.TrisoAuthUI);if(path==='/index.html')await page.waitForFunction(()=>window.tcPhase1BootstrapComplete);else await page.waitForLoadState('networkidle');
  for(const width of [390,768,1365,1920])for(const [lang,dir]of [['en','ltr'],['fa','rtl'],['ar','rtl']]){
   await page.setViewportSize({width,height:1000});
   for(const mode of ['signin','signup','forgot','reset','verify']){
    await page.evaluate(({lang,dir,mode})=>{TrisoAuthUI.language(lang);tc31CallbackMode(mode)},{lang,dir,mode});
    await page.evaluate(()=>new Promise(requestAnimationFrame));assert.equal(await page.locator('#tc37-welcome.open').count(),0,'auth language changes must not open welcome overlay');
    const measurement=await page.evaluate(mode=>{
     const id={signin:'tc31-login-form',signup:'tc31-signup-view',forgot:'tc31-forgot-view',reset:'tc31-recovery-shell',verify:'tc31-verification'}[mode],root=document.getElementById(id),card=root.matches('.tc-auth-card')?root:root.querySelector('.tc-auth-card'),box=card.getBoundingClientRect(),input=root.querySelector('input[type=email],input[type=password],input[type=text]'),ib=input.getBoundingClientRect(),cs=getComputedStyle(card),label=root.querySelector('label[for="tc31-password"]');
     const toggle=root.querySelector('[data-auth-reveal]'),tb=toggle?.getBoundingClientRect(),password=toggle&&document.getElementById(toggle.getAttribute('aria-controls')).getBoundingClientRect();
     return {width:box.width,center:(box.left+box.right)/2,viewport:innerWidth,inputWidth:ib.width,contentWidth:box.width-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)-2,labelHeight:label?.getBoundingClientRect().height,labelLineHeight:label&&parseFloat(getComputedStyle(label).lineHeight),overflow:document.documentElement.scrollWidth-innerWidth,toggle:tb?.toJSON(),password:password?.toJSON(),toggleAligned:!tb||(tb.left>=password.left&&tb.right<=password.right&&tb.top>=password.top-1&&tb.bottom<=password.bottom+1)};
    },mode);
    assert(measurement.width>=Math.min(420,width-32)&&measurement.width<=480,JSON.stringify({path,width,lang,mode,...measurement}));
    assert(Math.abs(measurement.center-width/2)<=1,'auth card must be centered');assert(Math.abs(measurement.inputWidth-measurement.contentWidth)<=2,'inputs must fill card content width');assert(measurement.overflow<=1,'no horizontal page overflow');assert(measurement.toggleAligned,JSON.stringify({path,width,lang,mode,...measurement}));
    if(mode==='signin'&&lang==='en')assert(measurement.labelHeight<28,'Password must remain on one line');
    evidence.push({path,viewport:width,lang,mode,cardWidth:measurement.width,inputWidth:measurement.inputWidth});renderings++;
    // Exercise rendered notices at every size, independent of Auth API behavior tests.
    for(const state of ['error','success']){
     const statusBox=await page.evaluate(({mode,state})=>{
      const ids={signin:'tc-v23-login-feedback',signup:'tc-v23-signup-feedback',forgot:'tc31-reset-feedback',reset:'tc-v22-recovery-feedback',verify:'tc31-resend-feedback'},el=document.getElementById(ids[mode]);
      TrisoAuthUI.set(el,state==='error'?'Unable to complete the request. Please try again.':'If an account exists for this email, we sent a reset link. Check inbox and spam.');el.hidden=false;el.dataset.state=state;
      return {overflow:el.scrollWidth-el.clientWidth,width:el.getBoundingClientRect().width};
     },{mode,state});assert(statusBox.overflow<=1&&statusBox.width>200,'notice must fit card');statusRenderings++;
     if(path==='/index.html'&&width===1365&&lang==='en')await page.locator('#tc31-panel .tc31-wrap').screenshot({path:out+'/'+mode+'-'+state+'.png'});
    }
    await page.evaluate(mode=>{const ids={signin:'tc-v23-login-feedback',signup:'tc-v23-signup-feedback',forgot:'tc31-reset-feedback',reset:'tc-v22-recovery-feedback',verify:'tc31-resend-feedback'};document.getElementById(ids[mode]).hidden=true},mode);

    if(path==='/index.html'&&(lang==='en'||width===390||width===1365)){
     const name=mode+'-'+lang+'-'+width;await page.locator('#tc31-panel .tc31-wrap').screenshot({path:out+'/'+name+'.png'});
     if(mode==='signin'&&lang==='en')await page.screenshot({path:out+'/page-'+name+'.png',fullPage:true});
    }
   }
  }
  await page.setViewportSize({width:1365,height:1000});await page.evaluate(()=>{TrisoAuthUI.language('en');tc31CallbackMode('signin')});
  const signIn=page.locator('#tc31-login-form .tc-auth-google');
  google=false;await signIn.click();await page.locator('#tc-v23-login-feedback[data-state=error]').waitFor();assert.match(await page.locator('#tc-v23-login-feedback').textContent(),/not configured/);assert.equal(authorizations,0);assert.equal(await signIn.isDisabled(),false);oauthCases++;
  if(path==='/index.html')await page.locator('#tc31-panel .tc31-wrap').screenshot({path:out+'/signin-error-en-1365.png'});
  google=true;settingsStatus=429;await signIn.click();await page.waitForFunction(()=>document.getElementById('tc-v23-login-feedback').textContent.includes('Too many requests'));assert.equal(authorizations,0);oauthCases++;
  settingsStatus=200;settingsOffline=true;await signIn.click();await page.waitForFunction(()=>document.getElementById('tc-v23-login-feedback').textContent.includes('Network unavailable'));assert.equal(authorizations,0);settingsOffline=false;oauthCases++;
  const before=settingsCalls;await page.evaluate(()=>{void tc31Google();void tc31Google()});await page.waitForFunction(()=>document.getElementById('tc31-panel')?.dataset.authMode==='account');assert.equal(settingsCalls,before+1);assert.equal(authorizations,1);assert.equal(exchanges,1);assert.equal(await page.evaluate(()=>sessionStorage.getItem('tc35_google_pkce')),null);assert.equal(await page.evaluate(()=>TrisoAuth.read()?.user?.id),fixture.user.id);assert.equal(new URL(page.url()).search,'');oauthCases++;
  assert(await page.evaluate(()=>localStorage.getItem('tc35_auth_session')),'Remember Me keeps OAuth login');
  await page.evaluate(async()=>{await tc31Logout();showScreen('tc31-panel')});await page.locator('#tc31-remember').uncheck();await signIn.click();await page.waitForFunction(()=>document.getElementById('tc31-panel')?.dataset.authMode==='account');assert.equal(authorizations,2);assert.equal(exchanges,2);assert.equal(await page.evaluate(()=>localStorage.getItem('tc35_auth_session')),null);assert(await page.evaluate(()=>sessionStorage.getItem('tc35_auth_session')));oauthCases++;

  assert.deepEqual(errors,[]);await context.unrouteAll({behavior:'ignoreErrors'});await context.close();console.log('PASS '+path+' rendered card/input/label/toggle geometry at four widths in EN/FA/AR; provider failures and mocked PKCE roundtrip');
 }
 await writeFile(out+'/measurements.json',JSON.stringify({renderings,statusRenderings,oauthCases,evidence},null,2)+'\n');
 // Browser-rendered contact sheets preserve the original rendered captures as separate files.
 const sheet=await browser.newPage({viewport:{width:1280,height:1000}});await sheet.route('**/*',r=>r.abort());
 for(const group of ['en','rtl','states']){
  let figures='';const names=[];
  if(group==='states')for(const state of ['error','success'])for(const mode of ['signin','signup','forgot','reset','verify'])names.push(mode+'-'+state);
  else for(const lang of group==='en'?['en']:['fa','ar'])for(const width of group==='en'?[390,768,1365,1920]:[390,1365])for(const mode of ['signin','signup','forgot','reset','verify'])names.push(mode+'-'+lang+'-'+width);
  for(const name of names){const png=(await readFile(out+'/'+name+'.png')).toString('base64');figures+='<figure><figcaption>'+name+'</figcaption><img src="data:image/png;base64,'+png+'"></figure>'}
  await sheet.setContent('<html><head><style>body{margin:0;background:#24222a;color:white;font:14px system-ui}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}figure{margin:0}figcaption{padding:8px}img{width:100%;height:auto;display:block}</style></head><body><div class="grid">'+figures+'</div></body></html>');await sheet.screenshot({path:out+'/contact-'+group+'.png',fullPage:true});
 }
 console.log('PASS '+renderings+' rendered layouts, '+statusRenderings+' notice layouts, '+oauthCases+' mocked OAuth scenarios; screenshots/measurements in '+out+' (no real Google login claimed)');
}finally{await browser.close()}
