import {test} from 'node:test';import assert from 'node:assert/strict';
import {coreRPC,coreUnits,createCoreVerifier} from '../supabase/functions/_shared/core-verifier.mjs';
import {configuredProvider} from '../supabase/functions/_shared/payments.mjs';
const txid='a'.repeat(64),received=Math.floor(Date.now()/1000)-60;
const invoice={provider_invoice_id:'invoice-fixture',chain:'mainnet',network:'BTC',address:'unique-invoice-address',units:'100000',issued_at:new Date((received-60)*1000).toISOString(),expires_at:new Date((received+600)*1000).toISOString()};
const transaction=()=>({txid,confirmations:6,timereceived:received,walletconflicts:[],details:[{category:'receive',address:invoice.address,amount:0.001,vout:0},{category:'receive',address:'another-address',amount:99,vout:1}]});
function verifier({network='BTC',tx=transaction(),chain={chain:'main',initialblockdownload:false},brand}={}){return createCoreVerifier({rpcByNetwork:{[network]:async method=>method==='getblockchaininfo'?chain:method==='getnetworkinfo'?{subversion:brand||(network==='BTC'?'/Satoshi:30.0.0/':'/LitecoinCore:0.21.4/')}:tx}})}
for(const network of ['BTC','LTC'])test(network+' independently verifies wallet recipient amount and confirmations',async()=>{const r=await verifier({network})({invoice:{...invoice,network},txid});assert.equal(r.state,'verified');assert.equal(r.evidence.units,'100000');assert.equal(r.evidence.txid,txid);assert(r.event_id.includes(network));});
test('node evidence tracks underpayment confirmations and reorg/conflict states',async()=>{
 for(const [change,state]of [[{confirmations:2},'pending_confirmations'],[{details:[{category:'receive',address:invoice.address,amount:0.0005,vout:0}]},'partial']])assert.equal((await verifier({tx:{...transaction(),...change}})({invoice,txid})).state,state);
 for(const change of [{confirmations:-1},{walletconflicts:[txid]},{replaced_by_txid:txid},{abandoned:true},{mempoolconflicts:[txid]}])await assert.rejects(verifier({tx:{...transaction(),...change}})({invoice,txid}),/conflicted_transaction/);
});
test('wrong chain asset sync transaction recipient output and time fail closed',async()=>{
 for(const options of [{brand:'/LitecoinCore:0.21.4/'},{chain:{chain:'test',initialblockdownload:false}},{chain:{chain:'main',initialblockdownload:true}},{tx:{...transaction(),txid:'b'.repeat(64)}},{tx:{...transaction(),details:[]}},{tx:{...transaction(),details:[transaction().details[0],transaction().details[0]]}},{tx:{...transaction(),timereceived:received-3600}},{tx:{...transaction(),walletconflicts:undefined}}])await assert.rejects(verifier(options)({invoice,txid}));
});
test('integer conversion rejects rounding loss negative values and overflow',()=>{for(const [v,n]of [[0.001,100000n],['0.00000001',1n],['84000000.00000000',8400000000000000n]])assert.equal(coreUnits(v),n);for(const v of [1e-9,-1,Infinity,NaN,'1e-8','0.000000001','99999999.99999999'])assert.throws(()=>coreUnits(v));});
test('RPC transport pins configured HTTPS endpoint disallows write methods and redirects',async()=>{
 let count=0;const rpc=coreRPC({url:'https://node.example.test/wallet/receive',username:'rpc',password:'synthetic',fetcher:async(url,options)=>{count++;assert.equal(url,'https://node.example.test/wallet/receive');assert.equal(options.redirect,'error');const b=JSON.parse(options.body);return Response.json({id:b.id,error:null,result:{chain:'main'}})}});
 assert.equal((await rpc('getblockchaininfo')).chain,'main');await assert.rejects(rpc('sendtoaddress'),/node_method_forbidden/);assert.equal(count,1);
 for(const url of ['http://node.test','https://user:pass@node.test','https://node.test/?key=secret'])assert.throws(()=>coreRPC({url,username:'x',password:'y'}));
});
test('RPC transport rejects mismatched replies oversized bodies and private errors',async()=>{
 for(const fetcher of [async()=>Response.json({id:'wrong',result:{}}),async()=>new Response('x'.repeat(262145)),async()=>{throw Error('PRIVATE_CREDENTIAL')}]){const rpc=coreRPC({url:'https://node.test',username:'x',password:'y',fetcher});await assert.rejects(rpc('gettransaction',[txid]),e=>e.message==='node_unavailable');}
 assert.equal(configuredProvider().enabled,false);
});

test('invalid or zero invoice amounts cannot be verified',async()=>{for(const units of ['0',undefined,'-1','1e2','9007199254740992'])await assert.rejects(verifier()({invoice:{...invoice,units},txid}),/invalid_invoice/);});
test('trusted node proof integrates with existing authenticated checkout settlement path',async()=>{
 const {createStoreHandler}=await import('../supabase/functions/_shared/store-handler.mjs');
 const user='11111111-1111-4111-8111-111111111111',order='22222222-2222-4222-8222-222222222222';
 for(const wrong of [false,true]){
  const tx=transaction();if(wrong)tx.details=[];let settled=0,failed=0;
  const handler=createStoreHandler({env:n=>({SUPABASE_URL:'https://fixture.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',SUPABASE_ANON_KEY:'synthetic-anon'})[n],provider:{name:'core-fixture',enabled:true,verify:verifier({tx})},fetcher:async(url,options)=>{
   if(url.endsWith('/auth/v1/user'))return Response.json({id:user});
   if(url.includes('/tc42_orders?'))return Response.json([{id:order,customer_id:user,status:'awaiting_payment'}]);
   if(url.includes('/store_crypto_invoice?'))return Response.json([{...invoice,order_id:order,provider:'core-fixture'}]);
   if(url.endsWith('/phase1_record_verification')){settled++;const body=JSON.parse(options.body);assert.equal(body.p_evidence.units,'100000');assert.equal(body.p_evidence.address,invoice.address);return Response.json('paid');}
   if(url.endsWith('/phase1_verification_failed'))failed++;
   return Response.json(null);
  }});
  const response=await handler(new Request('https://fixture.test',{method:'POST',headers:{Authorization:'Bearer synthetic-buyer'},body:JSON.stringify({action:'verify',order_id:order,txid})}));
  assert.equal(settled,wrong?0:1);assert.equal(failed,wrong?1:0);assert.equal(response.status,wrong?409:200);
 }
});
