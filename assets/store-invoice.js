/* Phase 1: same-project auth; provider disabled by default. Preserve the existing
 * checkout layout and manual options until the Phase 1 backend reports readiness. */
(async () => {
  const panel=document.getElementById('tc43-pay');
  if(!panel || typeof SUPA_URL==='undefined')return;
  const endpoint=SUPA_URL+'/functions/v1/store-crypto';
  let readiness;
  try {
    const r=await fetch(endpoint,{headers:{apikey:SUPA_KEY},signal:AbortSignal.timeout(6000)});
    if(!r.ok)return;
    readiness=await r.json();
    if(readiness.schema_version!==1)return;
  } catch {return;}
  const t=(en,fa,ar)=>({en,fa,ar})[typeof currentLang==='string'?currentLang:'en']||en;
  const status=document.createElement('p');status.setAttribute('role','status');
  let invoice=null,orderId=null,busy=false,timer,version=0;
  const ref=document.createElement('input');ref.placeholder=t('Order ID','شماره سفارش','رقم الطلب');ref.setAttribute('aria-label','Order ID');
  const tx=document.createElement('input');tx.maxLength=64;tx.placeholder='TXID';tx.setAttribute('aria-label','TXID');
  const network=document.createElement('select');network.setAttribute('aria-label','BTC / LTC');
  ['LTC','BTC'].forEach(c=>network.add(new Option(c,c)));
  const details=document.createElement('div');details.style.overflowWrap='anywhere';
  function button(text,fn){const b=document.createElement('button');b.type='button';b.className='tc43-action';b.textContent=text;b.onclick=()=>run(fn);return b;}
  async function call(body){
    const token=await window.tc42AccessToken?.();if(!token)throw Error(t('Sign in first','ابتدا وارد شوید','سجل الدخول أولاً'));
    const r=await fetch(endpoint,{method:'POST',headers:{apikey:SUPA_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    const d=await r.json();if(!r.ok)throw Error(d.error||'Request failed');return d;
  }
  async function run(fn){if(busy)return;busy=true;const v=version;panel.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn(v)}catch(e){if(v===version)status.textContent=e.message}finally{if(v===version){busy=false;controls()}}}
  function controls(){if(typeof restart!=='undefined')restart.disabled=!invoice||!(Date.parse(invoice.expires_at)<=Date.now()||['cancelled','fulfilled','refunded'].includes(invoice.order_status));create.disabled=!readiness.enabled||!!invoice;verify.disabled=!invoice||!readiness.enabled;resume.disabled=false;network.disabled=!!invoice;}
  function render(){
    clearTimeout(timer);details.replaceChildren();if(!invoice)return;
    const expired=Date.parse(invoice.expires_at)<=Date.now();
    const p=document.createElement('p');p.textContent=t('Invoice ','فاکتور ','فاتورة ')+invoice.id+' · '+(expired?'expired':invoice.state);details.append(p);
    // Legacy shared-wallet invoices must be reconciled, never offered for new payment.
    if(!expired&&(!invoice.order_status||['awaiting_payment','payment_submitted','payment_review'].includes(invoice.order_status))&&!invoice.txid&&invoice.provider!=='legacy-shared-address'&&readiness.enabled&&['awaiting_payment','submitted','confirming','partial'].includes(invoice.state)){
      const units=BigInt(invoice.units),amount=(units/100000000n)+'.'+(units%100000000n).toString().padStart(8,'0');
      const line=document.createElement('p');line.dir='ltr';line.textContent=amount+' '+invoice.network+' · '+invoice.address;
      const expiry=document.createElement('p');expiry.textContent=new Date(invoice.expires_at).toLocaleString();
      details.append(line,expiry);
      for(const [label,value] of [[t('Copy address','کپی آدرس','نسخ العنوان'),invoice.address],[t('Copy amount','کپی مبلغ','نسخ المبلغ'),amount]])details.append(button(label,async()=>{if(Date.parse(invoice.expires_at)<=Date.now())return render();await navigator.clipboard.writeText(value)}));
      const qr=document.createElement('div');qr.style.cssText='display:inline-block;background:white;padding:10px';
      try{new QRCode(qr,{text:(invoice.network==='BTC'?'bitcoin:':'litecoin:')+invoice.address+'?amount='+amount,width:160,height:160})}catch{qr.hidden=true}details.append(qr);
      timer=setTimeout(render,Math.max(1,Date.parse(invoice.expires_at)-Date.now()));
    }
    if(expired)status.textContent=t('Expired. Do not send more funds. Existing transfers require review.','منقضی شده. وجه دیگری ارسال نکنید؛ واریز قبلی نیاز به بررسی دارد.','انتهت المهلة. لا ترسل أموالاً إضافية؛ الدفعات السابقة تحتاج مراجعة.');
    controls();
  }
  const create=button(t('Create invoice','ساخت فاکتور','إنشاء فاتورة'),async v=>{
    if(!orderId){const id=await window.TrisoOrders.create(window.tc42OrderItems);if(v!==version)return;orderId=id;ref.value=id;}
    const result=await call({action:'create',order_id:orderId,network:network.value});if(v!==version)return;invoice=result;render();
  });
  const verify=button(t('Check TXID','بررسی تراکنش','تحقق من المعاملة'),async v=>{
    const result=await call({action:'verify',order_id:invoice.order_id,txid:tx.value.trim().toLowerCase()});if(v!==version)return;
    status.textContent=result.status;
    invoice=await call({action:'resume',order_id:invoice.order_id});if(v===version)render();
  });
  const resume=button(t('Reopen invoice','بازیابی فاکتور','استعادة الفاتورة'),async v=>{
    const result=await call({action:'resume',order_id:ref.value.trim()});if(v!==version)return;invoice=result;orderId=invoice.order_id;render();
  });
  const legacy=document.createElement('div');legacy.hidden=true;while(panel.firstChild)legacy.append(panel.firstChild);
  const restart=button(t('Start a new unpaid order','شروع سفارش پرداخت‌نشده جدید','بدء طلب جديد غير مدفوع'),async()=>{window.TrisoOrders.beginNew(window.tc42OrderItems);reset();});
  const manual=legacy.querySelector('section[aria-label="Manual Litecoin and Bitcoin payments"]');
  panel.append(legacy);if(manual)panel.append(manual);
  panel.append(network,create,details,tx,verify,ref,resume,restart,status);
  function reset(){version++;busy=false;orderId=null;invoice=null;ref.value='';tx.value='';details.replaceChildren();clearTimeout(timer);status.textContent=readiness.enabled?t('Only pay the exact server invoice. A TXID is an unverified claim.','فقط مبلغ فاکتور سرور را بپردازید. شناسه تراکنش به تنهایی تأیید پرداخت نیست.','ادفع وفق فاتورة الخادم فقط. معرّف المعاملة ليس إثبات دفع.'):t('Crypto processing is not configured. Save an unpaid order or contact support.','پرداخت رمزارزی پیکربندی نشده است. سفارش پرداخت‌نشده ذخیره کنید یا با پشتیبانی تماس بگیرید.','الدفع بالعملات الرقمية غير مهيأ. احفظ طلباً غير مدفوع أو تواصل مع الدعم.');controls();}
  const original=window.tc41OpenCheckout;if(original)window.tc41OpenCheckout=function(...args){const r=original.apply(this,args);reset();return r;};reset();
})();
