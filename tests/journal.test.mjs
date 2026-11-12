import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderJournal} from '../scripts/render-journal.mjs';
const post={slug:'safe-article',status:'published',published_at:'2020-01-01T00:00:00Z',title:'<script>alert(1)</script>',body:'<img src=x onerror=alert(1)>',language:'fa'};
test('journal excludes drafts, future publications and missing dates',()=>{assert.equal(renderJournal([{...post,status:'draft'},{...post,published_at:'2999-01-01'},{...post,published_at:null}]).pages.size,0)});
test('journal escapes content and renders RTL, canonical, schema and noindex',()=>{const {pages,sitemap}=renderJournal([post]);const html=pages.get(post.slug);assert(html.includes('dir="rtl"'));assert(html.includes('noindex,nofollow'));assert(!html.includes('<img src=x'));assert(!html.includes('<script>alert'));assert(html.includes('application/ld+json'));assert(sitemap.includes('/blog/safe-article/'))});
test('journal rejects traversal and duplicate slugs',()=>{assert.throws(()=>renderJournal([{...post,slug:'../../admin'}]));assert.throws(()=>renderJournal([post,post]))});
test('indexing requires explicit publication option',()=>{assert(renderJournal([post],{indexable:true}).pages.get(post.slug).includes('index,follow'))});
