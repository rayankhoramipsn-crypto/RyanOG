import { configuredProvider,inspectPayment,normalizeTxid,PaymentError } from './payments.mjs';
export function createWebhookHandler({env,provider=configuredProvider(),fetcher=fetch}) {
 return async req=>{
  if(req.method!=='POST')return new Response('POST required',{status:405});
  if(!provider.enabled)return new Response('Provider not configured',{status:503});
  try{
   const raw=await req.text();if(raw.length>65536)throw new PaymentError('payload_too_large',413);
   // The adapter MUST cryptographically verify the raw body, signature and timestamp.
   const event=await provider.authenticateWebhook(new Request(req.url,{method:'POST',headers:req.headers,body:raw}));
   if(!/^[0-9a-f-]{36}$/i.test(event?.order_id||'')||!event.event_id)throw new PaymentError('invalid_event');
   const base=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');
   if(!base||!key)throw new PaymentError('backend_not_configured',503);
   async function read(path,body){const r=await fetcher(base+'/rest/v1/'+path,{method:body?'POST':'GET',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});if(!r.ok)throw new PaymentError('callback_retry_required',503);return r.json();}
   const [invoice]=await read('store_crypto_invoice?order_id=eq.'+event.order_id);
   if(!invoice||invoice.provider!==provider.name)throw new PaymentError('invoice_mismatch');
   const [order]=await read('tc42_orders?id=eq.'+invoice.order_id);
   if(!order)throw new PaymentError('order_unavailable');
   // Re-fetch proof independently. Never settle from callback fields alone.
   const txid=normalizeTxid(event.txid);
   const {evidence}=await provider.verify({invoice,txid});
   if(evidence.txid!==txid)throw new PaymentError('transaction_mismatch');
   inspectPayment(evidence,invoice);
   await read('rpc/phase1_record_verification',{p_user:order.customer_id,p_order:invoice.order_id,p_event:event.event_id,p_evidence:evidence});
   return Response.json({received:true},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return Response.json({error:e instanceof PaymentError?e.code:'callback_retry_required'},{status:e instanceof PaymentError?e.status:503});}
 };
}
