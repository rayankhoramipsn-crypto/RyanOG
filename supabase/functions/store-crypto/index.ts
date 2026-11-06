// @ts-nocheck
const destinations = {
  BTC: "bc1qm4temacqu8ycjgc2u2m3j0nqs4y2kp7wwdkygm",
  LTC: "ltc1q8lek6ex3sf77q4fvm6cq3u5h7yp8aqd8rhwxnn"
};
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type" };
const json = (data,status=200)=>Response.json(data,{status,headers:cors});
async function read(url,options={}) {
  const r=await fetch(url,{...options,signal:AbortSignal.timeout(10000)});
  if (!r.ok) throw Error("Service unavailable or request rejected");
  return await r.json();
}
const outputScripts = {
  "bc1qm4temacqu8ycjgc2u2m3j0nqs4y2kp7wwdkygm": "0014dd579df700e1c989230ae2b7193e608548ab07ce",
  "ltc1q8lek6ex3sf77q4fvm6cq3u5h7yp8aqd8rhwxnn": "00143ff36d64d1827de0552cdeb008f297f1027e81a7"
};
export function inspectTx(tx, invoice, hash) {
  if (tx.hash !== hash || tx.double_spend !== false || !Array.isArray(tx.outputs) ||
      tx.outputs.length !== tx.vout_sz || tx.next_outputs) throw Error("Incomplete or invalid transaction");
  const received=Date.parse(tx.received);
  if (!Number.isFinite(received) || received<Date.parse(invoice.issued_at) || received>Date.parse(invoice.expires_at))
    throw Error("Transaction outside invoice window");
  const matching=tx.outputs.filter(o=>outputScripts[invoice.address] && o.script===outputScripts[invoice.address]);
  if (!matching.length || !matching.every(o=>Number.isSafeInteger(o.value)&&o.value>0) ||
      matching.reduce((sum,o)=>sum+BigInt(o.value),0n)!==BigInt(invoice.units)) throw Error("Destination or amount mismatch");
  return Number.isSafeInteger(tx.confirmations) && tx.confirmations>=6 && tx.block_height>0;
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:cors});
  if(req.method!=="POST") return json({error:"POST required"},405);
  if(Deno.env.get("STORE_CRYPTO_ENABLED")!=="true") return json({error:"Checkout is disabled"},503);
  const base=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth=req.headers.get("Authorization");
  if(!auth?.startsWith("Bearer ")) return json({error:"Sign in required"},401);
  const user=await read(base+"/auth/v1/user",{headers:{apikey:Deno.env.get("SUPABASE_ANON_KEY"),Authorization:auth}}).catch(()=>null);
  if(!user?.id) return json({error:"Invalid session"},401);
  const headers={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"};
  const rpc=(name,body)=>read(base+"/rest/v1/rpc/"+name,{method:"POST",headers,body:JSON.stringify(body)});
  try {
    const {action,order_id,network,txid}=await req.json();
    if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(order_id)) return json({error:"Invalid order"},400);
    const orders=await read(base+"/rest/v1/tc42_orders?id=eq."+order_id+"&customer_id=eq."+user.id+"&select=status",{headers});
    if(!orders.length) return json({error:"Order unavailable"},404);
    if(action==="create" && (network==="BTC"||network==="LTC")){
      const rate=await read("https://api.coinbase.com/v2/prices/"+network+"-USD/spot");
      if(rate.data?.base!==network || rate.data?.currency!=="USD" || !(Number(rate.data.amount)>0)) throw Error("Price unavailable");
      const invoice=await rpc("store_issue_crypto",{p_user:user.id,p_order:order_id,p_network:network,p_address:destinations[network],p_rate:rate.data.amount});
      return json(invoice);
    }
    const hash=String(txid||"").trim().toLowerCase();
    if(action!=="verify" || !/^[a-f0-9]{64}$/.test(hash)) return json({error:"Invalid TXID"},400);
    const [invoice]=await read(base+"/rest/v1/store_crypto_invoice?order_id=eq."+order_id,{headers});
    if(!invoice) return json({error:"No invoice"},404);
    if(invoice.txid===hash) return json({status:orders[0].status});
    if(invoice.txid) return json({error:"Invoice already settled"},409);
    const tx=await read("https://api.blockcypher.com/v1/"+invoice.network.toLowerCase()+"/main/txs/"+hash);
    if(!inspectTx(tx,invoice,hash)) return json({status:"pending_confirmations"});
    const status=await rpc("store_settle_crypto",{p_user:user.id,p_order:order_id,p_txid:hash});
    return json({status});
  } catch(e) { return json({error:e.message},400); }
});