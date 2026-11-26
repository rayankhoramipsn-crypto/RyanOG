import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const code=readFileSync('assets/triso-auth-storage.js','utf8');
function harness(){
 const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
 const localStorage=storage(),sessionStorage=storage(),window={navigator:{}};
 vm.runInNewContext(code,{window,localStorage,sessionStorage,Date});
 return {auth:window.TrisoAuth,localStorage,sessionStorage};
}
const session=(token='old',expires_at=1)=>({access_token:token,refresh_token:token,user:{id:'buyer'},expires_at});
test('session-only recovery never becomes persistent on read',()=>{const h=harness();h.auth.write(session(),false);h.auth.read();assert.equal(h.localStorage.getItem(h.auth.key),null)});
test('concurrent refresh calls exchange once',async()=>{const {auth}=harness();auth.write(session());let count=0;const exchange=async()=>{count++;await new Promise(r=>setTimeout(r,5));return session('new',9999999999)};await Promise.all([auth.refresh(exchange),auth.refresh(exchange)]);assert.equal(count,1);assert.equal(auth.read().access_token,'new')});
test('offline refresh preserves login',async()=>{const {auth}=harness();auth.write(session());await assert.rejects(auth.refresh(async()=>{throw Error('Network offline')}));assert.equal(auth.read().access_token,'old')});
test('revoked refresh clears session',async()=>{const {auth}=harness();auth.write(session());await assert.rejects(auth.refresh(async()=>{throw Error('refresh_token_not_found')}));assert.equal(auth.read(),null)});
test('logout during refresh cannot resurrect login',async()=>{const {auth}=harness();auth.write(session());await auth.refresh(async()=>{auth.clear();return session('late')});assert.equal(auth.read(),null)});
test('new login wins over previous refresh',async()=>{const {auth}=harness();auth.write(session());await auth.refresh(async()=>{auth.write(session('other'));return session('late')});assert.equal(auth.read().access_token,'other')});
test('fresh session avoids rotation',async()=>{const {auth}=harness();auth.write(session('fresh',9999999999));await auth.refresh(()=>{throw Error('must not run')})});
test('refresh preserves session-only preference',async()=>{const h=harness();h.auth.write(session(),false);await h.auth.refresh(async()=>session('next'));assert.equal(h.localStorage.getItem(h.auth.key),null);assert.equal(h.auth.read().access_token,'next')});

test('refresh cannot persist a response for another account',async()=>{const h=harness();h.auth.write(session());await assert.rejects(h.auth.refresh(async()=>({...session('wrong'),user:{id:'other'}})),/Session identity mismatch/);assert.equal(h.auth.read().user.id,'buyer');assert.equal(h.auth.read().access_token,'old')});
