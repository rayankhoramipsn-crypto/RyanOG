import assert from 'node:assert/strict';
export async function contentCases({db,as,one,check,identities,local}){
 let product,post;const slug='content-'+crypto.randomUUID();
 await check('content admin CRUD preserves drafts and scheduled articles behind public RLS',async()=>{
  post=await as('admin',c=>one(c,"insert into blog_posts(title,slug,body,status,author_id) values('Content fixture',$1,'Private draft','draft',$2) returning id",[slug,identities.admin.id]));
  for(const who of ['anon','buyer','seller','support'])assert.equal(await as(who,c=>one(c,'select count(*)::int from blog_posts where id=$1',[post])),0);
  await as('admin',c=>c.query("update blog_posts set status='published',published_at=now()+interval '1 day' where id=$1",[post]));assert.equal(await as('anon',c=>one(c,'select count(*)::int from blog_posts where id=$1',[post])),0);
  await as('admin',c=>c.query("update blog_posts set published_at=now()-interval '1 day',body='Published body' where id=$1",[post]));assert.equal(await as('anon',c=>one(c,'select body from blog_posts where id=$1',[post])),'Published body');
  await as('admin',c=>c.query("update blog_posts set status='draft' where id=$1",[post]));assert.equal(await as('anon',c=>one(c,'select count(*)::int from blog_posts where id=$1',[post])),0);
 });
 await check('buyer seller support and forged metadata cannot edit content or upload public assets',async()=>{
  for(const who of ['buyer','seller','support']){
   await assert.rejects(as(who,c=>c.query("insert into blog_posts(title,slug,body,author_id) values('Forged',$1,'Body',$2)",[crypto.randomUUID(),identities[who].id])),/row-level security/);
   assert.equal((await as(who,c=>c.query("update blog_posts set body='Forged' where id=$1",[post]))).rowCount,0);
   await assert.rejects(as(who,c=>c.query("insert into storage.objects(bucket_id,name) values('content-media',$1)",[identities[who].id+'/'+crypto.randomUUID()+'.png'])),/row-level security/);
  }
 });
 await check('product specifications and ordered media expose only available products',async()=>{
  product=await as('admin',c=>one(c,"insert into products(id,title,description,description_fa,price,stock,status,slug) values((select coalesce(max(id),0)+1 from products),'Content product','Description','توضیحات',19.50,5,'draft',$1) returning id",[slug]));
  await as('admin',c=>c.query("insert into product_media(product_id,media_type,media_url,label,sort_order) values($1,'image','https://example.test/photo.webp','Gallery caption',2),($1,'youtube','https://youtu.be/dQw4w9WgXcQ','Review',3)",[product]));
  await as('admin',c=>c.query("insert into product_specs(product_id,spec_key,spec_value) values($1,'Switch','Mechanical')",[product]));
  assert.equal(await as('anon',c=>one(c,'select count(*)::int from product_specs where product_id=$1',[product])),0);
  await as('admin',c=>c.query("update products set status='available' where id=$1",[product]));assert.equal(await as('anon',c=>one(c,'select count(*)::int from product_media where product_id=$1',[product])),2);assert.equal(await as('anon',c=>one(c,'select spec_value from product_specs where product_id=$1',[product])),'Mechanical');
  await assert.rejects(as('buyer',c=>c.query("insert into product_specs(product_id,spec_key,spec_value) values($1,'Bad','Unauthorized')",[product])),/row-level security/);
 });
 await check('unsafe media links invalid product values and stale admin content claims are denied',async()=>{
  await assert.rejects(as('admin',c=>c.query("insert into product_media(product_id,media_type,media_url) values($1,'youtube','https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ')",[product])),/Approved YouTube/);
  await assert.rejects(as('admin',c=>c.query("insert into product_media(product_id,media_type,media_url) values($1,'youtube','https://youtube.com/watch?v=invalid')",[product])),/Approved YouTube/);
  await assert.rejects(as('admin',c=>c.query("update blog_posts set cover_image_url='https://user:pass@example.test/p.png' where id=$1",[post])),/Safe HTTPS/);
  await assert.rejects(as('admin',c=>c.query("update products set price='NaN' where id=$1",[product])),/Invalid product/);
  await db.query("update auth.users set raw_app_meta_data='{}' where id=$1",[identities.admin.id]);
  try{assert.equal((await as('admin',c=>c.query("update blog_posts set body='Stale admin' where id=$1",[post]))).rowCount,0);await assert.rejects(as('admin',c=>c.query("insert into product_media(product_id,media_type,media_url) values($1,'image','https://example.test/f.png')",[product])),/row-level security/)}finally{await db.query("update auth.users set raw_app_meta_data='{\"role\":\"admin\"}' where id=$1",[identities.admin.id])}
 });
 await check('public content Storage paths allow admin inserts and reject replacement writes',async()=>{
  const path=identities.admin.id+'/'+crypto.randomUUID()+'.png';await as('admin',c=>c.query("insert into storage.objects(bucket_id,name) values('content-media',$1)",[path]));
  assert.equal((await as('admin',c=>c.query("update storage.objects set name=$2 where bucket_id='content-media' and name=$1",[path,identities.admin.id+'/'+crypto.randomUUID()+'.png']))).rowCount,0);
  await assert.rejects(as('admin',c=>c.query("insert into storage.objects(bucket_id,name) values('content-media',$1)",[identities.buyer.id+'/'+crypto.randomUUID()+'.png'])),/row-level security/);
 });
 if(local&&process.env.TRISO_STORAGE_TESTS==='1')await check('real binary content uploads enforce admin authorization MIME and bucket size limits',async()=>{
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jq1sAAAAASUVORK5CYII=','base64');
  const upload=(who,body,type='image/png')=>{const path=identities[who].id+'/'+crypto.randomUUID()+'.png';return fetch(local.API_URL+'/storage/v1/object/content-media/'+path,{method:'POST',headers:{apikey:local.ANON_KEY,Authorization:'Bearer '+identities[who].token,'Content-Type':type},body})};
  assert((await upload('admin',png)).ok);for(const who of ['buyer','seller','support'])assert(!(await upload(who,png)).ok);assert(!(await upload('admin','<svg/>','image/svg+xml')).ok);assert(!(await upload('admin',Buffer.alloc(5242881))).ok);
 });
}
