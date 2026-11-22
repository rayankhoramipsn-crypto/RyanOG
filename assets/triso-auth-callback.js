/* Capture callback credentials in memory, scrub URL immediately, never log them. */
(function(global){
 'use strict';
 const url=new URL(global.location.href),q=url.searchParams,h=new URLSearchParams(url.hash.slice(1));
 const keys=['access_token','refresh_token','token_hash','code','error','error_code','error_description','expires_in','expires_at','token_type','provider_token','provider_refresh_token','type'];
 const get=k=>q.get(k)||h.get(k);
 const active=[...keys.slice(0,7),'provider_token','provider_refresh_token'].some(k=>q.has(k)||h.has(k))||get('type')==='recovery';
 const type=get('type'),kind=type==='recovery'?'recovery':['signup','email','invite','email_change'].includes(type)?'confirmation':'signin';
 let pending=active?{kind,type,invalid:keys.some(k=>q.getAll(k).length+h.getAll(k).length>1),hash:get('token_hash'),code:get('code'),access:get('access_token'),refresh:get('refresh_token'),expires:Number(get('expires_in'))||3600,error:q.has('error')||q.has('error_code')||h.has('error')||h.has('error_code')}:null;
 const fragmentHasAuth=keys.some(k=>h.has(k));
 if(active){for(const k of keys){q.delete(k);h.delete(k)}if(fragmentHasAuth)url.hash=h.toString();global.history.replaceState(null,'',url.pathname+url.search+url.hash)}
 async function consume({api,user}){
  const input=pending;pending=null;if(!input)return {handled:false};
  let flow=input.kind;
  try{
   if(input.error){try{global.sessionStorage?.removeItem('tc35_google_pkce')}catch{};throw Error()}
   if(input.invalid)throw Error();
   if(input.type&&!['signup','email','invite','email_change','recovery','magiclink'].includes(input.type))throw Error();
   if([!!input.hash,!!input.code,!!(input.access||input.refresh)].filter(Boolean).length!==1)throw Error();
   let session;
   if(input.hash){
    if(!['recovery','signup','email','invite','email_change','magiclink'].includes(input.type))throw Error();
    session=await api('verify',{token_hash:input.hash,type:input.type});
   }else if(input.code){
    const appKey='tc35_google_pkce',sdkKey='sb-cxtytbjvdlngahytfilr-auth-token-code-verifier';let stored,app;
    if(!input.type){try{app=global.sessionStorage?.getItem(appKey);global.sessionStorage?.removeItem(appKey)}catch{}}
    if(app){
     const context=JSON.parse(app);
     if(context.redirect!==url.origin+url.pathname)throw Error();
     stored=JSON.stringify(context.verifier);
    }else{
     for(const name of ['sessionStorage','localStorage']){let value;try{value=global[name]?.getItem(sdkKey);global[name]?.removeItem(sdkKey)}catch{}
      if(value){if(stored&&stored!==value)throw Error();stored=value}
     }
    }
    if(!stored)throw Error();let verifier;try{verifier=JSON.parse(stored)}catch{verifier=stored}
    if(typeof verifier!=='string')throw Error();
    if(verifier.endsWith('/PASSWORD_RECOVERY')){if(input.type&&input.type!=='recovery')throw Error();flow='recovery';verifier=verifier.slice(0,-18)}else if(verifier.endsWith('/SIGN_IN'))verifier=verifier.slice(0,-8);
    if(!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier))throw Error();
    session=await api('token?grant_type=pkce',{auth_code:input.code,code_verifier:verifier});
   }else session={access_token:input.access,refresh_token:input.refresh,expires_in:input.expires};
   if(!session?.access_token||!session?.refresh_token)throw Error();
   const identity=await user(session.access_token);if(!identity?.id)throw Error();
   session={...session,user:identity};
   if(flow==='confirmation'){
    // Confirmation is not a remembered login. Revoke only this temporary session.
    if(global.TrisoAuth?.read()?.access_token!==session.access_token)await api('logout?scope=local',{},session.access_token).catch(()=>{});
    return {handled:true,kind:flow,state:'confirmed'};
   }
   return {handled:true,kind:flow,state:'verified',session};
  }catch{return {handled:true,kind:flow,state:'error',code:flow==='recovery'?'recovery_invalid':flow==='confirmation'?'confirmation_invalid':'signin_invalid'}}
 }
 global.TrisoAuthCallback={active,consume};
})(window);
