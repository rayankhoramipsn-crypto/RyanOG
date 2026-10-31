/* TRISOCMD V14 lower-page interactions.
   Products, prices, cart, auth and payment remain owned by the existing storefront. */
(function(){
  'use strict';
  const KEY='triso-favorites-on-this-device-v1';
  function readFavs(){try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return new Set(Array.isArray(a)?a.map(String):[])}catch{return new Set()}}
  window.tc14IsFavorite=function(id){return readFavs().has(String(id))};
  window.tc14ToggleFavorite=function(button,id){
    const favs=readFavs(),value=String(id);
    if(favs.has(value))favs.delete(value);else favs.add(value);
    try{localStorage.setItem(KEY,JSON.stringify([...favs]))}catch(_){}
    const selected=favs.has(value);
    if(button){button.setAttribute('aria-pressed',String(selected));button.setAttribute('aria-label',selected?'Remove from saved products':'Save product on this device');button.title=selected?'Saved on this device':'Save on this device'}
  };
  const footer=document.getElementById('tc14-footer');
  if(footer && 'IntersectionObserver' in window){
    const obs=new IntersectionObserver(entries=>{
      document.body.classList.toggle('tc14-footer-visible',entries.some(e=>e.isIntersecting)&&document.getElementById('store-screen')?.classList.contains('active'));
    },{threshold:0,rootMargin:'0px 0px -8% 0px'});
    obs.observe(footer);
    document.addEventListener('click',()=>{if(!document.getElementById('store-screen')?.classList.contains('active'))document.body.classList.remove('tc14-footer-visible')});
  }
  const form=document.getElementById('tc14-update-form');
  form?.addEventListener('submit',function(e){
    e.preventDefault();
    const input=form.querySelector('input[type=email]');
    if(!input?.value||!input.checkValidity()){input?.reportValidity();return}
    const email=input.value.trim();
    const body=encodeURIComponent('Please contact me about TRISOCMD updates at '+email+'.');
    const subject=encodeURIComponent('TRISOCMD updates request');
    const status=document.getElementById('tc14-footer-status');
    if(status)status.textContent='Your email app will open. This does not create an automatic subscription.';
    window.location.href='mailto:trisocmd@gmail.com?subject='+subject+'&body='+body;
  });
  // Keep the saved state correct after asynchronous product fetches and filter changes.
  const grid=document.getElementById('product-grid');
  if(grid && 'MutationObserver' in window){
    const sync=()=>{
      const favs=readFavs();
      grid.querySelectorAll('.tc14-fav[data-tc14-id]').forEach(btn=>{
        const selected=favs.has(btn.dataset.tc14Id);
        if(btn.getAttribute('aria-pressed')!==String(selected))btn.setAttribute('aria-pressed',String(selected));
      });
    };
    new MutationObserver(sync).observe(grid,{childList:true,subtree:false});
    sync();
  }
})();