// Owner-operated staging diagnostics: no payments, jobs, record writes or token output.
export const stagingAPI='https://cxtytbjvdlngahytfilr.supabase.co';
const key='sb_publishable_AqZWjpgyZ_h6-EKwOySyGQ_0LE8bcRm';
async function request(fetcher,path,{token,method='GET',body,webhook=false}={}){
 return fetcher(stagingAPI+path,{method,credentials:'omit',redirect:'error',cache:'no-store',headers:{...(webhook?{}:{apikey:key}),...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':webhook?'text/plain':'application/json'}:{})},body,signal:AbortSignal.timeout(10000)});
}
export async function checkEdges(fetcher=fetch){
 const checks=[
  ['Crypto readiness','store-crypto','GET',async r=>r.status===200&&await r.json().then(v=>v.schema_version===1&&v.enabled===false&&v.paypal_enabled===false)],
  ['Delivery hold','delivery-worker','GET',async r=>r.status===200&&await r.json().then(v=>v.email_enabled===false&&v.push_enabled===false)],
  ['Store rejects anonymous POST','store-crypto','POST',async r=>r.status===401],
  ['Worker rejects anonymous POST','delivery-worker','POST',async r=>[401,503].includes(r.status)],
  ['Payment webhook disabled','payment-webhook','POST',async r=>r.status===503&&(await r.text())==='Provider not configured'],
  ['Delivery webhook rejects unsigned input','delivery-webhook','POST',async r=>[401,503].includes(r.status)]
 ];const results=[];
 for(const [name,fn,method,accept]of checks){try{const r=await request(fetcher,'/functions/v1/'+fn,{method,webhook:fn.endsWith('webhook'),...(method==='POST'?{body:'{}'}:{})});if(fn.endsWith('webhook')){results.push({name,status:0,pass:null,note:'Inspect webhook HTTP status in browser Network panel; CORS intentionally hides the response'});continue}results.push({name,status:r.status,pass:await accept(r)})}catch{results.push({name,status:0,pass:fn.endsWith('webhook')?null:false,note:fn.endsWith('webhook')?'Manual webhook HTTP status inspection required; browser CORS hides the response':'Network/CORS request failed'})}}
 return results;
}
export async function checkSession(session,expected,fetcher=fetch){
 if(!session?.access_token||!session.user?.id)return {name:'Dedicated session',pass:false,note:'Sign in to the staging shop first'};
 try{
  const r=await request(fetcher,'/auth/v1/user',{token:session.access_token});if(r.status!==200)return {name:'Dedicated session',pass:false,status:r.status};
  const user=await r.json();if(user.id!==session.user.id)return {name:'Dedicated session',pass:false,note:'Identity mismatch'};
  const values=[];for(const name of ['phase1_is_admin','support_is_staff']){const r=await request(fetcher,'/rest/v1/rpc/'+name,{token:session.access_token,method:'POST',body:'{}'});if(!r.ok)throw Error();values.push(await r.json())}
  return {name:'Dedicated session and role',pass:values[0]===(expected==='admin')&&values[1]===['admin','support'].includes(expected),note:'Does not verify cross-account RLS or Storage access'};
 }catch{return {name:'Dedicated session and role',pass:false,note:'Auth/RPC request failed'}}
}
if(typeof document!=='undefined'){
 const allowed=location.origin==='https://trisocmd-staging-review.rayankhoramipsn.chatgpt.site'||['localhost','127.0.0.1'].includes(location.hostname);
 const output=document.getElementById('results');let results=[];
 const paint=()=>{output.textContent=JSON.stringify({target:'cxtytbjvdlngahytfilr',checks:results},null,2)};
 for(const id of ['check-edges','check-session']){const button=document.getElementById(id);button.disabled=!allowed;button.onclick=async()=>{button.disabled=true;try{
  if(id==='check-edges')results=await checkEdges();else if(document.getElementById('dedicated').checked)results.push(await checkSession(window.TrisoAuth?.read(),document.getElementById('expected-role').value));else results.push({name:'Dedicated account confirmation',pass:false});paint();
 }finally{button.disabled=!allowed}}}
 if(!allowed)output.textContent='This page is restricted to the isolated staging origin.';
}
