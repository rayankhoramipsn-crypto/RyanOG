/* TRISOCMD V34: private, read-only in-site notification inbox.
 * OS alerts work only while the site is open; no claim of background push.
 * Purchase requests do not prove payment or mark listings sold.
 */
(()=>{
 'use strict';
 const api='https://cxtytbjvdlngahytfilr.supabase.co';
 const key='sb_publishable_AqZWjpgyZ_h6-EKwOySyGQ_0LE8bcRm';
 const isAdminPage=location.pathname.includes('/admin/');
 const root=document.createElement('div');
 root.className='tc34-notice-root';root.hidden=true;
 root.innerHTML='<button type="button" class="tc34-notice-button" aria-expanded="false" aria-controls="tc34-notice-panel">🔔 Alerts <span class="tc34-notice-badge" hidden>0</span></button>'+
  '<div id="tc34-notice-panel" class="tc34-notice-panel" hidden><div class="tc34-notice-top"><strong>Notifications</strong><button type="button" class="tc34-notice-close" aria-label="Close notifications">✕</button></div>'+
  '<p class="tc34-notice-sub">Messages and purchase review requests. A request is not proof of payment.</p>'+
  '<ul class="tc34-notice-list"><li>Sign in to see notifications.</li></ul>'+
  '<div class="tc34-notice-bottom"><button type="button" class="tc34-notice-permission">Enable device alerts while site is open</button><label class="tc35-email-pref"><input type="checkbox" class="tc35-email-toggle"> Email notifications (opt-in)</label><span class="tc34-notice-help" role="status"></span></div></div>';
 const host=isAdminPage?document.querySelector('header'):(document.querySelector('.topbar .navtools')||document.querySelector('#store-screen .tc-native-navtools'));
 if(!host)return;
 host.append(root);
 const trigger=root.querySelector('.tc34-notice-button'),panel=root.querySelector('.tc34-notice-panel');
 const badge=root.querySelector('.tc34-notice-badge'),list=root.querySelector('.tc34-notice-list');
 const perm=root.querySelector('.tc34-notice-permission'),help=root.querySelector('.tc34-notice-help'),emailToggle=root.querySelector('.tc35-email-toggle');
 let owner=null,rows=[],latest=0,known=0,booted=false,fetching=false,shown=false;
 async function readEmailOptin(){
  const session=remembered();if(!session?.user)return false;
  const r=await fetch(api+'/rest/v1/market_alert_preferences?select=email_enabled&user_id=eq.'+encodeURIComponent(session.user.id),{
   headers:{apikey:key,Authorization:'Bearer '+session.access_token}
  });
  if(!r.ok)throw Error('Could not load email preference');
  const rows=await r.json();return rows[0]?.email_enabled===true;
 }
 async function saveEmailOptin(enabled){
  const session=remembered();if(!session?.user)throw Error('Sign in to save email preferences');
  const r=await fetch(api+'/rest/v1/market_alert_preferences?on_conflict=user_id',{
   method:'POST',headers:{apikey:key,Authorization:'Bearer '+session.access_token,
      'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
   body:JSON.stringify({user_id:session.user.id,email_enabled:!!enabled})
  });
  if(!r.ok){const data=await r.json().catch(()=>({}));throw Error(data.message||'Could not save email preference')}
  emailToggle.checked=!!enabled;return true;
 }
 async function enableDeviceAlerts(){
  if(!('Notification' in window)||!window.isSecureContext)return 'This browser cannot show device alerts here. In-site alerts still work.';
  if(Notification.permission==='denied')return 'Device alerts are blocked in your browser settings.';
  if(Notification.permission==='granted')return 'Device alerts are already on while the site is open.';
  const result=await Notification.requestPermission();
  return result==='granted'?'Device alerts enabled while the site is open.':'In-site alerts remain available.';
 }
 window.TrisoNotifications={readEmailOptin,saveEmailOptin,enableDeviceAlerts};
 const remembered=()=>window.TrisoAuth?.read?.();
 const href=row=>{
  if(isAdminPage)return row.kind==='message'?'#tc18-chat-list':'#tc18-order-list';
  return row.kind==='message'?'marketplace.html#inbox':'marketplace.html#purchase-requests-wrap';
 };
 const since=()=>{try{return Number(localStorage.getItem('tc34_seen_'+owner))||0}catch{return 0}};
 const saveSeen=n=>{try{localStorage.setItem('tc34_seen_'+owner,String(n))}catch{}};
 function render(){
  const seen=since(),unread=rows.filter(x=>Number(x.id)>seen).length;
  badge.hidden=!unread;badge.textContent=unread>99?'99+':String(unread);
  list.replaceChildren();
  if(!rows.length){const li=document.createElement('li');li.textContent='No notifications yet.';list.append(li);return}
  for(const row of rows){
   const li=document.createElement('li'),a=document.createElement('a');
   a.href=href(row);a.className='tc34-notice-link';if(Number(row.id)>seen)a.classList.add('tc34-new');
   const title=document.createElement('strong');title.textContent=String(row.title||'Marketplace update');
   const detail=document.createElement('span');detail.textContent=(row.listing_id?'Listing #'+row.listing_id+' · ':'')+new Date(row.created_at).toLocaleString();
   a.append(title,detail);li.append(a);list.append(li);
  }
 }
 function pop(item){
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  // No personal message contents, seller identifiers or payment instructions are exposed.
  try{
   const notification=new Notification('TRISOCMD: '+(item.kind==='message'?'New message':'Purchase review update'),{
    body:'Open TRISOCMD to see the update.',tag:'triso-notice-'+item.id
   });
   notification.onclick=()=>{window.focus();notification.close()};
  }catch{}
 }
 async function scan(){
  if(fetching||document.hidden)return;
  const session=remembered();
  const allowed=!!session?.user&&(!isAdminPage||!document.querySelector('#dashboard')?.classList.contains('hidden'));
  if(!allowed){
   root.hidden=false;owner=null;rows=[];known=0;latest=0;booted=false;
   help.textContent='Sign in to view notifications.';
   emailToggle.disabled=true;
   panel.hidden=true;trigger.setAttribute('aria-expanded','false');shown=false;
   return;
  }
  if(owner!==session.user.id){
   owner=session.user.id;known=0;booted=false;rows=[];root.hidden=false;
   emailToggle.disabled=false;
   readEmailOptin().then(v=>{if(owner===session.user.id)emailToggle.checked=v}).catch(()=>{});
  }
  fetching=true;
  try{
   const response=await fetch(api+'/rest/v1/market_notifications?select=id,kind,title,listing_id,request_id,conversation_id,created_at&order=id.desc&limit=40',{
    headers:{apikey:key,Authorization:'Bearer '+session.access_token}
   });
   if(!response.ok)throw Error('Notifications temporarily unavailable');
   const data=await response.json();
   if(!Array.isArray(data)||session.user.id!==owner)return;
   rows=data;latest=rows.reduce((max,r)=>Math.max(max,Number(r.id)||0),0);
   if(booted&&latest>known){
    const additions=rows.filter(r=>Number(r.id)>known).slice(0,2);
    additions.forEach(pop);
   }
   known=Math.max(known,latest);booted=true;render();
   if(!panel.hidden)saveSeen(latest);
  }catch(e){if(!booted){list.textContent='Notifications unavailable. Refresh or sign in again.';help.textContent=e.message}}
  finally{fetching=false}
 }
 trigger.addEventListener('click',()=>{
  const open=panel.hidden;panel.hidden=!open;shown=open;trigger.setAttribute('aria-expanded',String(open));
  if(open){if(owner)saveSeen(latest);render();scan().catch(()=>{})}
 });
 root.querySelector('.tc34-notice-close').addEventListener('click',()=>{
  panel.hidden=true;shown=false;trigger.setAttribute('aria-expanded','false');
 });
 perm.addEventListener('click',async()=>{help.textContent=await enableDeviceAlerts()});
 emailToggle.addEventListener('change',async()=>{
  const selected=emailToggle.checked;
  emailToggle.disabled=true;
  try{
   await saveEmailOptin(selected);
   help.textContent=selected?'Email preference saved. Email delivery requires verified sending setup.':'Email updates turned off.';
  }catch(e){emailToggle.checked=!selected;help.textContent=e.message}
  finally{emailToggle.disabled=false}
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)scan().catch(()=>{})});
 window.addEventListener('storage',e=>{if(e.key?.startsWith('tc34_seen_'))render()});
 scan().catch(()=>{});setInterval(()=>scan().catch(()=>{}),8500);
})();
