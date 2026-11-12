import {createDeliveryWebhook} from '../_shared/delivery.mjs';
const env=(name:string)=>Deno.env.get(name);
const rpc=async(name:string,args:object)=>{const r=await fetch(env('SUPABASE_URL')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:env('SUPABASE_SERVICE_ROLE_KEY')||'',Authorization:'Bearer '+env('SUPABASE_SERVICE_ROLE_KEY'),'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Database unavailable');return r.json()};
Deno.serve(createDeliveryWebhook({env,rpc}));
