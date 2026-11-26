import {test} from 'node:test';import assert from 'node:assert/strict';
import {stagingDeliveryEnv} from '../supabase/functions/_shared/delivery-hold.mjs';
import {createDeliveryWorker} from '../supabase/functions/_shared/delivery.mjs';
test('staging deployment hold overrides enabled runtime flags without leasing or sending',async()=>{
 const secret='synthetic-worker-secret-'.repeat(2),env=stagingDeliveryEnv(n=>n==='DELIVERY_WORKER_SECRET'?secret:'true');
 const handler=createDeliveryWorker({env,fetcher:()=>assert.fail('No queue/provider fetch during hold'),sendPush:()=>assert.fail('No push during hold')});
 assert.deepEqual(await (await handler(new Request('https://fixture.test'))).json(),{email_enabled:false,push_enabled:false,push_public_key:null});
 assert.deepEqual(await (await handler(new Request('https://fixture.test',{method:'POST',headers:{Authorization:'Bearer '+secret}}))).json(),{disabled:true,sent:0});
 assert.equal((await handler(new Request('https://fixture.test',{method:'POST'}))).status,401);
});
