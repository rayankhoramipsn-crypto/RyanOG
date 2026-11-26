// PREPARATION ONLY. No Supabase client, database connection, deployment or restore.
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {resolve,join} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export const stagingProject='cxtytbjvdlngahytfilr';
export const migrationFiles=['20261108214609_phase1_checkout.sql','20261110201622_marketplace_browse_page.sql','20261110204751_staging_integration_authorization.sql','20261111181536_marketplace_workflows.sql','20261111185818_notifications_email_support.sql','20261111200640_storefront_content.sql'];
const functionNames=['store-crypto','payment-webhook','delivery-worker','delivery-webhook'];
const hash=value=>createHash('sha256').update(value).digest('hex');
export function migrationPayload(file,source){
 if(!migrationFiles.includes(file))throw Error('Unreviewed migration');
 const begin=/^[\t ]*BEGIN;[\t ]*$/m,commit=/^[\t ]*COMMIT;[\t ]*$/m;
 if(begin.test(source)!==commit.test(source))throw Error('Incomplete transaction wrapper');
 // Hosted apply_migration owns the transaction/history entry. Keep every inner SQL statement.
 const query=source.replace(begin,'').replace(commit,'').trim()+'\n';
 return {project_id:stagingProject,name:'trisocmd_'+file.replace(/\.sql$/,''),query};
}
export async function buildStagingPacket(){
 const files=new Map(),migrations=[];
 for(const sourceFile of migrationFiles){const source=await readFile(join(root,'supabase/migrations',sourceFile),'utf8'),payload=migrationPayload(sourceFile,source),path='migration-payloads/'+sourceFile.replace(/\.sql$/,'.json'),json=JSON.stringify(payload,null,2)+'\n';files.set(path,json);migrations.push({source_file:sourceFile,source_sha256:hash(source),payload_file:path,payload_sha256:hash(json),tool:'supabase.apply_migration',name:payload.name})}
 const shared=(await readdir(join(root,'supabase/functions/_shared'))).filter(p=>p.endsWith('.mjs')).sort();
 const sourcePaths=[...functionNames.map(name=>'supabase/functions/'+name+'/index.ts'),...shared.map(name=>'supabase/functions/_shared/'+name),'supabase/config.toml'];
 const config=await readFile(join(root,'supabase/config.toml'),'utf8');for(const name of functionNames){const section=config.match(new RegExp('\\[functions\\.'+name+'\\]([\\s\\S]*?)(?=\\n\\[|$)'));if(!section||!/^\s*verify_jwt\s*=\s*false\s*$/m.test(section[1]))throw Error('Unreviewed Edge authentication configuration: '+name)}
 const sourceHashes=[];for(const path of sourcePaths){const source=await readFile(join(root,path),'utf8');files.set(path,source);sourceHashes.push({path,sha256:hash(source)})}
 for(const path of ['docs/release-preflight.sql','docs/TRISOCMD_RELEASE_READINESS.md'])files.set(path,await readFile(join(root,path),'utf8'));
 const manifest={project_id:stagingProject,execution_authorized:false,backup_restore_verification:'required_before_any_hosted_write',preserve_hosted_foundation_migrations:25,migrations,edge_functions:functionNames.map(name=>({name,verify_jwt:false,command:['supabase','functions','deploy',name,'--workdir','.','--project-ref',stagingProject]})),source_files:sourceHashes,excluded:['production','Pages deployment','PR merge','payment/email/push activation','scheduler installation','restore of hosted staging']};
 return {manifest,files};
}
export async function writeStagingPacket(out,{manifest,files},revision){
 await mkdir(out);for(const [path,source]of files){const target=join(out,path);await mkdir(resolve(target,'..'),{recursive:true});await writeFile(target,source,{flag:'wx'})}
 await writeFile(join(out,'manifest.json'),JSON.stringify({...manifest,source_revision:revision},null,2)+'\n',{flag:'wx'});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--out'||!args[1])throw Error('Preparation only: use --out <fresh-directory>');
 const git=async args=>(await promisify(execFile)('git',args,{cwd:root})).stdout.trim();if(await git(['status','--porcelain']))throw Error('Commit reviewed changes before freezing the approval packet');
 const revision=await git(['rev-parse','HEAD']),packet=await buildStagingPacket();await writeStagingPacket(resolve(args[1]),packet,revision);console.log('Prepared six migration payloads and four disabled-provider Edge bundles for '+stagingProject+'. Nothing deployed.');
}
