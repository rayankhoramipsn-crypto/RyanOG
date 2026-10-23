'use strict';
const URL_BASE='https://cxtytbjvdlngahytfilr.supabase.co';
const KEY='sb_publishable_AqZWjpgyZ_h6-EKwOySyGQ_0LE8bcRm';
const $=id=>document.getElementById(id);
const state={session:null,admin:false,products:[],cart:[],thread:null};
const get=(id)=>$(id).value.trim();
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e};
const msg=(text,error=false)=>{const el=$('toast');el.textContent=text;el.style.background=error?'#73303e':'#24334c';el.classList.remove('hidden');$('message').textContent=text};
const safeImage=(src)=>{try{const u=new URL(src);return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}};
async function api(path,{method='GET',body,auth=false,prefer}={}){
 const headers={'apikey':KEY,'Content-Type':'application/json'};
 if(auth){if(!state.session?.access_token)throw Error('Please sign in first');headers.Authorization='Bearer '+state.session.access_token}
 else headers.Authorization='Bearer '+KEY;
 if(prefer)headers.Prefer=prefer;
 const res=await fetch(URL_BASE+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 const data=await res.json().catch(()=>null);
 if(!res.ok)throw Error(data?.message||data?.error_description||data?.error||'Request failed ('+res.status+')');
 return data;
}
function saveSession(session){state.session=session;try{session?sessionStorage.setItem('triso_preview_session',JSON.stringify(session)):sessionStorage.removeItem('triso_preview_session')}catch{}}
async function refresh(){
 if(!state.session?.refresh_token)return;
 try{const d=await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:state.session.refresh_token}});saveSession(d)}
 catch{saveSession(null)}
}
async function auth(){await refresh();state.admin=false;
 if(state.session?.access_token){
  try{const u=await api('/auth/v1/user',{auth:true});$('identity').textContent=u.email||'Signed in';
   const v=await api('/rest/v1/rpc/is_admin',{method:'POST',auth:true,body:{}});state.admin=v===true;
  }catch{saveSession(null);$('identity').textContent='Guest'}
 }else $('identity').textContent='Guest';
 $('adminTab').classList.toggle('hidden',!state.admin);
 $('authPanel').classList.toggle('hidden',!!state.session);
 $('signOut').classList.toggle('hidden',!state.session);
}
function tab(name){document.querySelectorAll('main section').forEach(e=>e.classList.toggle('hidden',e.id!==name));if(name==='orders')loadOrders();if(name==='support')loadSupport();if(name==='admin'&&state.admin)loadAdmin()}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));
async function loadProducts(){
 state.products=await api('/rest/v1/products?select=id,title,price,description,image_url,category,stock,min_qty,max_qty,status&status=eq.available&order=id.desc');
 const cat=$('category'),selected=cat.value;cat.replaceChildren(new Option('All categories',''));
 for(const c of [...new Set(state.products.map(p=>p.category).filter(Boolean))].sort())cat.add(new Option(c,c));
 cat.value=selected;renderProducts();
}
function renderProducts(){
 const list=$('products');list.replaceChildren();
 const query=get('search').toLowerCase(),cat=get('category');
 const filtered=state.products.filter(p=>(!cat||p.category===cat)&&(!query||[p.title,p.description,p.category].some(s=>String(s||'').toLowerCase().includes(query))));
 if(!filtered.length){list.append(node('p','No products yet. The staging database may be empty.','muted'));return}
 for(const p of filtered){
  const card=node('article',undefined,'card');const img=safeImage(p.image_url);
  if(img){const image=node('img');image.src=img;image.alt=p.title;image.loading='lazy';image.referrerPolicy='no-referrer';card.append(image)}
  card.append(node('h3',p.title),node('p',p.category||'Digital goods','muted'),node('p',p.description||''),node('strong',money(p.price)));
  const add=node('button',p.stock>0?'Add to cart':'Out of stock');add.disabled=p.stock<=0;add.addEventListener('click',()=>addCart(p));card.append(node('p','Stock: '+p.stock,'muted'),add);list.append(card);
 }
}
function addCart(p){
 const min=Math.max(1,Number(p.min_qty)||1),existing=state.cart.find(x=>x.id===p.id);
 if(existing){const max=Math.min(Number(p.stock),Number(p.max_qty)||Infinity);if(existing.qty>=max){msg('Quantity limit reached',true);return}existing.qty++}
 else{if(p.stock<min){msg('Insufficient stock',true);return}state.cart.push({id:p.id,qty:min})}
 renderCart();msg('Added to test cart');
}
function renderCart(){
 const el=$('cartItems');el.replaceChildren();let total=0;
 for(const item of [...state.cart]){
  const p=state.products.find(x=>x.id===item.id);if(!p){state.cart=state.cart.filter(x=>x.id!==item.id);continue}
  const max=Math.min(Number(p.stock),Number(p.max_qty)||Infinity),min=Math.max(1,Number(p.min_qty)||1);
  item.qty=Math.min(max,Math.max(min,item.qty));total+=Number(p.price)*item.qty;
  const row=node('div',undefined,'panel row');row.append(node('strong',p.title),node('span',money(p.price)));
  const minus=node('button','−','ghost'),plus=node('button','+','ghost'),remove=node('button','Remove','ghost');
  minus.disabled=item.qty<=min;plus.disabled=item.qty>=max;
  minus.onclick=()=>{item.qty--;renderCart()};plus.onclick=()=>{item.qty++;renderCart()};remove.onclick=()=>{state.cart=state.cart.filter(x=>x.id!==item.id);renderCart()};
  row.append(minus,node('span',item.qty),plus,remove);el.append(row)
 }
 $('cartCount').textContent=state.cart.reduce((n,x)=>n+x.qty,0);
 $('cartTotal').textContent='Test total: '+money(total);
 $('checkout').disabled=!state.cart.length;
}
async function checkout(){
 if(!state.session){tab('account');throw Error('Sign in before placing a test order')}
 if(!state.cart.length)return;
 const items=state.cart.map(x=>({id:x.id,qty:x.qty}));
 const result=await api('/rest/v1/rpc/tc42_create_order',{method:'POST',auth:true,body:{p_items:items}});
 state.cart=[];renderCart();msg('Test order created: '+result);tab('orders');
}
async function loadOrders(){
 const el=$('myOrders');el.replaceChildren();if(!state.session){el.append(node('p','Sign in to see your orders.'));return}
 try{const orders=await api('/rest/v1/tc42_orders?select=id,status,total_amount,currency,items,created_at&order=created_at.desc&limit=30',{auth:true});
  if(!orders.length)el.append(node('p','No test orders yet.','muted'));
  for(const o of orders){const card=node('div',undefined,'panel');card.append(node('strong','Order '+o.id),node('p','Status: '+o.status+' · '+money(o.total_amount)+' · '+new Date(o.created_at).toLocaleString()));for(const item of o.items||[])card.append(node('p',JSON.stringify(item),'muted'));el.append(card)}
 }catch(e){msg(e.message,true)}
}
async function loadSupport(){
 const el=$('supportMessages');el.replaceChildren();if(!state.session){el.append(node('p','Sign in to use support.'));return}
 try{const threads=await api('/rest/v1/tc42_support_threads?select=id,subject&order=created_at.desc&limit=1',{auth:true});state.thread=threads[0]?.id||null;
 if(!state.thread){el.append(node('p','Send your first message to create a support thread.','muted'));return}
 const messages=await api('/rest/v1/tc42_support_messages?select=body,sender_id,created_at&thread_id=eq.'+encodeURIComponent(state.thread)+'&order=created_at.asc&limit=100',{auth:true});
 for(const m of messages){const card=node('div',undefined,'panel');card.append(node('p',m.body),node('small',new Date(m.created_at).toLocaleString(),'muted'));el.append(card)}
 }catch(e){msg(e.message,true)}
}
async function sendSupport(){
 if(!state.session)throw Error('Sign in to contact support');
 const body=get('supportBody');if(!body||body.length>1000)throw Error('Enter a message (up to 1000 characters)');
 if(!state.thread){const u=await api('/auth/v1/user',{auth:true});const threads=await api('/rest/v1/tc42_support_threads?select=id',{method:'POST',auth:true,prefer:'return=representation',body:{customer_id:u.id,subject:'General support'}});state.thread=threads[0].id}
 const u=await api('/auth/v1/user',{auth:true});
 await api('/rest/v1/tc42_support_messages',{method:'POST',auth:true,body:{thread_id:state.thread,sender_id:u.id,body}});
 $('supportBody').value='';msg('Test support message sent');loadSupport();
}
async function sign(kind){
 const email=get('email'),password=$('password').value;if(!email||password.length<6)throw Error('Enter email and a password of at least 6 characters');
 const d=await api('/auth/v1/'+(kind==='up'?'signup':'token?grant_type=password'),{method:'POST',body:{email,password}});
 if(d.access_token)saveSession(d);else if(d.session)saveSession(d.session);else msg('Check your email to confirm the account');
 $('password').value='';await auth();tab('shop');
}
function productForm(p={}){
 const mapping={productId:'id',pTitle:'title',pPrice:'price',pCategory:'category',pStock:'stock',pMin:'min_qty',pMax:'max_qty',pStatus:'status',pImage:'image_url',pDescription:'description'};
 for(const [id,key]of Object.entries(mapping))$(id).value=p[key]??(id==='pMin'?1:id==='pStatus'?'draft':'');
}
async function loadAdmin(){
 if(!state.admin)return;
 const prod=$('adminProducts'),orders=$('adminOrders');prod.replaceChildren();orders.replaceChildren();
 try{
  const products=await api('/rest/v1/products?select=id,title,price,category,stock,min_qty,max_qty,status,image_url,description&order=id.desc&limit=200',{auth:true});
  for(const p of products){const row=node('div',undefined,'panel row');row.append(node('strong',p.title),node('span',money(p.price)+' · '+p.status+' · stock '+p.stock));const edit=node('button','Edit');edit.onclick=()=>{productForm(p);window.scrollTo({top:0,behavior:'smooth'})};row.append(edit);prod.append(row)}
  if(!products.length)prod.append(node('p','No products. Add one above.','muted'));
  const all=await api('/rest/v1/tc42_orders?select=id,status,total_amount,created_at&order=created_at.desc&limit=100',{auth:true});
  for(const o of all){const row=node('div',undefined,'panel');row.append(node('strong',o.id),node('p',o.status+' · '+money(o.total_amount)+' · '+new Date(o.created_at).toLocaleString()));orders.append(row)}
  if(!all.length)orders.append(node('p','No orders yet.','muted'));
 }catch(e){msg(e.message,true)}
}
async function saveProduct(){
 if(!state.admin)throw Error('Admin access required');
 const title=get('pTitle'),price=Number(get('pPrice')),stock=Number(get('pStock')),min=Number(get('pMin')),max=get('pMax')?Number(get('pMax')):null;
 if(!title||!Number.isFinite(price)||price<0||!Number.isInteger(stock)||stock<0||!Number.isInteger(min)||min<1||(max!==null&&(!Number.isInteger(max)||max<min)))throw Error('Check title, price, stock and quantity limits');
 const body={title,price,stock,min_qty:min,max_qty:max,category:get('pCategory'),status:get('pStatus'),image_url:get('pImage')||null,description:get('pDescription')};
 const id=get('productId');await api('/rest/v1/products'+(id?'?id=eq.'+encodeURIComponent(id):''),{method:id?'PATCH':'POST',auth:true,body,prefer:'return=minimal'});
 productForm();msg('Product saved');await Promise.all([loadAdmin(),loadProducts()]);
}
const guard=fn=>async()=>{try{await fn()}catch(e){msg(e.message||'Something went wrong',true)}};
$('search').oninput=renderProducts;$('category').onchange=renderProducts;
$('checkout').onclick=guard(checkout);$('signIn').onclick=guard(()=>sign('in'));$('signUp').onclick=guard(()=>sign('up'));
$('signOut').onclick=guard(async()=>{if(state.session)await api('/auth/v1/logout',{method:'POST',auth:true}).catch(()=>{});saveSession(null);state.cart=[];renderCart();await auth();tab('shop')});
$('sendSupport').onclick=guard(sendSupport);$('saveProduct').onclick=guard(saveProduct);$('clearProduct').onclick=()=>productForm();
(async()=>{try{const s=sessionStorage.getItem('triso_preview_session');if(s)saveSession(JSON.parse(s))}catch{}await auth();try{await loadProducts()}catch(e){msg('Unable to load test products: '+e.message,true)}renderCart();tab('shop')})();
