/* TRISOCMD Marketplace V18 — privileged moderator viewing.
   The Supabase JWT/RLS is authoritative. No admin impersonation or money transfer. */
(function(){
'use strict';
const get=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=String(text);if(cls)e.className=cls;return e};
let active=null,chatList=[],orders=[],paymentClaims=[],busy=false,lastRefresh=0,chatQuery='',tc27OrderFilter='open',tc27OrderSearch='',tc27OrderBusy=false,tc27SelectedOrder=null;
const say=(id,text)=>{const e=get(id);if(e)e.textContent=String(text||'')};
const safeCall=async(fn)=>{if(typeof authorized==='undefined'||!authorized)throw Error('Verified admin sign-in required');return fn()};
async function rpcV18(name,body){
 return safeCall(()=>api('rpc/'+name,{method:'POST',body:JSON.stringify(body),headers:{Prefer:'return=representation'}}));
}
async function removeAdminListing(item){
 if(!confirm('Remove listing #'+item.id+'? It will be hidden from public search, with existing chat history retained.'))return;
 try{
  await rpcV18('market_remove_listing',{p_listing:Number(item.id)});
  status('Listing #'+item.id+' removed. Historical messages remain available.');
  await load();
 }catch(err){status('Could not remove listing: '+err.message)}
}
window.tc18RemoveListing=removeAdminListing;
function renderChatList(){
 const box=get('tc18-chat-list');if(!box)return;box.replaceChildren();
 const needle=chatQuery.trim().toLowerCase();
 const visible=chatList.filter(c=>!needle||[c.id,c.listing_id,c.seller_id,c.buyer_id].some(v=>String(v||'').toLowerCase().includes(needle)));
 say('tc26-admin-chat-count',visible.length+' of '+chatList.length+' conversations shown');
 if(!visible.length){box.append(el('p',chatList.length?'No conversations match this search.':'No marketplace conversations yet.','tc26-admin-empty'));return}
 for(const c of visible){
  const card=el('button',null,'tc18-conversation'+(String(c.id)===String(active)?' active':''));
  card.type='button';card.classList.toggle('tc26-last-selected',String(c.id)===String(active));
  card.setAttribute('aria-current',String(c.id)===String(active)?'true':'false');
  card.append(el('strong','#'+c.id+' · Listing #'+c.listing_id));
  card.append(el('small','Buyer '+c.buyer_id.slice(0,8)+' · Seller '+c.seller_id.slice(0,8)+' · '+new Date(c.created_at).toLocaleString()));
  card.onclick=()=>openChat(c);
  box.append(card);
 }
}
async function loadConversations(){
 return safeCall(async()=>{
  try{
   chatList=await api('market_conversations?select=id,listing_id,buyer_id,seller_id,created_at&order=created_at.desc&limit=150');
   say('tc18-chat-status',chatList.length+' conversations · Authorized moderators can review buyer-seller messages.');
   renderChatList();
   if(active){
    const c=chatList.find(x=>String(x.id)===String(active));
    if(c)await openChat(c,false);
   }
  }catch(err){say('tc18-chat-status','Could not load conversations: '+err.message)}
 });
}
async function openChat(c,focus=true){
 if(!authorized)return;
 active=String(c.id);renderChatList();
 const heading=get('tc18-chat-heading');
 heading.textContent='Conversation #'+c.id+' · Listing #'+c.listing_id;
 get('tc18-chat-context').textContent='Buyer '+c.buyer_id+' · Seller '+c.seller_id+' · Moderator read-only access.';
 const box=get('tc18-chat-messages');box.replaceChildren(el('p','Loading chat messages…'));
 try{
  const rows=await api('market_messages?select=id,conversation_id,sender_id,body,created_at&conversation_id=eq.'+encodeURIComponent(c.id)+'&order=created_at.asc,id.asc&limit=300');
  if(active!==String(c.id))return;
  box.replaceChildren();
  if(!rows.length)box.append(el('p','No messages in this conversation.'));
  for(const m of rows){
   const wrapper=el('div',null,'tc18-msg'+(m.sender_id===c.seller_id?' seller':' buyer'));
   wrapper.append(el('strong',m.sender_id===c.seller_id?'Seller':'Buyer'));
   wrapper.append(el('p',m.body));
   wrapper.append(el('small',new Date(m.created_at).toLocaleString()));
   box.append(wrapper);
  }
  if(focus)box.scrollTop=box.scrollHeight;
 }catch(err){say('tc18-chat-status','Cannot read messages: '+err.message)}
}
const tc27ActiveStates=['requested','awaiting_payment_setup','disputed'];
function tc27AdminFeedback(message='',kind='info'){
 const target=get('tc27-admin-order-feedback');if(!target)return;
 target.textContent=message;target.hidden=!message;target.dataset.state=kind;
 target.setAttribute('role',kind==='error'?'alert':'status');
}
function renderOrders(){
 const box=get('tc18-order-list');if(!box)return;box.replaceChildren();
 const needle=tc27OrderSearch.trim().toLowerCase();
 const filtered=orders.filter(o=>(tc27OrderFilter==='all'||(tc27OrderFilter==='open'&&tc27ActiveStates.includes(o.status))||o.status===tc27OrderFilter)
  &&(!needle||[o.id,o.listing_id,o.listing_title,o.buyer_id,o.seller_id].some(v=>String(v??'').toLowerCase().includes(needle))));
 say('tc27-admin-order-summary',filtered.length+' of '+orders.length+' requests shown · '+orders.filter(o=>tc27ActiveStates.includes(o.status)).length+' open');
 if(!filtered.length){box.append(el('p',orders.length?'No requests match these filters.':'No purchase requests yet.'));return}
 for(const o of filtered){
  const card=el('article',null,'tc18-order-card tc27-admin-order-card');
  card.append(el('strong','#'+String(o.id).slice(0,8)+' · '+o.listing_title+' · $'+o.price_usd));
  card.append(el('span',o.status.replaceAll('_',' '),'tc27-state '+o.status));
  card.append(el('p','Listing #'+o.listing_id+' · '+o.payment_method+' preference · '+new Date(o.created_at).toLocaleString()));
  card.append(el('small','Buyer '+o.buyer_id+' · Seller '+o.seller_id));
  if(o.buyer_note)card.append(el('p','Buyer note: '+o.buyer_note));
  if(o.admin_note)card.append(el('p','Admin note: '+o.admin_note));
  const claim=paymentClaims.find(c=>String(c.request_id)===String(o.id));
  if(claim){
   const review=el('div',null,'tc27-admin-review-only');
   review.append(el('strong','Unverified '+claim.network+' TXID · No funds confirmed'));
   review.append(el('p',claim.txid));
   review.append(el('small','Submitted '+new Date(claim.created_at).toLocaleString()+' · This is a claimed transaction reference, not payment evidence.'));
   card.append(review);
  }
  card.append(el('p','This is a review-only request, not a paid order. Do not instruct either party to transfer funds.','tc27-admin-review-only'));
  if(['requested','awaiting_payment_setup','disputed'].includes(o.status)){
   const button=el('button','Review request');button.type='button';
   button.onclick=()=>updatePurchase(o);
   card.append(button);
  }
  box.append(card);
 }
}
async function updatePurchase(o){
 if(!authorized||tc27OrderBusy||!['requested','awaiting_payment_setup','disputed'].includes(o.status))return;
 tc27SelectedOrder=o;
 get('tc27-order-context').textContent='Request #'+o.id+' · '+o.listing_title+'. Changes only describe review status; no payment is processed.';
 get('tc27-order-note').value=o.admin_note||'';
 get('tc27-order-action').value=o.status==='disputed'?'disputed':'awaiting_payment_setup';
 get('tc27-order-error').hidden=true;
 get('tc27-order-dialog').showModal();
}
get('tc27-order-close')?.addEventListener('click',()=>get('tc27-order-dialog').close());
get('tc27-order-dialog')?.addEventListener('close',()=>{tc27SelectedOrder=null});
get('tc27-order-form')?.addEventListener('submit',async e=>{
 e.preventDefault();
 const selected=tc27SelectedOrder,next=get('tc27-order-action').value,note=get('tc27-order-note').value.trim();
 if(!selected||tc27OrderBusy)return;
 if(!['cancelled','awaiting_payment_setup','disputed'].includes(next))return;
 const button=get('tc27-order-confirm');tc27OrderBusy=true;button.disabled=true;
 try{
  await rpcV18('market_admin_update_purchase',{p_request:selected.id,p_status:next,p_note:note.slice(0,500)});
  get('tc27-order-dialog').close();
  tc27AdminFeedback('Request #'+selected.id+' review status saved as '+next.replaceAll('_',' ')+'. No payment was confirmed.','success');
  await loadPurchases();
 }catch(err){
  const e=get('tc27-order-error');e.textContent='Could not save review: '+err.message;e.hidden=false;
  tc27AdminFeedback('Could not change request status: '+err.message,'error');
 }finally{tc27OrderBusy=false;button.disabled=false}
});
get('tc27-admin-order-filter')?.addEventListener('change',e=>{tc27OrderFilter=e.target.value;renderOrders()});
get('tc27-admin-order-search')?.addEventListener('input',e=>{tc27OrderSearch=e.target.value;renderOrders()});
async function loadPurchases(){
 return safeCall(async()=>{
  try{
   orders=await api('market_purchase_requests?select=id,listing_id,listing_title,buyer_id,seller_id,price_usd,payment_method,status,buyer_note,admin_note,created_at&order=created_at.desc&limit=150');
   try{paymentClaims=await api('market_txid_claims?select=id,request_id,network,txid,status,created_at&order=created_at.desc&limit=150')}
   catch(err){paymentClaims=[];console.warn('Unverified TXID review list unavailable',err)}
   say('tc18-orders-status',orders.length+' requests · Payment collection and escrow are NOT active; do not tell buyers to send funds.');
   renderOrders();
  }catch(err){say('tc18-orders-status','Cannot load requests: '+err.message)}
 });
}
async function refresh(){
 if(!authorized||busy)return;
 busy=true;lastRefresh=Date.now();
 try{await Promise.allSettled([loadConversations(),loadPurchases()])}
 finally{busy=false}
}
window.tc18Refresh=refresh;
function reset(){
 active=null;chatList=[];orders=[];paymentClaims=[];chatQuery='';tc27OrderSearch='';tc27OrderFilter='open';const f=get('tc27-admin-order-filter'),q=get('tc27-admin-order-search');if(f)f.value='open';if(q)q.value='';tc27AdminFeedback('');if(searchBox)searchBox.value='';say('tc26-admin-chat-count','');
 for(const id of ['tc18-chat-list','tc18-chat-messages','tc18-order-list'])get(id)?.replaceChildren();
 say('tc18-chat-status','Sign in with admin permissions to review conversations.');
 say('tc18-orders-status','Sign in with admin permissions to review purchase requests.');
}
const searchBox=get('tc26-admin-chat-search');
if(searchBox)searchBox.addEventListener('input',event=>{chatQuery=event.target.value;renderChatList()});
const originalLoad=window.tc18Refresh;
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&authorized&&Date.now()-lastRefresh>15000)refresh()});
const observer=new MutationObserver(()=>{
 const panel=get('dashboard');
 if(panel&&!panel.classList.contains('hidden')&&authorized)refresh();
 else if(panel&&panel.classList.contains('hidden'))reset();
});
if(get('dashboard'))observer.observe(get('dashboard'),{attributes:true,attributeFilter:['class']});
get('tc18-chat-refresh')?.addEventListener('click',loadConversations);
get('tc18-orders-refresh')?.addEventListener('click',loadPurchases);
setInterval(()=>{if(!document.hidden&&authorized&&!get('dashboard').classList.contains('hidden')&&Date.now()-lastRefresh>12000)refresh()},15000);
})();
