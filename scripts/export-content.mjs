// Anonymous public CMS reads only; credentials with elevated roles are refused.
import {writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {collectPublicContent} from '../assets/content-snapshot.mjs';
export async function exportContent({url,key,fetcher=fetch}){
 const origin=new URL(url);if(origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||!(origin.protocol==='https:'&&/^[a-z0-9-]+\.supabase\.co$/.test(origin.hostname)||origin.protocol==='http:'&&['127.0.0.1','localhost'].includes(origin.hostname)))throw Error('Public Supabase or disposable loopback API required');
 if(!key?.startsWith('sb_publishable_')){let role;try{role=JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role}catch{}if(role!=='anon')throw Error('Only publishable/anonymous credentials are permitted')}
 const all=async path=>{const rows=[];for(let offset=0;;offset+=100){const r=await fetcher(origin.origin+'/rest/v1/'+path+'&limit=100&offset='+offset,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Public CMS export failed ('+r.status+')');const page=await r.json();if(!Array.isArray(page))throw Error('Invalid CMS response');rows.push(...page);if(page.length<100)return rows}};
 return collectPublicContent(all);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const out=process.argv[process.argv.indexOf('--out')+1];if(!process.argv.includes('--out'))throw Error('Provide --out');const snapshot=await exportContent({url:process.env.TRISO_CONTENT_API_URL,key:process.env.TRISO_CONTENT_PUBLIC_KEY});await writeFile(out,JSON.stringify(snapshot,null,2),{flag:'wx'});console.log('Exported '+snapshot.products.length+' public products and '+snapshot.posts.length+' published articles')}
