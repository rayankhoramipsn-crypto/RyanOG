// Server-side delivery core. Default disabled; no browser imports or credentials.
// Store adapter must lease atomically and implement retry backoff / attempt limits.
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const subjects={
 registration:'Confirm your TRISOCMD account',recovery:'Reset your TRISOCMD password',
 order:'Order received',payment:'Payment status update',seller_order:'New purchase notice',
 listing_pending:'Listing awaiting review',listing_approved:'Your listing was approved',listing_declined:'Listing review update',
 message:'New message',support_reply:'Support replied',cancelled:'Order cancelled',disputed:'Dispute update'
};
export function renderEmail({kind,message,url,language='en'}){
 if(!subjects[kind])throw Error('Unknown email kind');
 const link=new URL(url);
 if(link.origin!=='https://trisocmd.shop'||link.username||link.password)throw Error('Untrusted email link');
 const subject=subjects[kind],dir=['fa','ar'].includes(language)?'rtl':'ltr';
 return {subject,text:subject+'\n\n'+String(message||'')+'\n\n'+link.href,
 html:`<!doctype html><html dir="${dir}"><body style="margin:0;background:#09090f;color:#f3f0ff;font-family:Arial,sans-serif"><table role="presentation" style="max-width:600px;margin:auto;padding:32px;background:#151020"><tr><td><p style="color:#bda2ff">TRISOCMD</p><h1>${escape(subject)}</h1><p style="line-height:1.7;white-space:pre-wrap">${escape(message)}</p><p><a style="color:#c6b2ff" href="${escape(link.href)}">View in TRISOCMD</a></p><p style="color:#aaa">Manage optional email alerts in your account.</p></td></tr></table></body></html>`};
}
export async function processEmailBatch({enabled=false,senderVerified=false,from,store,send,limit=20}){
 if(!enabled||!senderVerified)return {disabled:true,sent:0};
 if(from!=='support@trisocmd.shop')throw Error('Verified sender required');
 if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid batch size');
 let sent=0;
 // lease() MUST use SKIP LOCKED or equivalent and return opaque lease tokens.
 for(const job of await store.lease(limit)){
  try{
   if(store.prepare){const current=await store.prepare(job);if(!current){await store.skip(job.id,job.lease);continue}Object.assign(job,current)}
   // Recheck opt-in at send time, not only when queued.
   if(job.optional&&!await store.optedIn(job.user_id,job.id)){await store.skip(job.id,job.lease);continue}
   const content=renderEmail(job);
   const receipt=await send({from,to:job.to,...content,idempotencyKey:'triso-outbox-'+job.id});
   if(!receipt?.id)throw Error('Provider did not acknowledge delivery request');
   await store.sent(job.id,job.lease,receipt.id);sent++;
  }catch(error){
   // Never log tokens, recipient addresses, message content or provider secrets.
   await store.retry(job.id,job.lease,'delivery_failed',!!error?.permanent);
  }
 }
 return {disabled:false,sent};
}
