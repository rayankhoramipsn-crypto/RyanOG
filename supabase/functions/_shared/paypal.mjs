import { PaymentError } from './payments.mjs';
// Official Orders v2 sandbox transport. No public/live merchant processing.
// This adapter intentionally has no browser endpoint or settlement authority.
export function paypalSandbox({clientId,secret,fetcher=fetch}) {
  const base='https://api-m.sandbox.paypal.com';
  async function call(path,body,key) {
    if (!clientId || !secret) throw new PaymentError('paypal_not_configured',503);
    const tokenResponse=await fetcher(base+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+btoa(clientId+':'+secret),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(10000)});
    if(!tokenResponse.ok) throw new PaymentError('paypal_auth_failed',502);
    const {access_token}=await tokenResponse.json();
    if(!access_token) throw new PaymentError('paypal_auth_failed',502);
    const response=await fetcher(base+path,{method:'POST',headers:{Authorization:'Bearer '+access_token,'Content-Type':'application/json',...(key?{'PayPal-Request-Id':key}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
    if(!response.ok) throw new PaymentError('paypal_request_failed',502);
    return response.json();
  }
  return {
    createOrder(order) {
      if(!/^[0-9]+\.[0-9]{2}$/.test(order.amount) || order.currency!=='USD') throw new PaymentError('invalid_paypal_order');
      return call('/v2/checkout/orders',{intent:'CAPTURE',purchase_units:[{reference_id:order.id,custom_id:order.id,amount:{currency_code:'USD',value:order.amount}}]},order.id);
    },
    captureOrder(providerId,retryKey) {
      if(!/^[A-Z0-9]{10,32}$/.test(providerId) || !retryKey) throw new PaymentError('invalid_paypal_reference');
      return call('/v2/checkout/orders/'+providerId+'/capture',{},retryKey);
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
  const units=result.purchase_units;
  if(result.status!=='COMPLETED'||!Array.isArray(units)||units.length!==1) throw new PaymentError('paypal_capture_incomplete');
  const unit=units[0],captures=unit.payments?.captures;
  if(unit.reference_id!==order.id||unit.payee?.merchant_id!==merchantId||!merchantId||!Array.isArray(captures)||captures.length!==1) throw new PaymentError('paypal_capture_mismatch');
  const capture=captures[0];
  if(capture.status!=='COMPLETED'||capture.amount?.currency_code!==order.currency||capture.amount?.value!==order.amount||!capture.id) throw new PaymentError('paypal_capture_mismatch');
  return capture.id;
}
