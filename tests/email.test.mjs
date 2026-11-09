import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderEmail,processEmailBatch} from '../supabase/functions/_shared/email.mjs';
test('email escapes injected HTML and rejects non-store links',()=>{
 const e=renderEmail({kind:'order',message:'<script>alert(1)</script>',url:'https://trisocmd.shop/',language:'fa'});
 assert(!e.html.includes('<script>'));assert(e.html.includes('dir="rtl"'));
 assert.throws(()=>renderEmail({kind:'order',url:'https://evil.test/'}));
});
test('delivery disabled without verified sender',async()=>assert.deepEqual(await processEmailBatch({enabled:true}),{disabled:true,sent:0}));
test('worker rechecks opt-in and uses stable idempotency key',async()=>{
 let sent=0,skipped=0,keys=[];
 const jobs=[{id:1,lease:'a',optional:true,user_id:'no'},{id:2,lease:'b',optional:true,user_id:'yes',kind:'order',message:'Pending',url:'https://trisocmd.shop/',to:'fixture@example.test'}];
 const result=await processEmailBatch({enabled:true,senderVerified:true,from:'support@trisocmd.shop',store:{lease:async()=>jobs,optedIn:async id=>id==='yes',skip:async()=>skipped++,sent:async()=>sent++,retry:async()=>assert.fail('unexpected retry')},send:async x=>{keys.push(x.idempotencyKey);return {id:'provider-id'}}});
 assert.equal(result.sent,1);assert.equal(sent,1);assert.equal(skipped,1);assert.deepEqual(keys,['triso-outbox-2']);
});
test('provider failure queues retry without claiming delivery',async()=>{
 let retry=0;
 const result=await processEmailBatch({enabled:true,senderVerified:true,from:'support@trisocmd.shop',store:{lease:async()=>[{id:1,lease:'a',kind:'order',url:'https://trisocmd.shop/'}],retry:async()=>retry++,sent:async()=>assert.fail('must not mark sent')},send:async()=>{throw Error('offline')}});
 assert.equal(result.sent,0);assert.equal(retry,1);
});
