import {test} from 'node:test';import assert from 'node:assert/strict';
import {readTextBounded} from '../supabase/functions/_shared/request-body.mjs';import {createStoreHandler} from '../supabase/functions/_shared/store-handler.mjs';import {createWebhookHandler} from '../supabase/functions/_shared/webhook-handler.mjs';
function oversized(size){let cancelled=false;const request=new Request('https://fixture/',{method:'POST',headers:{Authorization:'Bearer fixture'},body:new ReadableStream({start(c){c.enqueue(new Uint8Array(size))},cancel(){cancelled=true}}),duplex:'half'});return {request,cancelled:()=>cancelled}}
test('payment and checkout streams are stopped at byte limits without waiting for end',async()=>{
 const values={SUPABASE_URL:'https://db.fixture',SUPABASE_SERVICE_ROLE_KEY:'service-fixture',SUPABASE_ANON_KEY:'anon-fixture'},store=createStoreHandler({env:n=>values[n],fetcher:async()=>Response.json({id:'00000000-0000-4000-8000-000000000001'})}),webhook=createWebhookHandler({env:n=>values[n],provider:{enabled:true,authenticateWebhook:()=>assert.fail('must not authenticate oversized data')}});
 for(const [handler,size]of [[store,16385],[webhook,65537]]){const r=oversized(size);assert.equal((await handler(r.request)).status,413);assert(r.cancelled())}
});
test('stream limits count UTF-8 bytes and preserve multibyte chunk boundaries',async()=>{
 const value='س',bytes=new TextEncoder().encode(value);const request=new Request('https://fixture/',{method:'POST',body:new ReadableStream({start(c){c.enqueue(bytes.slice(0,1));c.enqueue(bytes.slice(1));c.close()}}),duplex:'half'});assert.equal(await readTextBounded(request,2),value);await assert.rejects(readTextBounded(new Request('https://fixture/',{method:'POST',body:value}),1),e=>e.status===413);await assert.rejects(readTextBounded(new Request('https://fixture/',{method:'POST',body:new Uint8Array([255])}),10),e=>e.status===400);
});
test('checkout null and array bodies return client errors; invalid webhook identities cannot query SQL',async()=>{
 const values={SUPABASE_URL:'https://db.fixture',SUPABASE_SERVICE_ROLE_KEY:'service-fixture',SUPABASE_ANON_KEY:'anon-fixture'},store=createStoreHandler({env:n=>values[n],fetcher:async()=>Response.json({id:'00000000-0000-4000-8000-000000000001'})});for(const body of ['null','[]','"invalid"'])assert.equal((await store(new Request('https://fixture/',{method:'POST',headers:{Authorization:'Bearer fixture'},body}))).status,400);
 const webhook=createWebhookHandler({env:n=>values[n],fetcher:()=>assert.fail('must not query database'),provider:{enabled:true,authenticateWebhook:async()=>({order_id:'-'.repeat(36),event_id:'event'})}});assert.equal((await webhook(new Request('https://fixture/',{method:'POST',body:'{}'}))).status,400);
});
