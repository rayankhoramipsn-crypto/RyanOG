import assert from 'node:assert/strict';
export async function marketplaceCases({db,as,one,check,identities,local,api,rpc}){
 const who='other',uid=identities[who].id;
 await as('admin',c=>c.query('select market_set_pro($1,true)',[uid]));
 const create=()=>as(who,c=>one(c,"select market_submit('Workflow listing','Gaming Gear','Synthetic marketplace workflow description',12.34,null)"));
 const edit=(id,role=who)=>as(role,c=>c.query("select market_edit_listing($1,'Edited listing','Gaming Gear','An edited synthetic marketplace description',12.34)",[id]));
 const attach=async(id,n)=>{const path=uid+'/'+id+'/'+crypto.randomUUID()+'.png';await as(who,c=>c.query("insert into storage.objects(bucket_id,name) values('market-gallery',$1)",[path]));return as(who,c=>one(c,'insert into market_listing_media(listing_id,seller_id,object_path,sort_order) values($1,$2,$3,$4) returning id',[id,uid,path,n]))};
 let listing,request,order,room;
 await check('only current admins can grant and expire Seller Pro without payment activation',async()=>{
  await assert.rejects(as('seller',c=>c.query('select market_set_pro_until($1,true,null)',[uid])),/Admin only/);
  await as('admin',c=>c.query("select market_set_pro_until($1,true,now()+interval '1 day')",[uid]));
  assert(await one(db,'select pro_until>now() from seller_profiles where user_id=$1',[uid]));
  await assert.rejects(as('admin',c=>c.query("select market_set_pro_until($1,true,now()-interval '1 second')",[uid])),/future Pro expiry/);
  await as('admin',c=>c.query('select market_set_pro($1,true)',[uid]));
 });

 await check('seller edits re-enter moderation; other sellers cannot edit or approve',async()=>{
  listing=await create();await edit(listing);
  await assert.rejects(edit(listing,'seller'),/no rows/);
  await attach(listing,0);await as('admin',c=>c.query("update market_listings set status='approved' where id=$1",[listing]));
  await edit(listing);assert.equal(await one(db,'select status from market_listings where id=$1',[listing]),'pending');
  await as('admin',c=>c.query("update market_listings set status='approved' where id=$1",[listing]));
 });
 await check('media requires a stored owner photo and caps concurrent attachments at four',async()=>{
  const id=await create();
  await assert.rejects(as(who,c=>c.query('insert into market_listing_media(listing_id,seller_id,object_path,sort_order) values($1,$2,$3,0)',[id,uid,uid+'/'+id+'/'+crypto.randomUUID()+'.png'])),/Upload the photo/);
  const attempts=await Promise.allSettled(Array.from({length:6},(_,n)=>attach(id,n)));
  assert.equal(attempts.filter(x=>x.status==='fulfilled').length,4);
  assert.equal(await one(db,'select count(*)::int from market_listing_media where listing_id=$1',[id]),4);
 });
 await check('public profiles require opt-in and approved listing; profile writes stay owner-scoped',async()=>{
  await as(who,c=>c.query("insert into market_seller_public_profiles(user_id,display_name,bio,is_public) values($1,'Workflow Seller','Synthetic biography',false)",[uid]));
  assert.equal(await as('anon',c=>one(c,'select market_seller_profile($1)',[listing])),null);
  await as(who,c=>c.query('update market_seller_public_profiles set is_public=true where user_id=$1',[uid]));
  const profile=await as('anon',c=>one(c,'select market_seller_profile($1)',[listing]));assert.equal(profile.display_name,'Workflow Seller');assert.equal(profile.user_id,undefined);
  assert.equal((await as('seller',c=>c.query("update market_seller_public_profiles set display_name='Forged seller' where user_id=$1",[uid]))).rowCount,0);
 });
 await check('buyer review cancellation is idempotent and cannot cancel another account',async()=>{
  request=await as('buyer',c=>one(c,"select market_request_purchase($1,'CONTACT_SUPPORT',null)",[listing]));
  await assert.rejects(edit(listing),/active purchase/);
  await assert.rejects(as('seller',c=>c.query('select market_cancel_request($1)',[request])),/no rows/);
  await as('buyer',c=>c.query('select market_cancel_request($1)',[request]));await as('buyer',c=>c.query('select market_cancel_request($1)',[request]));
  assert.equal(await one(db,'select status from market_purchase_requests where id=$1',[request]),'cancelled');
 });
 await check('commission rounds to cents; canonical order prevents edits, removal and intake cancellation',async()=>{
  request=await as('buyer',c=>one(c,"select market_request_purchase($1,'CONTACT_SUPPORT',null)",[listing]));
  order=await as('buyer',c=>one(c,'select phase1_market_order($1)',[request]));
  assert.equal(await one(db,'select commission_usd from tc42_orders where id=$1',[order]),'0.49');
  await assert.rejects(as('buyer',c=>c.query('select market_cancel_request($1)',[request])),/canonical order/);
  await assert.rejects(as(who,c=>c.query('select market_remove_listing($1)',[listing])),/canonical order/);
  await assert.rejects(as('admin',c=>c.query("update market_listings set status='removed' where id=$1",[listing])),/canonical order/);
  // Trusted synthetic settlement state; provider verification is independently tested.
  await db.query("update tc42_orders set status='paid' where id=$1",[order]);
  await as(who,c=>c.query("select phase1_transition($1,'fulfillment_pending',null)",[order]));
  await as(who,c=>c.query("select phase1_transition($1,'fulfilled','Synthetic delivery')",[order]));
 });
 await check('canonical cancellation retires intake and permits a new review request',async()=>{
  const id=await create();await attach(id,0);await as('admin',c=>c.query("update market_listings set status='approved' where id=$1",[id]));
  const intake=await as('buyer',c=>one(c,"select market_request_purchase($1,'CONTACT_SUPPORT',null)",[id]));
  const canonical=await as('buyer',c=>one(c,'select phase1_market_order($1)',[intake]));
  const before=await one(db,'select count(*)::int from market_notifications');
  await as('buyer',c=>c.query("select phase1_transition($1,'cancelled',null)",[canonical]));
  assert.equal(await one(db,'select status from market_purchase_requests where id=$1',[intake]),'cancelled');
  assert.equal(await one(db,'select count(*)::int from market_notifications'),before+3);
  const next=await as('buyer',c=>one(c,"select market_request_purchase($1,'CONTACT_SUPPORT',null)",[id]));assert.notEqual(next,intake);
 });
 await check('sold listings cannot be resurrected, edited or removed by an admin',async()=>{
  await db.query("update market_listings set status='sold' where id=$1",[listing]);
  await assert.rejects(as('admin',c=>c.query("update market_listings set status='approved' where id=$1",[listing])),/Sold listings/);
  await assert.rejects(as(who,c=>c.query('select market_remove_listing($1)',[listing])),/Sold listings/);
 });
 await check('chat retries create one message and one notification per recipient, including concurrent sends',async()=>{
  const id=await create();await attach(id,0);await as('admin',c=>c.query("update market_listings set status='approved' where id=$1",[id]));
  room=await as('buyer',c=>one(c,'select market_start_chat($1)',[id]));const key=crypto.randomUUID();
  const before=await one(db,'select count(*)::int from market_notifications');
  const send=()=>as('buyer',c=>one(c,"select market_send_message_once($1,'Idempotent message',$2)",[room,key]));
  const ids=await Promise.all([send(),send()]);assert.equal(ids[0],ids[1]);
  assert.equal(await one(db,'select count(*)::int from market_notifications'),before+2);
  await assert.rejects(as('buyer',c=>c.query("select market_send_message_once($1,'Changed body',$2)",[room,key])),/retry mismatch/);
  await assert.rejects(as('seller',c=>c.query("select market_send_message_once($1,'Intruder',$2)",[room,crypto.randomUUID()])),/Conversation unavailable/);
 });
 await check('read watermark never acknowledges a message arriving after the visible page',async()=>{
  const first=await as('buyer',c=>one(c,"select market_send_message($1,'Seen before refresh')",[room]));
  await as('buyer',c=>one(c,"select market_send_message($1,'Arrived during refresh')",[room]));
  await as(who,c=>c.query('select market_mark_read_to($1,$2)',[room,first]));
  const inbox=await as(who,c=>c.query('select * from market_inbox_page(0)'));assert.equal(inbox.rows.find(x=>x.id===room).unread_count,'1');
  await assert.rejects(as('seller',c=>c.query('select market_mark_read_to($1,$2)',[room,first])),/Conversation unavailable/);
 });
 await check('admin approval queue includes 241 historical listings across seller accounts',async()=>{
  const created=await db.query("insert into market_listings(seller_id,title,platform,description,price,status,submitted_at) select case when i%2=0 then $1::uuid else $2::uuid end,'Cross seller queue '||i,'Gaming Gear','Synthetic historical cross seller submission',10,'pending',now()-i*interval '1 day' from generate_series(1,241) i returning id",[uid,identities.seller.id]);
  const rows=await as('admin',c=>c.query("select id,seller_id from market_listings where title like 'Cross seller queue %' and seller_id in ($1,$2) order by submitted_at desc,id desc",[uid,identities.seller.id]));
  assert.equal(rows.rowCount,241);assert.equal(new Set(rows.rows.map(r=>r.seller_id)).size,2);assert(rows.rows.some(r=>r.id===created.rows[240].id));
  if(local)assert.equal((await api('/rest/v1/market_listings?select=id&title=like.Cross%20seller%20queue%20*&seller_id=in.('+uid+','+identities.seller.id+')&limit=1000',{name:'admin'})).length,241);
  assert.equal(await as('buyer',c=>one(c,"select count(*)::int from market_listings where title like 'Cross seller queue %'")),0);
 });
 await check('inbox backend pagination reaches conversations beyond the first 100',async()=>{
  // Each listing has a unique buyer thread; synthetic IDs remain in this copy.
  await db.query("insert into market_conversations(listing_id,buyer_id,seller_id) select id,$1,seller_id from market_listings where false",[identities.buyer.id]);
  const ids=[];for(let n=0;n<102;n++){
   const id=await one(db,"insert into market_listings(seller_id,title,platform,description,price,status) values($1,'History fixture','Gear','Synthetic history fixture description',10,'approved') returning id",[uid]);
   ids.push(await one(db,'insert into market_conversations(listing_id,buyer_id,seller_id) values($1,$2,$3) returning id',[id,identities.buyer.id,uid]));
  }
  const a=await as('buyer',c=>c.query('select * from market_inbox_page(0)')),b=await as('buyer',c=>c.query('select * from market_inbox_page(100)'));
  assert.equal(a.rowCount,100);assert(b.rowCount>=3);assert.equal(new Set([...a.rows,...b.rows].map(x=>x.id)).size,a.rowCount+b.rowCount);
 });
 if(local&&process.env.TRISO_STORAGE_TESTS==='1')await check('binary Storage API validates MIME/size and isolates owner paths and private reads',async()=>{
  const id=await create(),path=uid+'/'+id+'/'+crypto.randomUUID()+'.png';
  const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/n8cAAAAASUVORK5CYII=','base64');
  const raw=(url,name,method='GET',body,type='image/png')=>fetch(local.API_URL+'/storage/v1/'+url,{method,headers:{apikey:local.ANON_KEY,Authorization:'Bearer '+(identities[name]?.token||local.ANON_KEY),'Content-Type':type},body});
  let r=await raw('object/market-gallery/'+path,who,'POST',image);assert(r.ok,await r.text());
  r=await raw('object/market-gallery/'+path,'seller');assert(!r.ok);
  r=await raw('object/market-gallery/'+uid+'/'+id+'/'+crypto.randomUUID()+'.svg',who,'POST',Buffer.from('<svg/>'),'image/svg+xml');assert(!r.ok);
  r=await raw('object/market-gallery/'+uid+'/'+id+'/'+crypto.randomUUID()+'.png',who,'POST',Buffer.alloc(5242881));assert(!r.ok);
  r=await raw('object/market-gallery/'+uid+'/'+id+'/'+crypto.randomUUID()+'.png','seller','POST',image);assert(!r.ok);
  await as(who,c=>c.query('insert into market_listing_media(listing_id,seller_id,object_path,sort_order) values($1,$2,$3,0)',[id,uid,path]));
  await as('admin',c=>c.query("update market_listings set status='approved' where id=$1",[id]));
  r=await raw('object/market-gallery/'+path,'anon');assert(r.ok);
 });
}
