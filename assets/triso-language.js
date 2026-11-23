/* One non-sensitive site preference. Runs before rendering, independently of Auth. */
(function(global){
 'use strict';
 const key='triso_language',cookie='triso_language',supported=['en','fa','ar','fr','de','es','ru','ro'];
 const names={en:'English',fa:'فارسی',ar:'العربية',fr:'Français',de:'Deutsch',es:'Español',ru:'Русский',ro:'Română'};
 let transient=null;
 const valid=value=>supported.includes(value),dir=value=>['fa','ar'].includes(value)?'rtl':'ltr';
 function read(){try{return global.localStorage.getItem(key)}catch{return null}}
 function cookieValue(){try{return document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookie+'='))?.slice(cookie.length+1)||null}catch{return null}}
 function get(){if(valid(transient))return transient;const fallback=cookieValue(),value=read();return valid(fallback)?fallback:valid(value)?value:null}
 function persist(value){try{global.localStorage.setItem(key,value);document.cookie=cookie+'=; Path=/; Max-Age=0; SameSite=Lax';return true}catch{try{document.cookie=cookie+'='+value+'; Path=/; Max-Age=31536000; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');return cookieValue()===value}catch{return false}}}
 // Migrate once. An empty marker prevents automatic legacy defaults becoming a choice.
 if(read()===null&&!get()){
  let previous=null;try{previous=global.localStorage.getItem('tc_market_lang');if(!valid(previous))previous=JSON.parse(global.localStorage.getItem('trisocmd_test_state')||'{}').lang}catch{}
  if(valid(previous))persist(previous);else try{global.localStorage.setItem(key,'')}catch{}
 }
 function consumeURL(accept){const u=new URL(location.href),value=u.searchParams.get('lang');if(!u.searchParams.has('lang'))return;if(accept&&valid(value))persist(value);u.searchParams.delete('lang');history.replaceState(history.state,'',u.pathname+u.search+u.hash)}
 const navigation=global.performance?.getEntriesByType?.('navigation')?.[0]?.type;
 consumeURL(!get()||(!global.TrisoAuthCallback?.active&&!['reload','back_forward'].includes(navigation)));
 const root=document.documentElement;
 const style=document.createElement('style');style.id='triso-language-boot';style.textContent='html[data-language-established]:not([data-language-picker]) #lang-screen,html[data-auth-callback]:not([data-language-picker]) #lang-screen{display:none!important}';document.head.append(style);
 if(global.TrisoAuthCallback?.active)root.setAttribute('data-auth-callback','');
 function apply(){const value=get();root.lang=value||'en';root.dir=dir(value);root.toggleAttribute('data-language-established',!!value)}
 function emit(source){apply();global.dispatchEvent(new CustomEvent('triso:language',{detail:{language:get()||'en',source}}))}
 function cleanLinks(){document.querySelectorAll('a[href]').forEach(a=>{try{const u=new URL(a.href);if(u.origin===location.origin&&u.searchParams.has('lang')&&!a.hasAttribute('data-language-choice')){u.searchParams.delete('lang');a.href=u.href}}catch{}})}
 function set(value){if(!valid(value))return false;const saved=persist(value);transient=saved?null:value;consumeURL(false);emit('choice');cleanLinks();return saved}
 function syncSelect(select){const value=get()||'en';if(![...select.options].some(o=>o.value===value))select.add(new Option(names[value],value));select.value=value}
 function selectControl(){
  if(document.querySelector('#lang-screen,#language,#acct-language,[data-content-aria="Language"],#language-switch'))return;
  const host=document.querySelector('header,nav');if(!host)return;const select=document.createElement('select');select.dataset.siteLanguage='';select.style.cssText='width:auto;max-width:170px;padding:8px;background:#15111f;color:#f2eafa;border:1px solid #655176;border-radius:8px;font:inherit';
  for(const code of ['en','fa','ar'])select.add(new Option(names[code],code));select.onchange=()=>set(select.value);host.append(select);syncControl();
 }
 function syncControl(){document.querySelectorAll('[data-site-language]').forEach(select=>{syncSelect(select);select.setAttribute('aria-label',({fa:'زبان',ar:'اللغة'})[get()]||'Language')})}
 function home(force=false){if(!document.getElementById('lang-screen')||typeof global.setLang!=='function')return;const value=get();if(value)global.setLang(value,dir(value),'restore');if(value&&document.getElementById('lang-screen').classList.contains('active')&&(force||!global.TrisoAuthCallback?.active))global.showScreen('store-screen')}
 global.TrisoLanguage={key,get,has:()=>!!get(),set,dir,supported,names,syncSelect};apply();
 function ready(){home();selectControl();syncControl();cleanLinks()}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
 global.addEventListener('triso:language',event=>{syncControl();home(['history','bfcache'].includes(event.detail.source))});
 global.addEventListener('pageshow',event=>{if(valid(read())||valid(cookieValue()))transient=null;consumeURL(false);emit(event.persisted?'bfcache':'restore');cleanLinks()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(valid(read())||valid(cookieValue()))transient=null;emit('restore')}});
 global.addEventListener('popstate',()=>{consumeURL(false);emit('history')});
 global.addEventListener('storage',event=>{if(event.key===key||event.key===null){transient=null;emit('storage')}});
 document.addEventListener('click',event=>{const a=event.target.closest?.('a[href]');if(!a)return;try{const u=new URL(a.href);if(u.origin===location.origin&&u.searchParams.has('lang')&&!a.hasAttribute('data-language-choice')){u.searchParams.delete('lang');a.href=u.href}}catch{}},true);
})(window);
