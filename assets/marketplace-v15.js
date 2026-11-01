/* TRISOCMD Marketplace v15: listing browse, mandatory seller photos, moderated messaging */
(()=>{'use strict';
const API='https://cxtytbjvdlngahytfilr.supabase.co';
const KEY='sb_publishable_AqZWjpgyZ_h6-EKwOySyGQ_0LE8bcRm';
const $=id=>document.getElementById(id);
const S={session:null,admin:false,items:[],photos:new Map(),signed:new Map(),category:'all',sort:'new',query:'',selected:null,threads:[],active:null,lastKey:'',timer:null,rt:null,inboxChannel:null,inboxTimer:null,inboxOwner:null,inboxBusy:null,inboxInitialized:false,inboxConnected:false,readMarks:new Map(),lang:'en',dailyCount:0,pro:false,threadQuery:'',unreadOnly:false,purchaseRows:[],purchaseBusy:false,purchaseFilter:'all'};
const i18n={en:{all:'All listings',fortnite:'Fortnite',roblox:'Roblox',steam:'Steam',gear:'Gaming gear',other:'Other',browse:'Explore listings',sell:'Sell an item',messages:'Messages',rules:'Marketplace rules',noresults:'No approved listings match your search.',details:'View details',contact:'Chat with seller',login:'Sign in',logout:'Sign out'},
fa:{all:'تمام آگهی‌ها',fortnite:'فورتنایت',roblox:'روبلاکس',steam:'استیم',gear:'تجهیزات گیمینگ',other:'سایر',browse:'آگهی‌های مارکت‌پلیس',sell:'ثبت آگهی',messages:'پیام‌ها',rules:'قوانین بازار',noresults:'آگهی تأییدشده‌ای پیدا نشد.',details:'مشاهده جزئیات',contact:'چت با فروشنده',login:'ورود',logout:'خروج'},
ar:{all:'كل الإعلانات',fortnite:'فورتنايت',roblox:'روبلوكس',steam:'ستيم',gear:'معدات الألعاب',other:'أخرى',browse:'تصفح السوق',sell:'نشر إعلان',messages:'الرسائل',rules:'قواعد السوق',noresults:'لا توجد إعلانات مطابقة.',details:'عرض التفاصيل',contact:'مراسلة البائع',login:'تسجيل الدخول',logout:'تسجيل الخروج'}};
const tr=k=>i18n[S.lang]?.[k]||i18n.en[k]||k;
const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=String(text);if(cls)e.className=cls;return e};
const empty=e=>e.replaceChildren();
const money=x=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(x)||0);
const date=x=>x?new Date(x).toLocaleString(S.lang==='fa'?'fa-IR':S.lang==='ar'?'ar':'en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
const errorText=e=>e?.message||String(e||'Unknown error');
function note(msg){$('notice').textContent=String(msg||'');if(msg&&!document.querySelector('dialog[open]'))$('notice').scrollIntoView({block:'nearest'})}
function marketFeedback(id,message,kind='error'){
 const e=$(id);if(!e)return;
 e.textContent=String(message||'');
 e.dataset.state=message?kind:'';
 e.setAttribute('role',kind==='error'?'alert':'status');
 e.setAttribute('aria-live',kind==='error'?'assertive':'polite');
 if(message&&kind==='error')e.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function sellStatus(message,kind='error'){marketFeedback('sell-status',message,kind)}
function authStatus(message,kind='error'){marketFeedback('auth-note',message,kind)}
function retryStatus(message,kind='error'){marketFeedback('retry-note',message,kind)}
const utcDay=date=>new Date(date).toISOString().slice(0,10);
function quotaDisplay(){
 const today=S.dailyCount;
 const count=$('seller-quota-count'),identity=$('seller-identity');
 if(identity)identity.textContent=S.session?.user?.email?'Posting as '+S.session.user.email:'Sign in to post';
 if(count)count.textContent=S.pro?'Pro seller: unlimited daily listings':today+' of 3 free listings submitted today (UTC) · '+Math.max(0,3-today)+' remaining';
}
function dialog(id){const d=$(id);if(!d.open)d.showModal()}
function close(id){if($(id).open)$(id).close()}
function saveSession(session){if(session){window.TrisoAuth.write(session);S.session=window.TrisoAuth.read()||session;}else{window.TrisoAuth.clear();S.session=null}}
function headers(json=true){const h={'apikey':KEY,Authorization:'Bearer '+(S.session?.access_token||KEY)};if(json)h['Content-Type']='application/json';return h}
async function req(path,opts={}){const json=('json'in opts);const r=await fetch(API+path,{method:opts.method||'GET',headers:{...headers(json),...(opts.headers||{})},body:json?JSON.stringify(opts.json):opts.body});const data=await r.json().catch(()=>null);if(!r.ok)throw Error(data?.message||data?.error_description||data?.msg||data?.error||'Request failed ('+r.status+')');return data}
const rpc=(name,json={})=>req('/rest/v1/rpc/'+name,{method:'POST',json});
async function refresh(){
 if(!S.session?.refresh_token)return;
 try{
  const d=await req('/auth/v1/token?grant_type=refresh_token',{method:'POST',json:{refresh_token:S.session.refresh_token}});
  if(!d.access_token)throw Error('Session expired');
  saveSession(d);
 }catch(e){
  if(/invalid.refresh|refresh.token.not.found|already.used|invalid.grant/i.test(e.message||''))saveSession(null);
  else console.warn('Session refresh delayed; saved login retained');
 }
}
async function adminCheck(){if(!S.session?.user)return false;try{return (await rpc('is_admin'))===true}catch{return false}}
function sessionUI(){
 const on=!!S.session?.user;
 const adminLink=$('nav-admin');
 if(adminLink)adminLink.classList.toggle('hidden',!on||!S.admin);
 $('nav-login').textContent=on?(S.session.user.email||'Account').split('@')[0]:tr('login');
 $('seller-auth').classList.toggle('hidden',on);
 $('seller-panel').classList.toggle('hidden',!on);
 $('mine-wrap').classList.toggle('hidden',!on);
 $('logout').classList.toggle('hidden',!on);
 $('chat-guest').classList.toggle('hidden',on);
 quotaDisplay();
}
function translate(){document.documentElement.lang=S.lang;document.documentElement.dir=['fa','ar'].includes(S.lang)?'rtl':'ltr';$('language').value=S.lang;document.querySelectorAll('[data-t]').forEach(e=>{e.textContent=tr(e.dataset.t)});$('search').placeholder=S.lang==='fa'?'جست‌وجوی اکانت، تجهیزات و بازی...':S.lang==='ar'?'ابحث عن الحسابات والألعاب...':'Search accounts, games, gear...';sessionUI();renderItems()}
function categoryOf(p){const v=((p.platform||'')+' '+(p.title||'')).toLowerCase();if(/fortnite|فورتنایت/.test(v))return 'fortnite';if(/roblox|روبلاکس/.test(v))return 'roblox';if(/steam|استیم/.test(v))return 'steam';if(/gear|mouse|keyboard|headset|controller|monitor|کیبورد|هدست|موس|تجهیز/.test(v))return 'gear';return 'other'}
function filtered(){let rows=S.items.filter(p=>(S.category==='all'||categoryOf(p)===S.category)&&[p.platform,p.title,p.description].join(' ').toLowerCase().includes(S.query));if(S.sort==='low')rows.sort((a,b)=>+a.price-+b.price);else if(S.sort==='high')rows.sort((a,b)=>+b.price-+a.price);else rows.sort((a,b)=>Number(b.is_pro)-Number(a.is_pro)||new Date(b.submitted_at)-new Date(a.submitted_at));return rows}
async function signed(path){if(!path)return null;const cached=S.signed.get(path);if(cached&&cached.until>Date.now())return cached.url;try{const safe=path.split('/').map(encodeURIComponent).join('/');const d=await req('/storage/v1/object/sign/market-gallery/'+safe,{method:'POST',json:{expiresIn:3600}});const u=d.signedURL||d.signedUrl;if(!u)return null;const url=u.startsWith('http')?u:API+'/storage/v1'+(u.startsWith('/')?u:'/'+u);S.signed.set(path,{url,until:Date.now()+2400000});return url}catch{return null}}
function art(p){const wrap=make('div',null,'item-cover');wrap.append(make('span',categoryOf(p).toUpperCase(),'placeholder'));wrap.append(make('span',p.is_pro?'PRO SELLER':'APPROVED','flag'));const photos=S.photos.get(String(p.id))||[];if(photos.length)signed(photos[0].object_path).then(url=>{if(url&&wrap.isConnected){const img=make('img');img.src=url;img.alt=p.title;img.loading='lazy';img.onerror=()=>img.remove();wrap.prepend(img)}});return wrap}
function card(p){const c=make('article',null,'item-card');const main=make('div',null,'item-main'),foot=make('div',null,'item-foot');const b=make('button',tr('details'),'btn small primary');b.type='button';b.onclick=()=>details(p);foot.append(make('span',money(p.price),'item-price'),b);main.append(make('div',p.platform,'item-category'),make('h3',p.title,'item-title'),make('p',p.description,'item-desc'),foot);c.append(art(p),main);return c}
function renderItems(){const root=$('cards');empty(root);const rows=filtered();$('count').textContent=rows.length+' listings';if(!rows.length)root.append(make('div',tr('noresults'),'empty'));else rows.forEach(p=>root.append(card(p)));document.querySelectorAll('[data-cat]').forEach(b=>b.classList.toggle('active',b.dataset.cat===S.category))}
async function readPhotos(ids){if(!ids.length)return;const valid=ids.map(Number).filter(Number.isInteger);if(!valid.length)return;try{const data=await req('/rest/v1/market_listing_media?select=listing_id,object_path,sort_order&listing_id=in.('+valid.join(',')+')&order=sort_order.asc&limit=500');for(const id of valid)S.photos.set(String(id),data.filter(m=>+m.listing_id===id))}catch(e){console.warn('Gallery unavailable',errorText(e))}}
async function browse(){try{S.items=await rpc('market_browse')||[];await readPhotos(S.items.map(p=>p.id));renderItems()}catch(e){empty($('cards'));$('cards').append(make('div','Listings unavailable: '+errorText(e),'empty'))}}
const tc27OpenStatuses=['requested','awaiting_payment_setup','disputed','payment_reported','payment_verified','delivery_reported'];
function tc27ActiveRequest(listingId){
 return S.purchaseRows.find(r=>String(r.listing_id)===String(listingId)&&r.buyer_id===S.session?.user?.id&&tc27OpenStatuses.includes(r.status));
}
function tc27PurchaseFeedback(message='',kind='info'){
 const node=$('purchase-status');node.textContent=message;node.dataset.state=message?kind:'';
 node.setAttribute('role',kind==='error'?'alert':'status');
 node.setAttribute('aria-live',kind==='error'?'assertive':'polite');
}
function tc27UpdatePurchaseButton(){
 const btn=$('request-purchase'),p=S.selected,already=p&&tc27ActiveRequest(p.id);
 if(!btn)return;
 const consent=$('accept').checked;
 btn.disabled=!consent||S.purchaseBusy||!!already;
 btn.textContent=already?'Review request already exists':'Request purchase review · No payment';
 const hint=$('tc33-request-hint');
 if(hint){
  const msg=already?'Request #'+already.id+' is already open — no duplicate request is needed.'
   :S.purchaseBusy?'Submitting your review request…'
   :!consent?'Tick the checkbox above to enable the request.'
   :S.session?.user?'Ready to submit a review-only request. No payment will be taken.'
   :'Ready to continue. You will be asked to sign in before submitting.';
  hint.textContent=msg;
  hint.dataset.state=already||!consent?'blocked':'ready';
 }
 if(already && $('purchase-status').dataset.state!=='success')
  tc27PurchaseFeedback('Existing request #'+already.id+' is '+already.status.replaceAll('_',' ')+'. No duplicate was created.','info');
}
let tc33DetailSeq=0;
function details(p){
 const sequence=++tc33DetailSeq;
 S.selected=p;tc27PurchaseFeedback('');
 $('detail-title').textContent=p.title;$('detail-platform').textContent=p.platform;
 $('detail-desc').textContent=p.description;$('detail-price').textContent=money(p.price);
 $('detail-date').textContent='Posted '+date(p.submitted_at);
 $('accept').checked=false;$('chat-seller').disabled=true;
 const cover=$('detail-cover'),placeholder=$('detail-placeholder'),thumbs=$('thumbs');
 cover.removeAttribute('src');cover.style.display='none';placeholder.classList.remove('hidden');
 placeholder.querySelector('span:last-child').textContent='Loading listing photos…';
 empty(thumbs);
 const images=S.photos.get(String(p.id))||[];
 if(!images.length)placeholder.querySelector('span:last-child').textContent='No gallery photo available';
 let loaded=false;
 for(const [i,file] of images.entries()){
  signed(file.object_path).then(url=>{
   if(sequence!==tc33DetailSeq||!url||S.selected?.id!==p.id)return;
   const img=make('img');img.src=url;img.alt='Photo '+(i+1);img.tabIndex=0;
   img.onerror=()=>{img.remove();if(!loaded)placeholder.querySelector('span:last-child').textContent='Photos unavailable — try again later'};
   const choose=()=>{
    if(sequence!==tc33DetailSeq)return;
    // Never hide the placeholder before an image has actually loaded.
    const next=new Image();next.onload=()=>{
     if(sequence!==tc33DetailSeq)return;
     cover.src=url;cover.style.display='block';placeholder.classList.add('hidden');loaded=true;
    };
    next.onerror=()=>{
     if(sequence!==tc33DetailSeq)return;
     if(!loaded){cover.style.display='none';placeholder.classList.remove('hidden');placeholder.querySelector('span:last-child').textContent='Photos unavailable — try again later'}
    };
    next.src=url;
   };
   img.onclick=choose;img.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}};
   thumbs.append(img);
   if(i===0)choose();
  }).catch(()=>{if(sequence===tc33DetailSeq&&!loaded)placeholder.querySelector('span:last-child').textContent='Photos unavailable — try again later'});
 }
 tc27UpdatePurchaseButton();
 dialog('detail-dialog');
 const scroller=$('detail-dialog').querySelector('.dialog-content');
 if(scroller)scroller.scrollTop=0;
}
async function contact(){if(!S.selected||!$('accept').checked)return;if(!S.session?.user){close('detail-dialog');dialog('auth-dialog');note('Sign in to contact the seller.');return}const b=$('chat-seller');b.disabled=true;try{const id=await rpc('market_start_chat',{p_listing:S.selected.id});close('detail-dialog');await showChats(id)}catch(e){note(errorText(e))}finally{b.disabled=false}}
async function login(signup){const email=$('auth-email').value.trim(),password=$('auth-password').value;if(!email||password.length<8){authStatus('Enter email and a password of at least 8 characters.');return}const btn=$('auth-signin');btn.disabled=true;try{const data=await req('/auth/v1/'+(signup?'signup':'token?grant_type=password'),{method:'POST',json:{email,password}});if(!data.access_token){authStatus('Account created. Confirm your email to sign in.','success');return}saveSession(data);S.admin=await adminCheck();close('auth-dialog');sessionUI();authStatus('');startInbox();await Promise.allSettled([mine(),threads(),purchases()]);note('Signed in')}catch(e){authStatus(errorText(e))}finally{btn.disabled=false}}
function logout(){stopPolling();stopInbox();saveSession(null);S.admin=false;S.active=null;S.threads=[];S.purchaseRows=[];S.purchaseBusy=false;S.dailyCount=0;S.pro=false;close('chat-dialog');$('purchase-requests-wrap').classList.add('hidden');empty($('purchase-requests'));sessionUI();note('Signed out')}
const mime={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
function checkFiles(files){if(!files.length)throw Error('At least one photo is required.');if(files.length>4)throw Error('Maximum four photos per listing.');for(const f of files)if(!mime[f.type]||f.size>5*1024*1024||f.size===0)throw Error('Use JPG, PNG or WebP photos under 5 MB each.')}
async function uploadPhoto(id,file,pos){const path=S.session.user.id+'/'+id+'/'+crypto.randomUUID()+'.'+mime[file.type];const response=await fetch(API+'/storage/v1/object/market-gallery/'+path,{method:'POST',headers:{...headers(false),'Content-Type':file.type,'x-upsert':'false'},body:file});if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.message||data.error||'Photo upload failed');}await req('/rest/v1/market_listing_media',{method:'POST',json:{listing_id:id,seller_id:S.session.user.id,object_path:path,alt_text:'Seller item photo',sort_order:pos},headers:{Prefer:'return=minimal'}})}
async function submit(e){
 e.preventDefault();
 sellStatus('');
 const files=Array.from($('photos').files||[]);
 try{checkFiles(files)}catch(err){sellStatus(err.message);return}
 if(!S.session?.user){sellStatus('Please sign in to post an item.');return}
 const b=$('post');
 b.disabled=true;
 let id=null;
 try{
  // The backend is authoritative: free sellers may submit 3 listings per UTC day.
  // Never trust a cached client-side count to reject submissions; the server enforces 3/day.
  const payload={p_title:$('title').value.trim(),p_platform:$('platform').value,p_description:$('description').value.trim(),p_price:Number($('price').value),p_image_url:null};
  if(payload.p_title.length<5||payload.p_description.length<20||!payload.p_platform||!Number.isFinite(payload.p_price)||payload.p_price<1)
    throw Error('Enter an item title, game/category, description (at least 20 characters), valid price and 1–4 photos.');
  sellStatus('Saving listing and uploading '+files.length+' photo(s)…','info');
  id=await rpc('market_submit',payload);
  for(let i=0;i<files.length;i++){
    $('upload-status').textContent='Uploading photo '+(i+1)+' of '+files.length;
    await uploadPhoto(id,files[i],i);
  }
  $('listing-form').reset();
  empty($('photo-preview'));
  $('upload-status').textContent='';
  sellStatus('');
  close('sell-dialog');
  note('Listing #'+id+' submitted with photos. It will appear in the admin approval queue, not publicly, until reviewed.');
  await mine();
  $('mine-wrap').scrollIntoView({block:'start',behavior:'smooth'});
 }catch(e){
  const msg=errorText(e);
  const info=id?
   'Your listing #'+id+' is saved as pending, but the photo upload did not finish. It will NOT be approved without a photo. Use My listings → Upload required photos (or Add more photos) to complete it. This submission counts toward today’s limit. Details: '+msg:
   msg;
  sellStatus(info);
  if(id)await mine();
 }finally{b.disabled=false}
}
function previewFiles(){const root=$('photo-preview');empty(root);const files=Array.from($('photos').files||[]);try{checkFiles(files);marketFeedback('upload-status',files.length+' valid image(s) selected','success')}catch(e){marketFeedback('upload-status',e.message,'error');return}for(const file of files){const url=URL.createObjectURL(file);const img=make('img');img.src=url;img.alt=file.name;img.onload=()=>URL.revokeObjectURL(url);root.append(img)}}
async function mine(){
 if(!S.session?.user)return;
 const root=$('mine');
 try{
  const userId=S.session.user.id;
  const [rows,profiles]=await Promise.all([
    req('/rest/v1/market_listings?select=id,title,status,price,decline_reason,submitted_at&seller_id=eq.'+encodeURIComponent(userId)+'&order=submitted_at.desc&limit=100'),
    req('/rest/v1/seller_profiles?select=is_pro,pro_until&user_id=eq.'+encodeURIComponent(userId)+'&limit=1').catch(()=>[])
  ]);
  if(!S.session?.user||S.session.user.id!==userId)return;
  const today=utcDay(new Date());
  S.dailyCount=rows.filter(p=>p.submitted_at&&utcDay(p.submitted_at)===today).length;
  S.pro=!!profiles?.[0]?.is_pro&&(!profiles[0].pro_until||new Date(profiles[0].pro_until)>new Date());
  quotaDisplay();
  await readPhotos(rows.map(x=>x.id));
  empty(root);
  if(!rows.length)root.append(make('p','No submissions yet. You can post up to 3 listings per UTC day.','fine'));
  for(const p of rows){
    const row=make('div',null,'submission'),count=(S.photos.get(String(p.id))||[]).length;
    row.append(make('strong',p.title),make('span',p.status,'status-chip '+p.status),make('span',count+' photos','fine'));
    if(p.status==='pending'&&count<4){
      const btn=make('button',count?'Add more photos':'Upload required photos','btn small secondary');
      btn.onclick=()=>{S.retryId=p.id;$('retry-input').value='';retryStatus('');dialog('retry-dialog')};
      row.append(btn);
    }
    if(p.status!=='removed'){
      const remove=make('button','Remove listing','btn small warn');
      remove.type='button';remove.onclick=()=>removeMyListing(p);row.append(remove);
    }
    if(p.decline_reason)row.append(make('span',p.decline_reason,'fine'));
    root.append(row);
  }
 }catch(e){root.textContent='My listings unavailable: '+errorText(e)}
}
async function removeMyListing(p){
 if(!S.session?.user)return;
 if(!confirm('Remove listing #'+p.id+'? It will disappear from public search, but existing messages and purchase requests will be retained.'))return;
 try{
  await rpc('market_remove_listing',{p_listing:Number(p.id)});
  note('Listing #'+p.id+' removed from the marketplace.');
  await Promise.allSettled([mine(),browse(),purchases()]);
 }catch(e){note('Could not remove this listing: '+errorText(e));}
}
function tc27RenderPurchases(){
 const root=$('purchase-requests'),owner=S.session?.user?.id,filter=S.purchaseFilter;
 if(!owner)return;
 const visible=S.purchaseRows.filter(r=>filter==='all'||(filter==='buyer'&&r.buyer_id===owner)||(filter==='seller'&&r.seller_id===owner)
   ||(filter==='open'&&tc27OpenStatuses.includes(r.status))||(filter==='cancelled'&&r.status==='cancelled'));
 empty(root);
 $('tc27-my-count').textContent=visible.length+' of '+S.purchaseRows.length+' requests';
 if(!visible.length){root.append(make('p',S.purchaseRows.length?'No requests match this filter.':'No purchase requests yet.','fine'));return}
 for(const p of visible){
  const card=make('article',null,'request-row tc27-request-card');
  const role=p.buyer_id===owner?'Buyer':'Seller',state=String(p.status||'requested');
  card.append(make('strong',role+' · '+p.listing_title+' · '+money(p.price_usd)));
  card.append(make('span',state.replaceAll('_',' '),'tc27-request-tag '+state));
  card.append(make('span','Request #'+p.id+' · Listing #'+p.listing_id+' · Preferred: '+p.payment_method+' · '+date(p.created_at),'tc27-request-meta'));
  if(p.admin_note)card.append(make('p','Administrator note: '+p.admin_note,'fine'));
  card.append(make('div','Review only — no payment, delivery confirmation or escrow is active.','tc27-request-warning'));
  root.append(card);
 }
}
async function purchases(){
 if(!S.session?.user){S.purchaseRows=[];$('purchase-requests-wrap').classList.add('hidden');return}
 const owner=S.session.user.id;
 $('purchase-requests-wrap').classList.remove('hidden');
 try{
  const rows=await req('/rest/v1/market_purchase_requests?select=id,listing_id,listing_title,price_usd,payment_method,status,buyer_id,seller_id,created_at,admin_note&order=created_at.desc&limit=100');
  if(S.session?.user?.id!==owner)return;
  if(!Array.isArray(rows))throw Error('Unexpected request list from server');
  S.purchaseRows=rows;tc27RenderPurchases();
  if(S.selected)tc27UpdatePurchaseButton();
 }catch(e){$('purchase-requests').textContent='Purchase requests unavailable: '+errorText(e)}
}
async function requestPurchase(){
 const p=S.selected;
 if(!p||!$('accept').checked||S.purchaseBusy)return;
 if(!S.session?.user){close('detail-dialog');dialog('auth-dialog');note('Sign in to request a purchase.');return}
 if(p.seller_id===S.session.user.id){tc27PurchaseFeedback('You cannot request to buy your own listing.','error');return}
 const existing=tc27ActiveRequest(p.id);
 if(existing){tc27PurchaseFeedback('Request #'+existing.id+' is already open. You do not need another request.','info');tc27UpdatePurchaseButton();return}
 if(!confirm('Submit a review-only request for '+p.title+' at '+money(p.price)+'? No payment or escrow will be started.'))return;
 const btn=$('request-purchase');
 S.purchaseBusy=true;btn.disabled=true;tc27PurchaseFeedback('Submitting for administrator review…','info');
 try{
  const id=await rpc('market_request_purchase',{p_listing:Number(p.id),p_method:$('purchase-method').value,p_note:null});
  await purchases();
  const match=S.purchaseRows.find(x=>String(x.id)===String(id));
  tc27PurchaseFeedback('Review request #'+id+(match?' is '+match.status.replaceAll('_',' '):' was recorded')+'. No payment was made. Do not send funds.','success');
 }catch(e){tc27PurchaseFeedback('Request failed: '+errorText(e),'error')}
 finally{S.purchaseBusy=false;const active=tc27ActiveRequest(p.id);btn.disabled=!$('accept').checked||!!active;btn.textContent=active?'Review request already exists':'Request purchase review · No payment'}
}
async function retry(){
 const files=Array.from($('retry-input').files||[]);
 const button=$('retry-save');
 try{
  checkFiles(files);
  const n=(S.photos.get(String(S.retryId))||[]).length;
  if(n+files.length>4)throw Error('Maximum four photos total.');
  button.disabled=true;
  retryStatus('Uploading '+files.length+' photo(s)…','info');
  for(let i=0;i<files.length;i++)await uploadPhoto(S.retryId,files[i],n+i);
  close('retry-dialog');
  retryStatus('');
  note('Photos saved. Your listing remains pending until an administrator approves it.');
 }catch(e){
  retryStatus('Upload not completed: '+errorText(e),'error');
 }finally{
  button.disabled=false;
  // Refresh media counts even after partial failures so retry never shows stale counts.
  if(S.session?.user)await mine().catch(()=>{});
 }
}

