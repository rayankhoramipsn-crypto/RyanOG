(async function initCryptoCheckout() {
  const endpoint = SUPA_URL + '/functions/v1/store-crypto';
  const headers = {apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY};
  try {
    const response = await fetch(endpoint, {headers, signal: AbortSignal.timeout(6000)});
    if (!response.ok || !(await response.json()).enabled) return;
  } catch { return; }

  const panel = document.getElementById('tc43-pay');
  const q = id => document.getElementById(id);
  const legacy=document.createElement('div'); legacy.hidden=true;
  while(panel.firstChild) legacy.append(panel.firstChild);
  let generation = 0;
  let invoice = null;
  let coin = 'LTC';
  let busy = false;
  const language = () => ['en','fa','ar'].includes(currentLang) ? currentLang : 'en';
  function tr(en,fa,ar) { return ({en,fa,ar})[language()]; }
  function button(label, action) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tc43-action'; b.textContent = label;
    b.onclick = action; return b;
  }
  const info = document.createElement('p');
  info.setAttribute('role','status');
  const details = document.createElement('div');
  const select = document.createElement('select');
  select.setAttribute('aria-label','BTC / LTC');
  for (const c of ['LTC','BTC']) select.add(new Option(c,c));
  select.onchange = () => { coin = select.value; };
  const tx = document.createElement('input');
  tx.maxLength = 64; tx.placeholder = 'TXID'; tx.setAttribute('aria-label','TXID');
  async function request(url, body, token) {
    const res = await fetch(url, {method:'POST', headers:{apikey:SUPA_KEY, Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(18000)});
    const data = await res.json();
    if (!res.ok) throw Error(data.error || data.message || 'Request failed');
    return data;
  }
  function copy(value) {
    return navigator.clipboard.writeText(value).then(()=>info.textContent=tr('Copied','کپی شد','تم النسخ')).catch(()=>{info.textContent=value;});
  }
  function renderQuote(i) {
    const units=BigInt(i.units);
    const amount=(units/100000000n).toString()+'.'+(units%100000000n).toString().padStart(8,'0');
    const uri=(i.network==='BTC'?'bitcoin:':'litecoin:')+i.address+'?amount='+amount;
    const qr=document.createElement('div');
    qr.style.cssText='display:inline-block;background:white;padding:12px';
    new QRCode(qr,{text:uri,width:180,height:180,correctLevel:QRCode.CorrectLevel.M});
    const summary=document.createElement('p'); summary.dir='ltr'; summary.style.overflowWrap='anywhere';
    summary.textContent=amount+' '+i.network+' · '+i.address;
    const expires=document.createElement('p');
    expires.textContent=tr('Pay before ','مهلت واریز ','ادفع قبل ')+new Date(i.expires_at).toLocaleString();
    details.replaceChildren(summary,qr,expires,button(tr('Copy address','کپی آدرس','نسخ العنوان'),()=>copy(i.address)),button(tr('Copy amount','کپی مبلغ','نسخ المبلغ'),()=>copy(amount)),tx,verify);
  }
  async function run(fn) {
    if(busy) return;
    const version=generation; busy=true; create.disabled=true; verify.disabled=true; select.disabled=true;
    try {
      const token=await window.tc42AccessToken?.();
      if(!token) throw Error(tr('Sign in first','اول وارد حسابت شو','سجل الدخول أولاً'));
      if(version===generation) await fn(token,version);
    } catch(e) { if(version===generation) info.textContent=e.message; }
    finally { if(version===generation){busy=false; create.disabled=!!invoice; select.disabled=!!invoice; verify.disabled=false;} }
  }
  const create=button('',()=>run(async(token,v)=>{
    const items=window.tc42OrderItems;
    const id=await request(SUPA_URL+'/rest/v1/rpc/tc42_create_order',{p_items:items},token);
    const i=await request(endpoint,{action:'create',network:coin,order_id:id},token);
    if(v!==generation)return;
    invoice=i; info.textContent=tr('Order ','سفارش ','طلب ')+id; renderQuote(i);
  }));
  const verify=button('',()=>run(async(token,v)=>{
    const r=await request(endpoint,{action:'verify',order_id:invoice.order_id,txid:tx.value},token);
    if(v!==generation)return;
    const labels={paid:tr('Payment confirmed','پرداخت تأیید شد','تم تأكيد الدفع'),pending_confirmations:tr('Waiting for confirmations. Check again later.','در انتظار تأیید شبکه؛ بعداً دوباره بررسی کن','بانتظار تأكيد الشبكة'),payment_review:tr('Payment received; contact support about stock','پرداخت دریافت شد؛ برای موجودی با پشتیبانی تماس بگیر','تم استلام الدفع؛ راجع الدعم بشأن المخزون')};
    info.textContent=labels[r.status] || r.status;
  }));
  const reference=document.createElement('input'); reference.placeholder='Order ID'; reference.setAttribute('aria-label','Order ID');
  const resume=button('',()=>run(async(token,v)=>{
    const i=await request(endpoint,{action:'resume',order_id:reference.value.trim()},token);
    if(v!==generation)return;
    invoice=i; coin=i.network; select.value=coin; renderQuote(i); info.textContent=i.order_status;
    if(i.txid || Date.parse(i.expires_at)<=Date.now()){
      details.querySelectorAll('canvas,img,table,button').forEach(el=>{if(el!==verify) el.hidden=true});
      info.textContent=i.txid?i.order_status:tr('Expired. Only check a transfer already sent.','مهلت پرداخت تمام شده؛ فقط تراکنش قبلی را بررسی کنید.','انتهت المهلة؛ تحقق فقط من دفعة سابقة.');
    }
  }));
  const reset=()=>{
    generation++; busy=false; invoice=null; coin='LTC'; select.value=coin; select.disabled=false; create.disabled=false; verify.disabled=false; tx.value='';
    create.textContent=tr('Create invoice','ساخت فاکتور','إنشاء فاتورة'); verify.textContent=tr('Check TXID','بررسی تراکنش','تحقق من المعاملة');
    resume.textContent=tr('Reopen by order ID','بازیابی با شماره سفارش','استعادة الفاتورة'); reference.value=''; details.replaceChildren(); info.textContent=''; panel.replaceChildren(legacy,select,create,details,info,reference,resume);
  };
  const original=window.tc41OpenCheckout;
  window.tc41OpenCheckout=function(...args){const result=original.apply(this,args);reset();return result};
  reset();
})();