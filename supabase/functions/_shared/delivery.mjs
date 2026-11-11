import {processEmailBatch} from './email.mjs';
const endpointAllowed=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&!u.port&&(/^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com)$/.test(u.hostname)||/^[a-z0-9-]+\.notify\.windows\.com$/.test(u.hostname))}catch{return false}};
export {endpointAllowed};
export function createResendTransport({apiKey,fetcher=fetch}){
 return async message=>{
  const r=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':message.idempotencyKey},body:JSON.stringify({from:message.from,to:message.to,subject:message.subject,text:message.text,html:message.html}),signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Object.assign(Error('Email provider rejected request'),{permanent:[400,401,403,422].includes(r.status)});
  const d=await r.json();if(typeof d.id!=='string'||!d.id||d.id.length>200)throw Error('Missing provider acknowledgement');return d;
 };
}
export function createDeliveryStore({rpc,channel='email'}){
 const finish=(id,lease,action,provider=null,code=null)=>rpc('delivery_finish',{p_id:id,p_lease:lease,p_action:action,p_provider:provider,p_code:code});
 return {prepare:job=>rpc('delivery_current',{p_id:job.id,p_lease:job.lease}),lease:limit=>rpc('delivery_lease',{p_channel:channel,p_limit:Math.min(limit,5)}),optedIn:(_user,id)=>rpc('delivery_allowed',{p_id:id}),skip:(id,l)=>finish(id,l,'skip'),sent:(id,l,receipt)=>finish(id,l,'sent',receipt),retry:(id,l,code,permanent=false)=>finish(id,l,permanent?'permanent':'retry',null,code),gone:(id,l)=>finish(id,l,'gone',null,'subscription_gone')};
}
async function equal(a,b){if(!a||!b)return false;const enc=new TextEncoder(),x=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(a))),y=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(b)));return x.reduce((n,v,i)=>n|(v^y[i]),0)===0}
export function createDeliveryWorker({env,fetcher=fetch,sendPush}){
 const emailEnabled=()=>env('EMAIL_DELIVERY_ENABLED')==='true'&&env('EMAIL_SENDER_VERIFIED')==='true'&&!!env('RESEND_API_KEY');
 const pushEnabled=()=>env('WEB_PUSH_ENABLED')==='true'&&!!env('VAPID_PUBLIC_KEY')&&!!env('VAPID_PRIVATE_KEY')&&!!sendPush;
 return async req=>{
  const cors={'Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey, authorization, content-type, x-client-info','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
  const json=(x,status=200)=>Response.json(x,{status,headers:cors});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method==='GET')return json({email_enabled:emailEnabled(),push_enabled:pushEnabled(),push_public_key:pushEnabled()?env('VAPID_PUBLIC_KEY'):null});
  if(req.method!=='POST')return json({error:'POST required'},405);
  const secret=env('DELIVERY_WORKER_SECRET');if(!secret||secret.length<32)return json({error:'worker_not_configured'},503);
  if(!await equal(req.headers.get('Authorization'),'Bearer '+secret))return json({error:'unauthorized'},401);
  if(!emailEnabled()&&!pushEnabled())return json({disabled:true,sent:0});
  const rpc=async(name,args)=>{const r=await fetcher(env('SUPABASE_URL')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:env('SUPABASE_SERVICE_ROLE_KEY'),Authorization:'Bearer '+env('SUPABASE_SERVICE_ROLE_KEY'),'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Delivery database unavailable');return r.status===204?null:r.json()};
  try{
   let email={disabled:true,sent:0},push={disabled:true,sent:0};
   if(emailEnabled())email=await processEmailBatch({enabled:true,senderVerified:true,from:'support@trisocmd.shop',store:createDeliveryStore({rpc}),send:createResendTransport({apiKey:env('RESEND_API_KEY'),fetcher}),limit:5});
   if(pushEnabled()){
    const store=createDeliveryStore({rpc,channel:'push'});let sent=0;
    for(const job of await store.lease(5)){
     try{const current=await store.prepare(job);if(!current){await store.skip(job.id,job.lease);continue}Object.assign(job,current);if(!await store.optedIn(job.user_id,job.id)){await store.skip(job.id,job.lease);continue}
      if(!endpointAllowed(job.subscription?.endpoint))throw Object.assign(Error('Invalid endpoint'),{permanent:true});
      await sendPush(job.subscription,JSON.stringify({title:'TRISOCMD',body:'Open TRISOCMD to view your update.',tag:'triso-notice-'+job.id,url:'/'}),{publicKey:env('VAPID_PUBLIC_KEY'),privateKey:env('VAPID_PRIVATE_KEY'),subject:'mailto:support@trisocmd.shop'});
      await store.sent(job.id,job.lease,'push-'+job.id);sent++;
     }catch(e){if([404,410].includes(e.statusCode))await store.gone(job.id,job.lease);else await store.retry(job.id,job.lease,'push_failed',!!e.permanent)}
    }push={disabled:false,sent};
   }return json({email,push});
  }catch{return json({error:'delivery_batch_failed'},503)}
 };
}
function bytes64(value){return Uint8Array.from(atob(value),c=>c.charCodeAt(0))}
export async function verifyDeliverySignature({id,timestamp,signature,body,secret,now=Date.now()}){
 if(!id||id.length>200||!/^\d{10}$/.test(timestamp||'')||Math.abs(now/1000-Number(timestamp))>300||!secret?.startsWith('whsec_'))return false;
 try{const key=await crypto.subtle.importKey('raw',bytes64(secret.slice(6)),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 for(const entry of String(signature||'').split(' ')){const [v,sig]=entry.split(',');if(v==='v1'&&sig&&await crypto.subtle.verify('HMAC',key,bytes64(sig),new TextEncoder().encode(id+'.'+timestamp+'.'+body)))return true}
 }catch{}return false;
}
export function createDeliveryWebhook({env,rpc,now=Date.now}){
 return async req=>{
  const reply=(error,status)=>Response.json({error},{status});if(req.method!=='POST')return reply('POST required',405);
  if(!env('RESEND_WEBHOOK_SECRET'))return reply('webhook_not_configured',503);
  if(Number(req.headers.get('content-length'))>65536)return reply('payload_too_large',413);
  let body='';
  try{const reader=req.body?.getReader(),chunks=[];let size=0;if(reader){for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();return reply('payload_too_large',413)}chunks.push(value)}}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}body=new TextDecoder().decode(bytes)}catch{return reply('invalid_body',400)}
  if(!await verifyDeliverySignature({id:req.headers.get('svix-id'),timestamp:req.headers.get('svix-timestamp'),signature:req.headers.get('svix-signature'),body,secret:env('RESEND_WEBHOOK_SECRET'),now:now()}))return reply('invalid_signature',401);
  let event;try{event=JSON.parse(body)}catch{return reply('invalid_json',400)}
  if(!['email.sent','email.delivered','email.bounced','email.complained','email.failed'].includes(event.type)||typeof event.data?.email_id!=='string'||event.data.email_id.length>200)return reply('invalid_event',400);
  try{const recorded=await rpc('delivery_webhook',{p_event:req.headers.get('svix-id'),p_provider:event.data.email_id,p_type:event.type});return Response.json({recorded})}catch{return reply('event_unavailable',503)}
 };
}
