/* Marketplace moderation inside the main store account panel.
   Only a JWT verified by the server-side is_admin() and RLS may view/moderate. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),root=$('tc-market-admin'),list=$('tc-market-pending');
 if(!root||!list)return;
 let enabled=false,loading=false,interval=null;
 const safe=(t)=>String(t==null?'':t);
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=safe(text);if(cls)el.className=cls;return el;};
 const msg=(t)=>{$('tc-market-status').textContent=safe(t)};
 async function request(path,options={}){
   const jwt=await window.tc42AccessToken?.();
   if(!jwt)throw Error('Sign in to your administrator account first.');
   const res=await fetch(SUPA_URL+'/rest/v1/'+path,{method:options.method||'GET',headers:{apikey:SUPA_KEY,Authorization:'Bearer '+jwt,Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},body:options.body?JSON.stringify(options.body):undefined});
   const text=await res.text();
   const value=text?JSON.parse(text):null;
   if(!res.ok)throw Error(value?.message||value?.error||'Server response '+res.status);
   return value;
 }
 async function verify(){const yes=await request('rpc/is_admin',{method:'POST',body:{}});if(yes!==true)throw Error('Administrator access not verified.');}
 async function photo(path){
   const jwt=await window.tc42AccessToken?.();
   if(!jwt)return null;
   const safePath=path.split('/').map(encodeURIComponent).join('/');
   const res=await fetch(SUPA_URL+'/storage/v1/object/sign/market-gallery/'+safePath,{
     method:'POST',headers:{apikey:SUPA_KEY,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},
     body:JSON.stringify({expiresIn:600})});
   if(!res.ok)return null;
   const data=await res.json();
   const target=data.signedURL||data.signedUrl;
   return target?(target.startsWith('http')?target:SUPA_URL+'/storage/v1'+(target.startsWith('/')?target:'/'+target)):null;
 }
 async function moderate(item,decision,reason=''){
   if(!enabled||!['approved','declined'].includes(decision))return;
   const label=decision==='approved'?'Approve':'Decline';
   if(decision==='approved'&&!confirm('Approve listing #'+item.id+' after checking its photos and description?'))return;
   if(decision==='declined'){
     const why=prompt('Explain why this listing was declined:',reason);
     if(why===null)return;
     if(!why.trim())return msg('Please provide a reason for declining.');reason=why.trim().slice(0,500);
   }
   msg(label+' in progress…');
   try{
     const jwt=await window.tc42AccessToken?.();
     const rows=await request('market_listings?id=eq.'+encodeURIComponent(item.id)+'&status=eq.pending',{method:'PATCH',body:{
       status:decision,reviewed_at:new Date().toISOString(),reviewed_by:JSON.parse(atob(jwt.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub,
       decline_reason:decision==='declined'?reason:null
     },headers:{Prefer:'return=representation'}});
     if(!Array.isArray(rows)||!rows.length)throw Error('This listing is no longer pending or permission was denied.');
     await load();msg('Listing #'+item.id+' '+decision+'.');
   }catch(e){msg('Could not '+label.toLowerCase()+': '+e.message)}
 }
 async function load(){
   if(!enabled||loading)return;loading=true;msg('Checking pending marketplace listings…');
   try{
     await verify();
     // Query only PENDING rows so recent submissions cannot disappear behind approved items.
     const items=await request('market_listings?select=id,title,platform,description,price,submitted_at,seller_id,status&status=eq.pending&order=submitted_at.desc&limit=200');
     if(!Array.isArray(items))throw Error('Invalid moderation response.');
     const ids=items.map(x=>Number(x.id)).filter(Number.isInteger);
     const media=ids.length?await request('market_listing_media?select=listing_id,object_path,sort_order&listing_id=in.('+ids.join(',')+')&order=sort_order.asc&limit=500'):[];
     root.hidden=false;
     $('tc-market-count').textContent=String(items.length);
     list.replaceChildren();
     if(!items.length)list.append(node('p','No pending listings. New submissions will appear here automatically.','tc-market-note'));
     for(const item of items){
       const photos=(Array.isArray(media)?media:[]).filter(x=>String(x.listing_id)===String(item.id));
       const card=node('article',null,'tc-market-entry');
       const header=node('div',null,'tc-market-entry-header');
       header.append(node('strong','#'+item.id+' · '+item.title),node('span',item.platform+' · $'+item.price,'tc-market-note'));
       card.append(header,node('p',(item.description||'').slice(0,450),'tc-market-desc'));
       card.append(node('small',photos.length+' item photo(s) · Submitted '+new Date(item.submitted_at).toLocaleString(),'tc-market-note'));
       const gallery=node('div',null,'tc-market-photos');
       if(!photos.length)gallery.append(node('span','No photo: approval unavailable','tc-market-warning'));
       for(const file of photos.slice(0,4)){
         const image=node('img');image.alt='Seller item photo';image.loading='lazy';
         photo(file.object_path).then(url=>{if(url){image.src=url;image.onclick=()=>window.open(url,'_blank','noopener,noreferrer')}else image.alt='Photo unavailable'}).catch(()=>image.alt='Photo unavailable');
         gallery.append(image);
       }
       card.append(gallery);
       const buttons=node('div',null,'tc-market-actions');
       const approve=node('button','Approve','tc31-btn');approve.type='button';approve.disabled=!photos.length;approve.onclick=()=>moderate(item,'approved');
       const decline=node('button','Decline','tc31-btn tc31-alt');decline.type='button';decline.onclick=()=>moderate(item,'declined');
       buttons.append(approve,decline);card.append(buttons);list.append(card);
     }
     msg(items.length+' pending marketplace listing(s). Last checked '+new Date().toLocaleTimeString()+'.');
   }catch(e){msg('Could not load moderation: '+e.message);list.replaceChildren()}
   finally{loading=false}
 }
 window.tcMarketAdminLoad=async()=>{enabled=true;root.hidden=false;await load();if(!interval)interval=setInterval(()=>{if(enabled&&!document.hidden)load()},20000)};
 window.tcMarketAdminReset=()=>{enabled=false;root.hidden=true;list.replaceChildren();$('tc-market-count').textContent='0';if(interval){clearInterval(interval);interval=null}};
 window.tcMarketAdminRefresh=()=>load();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&enabled)load()});
})();
