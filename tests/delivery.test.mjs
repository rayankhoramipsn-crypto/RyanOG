import {test} from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {createDeliveryWorker,createDeliveryWebhook,createResendTransport,createDeliveryStore,verifyDeliverySignature,endpointAllowed} from '../supabase/functions/_shared/delivery.mjs';
const secret='whsec_'+Buffer.from('fixture-only-webhook-secret').toString('base64'),now=Date.now(),timestamp=String(Math.floor(now/1000)),id='event-fixture',body=JSON.stringify({type:'email.delivered',data:{email_id:'provider-id'}});
const signature=(text=body)=>'v1,'+createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(id+'.'+timestamp+'.'+text).digest('base64');
test('delivery worker defaults disabled and rejects unconfigured or unauthorized invocations',async()=>{
 const h=createDeliveryWorker({env:()=>undefined,fetcher:()=>assert.fail('no network')});assert.equal((await(await h(new Request('https://fixture/'))).json()).email_enabled,false);const preflight=await h(new Request('https://fixture/',{method:'OPTIONS'}));assert.equal(preflight.status,204);assert(preflight.headers.get('access-control-allow-headers').includes('apikey'));
 assert.equal((await h(new Request('https://fixture/',{method:'POST'}))).status,503);
 const configured=createDeliveryWorker({env:n=>n==='DELIVERY_WORKER_SECRET'?'s'.repeat(40):undefined});assert.equal((await configured(new Request('https://fixture/',{method:'POST'}))).status,401);
 const r=await configured(new Request('https://fixture/',{method:'POST',headers:{Authorization:'Bearer '+'s'.repeat(40)}}));assert.equal((await r.json()).disabled,true);
});
test('Resend transport pins endpoint, deadline, sender payload and stable idempotency header',async()=>{
 let request;const send=createResendTransport({apiKey:'test-key',fetcher:async(url,options)=>{request={url,...options};return Response.json({id:'ack'})}});
 assert.equal((await send({from:'support@trisocmd.shop',to:'test@example.test',subject:'Order',text:'Unpaid',html:'Safe',idempotencyKey:'triso-outbox-1'})).id,'ack');
 assert.equal(request.url,'https://api.resend.com/emails');assert.equal(request.headers['Idempotency-Key'],'triso-outbox-1');assert(request.signal);
 const fail=createResendTransport({apiKey:'test',fetcher:async()=>new Response('',{status:422})});await assert.rejects(fail({}),e=>e.permanent===true);
});
test('store adapter caps batch size and forwards opaque lease fencing',async()=>{
 const calls=[],rpc=async(...args)=>{calls.push(args);return []};const store=createDeliveryStore({rpc});await store.lease(100);await store.optedIn('user',12);await store.sent(12,'fence','ack');assert.equal(calls[0][1].p_limit,5);assert.deepEqual(calls[1],['delivery_allowed',{p_id:12}]);assert.equal(calls[2][1].p_lease,'fence');
});
test('webhook verifies raw bytes and replay window before durable deduplication',async()=>{
 assert(await verifyDeliverySignature({id,timestamp,signature:signature(),body,secret,now}));
 assert(!await verifyDeliverySignature({id,timestamp,signature:signature(),body:body+' ',secret,now}));assert(!await verifyDeliverySignature({id,timestamp,signature:signature(),body,secret,now:now+301000}));
 const events=new Set(),h=createDeliveryWebhook({env:()=>secret,now:()=>now,rpc:async(_name,args)=>{if(events.has(args.p_event))return false;events.add(args.p_event);return true}});
 const req=()=>new Request('https://fixture/',{method:'POST',headers:{'svix-id':id,'svix-timestamp':timestamp,'svix-signature':signature()},body});assert.equal((await(await h(req())).json()).recorded,true);assert.equal((await(await h(req())).json()).recorded,false);
 assert.equal((await h(new Request('https://fixture/',{method:'POST',body}))).status,401);
});
test('signed invalid events and oversized webhook bodies cannot update a delivery',async()=>{
 const h=createDeliveryWebhook({env:()=>secret,rpc:()=>assert.fail('must not update')});const text=JSON.stringify({type:'unknown',data:{email_id:'id'}});const r=await h(new Request('https://fixture/',{method:'POST',headers:{'svix-id':id,'svix-timestamp':timestamp,'svix-signature':signature(text)},body:text}));assert.equal(r.status,400);
 assert.equal((await h(new Request('https://fixture/',{method:'POST',headers:{'content-length':'70000'},body:'x'}))).status,413);
});
test('push endpoints prohibit private hosts, credentials, ports and unknown providers',()=>{
 for(const url of ['https://127.0.0.1/x','https://evil.test/x','https://fcm.googleapis.com.evil.test/x','https://user@fcm.googleapis.com/x','https://fcm.googleapis.com:8443/x'])assert.equal(endpointAllowed(url),false);
 assert(endpointAllowed('https://fcm.googleapis.com/fcm/send/fixture'));
});
test('worker skips opted-out jobs, prunes gone subscriptions and sends generic encrypted payloads',async()=>{
 let finish,passed;const values={DELIVERY_WORKER_SECRET:'s'.repeat(40),WEB_PUSH_ENABLED:'true',VAPID_PUBLIC_KEY:'public',VAPID_PRIVATE_KEY:'private',SUPABASE_URL:'https://db.fixture',SUPABASE_SERVICE_ROLE_KEY:'server-test'};
 const worker=createDeliveryWorker({env:n=>values[n],fetcher:async(url,options)=>{const p=JSON.parse(options.body);if(url.endsWith('delivery_lease'))return Response.json([{id:1,lease:'fenced',user_id:'u',subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/x'}}]);if(url.endsWith('delivery_current'))return Response.json({subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/x'}});if(url.endsWith('delivery_allowed'))return Response.json(true);finish=p;return Response.json(null)},sendPush:async(_s,payload)=>{passed=payload;throw Object.assign(Error('gone'),{statusCode:410})}});
 const r=await worker(new Request('https://fixture/',{method:'POST',headers:{Authorization:'Bearer '+'s'.repeat(40)}}));assert.equal(r.status,200);assert.equal(finish.p_action,'gone');assert(!passed.includes('message contents'));assert.equal(JSON.parse(passed).body,'Open TRISOCMD to view your update.');
});
test('notification-only service worker ignores malformed push and never follows supplied off-site URLs',async()=>{
 const {readFile}=await import('node:fs/promises'),{runInNewContext}=await import('node:vm');const handlers={},shown=[],opened=[];
 const self={location:{origin:'https://trisocmd.shop'},addEventListener:(type,fn)=>handlers[type]=fn,registration:{showNotification:async(...args)=>shown.push(args)},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}};
 runInNewContext(await readFile(new URL('../sw-notifications.js',import.meta.url),'utf8'),{self,URL});
 let result;handlers.push({data:{json:()=>({tag:'invalid',body:'private'})},waitUntil:p=>result=p});assert.equal(shown.length,0);
 handlers.push({data:{json:()=>({tag:'triso-notice-1',title:'Private title',body:'Private body',url:'https://evil.test'})},waitUntil:p=>result=p});await result;assert.equal(shown[0][0],'TRISOCMD');assert.equal(shown[0][1].body,'Open TRISOCMD to view your update.');
 handlers.notificationclick({notification:{close(){},data:{url:'https://evil.test'}},waitUntil:p=>result=p});await result;assert.deepEqual(opened,['https://trisocmd.shop/']);
});
