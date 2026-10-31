/* TRISOCMD Marketplace V18 — privileged moderator viewing.
   The Supabase JWT/RLS is authoritative. No admin impersonation or money transfer. */
(function(){
'use strict';
const get=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=String(text);if(cls)e.className=cls;return e};
let active=null,chatList=[],orders=[],busy=false,lastRefresh=0;
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
 if(!chatList.length){box.append(el('p','No marketplace conversations yet.'));return}
 for(const c of chatList){
  const card=el('button',null,'tc18-conversation'+(String(c.id)===String(active)?' active':''));
  card.type='button';
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
function renderOrders(){
 const box=get('tc18-order-list');if(!box)return;box.replaceChildren();
 if(!orders.length){box.append(el('p','No purchase requests yet.'));return}
 for(const o of orders){
  const card=el('article',null,'tc18-order-card');
  card.append(el('strong',o.listing_title+' · $'+o.price_usd+' · '+o.payment_method));
  card.append(el('p','Request '+o.id+' · '+o.status+' · '+new Date(o.created_at).toLocaleString()));
  card.append(el('small','Buyer '+o.buyer_id+' · Seller '+o.seller_id));
  if(o.buyer_note)card.append(el('p','Buyer note: '+o.buyer_note));
  if(o.admin_note)card.append(el('p','Admin note: '+o.admin_note));
  const controls=el('div',null,'tc18-order-controls');
  if(['requested','awaiting_payment_setup','disputed'].includes(o.status)){
   const pending=el('button','Awaiting payment setup');pending.type='button';
   pending.onclick=()=>updatePurchase(o,'awaiting_payment_setup');
   const cancel=el('button','Cancel request');cancel.type='button';
   cancel.onclick=()=>updatePurchase(o,'cancelled');
   controls.append(pending,cancel);
  }
  card.append(controls);box.append(card);
 }
}
async function updatePurchase(o,next){
 if(!confirm('Set request '+o.id+' to '+next+'? This records review only, NOT a completed payment or payout.'))return;
 const note=prompt('Optional admin note to buyer and seller (up to 500 characters):','');
 if(note===null)return;
 try{
  await rpcV18('market_admin_update_purchase',{p_request:o.id,p_status:next,p_note:note.slice(0,500)});
  await loadPurchases();
 }catch(e){say('tc18-orders-status','Could not update request: '+e.message)}
}
async function loadPurchases(){
 return safeCall(async()=>{
  try{
   orders=await api('market_purchase_requests?select=id,listing_id,listing_title,buyer_id,seller_id,price_usd,payment_method,status,buyer_note,admin_note,created_at&order=created_at.desc&limit=150');
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
 active=null;chatList=[];orders=[];
 for(const id of ['tc18-chat-list','tc18-chat-messages','tc18-order-list'])get(id)?.replaceChildren();
 say('tc18-chat-status','Sign in with admin permissions to review conversations.');
 say('tc18-orders-status','Sign in with admin permissions to review purchase requests.');
}
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
