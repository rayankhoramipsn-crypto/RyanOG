// Local runner safety tests. These do not contact Supabase or prove live behavior.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {NAMES,CASES,launchOptions,allowMutation,main}=require('./blog-live.cjs');
test('missing Secrets blocks execution and marks every live case NOT_RUN',async()=>{
 let output='';const original=console.log;let code;
 try{console.log=value=>{output+=value};code=await main({});}finally{console.log=original}
 assert.equal(code,2);const report=JSON.parse(output);
 assert.deepEqual(report.missing,NAMES);assert.equal(report.results.length,CASES.length);assert.ok(report.results.every(r=>r.status==='NOT_RUN'));
});
test('Chromium child environment excludes user Secrets, admin keys and diagnostics',()=>{
 const env={PATH:'/bin',HTTPS_PROXY:'http://proxy:8080',DEBUG:'pw:api',PWDEBUG:'1',SUPABASE_SERVICE_ROLE_KEY:'sentinel-admin'};
 for(const name of NAMES)env[name]='sentinel-user';
 const opts=launchOptions(env);for(const name of [...NAMES,'DEBUG','PWDEBUG','SUPABASE_SERVICE_ROLE_KEY'])assert.equal(opts.env[name],undefined);
 assert.equal(opts.proxy.server,env.HTTPS_PROXY);assert.match(opts.proxy.bypass,/127.0.0.1/);assert.equal(opts.env.PATH,'/bin');
});
test('POST requires this run prefix; PATCH/DELETE require an owned ID or exact prefix',()=>{
 const prefix='live-blog-unique',ids=new Set(['own-id']);
 const url=query=>new URL('https://cxtytbjvdlngahytfilr.supabase.co/rest/v1/blog_posts'+query);
 assert.equal(allowMutation('POST',url(''),{slug:prefix+'-draft'},ids,prefix),true);
 assert.equal(allowMutation('POST',url(''),{slug:'existing'},ids,prefix),false);
 for(const method of ['PATCH','DELETE']){
  assert.equal(allowMutation(method,url(''),null,ids,prefix),false);
  assert.equal(allowMutation(method,url('?id=eq.other'),null,ids,prefix),false);
  assert.equal(allowMutation(method,url('?id=eq.own-id'),null,ids,prefix),true);
  assert.equal(allowMutation(method,url('?slug=like.'+prefix+'*'),null,ids,prefix),true);
  assert.equal(allowMutation(method,url('?slug=like.live-blog-*'),null,ids,prefix),false);
 }
 assert.equal(allowMutation('PATCH',url('?id=eq.own-id'),{slug:'outside-run'},ids,prefix),false);
});
