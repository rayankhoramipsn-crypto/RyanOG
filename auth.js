/* Shared staging Auth. Browser guards are UX; Supabase RLS enforces data access. */
(()=>{
'use strict';
const root='https://cxtytbjvdlngahytfilr.supabase.co';
const key='sb_publishable_AqZWjpgyZ_h6-EKwOySyGQ_0LE8bcRm';
const storageKey='tc35_auth_session';
const base=new URL('.',document.currentScript.src);
let pending=null;
function read(){try{return JSON.parse(sessionStorage.getItem(storageKey)||'null')}catch{return null}}
function save(value){if(value)sessionStorage.setItem(storageKey,JSON.stringify({...value,expires_at:value.expires_at||Math.floor(Date.now()/1000)+(value.expires_in||3600)}));else sessionStorage.removeItem(storageKey)}
async function request(path,body,token){
 const response=await fetch(root+'/auth/v1/'+path,{method:body?'POST':'GET',headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok){const error=Error(data.msg||data.message||data.error_description||'Authentication unavailable. Please try again.');error.status=response.status;throw error}return data;
}
async function verify(){
 let session=read();if(!session?.access_token)return null;
 const renew=async()=>{if(!session.refresh_token){save(null);return null}try{session=await request('token?grant_type=refresh_token',{refresh_token:session.refresh_token});save(session);return session}catch(error){if([400,401,403].includes(error.status))save(null);throw error}};
 if(!session.expires_at||session.expires_at<Date.now()/1000+90){if(!await renew())return null}
 let user;
 try{user=await request('user',null,session.access_token)}catch(error){if(error.status!==401&&error.status!==403)throw error;if(!await renew())return null;try{user=await request('user',null,session.access_token)}catch(retry){if([401,403].includes(retry.status))save(null);throw retry}}
 session={...session,user};save(session);return session;
}
function verified(){if(!pending)pending=verify().finally(()=>{pending=null});return pending}
function safeReturn(value){try{const target=new URL(value||'account.html',base);if(target.origin!==base.origin||!target.pathname.startsWith(base.pathname)||target.username||target.password)return new URL('account.html',base).href;target.hash='';return target.href}catch{return new URL('account.html',base).href}}
function login(){const target=new URL('auth.html',base);target.searchParams.set('next',location.pathname+location.search);location.replace(target.href)}
async function requireSession(admin=false){const session=await verified();if(!session){login();return null}if(admin&&session.user.app_metadata?.role!=='admin')throw Error('Administrator access required.');return session}
async function headers(admin=false){const session=await requireSession(admin);if(!session)throw Error('Sign in required.');return {apikey:key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'}}
async function signIn(email,password){const session=await request('token?grant_type=password',{email,password});save(session);return verified()}
async function signUp(email,password){const session=await request('signup',{email,password});if(session.access_token){save(session);return verified()}return null}
async function signOut(){const session=read();save(null);if(session?.access_token)await request('logout',{},session.access_token)}
window.TrisoAuth={verified,requireSession,headers,signIn,signUp,signOut,safeReturn,base};
})();
