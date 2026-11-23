/* Canonical order center. UI visibility is convenience; RLS/RPCs authorize all operations. */
(() => {
 'use strict';
 const base='https://cxtytbjvdlngahytfilr.supabase.co',key='sb_publishable_AqZWjpgyZ_h6-EKwOySyGQ_0LE8bcRm';
 const adminPage=location.pathname.includes('/admin/');
 const t=(en,fa,ar)=>({en,fa,ar})[document.documentElement.lang]||en;
 const localized=new Map();
 function bind(n,property,value){if(!localized.has(n))localized.set(n,new Map());localized.get(n).set(property,value);if(property.startsWith('aria-'))n.setAttribute(property,value());else n[property]=value();return n}
 function repaint(){for(const [n,properties]of localized){if(!n.isConnected){localized.delete(n);continue}for(const [property,value]of properties){if(property.startsWith('aria-'))n.setAttribute(property,value());else n[property]=value()}}}
 const node=(tag,text)=>{const n=document.createElement(tag);if(typeof text==='function')return bind(n,'textContent',text);if(text!==undefined)n.textContent=text;return n};
 const statuses={all:['all','همه','الكل'],awaiting_payment:['awaiting payment','در انتظار پرداخت','بانتظار الدفع'],payment_submitted:['payment submitted','ادعای پرداخت ارسال شده','تم إرسال ادعاء الدفع'],payment_review:['payment review','بررسی پرداخت','مراجعة الدفع'],paid:['paid','پرداخت‌شده','مدفوع'],fulfillment_pending:['fulfillment pending','در انتظار تحویل','بانتظار التسليم'],fulfilled:['fulfilled','تحویل‌شده','تم التسليم'],cancelled:['cancelled','لغوشده','ملغى'],disputed:['disputed','مورد اختلاف','متنازع عليه'],refunded:['refunded','بازپرداخت‌شده','مسترد']};
 const statusText=s=>statuses[s]?t(...statuses[s]):s.replaceAll('_',' ');
 async function token(){return await window.tc42AccessToken?.()||window.TrisoAuth?.read()?.access_token;}
 async function api(path,body){const actor=window.TrisoAuth?.read()?.user?.id;const jwt=await token();if(actor!==window.TrisoAuth?.read()?.user?.id||jwt!==window.TrisoAuth?.read()?.access_token)throw Error(t('Account changed. Refresh and try again.','حساب تغییر کرد. صفحه را به‌روزرسانی کنید.','تغير الحساب. حدّث الصفحة وحاول مجددًا.'));if(!jwt)throw Error(t('Sign in to view orders.','برای مشاهده سفارش‌ها وارد شوید.','سجل الدخول لعرض الطلبات.'));const r=await fetch(base+'/rest/v1/'+path,{method:body===undefined?'GET':'POST',headers:{apikey:key,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok)throw Object.assign(Error('Order service unavailable'),{status:r.status});return d;}
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
 root.append(node('h3',()=>t('Order center','مرکز سفارش‌ها','مركز الطلبات')));
 const feedback=node('p');feedback.setAttribute('role','status');
 const filter=node('select');bind(filter,'aria-label',()=>t('Order status','وضعیت سفارش','حالة الطلب'));
 ['all','awaiting_payment','payment_submitted','payment_review','paid','fulfillment_pending','fulfilled','cancelled','disputed','refunded'].forEach(s=>filter.append(bind(new Option('',s),'textContent',()=>statusText(s))));
 const list=node('div');let rows=[],generation=0,rowOwner=null,loadState='idle',loadError=false,hasData=false,pendingLoad=null;
 const listeners=new Set();
 function snapshot(){const owner=window.TrisoAuth?.read()?.user?.id;return {owner,rows:owner&&owner===rowOwner?rows.map(o=>({...o})):[],state:owner===rowOwner?loadState:'idle',error:owner===rowOwner&&loadError,hasData:owner===rowOwner&&hasData}}
 function publish(){for(const fn of listeners)fn(snapshot())}
 function resetOrders(){generation++;pendingLoad=null;refresh.disabled=false;rows=[];rowOwner=null;loadState='idle';loadError=false;hasData=false;list.replaceChildren();publish()}
 function button(label,fn){const b=node('button',label);b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn()}catch(e){feedback.textContent=e.message}finally{b.disabled=false}};return b;}
 const refresh=button(()=>t('Refresh orders','به‌روزرسانی سفارش‌ها','تحديث الطلبات'),load);
 root.append(filter,refresh,feedback,list);
 const host=adminPage?document.getElementById('dashboard'):(document.querySelector('#store-screen')||document.querySelector('main'));
 if(!host)return;host.append(root);
 function render(){
   list.replaceChildren();for(const [n]of localized)if(!n.isConnected)localized.delete(n);const user=window.TrisoAuth?.read()?.user;
   for(const o of rows.filter(o=>filter.value==='all'||filter.value===o.status)){
    const card=node('article');card.style.cssText='border:1px solid #355069;padding:14px;margin:12px 0;min-width:0';
    card.append(node('strong',o.id),node('p',()=>statusText(o.status)+' · '+o.total_amount+' '+o.currency));
    if(o.commission_usd>0)card.append(node('p',()=>t('Marketplace commission (4%): ','کارمزد بازار (۴٪): ','عمولة السوق (4%): ')+o.commission_usd+' USD'));
    if(o.customer_id===user?.id||o.seller_id===user?.id)card.append(button(()=>t('Order support','پشتیبانی سفارش','دعم الطلب'),()=>window.TrisoSupport?.open({orderId:o.id,dispute:o.status==='disputed'})));
    if(o.delivery_note)card.append(node('p',()=>t('Delivery: ','تحویل: ','التسليم: ')+o.delivery_note));
    const transition=async(status,note=null)=>{await api('rpc/phase1_transition',{p_order:o.id,p_status:status,p_note:note});await load()};
    if(o.customer_id===user?.id){
      if(!o.listing_id&&['fulfilled','cancelled','refunded'].includes(o.status))card.append(button(()=>t('Prepare a new checkout','آماده‌سازی سفارش جدید','تحضير طلب جديد'),async()=>{beginNew(o.items.map(i=>({id:i.id,qty:i.qty})));feedback.textContent=t('New attempt prepared. Return to the cart to review current prices.','سفارش جدید آماده است. برای بررسی قیمت فعلی به سبد برگردید.','تم تحضير محاولة جديدة. ارجع للسلة لمراجعة الأسعار الحالية.');}));
      if(o.status==='awaiting_payment')card.append(button(()=>t('Cancel order','لغو سفارش','إلغاء الطلب'),()=>transition('cancelled')));
      if(['awaiting_payment','payment_submitted','payment_review'].includes(o.status)){
        const method=node('select');bind(method,'aria-label',()=>t('Claim method','روش ثبت ادعا','طريقة تقديم الادعاء'));['BANK','PAYPAL','CASHAPP','CONTACT_SUPPORT'].forEach(m=>method.add(new Option(m,m)));
        const reference=node('input');reference.maxLength=200;bind(reference,'placeholder',()=>t('Payment reference for review','مرجع پرداخت برای بررسی','مرجع الدفع للمراجعة'));bind(reference,'aria-label',()=>t('Payment reference','مرجع پرداخت','مرجع الدفع'));
        card.append(node('p',()=>t('References and receipts are unverified claims. No funds are confirmed by submission.','مرجع و رسید تنها ادعای پرداخت هستند؛ ارسال آن تأیید دریافت وجه نیست.','المراجع والإيصالات ادعاءات غير مؤكدة. إرسالها لا يؤكد استلام الأموال.')),method,reference,button(()=>t('Submit claim','ارسال ادعا','إرسال الادعاء'),async()=>{await api('rpc/phase1_submit_claim',{p_order:o.id,p_method:method.value,p_reference:reference.value});await load()}));
      }
    }
    if(!['cancelled','refunded','disputed'].includes(o.status))card.append(button(()=>t('Open dispute','ثبت اختلاف','فتح نزاع'),()=>transition('disputed')));
    if(adminPage||o.seller_id===user?.id){
      if(o.status==='paid')card.append(button(()=>t('Begin fulfillment','شروع تحویل','بدء التسليم'),()=>transition('fulfillment_pending')));
      if(['paid','fulfillment_pending'].includes(o.status)){
        const note=node('textarea');note.maxLength=2000;bind(note,'aria-label',()=>t('Delivery information','اطلاعات تحویل','معلومات التسليم'));bind(note,'placeholder',()=>t('Delivery information for the buyer','اطلاعات تحویل برای خریدار','معلومات التسليم للمشتري'));
        card.append(note,button(()=>t('Confirm fulfillment','تأیید تحویل','تأكيد التسليم'),()=>transition('fulfilled',note.value)));
      }
    }
    if(adminPage&&['payment_submitted','payment_review','disputed'].includes(o.status))card.append(button(()=>t('Cancel after rejected claims','لغو پس از رد ادعاها','إلغاء بعد رفض الادعاءات'),()=>transition('cancelled')));
    if(adminPage&&o.status==='disputed'){const resolution=node('textarea');resolution.maxLength=2000;bind(resolution,'aria-label',()=>t('Dispute resolution reason','دلیل حل اختلاف','سبب تسوية النزاع'));card.append(resolution,button(()=>t('Resume previously verified fulfillment','ادامه تحویل تأییدشده قبلی','استئناف التسليم المتحقق منه سابقاً'),()=>transition('fulfillment_pending',resolution.value)));}
    if(adminPage)card.append(button(()=>t('Review claims and audit','بررسی ادعاها و سوابق','مراجعة الادعاءات وسجل التدقيق'),async()=>{
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
   const owner=window.TrisoAuth?.read()?.user?.id;
   if(!owner){resetOrders();feedback.textContent=t('Sign in to view orders.','برای مشاهده سفارش‌ها وارد شوید.','سجل الدخول لعرض الطلبات.');return}
   if(pendingLoad?.owner===owner)return pendingLoad.promise;
   const stamp=++generation,flight={owner,promise:null};pendingLoad=flight;
   if(rowOwner!==owner){rows=[];hasData=false}rowOwner=owner;loadState='loading';loadError=false;
   feedback.textContent=t('Loading orders…','در حال بارگذاری سفارش‌ها…','جارٍ تحميل الطلبات…');refresh.disabled=true;publish();
   flight.promise=(async()=>{
    try{
     const next=new Map();
     for(let offset=0;;offset+=100){
      if(stamp!==generation||owner!==window.TrisoAuth?.read()?.user?.id)return;
      const query=new URLSearchParams({select:'*',order:'created_at.desc,id.desc',limit:'100',offset:String(offset)});
      if(!adminPage){if(!/^[0-9a-f-]{36}$/i.test(owner))throw Error('Invalid account');query.set('or','(customer_id.eq.'+owner+',seller_id.eq.'+owner+')')}
      const page=await api('tc42_orders?'+query);
      if(stamp!==generation||owner!==window.TrisoAuth?.read()?.user?.id)return;
      if(!Array.isArray(page))throw Error('Invalid order response');
      for(const order of page)if(order.id&&(adminPage||order.customer_id===owner||order.seller_id===owner))next.set(String(order.id),order);
      if(page.length<100)break;
     }
     rows=[...next.values()];hasData=true;loadState='ready';render();feedback.textContent='';
    }catch(error){
     if(stamp!==generation||owner!==window.TrisoAuth?.read()?.user?.id)return;
     loadState='error';loadError=true;
     if([401,403].includes(error.status)){rows=[];hasData=false;list.replaceChildren()}
     feedback.textContent=t('Orders could not refresh. Please try again.','سفارش‌ها به‌روزرسانی نشدند. دوباره تلاش کنید.','تعذر تحديث الطلبات. حاول مجددًا.');
    }finally{if(pendingLoad===flight){pendingLoad=null;refresh.disabled=false}if(stamp===generation)publish()}
   })();return flight.promise;
 }

 new MutationObserver(repaint).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 filter.onchange=render;
 async function market(requestId){const id=await api('rpc/phase1_market_order',{p_request:requestId});await load();root.scrollIntoView({behavior:'smooth',block:'start'});return id;}
 window.TrisoOrders={create,load,market,beginNew,statusText,snapshot,subscribe:fn=>{listeners.add(fn);fn(snapshot());return ()=>listeners.delete(fn)},reset:resetOrders,open:async()=>{const target=document.getElementById('tc45-tracking-list');if(target&&root.parentElement!==target)target.replaceChildren(root);await load()},close:()=>{if(root.parentElement!==host)host.append(root)}};
 const selected=new URLSearchParams(location.search).get('product');
 if(/^[0-9]{1,18}$/.test(selected||'') && typeof window.openProduct==='function'){
  let attempts=0;const timer=setInterval(()=>{attempts++;if(typeof state!=='undefined' && state.products?.some(p=>String(p.id)===selected)){clearInterval(timer);window.openProduct(selected);}else if(attempts>=100)clearInterval(timer);},100);
 }
 window.addEventListener('storage',()=>{if(rowOwner!==window.TrisoAuth?.read()?.user?.id)resetOrders()});
 window.addEventListener('triso:session',()=>{if(rowOwner!==window.TrisoAuth?.read()?.user?.id)resetOrders()});
 // Hide data immediately on sign-out or account switch; never retain another account's order DOM.
 let lastOwner=window.TrisoAuth?.read()?.user?.id;
 setInterval(()=>{const owner=window.TrisoAuth?.read()?.user?.id;if(owner!==lastOwner){lastOwner=owner;if(owner===rowOwner)return;resetOrders();feedback.textContent=t('Refresh to view orders.','برای مشاهده سفارش‌ها به‌روزرسانی کنید.','حدّث لعرض الطلبات.');}},1000);
})();
