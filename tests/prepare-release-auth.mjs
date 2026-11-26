// Configure only an explicitly selected fresh local CLI workdir, never a linked project.
import {readFile,writeFile,access} from 'node:fs/promises';import {resolve} from 'node:path';
const workdir=resolve(process.argv[2]||'');if(!process.argv[2]||!workdir.includes('/work/'))throw Error('Select a disposable work/ Supabase directory');
try{await access(workdir+'/supabase/.temp/project-ref');throw Error('Refusing a linked Supabase project')}catch(e){if(e.code!=='ENOENT')throw e}
const file=workdir+'/supabase/config.toml',source=await readFile(file,'utf8');if(!source.includes('site_url = "http://127.0.0.1:3000"'))throw Error('Expected a fresh local configuration');
await writeFile(file,source.replace('site_url = "http://127.0.0.1:3000"','site_url = "http://127.0.0.1:8765"').replace('additional_redirect_urls = ["https://127.0.0.1:3000"]','additional_redirect_urls = ["http://127.0.0.1:8765/**"]').replace('enable_confirmations = false','enable_confirmations = true'));