function chatFeedback(message,problem=false){
 const line=$('chat-state');
 line.textContent=String(message||'');
 line.classList.toggle('chat-error',!!problem);
 line.setAttribute('role',problem?'alert':'status');
 line.setAttribute('aria-live',problem?'assertive':'polite');
}
function chatConnection(message,connected=false){
 const el=$('chat-connection');
 if(!el)return;
 el.textContent=String(message||'');
 el.classList.toggle('connection-fallback',!connected);
 S.inboxConnected=!!connected;
}
const tc26DocumentTitle=document.title;
function updateUnreadBadges(total){
 const number=Math.max(0,Number(total)||0),label=number>99?'99+':String(number);
 document.title=number?'('+label+') '+tc26DocumentTitle:tc26DocumentTitle;
 for(const id of ['nav-unread','hero-unread']){
   const el=$(id);
   if(!el)continue;
   el.textContent=label;
   el.classList.toggle('hidden',!number);
 }
 const button=$('nav-messages');
 if(button)button.setAttribute('aria-label',number?number+' unread marketplace messages':'Marketplace conversations');
}
function clearChatView(){
 $('chat-topic').textContent='Select a conversation';
 $('chat-sub').textContent='Your conversations stay private between the buyer, seller and authorized moderators.';
 $('chat-form').classList.add('hidden');
 empty($('bubbles'));
 $('bubbles').append(make('div','Choose a conversation to read and reply.','chat-placeholder'));
}
function renderThreads(){
 const root=$('thread-list');empty(root);
 const query=S.threadQuery.toLowerCase().trim();
 const rows=S.threads.filter(row=>(!S.unreadOnly||row.unread_count>0)
   &&(!query||[row.listing_title,row.listing_id,row.last_message_preview,row.seller_id,row.buyer_id]
     .some(value=>String(value??'').toLowerCase().includes(query))));
 const unread=S.threads.reduce((n,row)=>n+row.unread_count,0);
 const summary=$('tc26-inbox-summary');
 if(summary)summary.textContent=rows.length+' of '+S.threads.length+' conversations · '+unread+' unread message'+(unread===1?'':'s');
 const h=make('div',null,'thread-heading');
 h.append(make('h3','Your conversations'),make('span',String(S.threads.length),'thread-total'));
 root.append(h);
 if(!rows.length){
  root.append(make('div',S.threads.length?'No conversations match this filter. Clear search or turn off Unread only.':'No conversations yet. Open an approved listing and choose Chat with seller to get started.','thread-empty'));
  return;
 }
 for(const row of rows){
  const id=String(row.id);
  const item=make('button',null,'thread-button'+(String(S.active)===id?' active':''));
  item.type='button';item.classList.toggle('tc26-has-unread',row.unread_count>0);
  item.setAttribute('aria-label','Conversation about '+(row.listing_title||'Listing #'+row.listing_id)+(row.unread_count?' · '+row.unread_count+' unread messages':''));
  item.setAttribute('aria-current',String(S.active)===id?'true':'false');
  const top=make('span',null,'thread-top');
  top.append(make('strong',row.listing_title||'Listing #'+row.listing_id));
  if(Number(row.unread_count)>0){
   const badge=make('span',String(Math.min(99,Number(row.unread_count)))+(Number(row.unread_count)>99?'+':''),'thread-unread');
   badge.setAttribute('aria-label',row.unread_count+' unread messages');
   top.append(badge);
  }
  item.append(top);
  item.append(make('small',row.seller_id===S.session?.user?.id?'Buyer inquiry':'Seller conversation','thread-role'));
  if(row.last_message_preview)item.append(make('span',row.last_message_preview,'thread-preview'));
  else item.append(make('span','New conversation — say hello','thread-preview'));
  if(row.last_message_at||row.created_at)item.append(make('time',date(row.last_message_at||row.created_at),'thread-date'));
  item.onclick=()=>selectThread(row);
  root.append(item);
 }
}
async function threads(){
 if(!S.session?.user){S.threads=[];updateUnreadBadges(0);renderThreads();return []}
 if(S.inboxBusy)return S.inboxBusy;
 const owner=S.session.user.id;
 S.inboxBusy=(async()=>{
  const result=await rpc('market_inbox');
  if(!Array.isArray(result))throw Error('Inbox returned an unexpected response');
  if(S.session?.user?.id!==owner)return [];
  S.threads=result.map(row=>({
   ...row,id:String(row.id),listing_id:String(row.listing_id),
   unread_count:Math.max(0,Number(row.unread_count)||0)
  }));
  updateUnreadBadges(S.threads.reduce((count,row)=>count+row.unread_count,0));
  S.inboxInitialized=true;
  renderThreads();
  return S.threads;
 })().catch(e=>{
  if(S.session?.user?.id===owner){
   chatFeedback('Unable to refresh conversations: '+errorText(e),true);
   if($('chat-dialog').open&&!S.threads.length){
    empty($('thread-list'));
    $('thread-list').append(make('div','Inbox unavailable. Check your connection and reopen messages.','thread-empty'));
   }
  }
  throw e;
 }).finally(()=>{S.inboxBusy=null});
 return S.inboxBusy;
}
async function showChats(id=null){
 if(!S.session?.user){dialog('auth-dialog');return}
 dialog('chat-dialog');
 if(!S.active)clearChatView();
 chatFeedback('Loading your conversations…');
 try{
  await threads();
  if(!$('chat-dialog').open)return;
  let selected=null;
  if(id!==null&&id!==undefined){
   // Never silently route to another seller if a freshly created thread
   // cannot be loaded yet.
   selected=S.threads.find(c=>String(c.id)===String(id));
   if(!selected){
    chatFeedback('Your conversation is being prepared. Close and reopen Messages in a moment.',true);
    return;
   }
  }else{
   // Do not auto-open the first unread conversation when merely opening Inbox.
   // Only explicit selection should mark a conversation read.
   selected=S.threads.find(c=>String(c.id)===String(S.active))||null;
  }
  if(selected)await selectThread(selected);
  else{
   S.active=null;clearChatView();
   chatFeedback(S.threads.length?'Select a conversation to read and reply.':'No conversations yet. Open a listing and choose Chat with seller.');
  }
 }catch(e){chatFeedback('Could not open your inbox: '+errorText(e),true)}
}
async function selectThread(row){
 if(!S.session?.user)return;
 const id=String(row.id);
 if(S.active!==id){stopPolling();S.lastKey='';}
 S.active=id;S.lastKey='';
 renderThreads();
 $('chat-topic').textContent=row.listing_title||'Listing #'+row.listing_id;
 const side=row.seller_id===S.session.user.id?'Talking with a buyer':'Talking with the seller';
 $('chat-sub').textContent=side+' · Listing #'+row.listing_id+' · Keep account credentials private';
 $('chat-form').classList.remove('hidden');
 chatFeedback('Loading messages…');
 await messages(true);
 if(S.active===id&&$('chat-dialog').open){
   startPolling();
   $('chat-body').focus({preventScroll:true});
 }
}
async function markRead(conversationId,lastMessageId=0){
 if(!S.session?.user)return;
 const owner=S.session.user.id;
 const id=String(conversationId);
 const key=owner+':'+id+':'+String(lastMessageId);
 if(S.readMarks.get(id)===key)return;
 S.readMarks.set(id,key);
 try{
  await rpc('market_mark_read',{p_conversation:Number(id)});
  if(S.session?.user?.id===owner)await threads();
 }catch(e){
  if(S.readMarks.get(id)===key)S.readMarks.delete(id);
  console.warn('Could not update read state',errorText(e));
 }
}
async function messages(force=false){
 if(!S.active||!S.session?.user||!$('chat-dialog').open)return;
 const room=String(S.active),owner=S.session.user.id;
 try{
  const rows=await req('/rest/v1/market_messages?select=id,sender_id,body,created_at&conversation_id=eq.'+encodeURIComponent(room)+'&order=created_at.asc,id.asc&limit=200');
  if(String(S.active)!==room||S.session?.user?.id!==owner||!$('chat-dialog').open)return;
  if(!Array.isArray(rows))throw Error('Invalid message response');
  const last=rows[rows.length-1];
  const key=rows.length+':'+(last?.id||0);
  if(!force&&key===S.lastKey)return;
  S.lastKey=key;
  const box=$('bubbles'),nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<100;
  empty(box);
  if(!rows.length)box.append(make('div','No messages yet. Send a friendly introduction about this listing.','chat-placeholder'));
  for(const item of rows){
   const own=item.sender_id===owner;
   const bubble=make('div',null,'bubble'+(own?' mine':''));
   bubble.append(make('span',item.body,'bubble-body'));
   bubble.append(make('small',date(item.created_at),'bubble-time'));
   box.append(bubble);
  }
  if(nearBottom||force)box.scrollTop=box.scrollHeight;
  const current=S.threads.find(t=>String(t.id)===room);
  if(force||(current&&current.unread_count>0)||(last&&last.sender_id!==owner))
    markRead(room,last?.id||0);
  chatFeedback('Messages updated · '+new Date().toLocaleTimeString());
 }catch(e){chatFeedback('Unable to load messages: '+errorText(e),true)}
}
function stopPolling(){
 if(S.timer){clearInterval(S.timer);S.timer=null}
}
function startPolling(){
 stopPolling();
 // Live events are push-based; polling is an automatic fallback if a socket
 // connection is blocked by the browser or network.
 S.timer=setInterval(()=>{
  if(!document.hidden&&$('chat-dialog').open&&S.active)messages();
 },3500);
}
function stopInbox(){
 if(S.inboxTimer){clearInterval(S.inboxTimer);S.inboxTimer=null}
 if(S.rt&&S.inboxChannel){S.rt.removeChannel(S.inboxChannel).catch(()=>{});S.inboxChannel=null}
 S.inboxOwner=null;S.inboxConnected=false;
 S.inboxInitialized=false;S.inboxBusy=null;S.readMarks.clear();
 updateUnreadBadges(0);
}
function startInbox(){
 if(!S.session?.user||!S.session?.access_token)return;
 const owner=S.session.user.id;
 if(S.inboxOwner===owner&&S.inboxTimer){
   if(S.rt)S.rt.realtime.setAuth(S.session.access_token);
   return;
 }
 stopInbox();
 S.inboxOwner=owner;
 chatConnection('Connecting…');
 threads().catch(()=>{});
 S.inboxTimer=setInterval(()=>{
  if(!document.hidden&&S.session?.user?.id===owner)threads().catch(()=>{});
 },7000);
 if(!window.supabase?.createClient){
  chatConnection('Auto-refresh every few seconds');
  return;
 }
 try{
  if(!S.rt)S.rt=window.supabase.createClient(API,KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  S.rt.realtime.setAuth(S.session.access_token);
  S.inboxChannel=S.rt.channel('triso-market-inbox-'+owner)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'market_messages'},payload=>{
      if(S.session?.user?.id!==owner)return;
      threads().catch(()=>{});
      if(S.active&&$('chat-dialog').open&&String(payload.new?.conversation_id)===String(S.active))messages();
   })
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'market_conversations'},()=>{
      if(S.session?.user?.id===owner)threads().catch(()=>{});
   })
   .subscribe(status=>{
      if(S.inboxOwner!==owner)return;
      if(status==='SUBSCRIBED')chatConnection('Live connected',true);
      else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')chatConnection('Auto-refresh active');
   });
 }catch(e){
  console.warn('Realtime unavailable; inbox refresh fallback remains active',e);
  chatConnection('Auto-refresh active');
 }
}
async function send(e){
 e.preventDefault();
 if(!S.active||!S.session?.user){chatFeedback('Choose a conversation before sending.',true);return}
 const box=$('chat-body'),body=box.value.trim();
 if(!body)return;
 if(/(?:password|recovery code|seed phrase|access token|one.time code)/i.test(body)){
  chatFeedback('For your security, never send passwords or recovery codes in chat.',true);return;
 }
 const id=String(S.active),btn=$('chat-send');
 btn.disabled=true;btn.textContent='Sending…';chatFeedback('Sending…');
 try{
  await rpc('market_send_message',{p_conversation:Number(id),p_body:body});
  if(String(S.active)===id){box.value='';await messages(true)}
  await threads().catch(()=>{});
  chatFeedback('Sent · '+new Date().toLocaleTimeString());
 }catch(e){
  // Keep the unsent draft so the buyer/seller can retry safely.
  chatFeedback('Message not sent. '+errorText(e),true);
 }finally{btn.disabled=false;btn.textContent='Send ↗'}
}

