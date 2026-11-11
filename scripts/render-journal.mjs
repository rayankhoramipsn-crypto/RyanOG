// Offline publication step: consume an operator-reviewed export, never credentials.
// node scripts/render-journal.mjs published.json output-directory [--indexable]
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderJournal(posts,{indexable=false,now=Date.now()}={}){
 if(!Array.isArray(posts))throw Error('Expected an article array');
 const pages=new Map(),urls=[];
 for(const p of posts){
  if(p.status!=='published'||!Number.isFinite(Date.parse(p.published_at))||Date.parse(p.published_at)>now)continue;
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug||''))throw Error('Invalid article slug');
  if(pages.has(p.slug))throw Error('Duplicate article slug');
  if(!p.title||!p.body)throw Error('Title and body required');
  const url='https://trisocmd.shop/blog/'+p.slug+'/';
  const lang=['en','fa','ar'].includes(p.language)?p.language:'en';
  const title=p.seo_title||p.title,description=p.seo_description||p.excerpt||'TRISOCMD Journal';
  let image='';try{const u=new URL(p.cover_image_url);if(u.protocol==='https:'&&!u.username&&!u.password)image='<img src="'+escape(u.href)+'" alt="'+escape(p.title)+'" width="960" height="540" decoding="async" fetchpriority="high" style="object-fit:contain;height:auto">'}catch{}
  const ld=JSON.stringify({'@context':'https://schema.org','@type':'Article',headline:p.title,datePublished:p.published_at,inLanguage:lang,mainEntityOfPage:url}).replace(/</g,'\\u003c');
  pages.set(p.slug,`<!doctype html><html lang="${lang}" dir="${lang==='en'?'ltr':'rtl'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="${indexable?'index,follow':'noindex,nofollow'}"><title>${escape(title)} | TRISOCMD</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${url}"><meta property="og:type" content="article"><meta property="og:url" content="${url}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><link rel="stylesheet" href="/luxury-dark.css"><style>body{max-width:760px;margin:auto;padding:24px;background:#0b0d14;color:#f0f1f7;font:18px system-ui}a{color:#b8a4ff}img{max-width:100%}.body{white-space:pre-wrap;line-height:1.8}</style><script type="application/ld+json">${ld}</script></head><body><nav><a href="/journal/">TRISOCMD Journal</a> · <a href="/products/">Products</a></nav><main><article><h1>${escape(p.title)}</h1><p>${escape(p.category)} · <time datetime="${escape(p.published_at)}">${escape(p.published_at.slice(0,10))}</time></p>${image}<div class="body">${escape(p.body)}</div></article></main></body></html>`);
  urls.push(url);
 }
 return {pages,sitemap:'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>'<url><loc>'+escape(u)+'</loc></url>').join('')+'</urlset>'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [input,out,...flags]=process.argv.slice(2);if(!input||!out)throw Error('Provide reviewed JSON export and a fresh output directory');
 const {pages,sitemap}=renderJournal(JSON.parse(await readFile(input,'utf8')),{indexable:flags.includes('--indexable')});
 // Require a fresh directory so removed/draft posts cannot survive a rebuild.
 await mkdir(out);
 for(const [slug,html]of pages){const dir=join(out,'blog',slug);await mkdir(dir,{recursive:true});await writeFile(join(dir,'index.html'),html)}
 await writeFile(join(out,'sitemap.xml'),sitemap);
 await writeFile(join(out,'robots.txt'),flags.includes('--indexable')?'User-agent: *\nDisallow: /admin/\nDisallow: /preview/\nSitemap: https://trisocmd.shop/sitemap.xml\n':'User-agent: *\nDisallow: /\n');
 console.log('Rendered '+pages.size+' reviewed published articles');
}
