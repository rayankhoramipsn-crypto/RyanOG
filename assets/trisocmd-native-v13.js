/* TRISOCMD native premium controls — no image hotspots. */
(function(){
 'use strict';
 const root=document.getElementById('store-screen');if(!root)return;
 const toggle=document.getElementById('tc-native-lang-toggle');
 const menu=document.getElementById('tc-native-lang-menu');
 const nav=document.getElementById('tc-native-navlinks');
 const mobile=document.querySelector('.tc-native-menu-toggle');
 const srch=document.getElementById('tc-native-search');
 const backendSearch=document.getElementById('tc39-search');
 const category=document.getElementById('tc39-category');
 const cartOriginal=document.getElementById('tc39-count');
 const cartBadge=document.getElementById('tc-native-cartcount');
 function langClose(){if(!menu)return;menu.hidden=true;toggle?.setAttribute('aria-expanded','false')}
 function langOpen(){if(!menu)return;menu.hidden=false;toggle?.setAttribute('aria-expanded','true');const current=(document.documentElement.lang||'en').toLowerCase();menu.querySelectorAll('button[data-native-lang]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.nativeLang===current)))}
 toggle?.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();menu.hidden?langOpen():langClose()});
 menu?.addEventListener('click',function(e){const b=e.target.closest('button[data-native-lang]');if(!b)return;e.preventDefault();e.stopPropagation();langClose();if(typeof window.setLang==='function')window.setLang(b.dataset.nativeLang,b.dataset.nativeDir,'navbar');else{document.documentElement.lang=b.dataset.nativeLang;document.documentElement.dir=b.dataset.nativeDir}document.getElementById('nav-lang-label')?.replaceChildren(document.createTextNode(b.dataset.nativeLang.toUpperCase()))});
 document.addEventListener('click',e=>{if(!e.target.closest('#tc-native-lang'))langClose()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){langClose();nav?.classList.remove('open');mobile?.setAttribute('aria-expanded','false')}});
 mobile?.addEventListener('click',()=>{if(!nav)return;const opened=nav.classList.toggle('open');mobile.setAttribute('aria-expanded',String(opened))});
 nav?.addEventListener('click',e=>{if(e.target.closest('a,button')){nav.classList.remove('open');mobile?.setAttribute('aria-expanded','false')}});
 function filter(k,scroll=true){
   if(!category||!backendSearch)return;
   const key=k==='gear'?'gaming':k;
   const options=Array.from(category.options);
   const found=k==='all'?options.find(o=>o.value===''):options.find(o=>(o.textContent+' '+o.value).toLowerCase().includes(key));
   category.value=found?found.value:'';
   backendSearch.value=(found||k==='all')?'':key;
   if(srch)srch.value='';
   if(typeof window.tc39Filter==='function')window.tc39Filter();
   root.querySelectorAll('[data-native-filter]').forEach(b=>{const on=b.dataset.nativeFilter===k;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
   if(scroll)document.querySelector('#store-screen .product-section')?.scrollIntoView({behavior:'smooth',block:'start'});
 }
 root.addEventListener('click',e=>{
  const tile=e.target.closest('a[data-native-category]');if(tile){e.preventDefault();filter(tile.dataset.nativeCategory);return}
  const chip=e.target.closest('button[data-native-filter]');if(chip){e.preventDefault();filter(chip.dataset.nativeFilter);return}
 });
 srch?.addEventListener('input',()=>{if(backendSearch){backendSearch.value=srch.value;if(category)category.value='';if(typeof window.tc39Filter==='function')window.tc39Filter()}});
 srch?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();document.querySelector('#store-screen .product-section')?.scrollIntoView({behavior:'smooth'})}});
 if(cartOriginal&&cartBadge){const sync=()=>cartBadge.textContent=cartOriginal.textContent?.trim()||'0';sync();new MutationObserver(sync).observe(cartOriginal,{childList:true,characterData:true,subtree:true})}

 const translations={
 en:{home:'Home',store:'Store',market:'Marketplace',blog:'Blog',trust:'How to Trust Us',faq:'FAQ',explore:'EXPLORE THE STORE',discover:'DISCOVER TRISOCMD',heroSub:'Fortnite drops, digital essentials and gaming gear worth talking about.',title:'THE GAME<br><em>STARTS HERE.</em>'},
 fa:{home:'خانه',store:'فروشگاه',market:'بازار کاربران',blog:'وبلاگ',trust:'اعتماد و امنیت',faq:'سؤالات متداول',explore:'مشاهده فروشگاه',discover:'آشنایی با TRISOCMD',heroSub:'اکانت‌های فورتنایت، محصولات دیجیتال و تجهیزات گیمینگ.',title:'بازی از<br><em>اینجا شروع می‌شود.</em>'},
 ar:{home:'الرئيسية',store:'المتجر',market:'السوق',blog:'المدونة',trust:'الثقة والأمان',faq:'الأسئلة',explore:'تصفح المتجر',discover:'اكتشف TRISOCMD',heroSub:'حسابات فورتنايت والمنتجات الرقمية ومعدات الألعاب.',title:'اللعبة تبدأ<br><em>من هنا.</em>'},
 fr:{home:'Accueil',store:'Boutique',market:'Marché',blog:'Blog',trust:'Confiance',faq:'FAQ',explore:'EXPLORER LA BOUTIQUE',discover:'DÉCOUVRIR TRISOCMD',heroSub:'Comptes Fortnite, produits numériques et équipement gaming.',title:'LE JEU<br><em>COMMENCE ICI.</em>'},
 de:{home:'Startseite',store:'Shop',market:'Marktplatz',blog:'Blog',trust:'Vertrauen',faq:'FAQ',explore:'SHOP ENTDECKEN',discover:'TRISOCMD ENTDECKEN',heroSub:'Fortnite-Accounts, digitale Produkte und Gaming-Zubehör.',title:'DAS SPIEL<br><em>BEGINNT HIER.</em>'},
 es:{home:'Inicio',store:'Tienda',market:'Mercado',blog:'Blog',trust:'Confianza',faq:'FAQ',explore:'EXPLORAR TIENDA',discover:'DESCUBRIR TRISOCMD',heroSub:'Cuentas de Fortnite, productos digitales y accesorios gaming.',title:'EL JUEGO<br><em>EMPIEZA AQUÍ.</em>'},
 ro:{home:'Acasă',store:'Magazin',market:'Piață',blog:'Blog',trust:'Încredere',faq:'FAQ',explore:'DESCOPERĂ MAGAZINUL',discover:'DESCOPERĂ TRISOCMD',heroSub:'Conturi Fortnite, produse digitale și accesorii gaming.',title:'JOCUL<br><em>ÎNCEPE AICI.</em>'},
 ru:{home:'Главная',store:'Магазин',market:'Маркет',blog:'Блог',trust:'Доверие',faq:'FAQ',explore:'ОТКРЫТЬ МАГАЗИН',discover:'УЗНАТЬ О TRISOCMD',heroSub:'Аккаунты Fortnite, цифровые товары и игровые аксессуары.',title:'ИГРА<br><em>НАЧИНАЕТСЯ ЗДЕСЬ.</em>'}
 };
 function paintLang(){
  const code=(document.documentElement.lang||'en').toLowerCase(), t=translations[code]||translations.en;
  root.querySelectorAll('[data-native-i18n]').forEach(el=>{const value=t[el.dataset.nativeI18n];if(value)el.textContent=value});
  const title=document.getElementById('hero-title');if(title)title.innerHTML=t.title;
  const codeEl=document.getElementById('nav-lang-label');if(codeEl)codeEl.textContent=code.toUpperCase();
  root.querySelectorAll('[data-native-lang]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.nativeLang===code)));
 }
 paintLang();new MutationObserver(paintLang).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