async function init(){
 S.session=window.TrisoAuth.read();
 const checkbox=$('auth-remember');
 if(checkbox){checkbox.checked=window.TrisoAuth.remembered();checkbox.addEventListener('change',()=>window.TrisoAuth.setRemember(checkbox.checked))}
 if(S.session?.refresh_token&&(!S.session.expires_at||S.session.expires_at*1000<Date.now()+120000))await refresh();
S.lang=['en','fa','ar'].includes(localStorage.getItem('tc_market_lang'))?localStorage.getItem('tc_market_lang'):'en';S.admin=await adminCheck();translate();await browse();if(S.session?.user){startInbox();await Promise.allSettled([mine(),threads(),purchases()]);}
const hash=Number(new URLSearchParams(location.search).get('listing'));if(hash){const found=S.items.find(x=>+x.id===hash);if(found)details(found)}}
document.querySelectorAll('[data-cat]').forEach(b=>b.addEventListener('click',()=>{S.category=b.dataset.cat;renderItems();$('listing-section').scrollIntoView({block:'start'})}));
$('search').addEventListener('input',e=>{S.query=e.target.value.trim().toLowerCase();renderItems()});
$('sort').addEventListener('change',e=>{S.sort=e.target.value;renderItems()});
$('language').addEventListener('change',e=>{S.lang=e.target.value;localStorage.setItem('tc_market_lang',S.lang);translate()});
$('nav-login').addEventListener('click',()=>S.session?.user?dialog('sell-dialog'):dialog('auth-dialog'));
$('open-sell').addEventListener('click',()=>dialog(S.session?.user?'sell-dialog':'auth-dialog'));
$('open-rules').addEventListener('click',()=>dialog('rules-dialog'));
$('open-messages').addEventListener('click',()=>showChats());
$('nav-messages').addEventListener('click',()=>showChats());
$('tc26-thread-search')?.addEventListener('input',e=>{S.threadQuery=e.target.value;renderThreads()});
$('tc26-unread-only')?.addEventListener('change',e=>{S.unreadOnly=e.target.checked;renderThreads()});
$('seller-messages').addEventListener('click',()=>showChats());
$('auth-signin').addEventListener('click',()=>login(false));$('auth-signup').addEventListener('click',()=>login(true));
$('logout').addEventListener('click',logout);
$('listing-form').addEventListener('submit',submit);
$('photos').addEventListener('change',previewFiles);
$('retry-save').addEventListener('click',retry);
$('accept').addEventListener('change',e=>{$('chat-seller').disabled=!e.target.checked;tc27UpdatePurchaseButton()});
$('detail-dialog').addEventListener('close',()=>{tc33DetailSeq++});
$('chat-seller').addEventListener('click',contact);
$('request-purchase').addEventListener('click',requestPurchase);
$('refresh-purchases').addEventListener('click',purchases);
$('tc27-my-filter')?.addEventListener('change',e=>{S.purchaseFilter=e.target.value;tc27RenderPurchases()});
$('chat-form').addEventListener('submit',send);
$('chat-body').addEventListener('keydown',e=>{
 if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){
  e.preventDefault();
  if(!$('chat-send').disabled)$('chat-form').requestSubmit();
 }
});
$('chat-dialog').addEventListener('close',stopPolling);
document.addEventListener('visibilitychange',async()=>{if(!document.hidden){
 if(S.session?.refresh_token&&(!S.session.expires_at||S.session.expires_at*1000<Date.now()+120000))await refresh();
 if(S.active)messages();if(S.session?.user){threads().catch(()=>{});purchases().catch(()=>{})}browse();sessionUI();
}});
window.addEventListener('storage',e=>{
 if(e.key===window.TrisoAuth.key){
  const next=window.TrisoAuth.read();
  if((S.session?.access_token||null)!==(next?.access_token||null)){
   stopPolling();stopInbox();S.active=null;
   S.session=next;S.dailyCount=0;S.pro=false;S.threads=[];S.purchaseRows=[];S.purchaseBusy=false;sessionUI();
   if(next){startInbox();Promise.allSettled([mine(),threads(),purchases()]);}else{$('purchase-requests-wrap').classList.add('hidden');empty($('purchase-requests'));}
  }
 }
});
setInterval(async()=>{if(!S.session?.refresh_token)return;const expires=S.session.expires_at||0;if(expires && expires*1000>Date.now()+4*60*1000)return;await refresh();if(S.rt&&S.session?.access_token)S.rt.realtime.setAuth(S.session.access_token);sessionUI()},120000);
init();
})();