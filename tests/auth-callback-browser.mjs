// Isolated UI regressions: every non-loopback request is mocked or blocked.
import {chromium} from 'playwright';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const base='http://127.0.0.1:8765',api='https://cxtytbjvdlngahytfilr.supabase.co',cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
const fixture={access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600,user:{id:'00000000-0000-4000-8000-000000000001',email:'synthetic@example.test',email_confirmed_at:'2026-01-01T00:00:00Z'}};
const browser=await chromium.launch({executablePath:process.env.TRISO_CHROMIUM_PATH||undefined,args:['--no-sandbox']});let cases=0;
try{
 for(const path of ['/index.html','/preview/index.html']){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[],calls=[];
  let signupMode='ok',loginMode='ok',verifyMode='ok';
  await context.route('**/*',async route=>{
   const request=route.request(),u=new URL(request.url());if(u.origin===base)return route.continue();if(u.origin!==api)return route.abort();
   if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
   const method=request.method(),data=request.postDataJSON?.();calls.push({path:u.pathname,method,query:u.search,body:data});let body=[],status=200;
   if(u.pathname==='/auth/v1/signup'){await new Promise(r=>setTimeout(r,80));body=signupMode==='session'?{...fixture,user:{...fixture.user,email_confirmed_at:null}}:{user:{id:fixture.user.id}};if(signupMode==='rate'){status=429;body={code:'over_email_send_rate_limit'}}}
   if(u.pathname==='/auth/v1/verify'){body=fixture;if(verifyMode==='expired'){status=403;body={code:'otp_expired'}}}
   if(u.pathname==='/auth/v1/token'){if(loginMode==='offline')return route.abort();body=fixture;if(loginMode!=='ok'){status=loginMode==='rate'?429:400;body={code:loginMode==='rate'?'over_request_rate_limit':loginMode==='unconfirmed'?'email_not_confirmed':'invalid_credentials'}}}
   if(u.pathname==='/auth/v1/user')body=method==='PUT'?{}:fixture.user;
   if(u.pathname.endsWith('/rpc/is_admin'))body=false;
   if(u.pathname.endsWith('/rpc/notification_page'))body={items:[],unread:0,last_read_id:0};
   if(u.pathname.endsWith('/rpc/market_browse_page'))body={items:[],has_more:false};
   if(u.pathname==='/functions/v1/store-crypto')body={enabled:false,paypal_enabled:false,schema_version:1};
   return route.fulfill({status,headers:cors,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  async function open(suffix=''){
   await page.goto('about:blank');await page.goto(base+path+suffix);await page.waitForFunction(()=>typeof window.tc31Register==='function'&&!!window.TrisoAuthUI);
   if(path==='/index.html')await page.waitForFunction(()=>window.tcPhase1BootstrapComplete===true);
   await page.evaluate(()=>document.getElementById('tc37-welcome')?.classList.remove('open'));
  }
  async function emptySession(){await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()})}
  async function fields(){await page.locator('#tc31-signup-name').fill('Synthetic Player');await page.locator('#tc31-signup-email').fill('synthetic@example.test');await page.locator('#tc31-signup-password').fill('synthetic-password-123');await page.locator('#tc31-signup-confirm').fill('synthetic-password-123')}
  await open();await emptySession();
  for(const [lang,dir] of [['en','ltr'],['fa','rtl'],['ar','rtl']]){
   for(const width of [390,1280]){
    await page.setViewportSize({width,height:844});await page.evaluate(({lang,dir})=>{setLang(lang,dir,'navbar');showScreen('tc31-panel');tc31ShowSignup()},{lang,dir});
    await page.waitForFunction(l=>document.querySelector('.tc31-heading[data-auth-copy]')?.textContent===TrisoAuthUI.t('Create account'),lang);
    await page.waitForFunction(()=>document.activeElement.id==='tc31-signup-name');
    assert.equal(await page.evaluate(()=>document.documentElement.dir),dir);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=1,'no horizontal overflow');
    const card=await page.locator('#tc31-signup-view .tc-auth-card').boundingBox();assert(card.width>=Math.min(420,width-32)&&card.width<=440&&card.height<760,JSON.stringify({path,lang,width,card}));
    assert.equal(await page.locator('label[for=tc31-signup-email]').textContent(),await page.evaluate(()=>TrisoAuthUI.t('Email address')));
    await page.locator('#tc31-signup-password').focus();await page.keyboard.press('Tab');assert.equal(await page.locator('[aria-controls=tc31-signup-password]').evaluate(e=>e===document.activeElement),true,'keyboard reaches reveal');
    if(path==='/index.html'&&width===390)await page.screenshot({path:'/tmp/triso-auth-signup-'+lang+'.png',fullPage:true});
    await fields();const before=calls.filter(c=>c.path==='/auth/v1/signup').length;
    await page.evaluate(()=>Promise.all([tc31Register(),tc31Register()]));
    await page.waitForFunction(()=>document.getElementById('tc31-panel').dataset.authMode==='signin');
    assert.equal(calls.filter(c=>c.path==='/auth/v1/signup').length,before+1,'single signup request');
    assert.equal(await page.locator('#tc31-signup-password').inputValue(),'');assert.equal(await page.locator('#tc31-signup-confirm').inputValue(),'');
    assert.equal(await page.evaluate(()=>TrisoAuth.read()),null,'no automatic signup login');
    assert.equal(await page.locator('#tc-v23-login-feedback').getAttribute('data-state'),'success');
    assert.equal(await page.locator('#tc-v23-login-feedback').textContent(),await page.evaluate(()=>TrisoAuthUI.t('Account created. Check your inbox to verify your email before signing in.')));
    cases++;
   }
  }
  console.log('PASS '+path+' six signup layout/language cases');
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{setLang('en','ltr','navbar');showScreen('tc31-panel');tc31ShowSignup()});await fields();signupMode='session';await page.evaluate(()=>tc31Register());assert.equal(await page.evaluate(()=>TrisoAuth.read()),null);assert(calls.some(c=>c.path==='/auth/v1/logout'&&c.query.includes('scope=local')));signupMode='ok';cases++;
  await page.evaluate(()=>tc31ShowSignup());await fields();signupMode='rate';await page.evaluate(()=>tc31Register());assert.match(await page.locator('#tc-v23-signup-feedback').textContent(),/Too many requests/);assert.equal(await page.locator('#tc31-signup-form button[type=submit]').isDisabled(),false);signupMode='ok';cases++;
  await page.evaluate(()=>tc31HideSignup());await page.locator('#tc31-email').fill('synthetic@example.test');await page.locator('#tc31-password').fill('synthetic-password-123');
  for(const [mode,expected] of [['invalid',/incorrect/],['unconfirmed',/Verify your email/],['rate',/Too many requests/],['offline',/Network unavailable/]]){loginMode=mode;await page.evaluate(()=>tc31Email('login'));assert.match(await page.locator('#tc-v23-login-feedback').textContent(),expected);assert.equal(await page.locator('#tc-v22-login-submit').isDisabled(),false);cases++}loginMode='ok';
  await page.evaluate(()=>{document.getElementById('tc31-remember').checked=false;document.getElementById('tc31-remember').dispatchEvent(new Event('change'))});await page.evaluate(()=>tc31Email('login'));assert.equal(await page.evaluate(()=>localStorage.getItem('tc35_auth_session')),null);assert(await page.evaluate(()=>sessionStorage.getItem('tc35_auth_session')));await page.reload();await page.waitForFunction(()=>document.getElementById('tc31-panel').dataset.authMode==='account');await page.evaluate(()=>tc31Logout());cases++;
  await page.evaluate(()=>showScreen('tc31-panel'));await page.locator('#tc31-email').fill('synthetic@example.test');await page.locator('#tc31-remember').check();await page.locator('#tc31-password').fill('synthetic-password-123');await page.evaluate(()=>tc31Email('login'));assert(await page.evaluate(()=>localStorage.getItem('tc35_auth_session')));await page.reload();await page.waitForFunction(()=>document.getElementById('tc31-panel').dataset.authMode==='account');await page.evaluate(()=>tc31Logout());cases++;
  await open('?type=signup&token_hash=synthetic-confirmation');await page.waitForFunction(()=>document.getElementById('tc-v23-login-feedback').dataset.state==='success');assert.match(await page.locator('#tc-v23-login-feedback').textContent(),/Email verified/);assert.equal(await page.locator('#tc31-recovery-form').isVisible(),false);assert.equal(new URL(page.url()).search,'');assert.equal(await page.evaluate(()=>TrisoAuth.read()),null);cases++;
  verifyMode='expired';await open('?type=signup&token_hash=synthetic-expired');await page.locator('#tc31-verification').waitFor({state:'visible'});assert.match(await page.locator('#tc31-resend-feedback').textContent(),/verification link/);await page.locator('#tc31-resend-email').fill('synthetic@example.test');await page.locator('#tc31-resend-form button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('tc31-resend-feedback').dataset.state==='success');const resend=calls.findLast(c=>c.path==='/auth/v1/resend');assert.equal(resend.body.type,'signup');assert.equal(new URLSearchParams(resend.query).get('redirect_to'),base+path);verifyMode='ok';cases++;
  await open('#error=access_denied&error_code=otp_expired&error_description=synthetic-private-detail');await page.locator('#tc-v23-login-feedback[data-state=error]').waitFor({state:'visible'});assert.equal(await page.locator('#tc31-recovery-form').isVisible(),false);assert(!await page.locator('#tc31-panel').textContent().then(s=>s.includes('synthetic-private-detail')));cases++;
  await open('#access_token=synthetic-access&refresh_token=synthetic-refresh&type=recovery');await page.locator('#tc31-recovery-form').waitFor({state:'visible'});assert.equal(await page.locator('#tc31-guest').isVisible(),false);assert.equal(await page.evaluate(()=>localStorage.getItem('tc35_auth_session')),null);assert.equal(new URL(page.url()).hash,'');
  await page.locator('#tc31-new-password').fill('synthetic-new-password');await page.locator('#tc31-confirm-new-password').fill('synthetic-new-password');await page.locator('#tc31-update-password-button').click();await page.waitForFunction(()=>document.getElementById('tc31-panel').dataset.authMode==='signin');assert.match(await page.locator('#tc-v23-login-feedback').textContent(),/password was changed/);assert.equal(await page.evaluate(()=>TrisoAuth.read()),null);cases++;
  await open('#access_token=synthetic-oauth&refresh_token=synthetic-refresh');await page.waitForFunction(()=>document.getElementById('tc31-panel').dataset.authMode==='account');assert.equal(await page.locator('#tc31-recovery-form').isVisible(),false);await page.evaluate(()=>tc31Logout());cases++;
  // Password reset request stays on the same origin and path.
  await page.evaluate(()=>{tc31ShowForgot();document.getElementById('tc31-forgot-email').value='synthetic@example.test'});await page.evaluate(()=>tc31Reset());assert.equal(new URLSearchParams(calls.findLast(c=>c.path==='/auth/v1/recover').query).get('redirect_to'),base+path);cases++;
  await page.locator('#tc-auth-language').selectOption('ar');await page.evaluate(()=>tc31HideSignup());await page.waitForFunction(()=>document.documentElement.dir==='rtl');await page.addScriptTag({content:readFileSync('node_modules/axe-core/axe.min.js','utf8')});const violations=await page.evaluate(async()=>{const r=await axe.run('#tc31-panel',{runOnly:{type:'tag',values:['wcag2a','wcag2aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});assert.deepEqual(violations,[],'auth accessibility');cases++;
  await page.screenshot({path:'/tmp/triso-auth-'+(path.includes('preview')?'preview':'main')+'.png',fullPage:true});
  assert.deepEqual(errors,[],'no page errors');console.log('PASS '+path+' auth callbacks, signup, errors, persistence, EN/FA/AR mobile/desktop, keyboard and axe');await context.close();
 }
 console.log('PASS '+cases+' focused mocked browser scenarios; no hosted email/OAuth delivery is claimed');
}finally{await browser.close()}
