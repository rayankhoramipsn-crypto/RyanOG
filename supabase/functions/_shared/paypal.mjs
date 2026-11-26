import {readTextBounded} from './request-body.mjs';
import { PaymentError } from './payments.mjs';
// Official Orders v2 sandbox transport. No public/live merchant processing.
// This adapter intentionally has no browser endpoint or settlement authority.
export function paypalSandbox({clientId,secret,fetcher=fetch}) {
  const base='https://api-m.sandbox.paypal.com';
  async function call(path,body,key,method='POST') {
    if (!clientId || !secret) throw new PaymentError('paypal_not_configured',503);
    try {
    const tokenResponse=await fetcher(base+'/v1/oauth2/token',{method:'POST',redirect:'error',headers:{Authorization:'Basic '+btoa(clientId+':'+secret),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(10000)});
    if(!tokenResponse.ok) throw new PaymentError('paypal_auth_failed',502);
    const {access_token}=JSON.parse(await readTextBounded(tokenResponse,16384));
    if(!access_token) throw new PaymentError('paypal_auth_failed',502);
    const response=await fetcher(base+path,{method,redirect:'error',headers:{Authorization:'Bearer '+access_token,'Content-Type':'application/json',...(key?{'PayPal-Request-Id':key}:{})},body:method==='GET'?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
    if(!response.ok) throw new PaymentError('paypal_request_failed',502);
    return JSON.parse(await readTextBounded(response,262144));
    } catch(error) {if(error instanceof PaymentError)throw error;throw new PaymentError('paypal_unavailable',502)}
  }
  return {
    createOrder(order) {
      if(typeof order.amount!=='string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(order.id||'') || !/^(?:0|[1-9][0-9]{0,9})\.[0-9]{2}$/.test(order.amount) || BigInt(order.amount.replace('.',''))===0n || order.currency!=='USD') throw new PaymentError('invalid_paypal_order');
      return call('/v2/checkout/orders',{intent:'CAPTURE',purchase_units:[{reference_id:order.id,custom_id:order.id,amount:{currency_code:'USD',value:order.amount}}]},order.id);
    },
    captureOrder(providerId,retryKey) {
      if(!/^[A-Z0-9]{10,32}$/.test(providerId) || !/^[A-Za-z0-9:_-]{1,38}$/.test(retryKey||'')) throw new PaymentError('invalid_paypal_reference');
      return call('/v2/checkout/orders/'+providerId+'/capture',{},retryKey);
    },
    async verifyCapture(providerId,order,merchantId) {
      if(!/^[A-Z0-9]{10,32}$/.test(providerId||''))throw new PaymentError('invalid_paypal_reference');
      const result=await call('/v2/checkout/orders/'+providerId,undefined,undefined,'GET');
      if(result.id!==providerId)throw new PaymentError('paypal_capture_mismatch');
      return {capture_id:inspectPayPalCapture(result,order,merchantId),provider_order_id:providerId};
    },
    async verifyWebhook(event,headers,webhookId) {
      if(!webhookId) throw new PaymentError('paypal_webhook_not_configured',503);
      const result=await call('/v1/notifications/verify-webhook-signature',{
        auth_algo:headers.get('paypal-auth-algo'),cert_url:headers.get('paypal-cert-url'),transmission_id:headers.get('paypal-transmission-id'),
        transmission_sig:headers.get('paypal-transmission-sig'),transmission_time:headers.get('paypal-transmission-time'),webhook_id:webhookId,webhook_event:event,
      });
      return result.verification_status==='SUCCESS';
    },
  };
}
export function inspectPayPalCapture(result,order,merchantId) {
  const units=result?.purchase_units;
  if(result?.status!=='COMPLETED'||!Array.isArray(units)||units.length!==1) throw new PaymentError('paypal_capture_incomplete');
  const unit=units[0],captures=unit?.payments?.captures;
  if(unit?.reference_id!==order.id||unit.payee?.merchant_id!==merchantId||typeof merchantId!=='string'||!merchantId||!Array.isArray(captures)||captures.length!==1) throw new PaymentError('paypal_capture_mismatch');
  const capture=captures[0];
  if(capture?.status!=='COMPLETED'||capture.amount?.currency_code!==order.currency||capture.amount?.value!==order.amount||typeof capture.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(capture.id)) throw new PaymentError('paypal_capture_mismatch');
  return capture.id;
}
