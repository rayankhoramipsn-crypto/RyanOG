import {readTextBounded,RequestBodyError} from './request-body.mjs';
import { PaymentError, normalizeTxid, inspectPayment, validateInvoice, configuredProvider } from './payments.mjs';
const uuid = value => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value || '');
export function createStoreHandler({ env, fetcher = fetch, provider = configuredProvider() }) {
  return async req => {
    const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, apikey, content-type', 'Access-Control-Allow-Methods':'GET,POST,OPTIONS', 'Cache-Control':'no-store' };
    const json = (value,status=200) => Response.json(value,{status,headers:cors});
    if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
    if (req.method === 'GET') return json({enabled:provider.enabled, schema_version:1, paypal_enabled:false, manual_claims:true});
    if (req.method !== 'POST') return json({error:'POST required'},405);
    try {
      const base = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY'), anon = env('SUPABASE_ANON_KEY');
      if (!base || !key || !anon) throw new PaymentError('backend_not_configured',503);
      const auth = req.headers.get('Authorization');
      if (!auth?.startsWith('Bearer ')) throw new PaymentError('sign_in_required',401);
      async function read(path, options={}, service=false) {
        const r = await fetcher(base+path,{...options,headers:{apikey:service?key:anon,Authorization:service?'Bearer '+key:auth,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(12000)});
        if (!r.ok) throw new PaymentError(r.status===401?'invalid_session':r.status===403?'not_authorized':'request_rejected',r.status>=500?503:r.status);
        return r.status===204 ? null : r.json();
      }
      // Always use the same project as the data; no production/staging identity bridge.
      const user = await read('/auth/v1/user');
      if (!uuid(user?.id)) throw new PaymentError('invalid_session',401);
      const raw = await readTextBounded(req,16384,'request_too_large');
      let body; try { body=JSON.parse(raw); } catch { throw new PaymentError('invalid_json'); }
      const rpc = (name,value,service=false) => read('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(value)},service);
      if(!body||typeof body!=='object'||Array.isArray(body))throw new PaymentError('invalid_json');
      const { action,order_id,network } = body;
      if (action==='order') {
        if (!uuid(body.key)) throw new PaymentError('retry_key_required');
        return json(await rpc('phase1_create_order',{p_items:body.items,p_key:body.key}));
      }
      if (action==='history') return json(await read('/rest/v1/tc42_orders?select=*&order=created_at.desc&limit=100'));
      if (action==='market_order') {
        if (!uuid(body.request_id)) throw new PaymentError('invalid_request');
        return json(await rpc('phase1_market_order',{p_request:body.request_id}));
      }
      if (!uuid(order_id)) throw new PaymentError('invalid_order');
      const orders=await read('/rest/v1/tc42_orders?id=eq.'+order_id+'&select=*');
      const order=orders?.[0];
      if (!order) throw new PaymentError('order_unavailable',404);
      if (action==='transition') return json(await rpc('phase1_transition',{p_order:order_id,p_status:body.status,p_note:body.note??null}));
      if (action==='audit') {
        if (!(await rpc('phase1_is_admin',{}))) throw new PaymentError('admin_required',403);
        return json({events:await read('/rest/v1/store_order_events?order_id=eq.'+order_id+'&order=id.desc'),claims:await read('/rest/v1/store_payment_claims?order_id=eq.'+order_id),invoices:await read('/rest/v1/store_crypto_invoice?order_id=eq.'+order_id)});
      }
      if (action==='review_claim') {
        if (!uuid(body.claim_id) || !(await rpc('phase1_is_admin',{}))) throw new PaymentError('admin_required',403);
        return json(await rpc('phase1_review_claim',{p_claim:body.claim_id,p_reject:body.reject===true,p_note:body.note}));
      }
      if (order.customer_id!==user.id) throw new PaymentError('buyer_required',403);
      if (action==='claim') return json(await rpc('phase1_submit_claim',{p_order:order_id,p_method:body.method,p_reference:body.reference}));
      if (action==='resume') {
        const [invoice]=await read('/rest/v1/store_crypto_invoice?order_id=eq.'+order_id);
        if (!invoice) throw new PaymentError('invoice_unavailable',404);
        return json({...invoice,order_status:order.status,expired:Date.parse(invoice.expires_at)<=Date.now()});
      }
      if (!provider.enabled) throw new PaymentError('payment_provider_not_configured',503);
      if (action==='create') {
        if (order.status!=='awaiting_payment') throw new PaymentError('order_not_awaiting_payment',409);
        if (!['BTC','LTC'].includes(network)) throw new PaymentError('invalid_network');
        const [existing]=await read('/rest/v1/store_crypto_invoice?order_id=eq.'+order_id);
        if(existing) {
          if(existing.network!==network || Date.parse(existing.expires_at)<=Date.now()) throw new PaymentError('invoice_expired_or_network_locked',409);
          return json(existing);
        }
        const invoice=validateInvoice(await provider.createInvoice({order,network,idempotencyKey:order.id}),network);
        return json(await rpc('phase1_issue_invoice',{p_user:user.id,p_order:order_id,p_network:network,p_address:invoice.address,p_units:String(invoice.units),p_provider:provider.name,p_provider_id:invoice.provider_invoice_id,p_expires:invoice.expires_at},true));
      }
      if (action==='verify') {
        const txid=normalizeTxid(body.txid);
        const [invoice]=await read('/rest/v1/store_crypto_invoice?order_id=eq.'+order_id);
        if (!invoice) throw new PaymentError('invoice_unavailable',404);
        if (invoice.provider!==provider.name) throw new PaymentError('legacy_invoice_requires_reconciliation',409);
        await rpc('phase1_submit_claim',{p_order:order_id,p_method:invoice.network,p_reference:txid});
        try {
        const {event_id,evidence}=await provider.verify({invoice,txid});
        if (evidence?.txid!==txid) throw new PaymentError('transaction_mismatch',502);
        inspectPayment(evidence,invoice);
        return json({status:await rpc('phase1_record_verification',{p_user:user.id,p_order:order_id,p_event:event_id,p_evidence:evidence},true)});
        } catch(error) {
          await rpc('phase1_verification_failed',{p_user:user.id,p_order:order_id,p_txid:txid,p_code:(error instanceof PaymentError || error instanceof RequestBodyError)?error.code:'provider_unavailable'},true).catch(()=>{});
          throw error;
        }
      }
      throw new PaymentError('unsupported_action');
    } catch (error) {
      // Never relay provider bodies, URLs, credentials or database internals.
      return json({error:(error instanceof PaymentError || error instanceof RequestBodyError)?error.code:'service_unavailable'},(error instanceof PaymentError || error instanceof RequestBodyError)?error.status:503);
    }
  };
}
