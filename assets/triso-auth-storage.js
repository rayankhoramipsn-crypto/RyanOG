/* TRISOCMD shared session persistence (main, marketplace, admin, blog, product).
   Only Supabase-issued session tokens are persisted; never store passwords. */
(function(global){
 'use strict';
 const KEY='tc35_auth_session',PREF='tc35_remember_me';
 function get(storage,key){try{return storage.getItem(key)}catch{return null}}
 function put(storage,key,value){try{storage.setItem(key,value);return true}catch{return false}}
 function del(storage,key){try{storage.removeItem(key)}catch{}}
 function remembered(){return get(localStorage,PREF)!=='false'}
 function read(){
   // Persistent login takes priority; legacy sessionStorage login is upgraded in place.
   const persist=get(localStorage,KEY),temporary=get(sessionStorage,KEY);
   let value=null;
   for(const raw of [persist,temporary]){
     if(!raw)continue;
     try{const s=JSON.parse(raw);if(s&&s.access_token&&s.refresh_token&&s.user){value=s;break}}catch{}
   }
   if(value&&temporary&&!persist&&remembered())put(localStorage,KEY,JSON.stringify(value));
   return value;
 }
 function write(value,keep=remembered()){
   if(!value||!value.access_token||!value.refresh_token||!value.user)return false;
   const saved={access_token:value.access_token,refresh_token:value.refresh_token,
     expires_at:value.expires_at||(Math.floor(Date.now()/1000)+(Number(value.expires_in)||3600)),
     user:value.user};
   const raw=JSON.stringify(saved);
   if(keep){
     if(!put(localStorage,KEY,raw)){return put(sessionStorage,KEY,raw)}
     del(sessionStorage,KEY);
   }else{
     if(!put(sessionStorage,KEY,raw))return false;
     del(localStorage,KEY);
   }
   return true;
 }
 function clear(){del(localStorage,KEY);del(sessionStorage,KEY)}
 function setRemember(v){
   put(localStorage,PREF,v?'true':'false');
   const session=read();
   if(session)write(session,v);
 }
 global.TrisoAuth=Object.freeze({read,write,clear,remembered,setRemember,key:KEY});
})(window);
