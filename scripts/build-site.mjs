// Fresh output only. Never publishes, mutates a database, or copies operator secrets.
import {mkdir,cp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {renderStorefront,escape} from './render-storefront.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function buildSite({out,content=join(root,'content/published.json'),indexable=false}){
 const snapshot=JSON.parse(await readFile(content,'utf8')),result=renderStorefront(snapshot,{indexable});
 const output=resolve(out);if(output===root||root.startsWith(output+'/'))throw Error('Output must be a fresh build directory');
 await mkdir(output);
 for(const name of ['sw-notifications.js','index.html','404.html','marketplace.html','product.html','app.js','luxury-dark.css','snowflake.png','assets','admin','blog','videos','help','policies','preview'])await cp(join(root,name),join(output,name),{recursive:true,errorOnExist:true});
 const blogFile=join(output,'blog/index.html'),blog=await readFile(blogFile,'utf8'),placeholder='<section id="listing" class="grid" aria-label="Published articles"></section>';
 if(!blog.includes(placeholder))throw Error('Blog build placeholder missing');
 const cards=snapshot.posts.filter(p=>result.pages.has('/blog/'+p.slug+'/index.html')).map(p=>'<div class="card"><h2><a href="/blog/'+p.slug+'/">'+escape(p.title)+'</a></h2><p>'+escape(p.excerpt)+'</p></div>').join('');
 await writeFile(blogFile,blog.replace(placeholder,placeholder.replace('</section>',cards+'</section>')));
 for(const [path,html]of result.pages){const file=join(output,path.slice(1));await mkdir(resolve(file,'..'),{recursive:true});await writeFile(file,html)}
 await writeFile(join(output,'sitemap.xml'),result.sitemap);await writeFile(join(output,'robots.txt'),result.robots);await writeFile(join(output,'.nojekyll'),'');return {pages:result.pages.size,output};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const args=process.argv.slice(2),value=flag=>args[args.indexOf(flag)+1];if(!args.includes('--out'))throw Error('Provide --out with a fresh directory');const result=await buildSite({out:value('--out'),content:args.includes('--content')?value('--content'):undefined,indexable:args.includes('--indexable')});console.log('Built '+result.pages+' public content pages (no deployment)')}
