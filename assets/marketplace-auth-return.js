/* Return only a recent, explicitly requested listing action after the existing Auth UI. */
(function(global){
 'use strict';const key='triso_market_listing_intent';let returning=false;
 function intent(){try{const p=JSON.parse(sessionStorage.getItem(key)||'null');return p?.viaMain===true&&Number.isSafeInteger(p.listing)&&p.listing>0&&['chat','checkout'].includes(p.action)&&Number.isFinite(p.at)&&Date.now()>=p.at&&Date.now()-p.at<900000?p:null}catch{return null}}
 function check(){const p=intent();if(!p||returning||!global.TrisoAuth?.read()?.user?.id||document.getElementById('tc31-panel')?.dataset.authMode!=='account')return;returning=true;const target=new URL(p.preview?'/preview/marketplace.html':'/marketplace.html',location.origin);target.searchParams.set('listing',String(p.listing));location.replace(target.href)}
 function ready(){const u=new URL(location.href);if(u.searchParams.has('market_signin')){u.searchParams.delete('market_signin');history.replaceState(history.state,'',u.pathname+u.search+u.hash);if(intent()&&!global.TrisoAuthCallback?.active){global.showScreen('tc31-panel');global.tc31CallbackMode('signin');global.tc37Close?.()}}const panel=document.getElementById('tc31-panel');if(panel)new MutationObserver(check).observe(panel,{attributes:true,attributeFilter:['data-auth-mode']});check()}
 global.addEventListener('triso:session',()=>queueMicrotask(check));if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})(window);
