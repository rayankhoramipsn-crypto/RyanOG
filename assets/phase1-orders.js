/* Canonical order center. UI visibility is convenience; RLS/RPCs authorize all operations. */
(() => {
 'use strict';
 const base='https://cxtytbjvdlngahytfilr.supabase.co',key='sb_publishable_AqZWjpgyZ_h6-EKwOySyGQ_0LE8bcRm';
 const adminPage=location.pathname.includes('/admin/');
 const t=(en,fa,ar)=>({en,fa,ar})[document.documentElement.lang]||en;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
 async function token(){return await window.tc42AccessToken?.()||window.TrisoAuth?.read()?.access_token;}
 async function api(path,body){const jwt=await token();if(!jwt)throw Error(t('Sign in to view orders.','برای مشاهده سفارش‌ها وارد شوید.','سجل الدخول لعرض الطلبات.'));const r=await fetch(base+'/rest/v1/'+path,{method:body===undefined?'GET':'POST',headers:{apikey:key,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok)throw Error(d.message||d.error||'Order service unavailable');return d;}
 let retry=null;
 async function create(items){
   const owner=window.TrisoAuth?.read()?.user?.id,cart=JSON.stringify(items);
   // Keep one retry key per owner/cart, including after an uncertain network failure.
   const storageKey='phase1-checkout:'+owner+':'+cart;
   let stored;try{stored=sessionStorage.getItem(storageKey)}catch{}
   if(!retry||retry.cart!==cart||retry.owner!==owner)retry={owner,cart,key:stored||crypto.randomUUID()};
   try{sessionStorage.setItem(storageKey,retry.key)}catch{}
   return api('rpc/phase1_create_order',{p_items:items,p_key:retry.key});
 }
 function beginNew(items){const owner=window.TrisoAuth?.read()?.user?.id,cart=JSON.stringify(items);retry=null;try{sessionStorage.removeItem('phase1-checkout:'+owner+':'+cart)}catch{}}
 const root=node('section');root.id='phase1-order-center';root.className='tc42-admin';root.style.cssText='padding:18px;margin:18px auto;max-width:1100px;overflow-wrap:anywhere';
 root.append(node('h3',t('Order center','مرکز سفارش‌ها','مركز الطلبات')));
 const feedback=node('p');feedback.setAttribute('role','status');
 const filter=node('select');filter.setAttribute('aria-label','Order status');
 ['all','awaiting_payment','payment_submitted','payment_review','paid','fulfillment_pending','fulfilled','cancelled','disputed','refunded'].forEach(s=>filter.add(new Option(s.replaceAll('_',' '),s)));
 const list=node('div');let rows=[],loading=false,generation=0;
 function button(label,fn){const b=node('button',label);b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn()}catch(e){feedback.textContent=e.message}finally{b.disabled=false}};return b;}
 const refresh=button(t('Refresh orders','به‌روزرسانی سفارش‌ها','تحديث الطلبات'),load);
 root.append(filter,refresh,feedback,list);
 const host=adminPage?document.getElementById('dashboard'):(document.querySelector('#store-screen')||document.querySelector('main'));
 if(!host)return;host.append(root);
 function render(){
   list.replaceChildren();const user=window.TrisoAuth?.read()?.user;
   for(const o of rows.filter(o=>filter.value==='all'||filter.value===o.status)){
    const card=node('article');card.style.cssText='border:1px solid #355069;padding:14px;margin:12px 0;min-width:0';
    card.append(node('strong',o.id),node('p',o.status.replaceAll('_',' ')+' · '+o.total_amount+' '+o.currency));
    if(o.commission_usd>0)card.append(node('p',t('Marketplace commission (4%): ','کارمزد بازار (۴٪): ','عمولة السوق (4%): ')+o.commission_usd+' USD'));
    if(o.delivery_note)card.append(node('p',t('Delivery: ','تحویل: ','التسليم: ')+o.delivery_note));
    const transition=async(status,note=null)=>{await api('rpc/phase1_transition',{p_order:o.id,p_status:status,p_note:note});await load()};
    if(o.customer_id===user?.id){
      if(!o.listing_id&&['fulfilled','cancelled','refunded'].includes(o.status))card.append(button(t('Prepare a new checkout','آماده‌سازی سفارش جدید','تحضير طلب جديد'),async()=>{beginNew(o.items.map(i=>({id:i.id,qty:i.qty})));feedback.textContent=t('New attempt prepared. Return to the cart to review current prices.','سفارش جدید آماده است. برای بررسی قیمت فعلی به سبد برگردید.','تم تحضير محاولة جديدة. ارجع للسلة لمراجعة الأسعار الحالية.');}));
      if(o.status==='awaiting_payment')card.append(button(t('Cancel order','لغو سفارش','إلغاء الطلب'),()=>transition('cancelled')));
      if(['awaiting_payment','payment_submitted','payment_review'].includes(o.status)){
        const method=node('select');method.setAttribute('aria-label','Claim method');['BANK','PAYPAL','CASHAPP','CONTACT_SUPPORT'].forEach(m=>method.add(new Option(m,m)));
        const reference=node('input');reference.maxLength=200;reference.placeholder=t('Payment reference for review','مرجع پرداخت برای بررسی','مرجع الدفع للمراجعة');reference.setAttribute('aria-label','Payment reference');
        card.append(node('p',t('References and receipts are unverified claims. No funds are confirmed by submission.','مرجع و رسید تنها ادعای پرداخت هستند؛ ارسال آن تأیید دریافت وجه نیست.','المراجع والإيصالات ادعاءات غير مؤكدة. إرسالها لا يؤكد استلام الأموال.')),method,reference,button(t('Submit claim','ارسال ادعا','إرسال الادعاء'),async()=>{await api('rpc/phase1_submit_claim',{p_order:o.id,p_method:method.value,p_reference:reference.value});await load()}));
      }
    }
    if(!['cancelled','refunded','disputed'].includes(o.status))card.append(button(t('Open dispute','ثبت اختلاف','فتح نزاع'),()=>transition('disputed')));
    if(adminPage||o.seller_id===user?.id){
      if(o.status==='paid')card.append(button(t('Begin fulfillment','شروع تحویل','بدء التسليم'),()=>transition('fulfillment_pending')));
      if(['paid','fulfillment_pending'].includes(o.status)){
        const note=node('textarea');note.maxLength=2000;note.setAttribute('aria-label','Delivery information');note.placeholder=t('Delivery information for the buyer','اطلاعات تحویل برای خریدار','معلومات التسليم للمشتري');
        card.append(note,button(t('Confirm fulfillment','تأیید تحویل','تأكيد التسليم'),()=>transition('fulfilled',note.value)));
      }
    }
    if(adminPage&&['payment_submitted','payment_review','disputed'].includes(o.status))card.append(button('Cancel after rejected claims',()=>transition('cancelled')));
    if(adminPage&&o.status==='disputed'){const resolution=node('textarea');resolution.maxLength=2000;resolution.setAttribute('aria-label','Dispute resolution reason');card.append(resolution,button('Resume previously verified fulfillment',()=>transition('fulfillment_pending',resolution.value)));}
    if(adminPage)card.append(button('Review claims and audit',async()=>{
      const [events,claims,invoices]=await Promise.all([api('store_order_events?order_id=eq.'+o.id+'&order=id.desc'),api('store_payment_claims?order_id=eq.'+o.id),api('store_crypto_invoice?order_id=eq.'+o.id)]);
      audit.replaceChildren();const pre=node('pre',JSON.stringify({invoices,events},null,2));pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';audit.append(pre);
      for(const claim of claims){
       const section=node('div');section.append(node('p',claim.method+' · '+claim.reference+' · '+claim.state));
       if(!['verified'].includes(claim.state)){
         const review=node('textarea');review.maxLength=1000;review.setAttribute('aria-label','Claim review note');review.value=claim.review_note||'';
         const save=reject=>api('rpc/phase1_review_claim',{p_claim:claim.id,p_reject:reject,p_note:review.value});
         section.append(review,button('Hold for review',()=>save(false)),button('Reject claim',()=>save(true)));
       }audit.append(section);
      }
    }));
    const audit=node('div');card.append(audit);list.append(card);
   }
   if(!list.childNodes.length)list.textContent=t('No orders match this filter.','سفارشی مطابق فیلتر نیست.','لا توجد طلبات تطابق التصفية.');
 }
 async function load(){
   if(loading)return;loading=true;const v=++generation;const owner=window.TrisoAuth?.read()?.user?.id;
   feedback.textContent=t('Loading orders…','در حال بارگذاری سفارش‌ها…','جارٍ تحميل الطلبات…');
   try{const next=[];for(let offset=0;;offset+=100){const page=await api('tc42_orders?select=*&order=created_at.desc,id.desc&limit=100&offset='+offset);if(v!==generation||owner!==window.TrisoAuth?.read()?.user?.id)return;next.push(...page);if(page.length<100)break;}if(v!==generation||owner!==window.TrisoAuth?.read()?.user?.id)return;rows=next;render();feedback.textContent='';}catch(e){rows=[];list.replaceChildren();feedback.textContent=e.message}finally{loading=false}
 }
 filter.onchange=render;
 async function market(requestId){const id=await api('rpc/phase1_market_order',{p_request:requestId});await load();root.scrollIntoView({behavior:'smooth',block:'start'});return id;}
 window.TrisoOrders={create,load,market,beginNew};
 const selected=new URLSearchParams(location.search).get('product');
 if(/^[0-9]{1,18}$/.test(selected||'') && typeof window.openProduct==='function'){
  let attempts=0;const timer=setInterval(()=>{attempts++;if(typeof state!=='undefined' && state.products?.some(p=>String(p.id)===selected)){clearInterval(timer);window.openProduct(selected);}else if(attempts>=100)clearInterval(timer);},100);
 }
 window.addEventListener('storage',()=>{rows=[];list.replaceChildren();generation++;});
 // Hide data immediately on sign-out or account switch; never retain another account's order DOM.
 let lastOwner=window.TrisoAuth?.read()?.user?.id;
 setInterval(()=>{const owner=window.TrisoAuth?.read()?.user?.id;if(owner!==lastOwner){lastOwner=owner;generation++;rows=[];list.replaceChildren();feedback.textContent=t('Refresh to view orders.','برای مشاهده سفارش‌ها به‌روزرسانی کنید.','حدّث لعرض الطلبات.');}},1000);
})();
