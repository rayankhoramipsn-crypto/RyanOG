/* Google PKCE initiation. Only the staging public settings endpoint is queried. */
(function(global){
 'use strict';
 const project='https://cxtytbjvdlngahytfilr.supabase.co',key='tc35_google_pkce';
 const base64url=bytes=>global.btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
 async function google({url,anon}){
  if(!['https:','http:'].includes(global.location.protocol)||url!==project)throw Error('Google sign-in needs a hosted HTTPS URL.');
  if(global.location.protocol==='http:'&&!['localhost','127.0.0.1'].includes(global.location.hostname))throw Error('Google sign-in needs a hosted HTTPS URL.');
  const response=await global.fetch(project+'/auth/v1/settings',{headers:{apikey:anon},signal:AbortSignal.timeout(15000)});
  if(!response.ok){const e=Error('Google sign-in settings could not be checked. Please try again.');e.status=response.status;throw e}
  const settings=await response.json();
  if(settings?.external?.google===false)throw Error('Google sign-in is not configured on this site. Please use email sign-in.');
  if(settings?.external?.google!==true)throw Error('Google sign-in settings could not be checked. Please try again.');
  const verifier=base64url(global.crypto.getRandomValues(new Uint8Array(32)));
  const challenge=base64url(new Uint8Array(await global.crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
  const redirect=global.location.origin+global.location.pathname;
  // One verifier per browser tab; never overwrite SDK email/recovery verifiers.
  try{global.sessionStorage.setItem(key,JSON.stringify({verifier,redirect}));if(!global.sessionStorage.getItem(key))throw Error()}
  catch{throw Error('Google sign-in needs browser session storage. Allow it and try again.')}
  const authorize=new URL(project+'/auth/v1/authorize');
  authorize.search=new URLSearchParams({provider:'google',redirect_to:redirect,code_challenge:challenge,code_challenge_method:'s256'}).toString();
  return authorize.href;
 }
 global.TrisoAuthOAuth={google};
})(window);
