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
const explorers = { BTC:"https://mempool.space/api", LTC:"https://litecoinspace.org/api" };
async function endpointText(url) {
  const response = await fetch(url,{signal:AbortSignal.timeout(8000),redirect:"error"});
  if (!response.ok) throw Error("Blockchain provider unavailable");
  return (await response.text()).trim();
}
async function quote(network) {
  const data = await read(explorers[network]+"/v1/prices");
  const age = Date.now()/1000-data.time;
  if (!Number.isFinite(data.USD) || data.USD<=0 || !Number.isFinite(age) || age < -60 || age > 7200)
    throw Error("Fresh exchange rate unavailable");
  return data.USD;
}
async function chainTip(network) {
  const height = await endpointText(explorers[network]+"/blocks/tip/height");
  if (!/^[1-9][0-9]{4,8}$/.test(height)) throw Error("Chain tip unavailable");
  return Number(height);
}
async function verifyTransfer(invoice, hash) {
  const root = explorers[invoice.network];
  const tx = await read(root+"/tx/"+hash);
  if (tx.txid!==hash || !Array.isArray(tx.vout)) throw Error("Invalid transaction");
  const outputs=tx.vout.filter(o=>o.scriptpubkey===outputScripts[invoice.address]);
  if (!outputs.length || !outputs.every(o=>Number.isSafeInteger(o.value)&&o.value>0) ||
      outputs.reduce((sum,o)=>sum+BigInt(o.value),0n)!==BigInt(invoice.units))
    throw Error("Wrong receiving address or amount");
  if (tx.status?.confirmed!==true) return false;
  const {block_height:height, block_hash:blockHash, block_time:time}=tx.status;
  if (!Number.isSafeInteger(height) || height<1 || !/^[a-f0-9]{64}$/.test(blockHash)) throw Error("Invalid block");
  const [tip,canonical]=await Promise.all([chainTip(invoice.network), endpointText(root+"/block-height/"+height)]);
  if (canonical!==blockHash || tip-height+1<6) return false;
  const start=Date.parse(invoice.issued_at), end=Date.parse(invoice.expires_at);
  let received=Number(time)*1000;
  if (!Number.isFinite(received) || received<start || received>end) {
    const times=await read(root+"/v1/transaction-times?txId%5B%5D="+hash);
    received=Array.isArray(times) && Number.isSafeInteger(times[0]) ? times[0]*1000 : NaN;
  }
  if (!Number.isFinite(received) || received<start || received>end)
    throw Error("Timing needs manual review; keep this order ID and contact support");
  return true;
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:cors});
  const base=Deno.env.get("SUPABASE_URL");
  const production=base==="https://zrolxgzndinktsjsthfw.supabase.co";
  const authBase=production?"https://cxtytbjvdlngahytfilr.supabase.co":base;
  const authKey=production?"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4dHl0Ymp2ZGxuZ2FoeXRmaWxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MDgxNTcsImV4cCI6MjEwODI4NDE1N30.60fpG7raWTl8ueU1ajC0ct3MuN5l9akEdkQcCxYBKH8":Deno.env.get("SUPABASE_ANON_KEY");
  const pilot = Deno.env.get("STORE_CRYPTO_PILOT") === "true";
  const enabled = pilot || Deno.env.get("STORE_CRYPTO_ENABLED") === "true";
  if(req.method==="GET" && new URL(req.url).searchParams.get("check")==="providers"){
    const checks=await Promise.all(Object.keys(explorers).map(async network=>{
      try{const [usd,height]=await Promise.all([quote(network),chainTip(network)]);return {network,usd,height};}
      catch{return {network,available:false};}
    }));return json({enabled,pilot,checks});
  }
  if(req.method==="GET" && new URL(req.url).searchParams.get("catalog")==="store"){
    try {
      const fields="id,title,price,stock,status,category,description,description_ar,image_url,min_qty,max_qty";
      const key=Deno.env.get("SUPABASE_ANON_KEY");
      return json(await read(base+"/rest/v1/products?status=eq.available&order=id.asc&select="+fields,{headers:{apikey:key,Authorization:"Bearer "+key}}));
    } catch {return json({error:"Catalog unavailable"},503);}
  }
  if(req.method==="GET") return json({enabled,pilot});
  if(req.method!=="POST") return json({error:"POST required"},405);

  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth=req.headers.get("Authorization");
  if(!auth?.startsWith("Bearer ")) return json({error:"Sign in required"},401);
  const user=await read(authBase+"/auth/v1/user",{headers:{apikey:authKey,Authorization:auth}}).catch(()=>null);
  if(!user?.id) return json({error:"Invalid session"},401);

  const headers={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"};
  const rpc=(name,body)=>read(base+"/rest/v1/rpc/"+name,{method:"POST",headers,body:JSON.stringify(body)});
  try {
    const {action,order_id,network,txid,items,product_id,product}=await req.json();
    if (production && action.startsWith("admin_product_")){
      if(user.app_metadata?.role!=="admin")return json({error:"Admin required"},403);
      const columns="id,title,price,stock,status,category,description,description_ar,image_url,min_qty,max_qty";
      const url=base+"/rest/v1/products";
      if(action==="admin_product_list") return json(await read(url+"?select="+columns+"&order=id.desc&limit=200",{headers}));
      const edit=action==="admin_product_edit", remove=action==="admin_product_delete";
      if(!edit && !remove && action!=="admin_product_new")return json({error:"Unknown operation"},400);
      if((edit||remove)&&!/^\d{1,18}$/.test(String(product_id)))return json({error:"Invalid product"},400);
      let body;
      if(!remove){
        if(!product || typeof product.title!=="string" || !product.title.trim() || product.title.length>300 ||
           !Number.isFinite(product.price)||product.price<0||!Number.isInteger(product.stock)||product.stock<0 ||
           !Number.isInteger(product.min_qty)||product.min_qty<1 || (product.max_qty!=null&&(!Number.isInteger(product.max_qty)||product.max_qty<product.min_qty))||
           !["available","unavailable"].includes(product.status)||
           (product.image_url && !/^https:\/\//i.test(product.image_url))) return json({error:"Invalid product details"},400);
        const fields=columns.split(",").filter(k=>k!=="id");
        body=JSON.stringify(Object.fromEntries(fields.filter(k=>Object.hasOwn(product,k)).map(k=>[k,product[k]])));
      }
      const result=await read(url+(edit||remove?"?id=eq."+product_id:""),{method:remove?"DELETE":edit?"PATCH":"POST",headers:{...headers,Prefer:"return=representation"},body});
      if(!result.length)return json({error:"Product no longer exists"},404);
      return json(result);
    }
    if (production && (action==="history" || action==="admin_history")) {
      const ownerOnly = action==="history";
      if (!ownerOnly && user.app_metadata?.role!=="admin") return json({error:"Admin required"},403);
      const ownerQuery=ownerOnly ? "customer_id=eq."+user.id+"&" : "";
      return json(await read(base+"/rest/v1/tc42_orders?"+ownerQuery+"select=id,status,total_amount,currency,items,created_at&order=created_at.desc&limit=100",{headers}));
    }
    if(!enabled) return json({error:"Checkout is disabled"},503);
    if(pilot && user.app_metadata?.role !== "admin") return json({error:"Operator pilot only"},403);
    if (production && action==="order") {
      if (!Array.isArray(items) || items.length<1 || items.length>20) return json({error:"Invalid cart"},400);
      if (pilot && (items.length!==1 || Number(items[0]?.id)!==5 || Number(items[0]?.qty)!==1)) return json({error:"Pilot item only"},400);
      return json(await rpc("store_checkout_order",{buyer:user.id,items}));
    }

    if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(order_id)) return json({error:"Invalid order"},400);
    const orders=await read(base+"/rest/v1/tc42_orders?id=eq."+order_id+"&customer_id=eq."+user.id+"&select=status,total_amount,items",{headers});
    if(!orders.length) return json({error:"Order unavailable"},404);
    if (pilot) {
      const order = orders[0];
      const [item] = order.items;
      if (order.items.length !== 1 || Number(item?.id) !== 5 || Number(item.qty) !== 1 ||
          Number(order.total_amount) !== 0.25 || (action === "create" && network !== "LTC"))
        return json({error:"Pilot requires one unit of product 5 at USD 0.25, paid in LTC"},400);
    }
    if(action==="create" && (network==="BTC"||network==="LTC")){
      const [rate]=await Promise.all([quote(network),chainTip(network)]);
      const invoice=await rpc("store_issue_crypto",{p_user:user.id,p_order:order_id,p_network:network,p_address:destinations[network],p_rate:rate});
      return json(Array.isArray(invoice) ? invoice[0] : invoice);
    }
    if(action==="resume"){
      const [invoice]=await read(base+"/rest/v1/store_crypto_invoice?order_id=eq."+order_id,{headers});
      return invoice ? json({...invoice,order_status:orders[0].status}) : json({error:"No invoice for this order"},404);
    }
    const hash=String(txid||"").trim().toLowerCase();
    if(action!=="verify" || !/^[a-f0-9]{64}$/.test(hash)) return json({error:"Invalid TXID"},400);
    const [invoice]=await read(base+"/rest/v1/store_crypto_invoice?order_id=eq."+order_id,{headers});
    if(!invoice) return json({error:"No invoice"},404);
    if(invoice.txid===hash) return json({status:orders[0].status});
    if(invoice.txid) return json({error:"Invoice already settled"},409);
    if(!await verifyTransfer(invoice,hash)) return json({status:"pending_confirmations"});
    const status=await rpc("store_settle_crypto",{p_user:user.id,p_order:order_id,p_txid:hash});
    return json({status});
  } catch(e) { return json({error:e.message},400); }
});