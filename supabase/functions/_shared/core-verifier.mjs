// Read-only BTC/LTC wallet evidence. Not registered by configuredProvider().
import {PaymentError,normalizeTxid,inspectPayment} from './payments.mjs';
import {readTextBounded} from './request-body.mjs';
const methods=new Set(['getblockchaininfo','getnetworkinfo','gettransaction']);
export function coreRPC({url,username,password,fetcher=fetch}){
 let endpoint;try{endpoint=new URL(url)}catch{throw new PaymentError('node_not_configured',503)}
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||!username||!password)throw new PaymentError('node_not_configured',503);
 return async(method,params=[])=>{
  if(!methods.has(method))throw new PaymentError('node_method_forbidden',403);
  try{
   const id=crypto.randomUUID(),response=await fetcher(endpoint.href,{method:'POST',redirect:'error',headers:{Authorization:'Basic '+btoa(username+':'+password),'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'1.0',id,method,params}),signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error();
   const data=JSON.parse(await readTextBounded(response,262144));
   if(data.id!==id||data.error||data.result==null)throw Error();
   return data.result;
  }catch{throw new PaymentError('node_unavailable',503)}
 };
}
// RPC JSON numbers are converted to a canonical eight-decimal representation;
// values with sub-satoshi precision, nonfinite/negative values or overflow fail.
export function coreUnits(value){
 const decimal=typeof value==='number'&&Number.isFinite(value)&&value>=0?value.toFixed(8):value;
 if(typeof decimal!=='string'||!/^\d{1,8}(?:\.\d{1,8})?$/.test(decimal))throw new PaymentError('invalid_node_amount',502);
 const [whole,fraction='']=decimal.split('.'),units=BigInt(whole)*100000000n+BigInt(fraction.padEnd(8,'0'));
 if(units>BigInt(Number.MAX_SAFE_INTEGER)||(typeof value==='number'&&Number(decimal)!==value))throw new PaymentError('invalid_node_amount',502);
 return units;
}
export function createCoreVerifier({rpcByNetwork}){
 return async({invoice,txid})=>{
  txid=normalizeTxid(txid);
  if(!['BTC','LTC'].includes(invoice?.network)||invoice.chain!=='mainnet'||typeof invoice.address!=='string'||invoice.address.length<14||typeof invoice.provider_invoice_id!=='string'||!invoice.provider_invoice_id||typeof invoice.units!=='string'||!/^\d{1,16}$/.test(invoice.units)||BigInt(invoice.units)<1000n||BigInt(invoice.units)>BigInt(Number.MAX_SAFE_INTEGER))throw new PaymentError('invalid_invoice');
  const rpc=rpcByNetwork[invoice.network];if(typeof rpc!=='function')throw new PaymentError('node_not_configured',503);
  const chain=await rpc('getblockchaininfo'),node=await rpc('getnetworkinfo');
  const brand=invoice.network==='BTC'?/^\/Satoshi:[^/]+\/$/:/^\/LitecoinCore:[^/]+\/$/;
  if(chain.chain!=='main'||chain.initialblockdownload!==false||!brand.test(node.subversion||''))throw new PaymentError('wrong_or_unsynced_node',503);
  const tx=await rpc('gettransaction',[txid,true]);
  if(tx.txid!==txid||!Number.isSafeInteger(tx.confirmations)||tx.confirmations<0||!Array.isArray(tx.walletconflicts)||tx.walletconflicts.length||tx.replaced_by_txid||tx.abandoned===true||(tx.mempoolconflicts?.length))throw new PaymentError('conflicted_transaction',409);
  if(!Array.isArray(tx.details)||!Number.isSafeInteger(tx.timereceived)||tx.timereceived<=0||tx.timereceived>Math.floor(Date.now()/1000)+60)throw new PaymentError('invalid_node_evidence',502);
  let units=0n;const seen=new Set();
  for(const out of tx.details){
   if(out.category!=='receive'||out.address!==invoice.address)continue;
   if(out.abandoned===true||!Number.isSafeInteger(out.vout)||out.vout<0||seen.has(out.vout))throw new PaymentError('invalid_node_output',502);
   seen.add(out.vout);units+=coreUnits(out.amount);
  }
  if(!seen.size||units>BigInt(Number.MAX_SAFE_INTEGER))throw new PaymentError('wrong_recipient_or_amount',409);
  const evidence={provider_invoice_id:invoice.provider_invoice_id,chain:'mainnet',network:invoice.network,address:invoice.address,units:String(units),confirmations:tx.confirmations,double_spend:false,txid,seen_at:new Date(tx.timereceived*1000).toISOString()};
  const state=inspectPayment(evidence,invoice);
  // A confirmation-count change produces a new idempotent reconciliation event;
  // SQL still owns global TXID uniqueness, reservations and paid transitions.
  return {event_id:'core:'+invoice.network+':'+txid+':'+tx.confirmations+':'+units,evidence,state};
 };
}
