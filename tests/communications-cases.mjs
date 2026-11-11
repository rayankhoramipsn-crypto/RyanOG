import assert from 'node:assert/strict';
export async function communicationsCases({db,as,one,check,identities,local,api,rpc}){
 const buyer=identities.buyer.id,staff=identities.support.id;let ticket,job,lease;
 await check('legacy tickets and original conversations retain all historical content',async()=>{
  assert(await one(db,"select count(*)::int>0 from tc42_support_threads where legacy_ticket_id is not null"));
  assert(await one(db,"select count(*)::int>0 from tc42_support_messages where length(body)=3000"));
 });
 await check('support creation is idempotent and cannot link another account order',async()=>{
  const key=crypto.randomUUID(),create=()=>as('buyer',c=>one(c,"select support_create('Private support','A ticket body',$1,null,false)",[key]));
  const ids=await Promise.all([create(),create()]);ticket=ids[0];assert.equal(ids[0],ids[1]);
  await assert.rejects(as('buyer',c=>c.query("select support_create('Wrong link','Body',$1,$2,true)",[crypto.randomUUID(),crypto.randomUUID()])),/Order unavailable/);
  await assert.rejects(as('other',c=>c.query("select support_reply($1,'Intruder',$2)",[ticket,crypto.randomUUID()])),/no rows/);
  assert.equal(await as('other',c=>one(c,'select count(*)::int from tc42_support_messages where thread_id=$1',[ticket])),0);
 });
 await check('support staff reads/replies but cannot access private financial orders or award Pro',async()=>{
  assert.equal(await as('support',c=>one(c,'select support_is_staff()')),true);
  assert.equal(await as('support',c=>one(c,'select count(*)::int from tc42_orders')),0);
  const key=crypto.randomUUID(),send=()=>as('support',c=>one(c,"select support_reply($1,'Staff reply',$2)",[ticket,key]));
  assert.equal(await send(),await send());
  await assert.rejects(as('support',c=>c.query('select market_set_pro($1,true)',[buyer])),/Admin only/);
  assert.equal(await as('other',c=>one(c,'select support_is_staff()'),{app_metadata:{role:'support'}}),false);
 });
 await check('assignment and statuses require staff, closed tickets block further replies',async()=>{
  await assert.rejects(as('buyer',c=>c.query("select support_manage($1,'closed',null)",[ticket])),/staff required/);
  await assert.rejects(as('support',c=>c.query("select support_manage($1,'open',$2)",[ticket,buyer])),/Invalid assignee/);
  await as('support',c=>c.query("select support_manage($1,'closed',$2)",[ticket,staff]));
  await assert.rejects(as('buyer',c=>c.query("select support_reply($1,'Closed reply',$2)",[ticket,crypto.randomUUID()])),/closed/);
  await as('admin',c=>c.query("select support_manage($1,'open',$2)",[ticket,staff]));
 });
 await check('notification history and read watermarks are private and synchronized server-side',async()=>{
  if(await one(db,"select exists(select 1 from pg_publication where pubname='supabase_realtime')"))assert.equal(await one(db,"select count(*)::int from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename in ('market_notifications','market_notification_reads')"),2);
  const n=await one(db,"select max(id) from market_notifications where recipient_id=$1",[buyer]);
  const before=await as('buyer',c=>one(c,'select notification_page()'));assert(before.unread>0);
  await assert.rejects(as('other',c=>c.query('select notification_read($1)',[n])),/unavailable/);
  await as('buyer',c=>c.query('select notification_read($1)',[n]));
  assert.equal((await as('buyer',c=>one(c,'select notification_page()'))).unread,0);
  const supportInbox=await as('support',c=>c.query('select * from market_notifications'));assert(supportInbox.rows.every(n=>n.for_support||n.recipient_id===staff));
 });
 await check('notification event keys prevent duplicate alerts and duplicate email targets',async()=>{
  await db.query("update auth.users set email=coalesce(email,'fixture@integration.example.test'),email_confirmed_at=coalesce(email_confirmed_at,now())");
  await as('buyer',c=>c.query('insert into market_alert_preferences(user_id,email_enabled) values($1,true) on conflict(user_id) do update set email_enabled=true',[buyer]));
  const event='test:'+crypto.randomUUID();const emit=()=>db.query("select notice_emit($1,$2,false,false,'support_reply','Reply available','support_reply','{}')",[event,buyer]);await emit();await emit();
  assert.equal(await one(db,'select count(*)::int from market_notifications where event_key=$1',[event]),1);
  assert.equal(await one(db,'select count(*)::int from market_email_outbox j join market_notifications n on n.id=j.notification_id where n.event_key=$1',[event]),1);
 });
 await check('concurrent workers lease disjoint jobs; stale worker acknowledgement is fenced',async()=>{
  for(let i=0;i<9;i++)await db.query("select notice_emit($1,$2,false,false,'message','Update','message','{}')",['lease:'+crypto.randomUUID(),buyer]);
  const lease=()=>as('service',c=>one(c,"select delivery_lease('email',5)"));const [a,b]=await Promise.all([lease(),lease()]);assert.equal(a.length+b.length,10);assert.equal(new Set([...a,...b].map(j=>j.id)).size,10);
  job=a[0];await db.query("update market_email_outbox set lease_until=now()-interval '1 second' where id=$1",[job.id]);
  const next=(await as('service',c=>one(c,"select delivery_lease('email',5)"))).find(j=>j.id===job.id);assert(next);assert.notEqual(job.lease,next.lease);
  await assert.rejects(as('service',c=>c.query("select delivery_finish($1,$2,'sent','old',null)",[job.id,job.lease])),/Stale delivery lease/);
  job=next;
 });
 await check('opt-out is rechecked at send time and retries are capped with durable failure logs',async()=>{
  await as('buyer',c=>c.query('update market_alert_preferences set email_enabled=false where user_id=$1',[buyer]));
  assert.equal(await as('service',c=>one(c,'select delivery_allowed($1)',[job.id])),false);
  await as('service',c=>c.query("select delivery_finish($1,$2,'retry',null,'network_failed')",[job.id,job.lease]));
  assert(await one(db,'select next_attempt_at>now() from market_email_outbox where id=$1',[job.id]));
  await db.query("update market_email_outbox set attempts=6,next_attempt_at=now() where id=$1",[job.id]);await as('service',c=>c.query("select delivery_lease('email',10)"));assert.equal(await one(db,'select state from market_email_outbox where id=$1',[job.id]),'failed');
  assert(await one(db,'select count(*)::int>0 from market_delivery_log where job_id=$1',[job.id]));
 });
 await check('delivery webhooks are deduplicated and cannot downgrade terminal delivery state',async()=>{
  const provider='provider-'+crypto.randomUUID(),event=crypto.randomUUID();
  await db.query("update market_email_outbox set provider_id=$2,state='sent',delivery_state='accepted' where id=$1",[job.id,provider]);
  assert.equal(await as('service',c=>one(c,"select delivery_webhook($1,$2,'email.delivered')",[event,provider])),true);
  assert.equal(await as('service',c=>one(c,"select delivery_webhook($1,$2,'email.delivered')",[event,provider])),false);
  await as('service',c=>c.query("select delivery_webhook($1,$2,'email.sent')",[crypto.randomUUID(),provider]));assert.equal(await one(db,'select delivery_state from market_email_outbox where id=$1',[job.id]),'delivered');
  await assert.rejects(as('buyer',c=>c.query("select delivery_lease('email',5)")),/permission denied/);
 });
 await check('push subscriptions reject arbitrary endpoints and cross-account reassignment',async()=>{
  await assert.rejects(as('buyer',c=>c.query('select push_register($1,$2,$3)',['https://127.0.0.1/private','A'.repeat(87),'B'.repeat(22)])),/Invalid push/);
  const endpoint='https://fcm.googleapis.com/fcm/send/'+crypto.randomUUID();await as('buyer',c=>c.query('select push_register($1,$2,$3)',[endpoint,'A'.repeat(87),'B'.repeat(22)]));
  await assert.rejects(as('other',c=>c.query('select push_register($1,$2,$3)',[endpoint,'A'.repeat(87),'B'.repeat(22)])),/another session/);
  assert.equal(await as('other',c=>one(c,'select count(*)::int from market_push_subscriptions')),0);
 });
 await check('delivery refreshes the verified destination and reconciles webhooks preceding acknowledgements',async()=>{
  await as('buyer',c=>c.query('update market_alert_preferences set email_enabled=true where user_id=$1',[buyer]));
  const refreshed='refreshed-'+crypto.randomUUID()+'@integration.example.test';await db.query('update auth.users set email=$2 where id=$1',[buyer,refreshed]);
  const token=crypto.randomUUID(),provider='early-'+crypto.randomUUID();await db.query("update market_email_outbox set state='processing',lease=$2,lease_until=now()+interval '5 minutes',provider_id=null,delivery_state=null where id=$1",[job.id,token]);
  assert.equal((await as('service',c=>one(c,'select delivery_current($1,$2)',[job.id,token]))).to,refreshed);
  await as('service',c=>c.query("select delivery_webhook($1,$2,'email.delivered')",[crypto.randomUUID(),provider]));await as('service',c=>c.query("select delivery_finish($1,$2,'sent',$3,null)",[job.id,token,provider]));
  assert.equal(await one(db,'select delivery_state from market_email_outbox where id=$1',[job.id]),'delivered');
 });
 await check('overlapping personal/admin audiences produce one email and one visible event per user',async()=>{
  await as('admin',c=>c.query('insert into market_alert_preferences(user_id,email_enabled) values($1,true) on conflict(user_id) do update set email_enabled=true',[identities.admin.id]));
  const event='overlap:'+crypto.randomUUID(),title='Overlap '+crypto.randomUUID();await db.query("select notice_emit($1,$2,false,false,'message',$3,'message','{}');",[event,identities.admin.id,title]);await db.query("select notice_emit($1,null,true,false,'message',$2,'message','{}')",[event,title]);
  assert.equal(await one(db,'select count(*)::int from market_email_outbox where event_key=$1 and user_id=$2',[event,identities.admin.id]),1);
  const page=await as('admin',c=>one(c,'select notification_page(null,100)'));assert.equal(page.items.filter(n=>n.title===title).length,1);
 });
 await check('delivery logs and manual retries require admin and respect the provider idempotency window',async()=>{
  await assert.rejects(as('support',c=>c.query('select delivery_attempts()')),/Admin only/);
  await db.query("update market_email_outbox set state='failed',provider_id=null,delivery_state=null,first_attempt_at=now()-interval '24 hours' where id=$1",[job.id]);
  await assert.rejects(as('admin',c=>c.query('select delivery_retry($1)',[job.id])),/Reconcile provider/);
  await db.query('update market_email_outbox set first_attempt_at=now() where id=$1',[job.id]);await as('admin',c=>c.query('select delivery_retry($1)',[job.id]));assert.equal(await one(db,'select state from market_email_outbox where id=$1',[job.id]),'queued');
 });
 await check('reactivating an inactive push subscription cannot exceed the ten-device limit',async()=>{
  const register=endpoint=>as('buyer',c=>c.query('select push_register($1,$2,$3)',[endpoint,'A'.repeat(87),'B'.repeat(22)]));
  const old='https://fcm.googleapis.com/fcm/send/'+crypto.randomUUID();await register(old);await as('buyer',c=>c.query('select push_remove($1)',[old]));
  for(let i=await one(db,'select count(*)::int from market_push_subscriptions where user_id=$1 and active',[buyer]);i<10;i++)await register('https://fcm.googleapis.com/fcm/send/'+crypto.randomUUID());
  await assert.rejects(register(old),/limit reached/);
 });
 await check('listing review and invoice-state events notify their authorized audiences once',async()=>{
  const listing=await one(db,"insert into market_listings(seller_id,title,platform,description,price) values($1,'Notice fixture','Gaming Gear','Synthetic notification regression fixture',10) returning id",[identities.seller.id]);
  assert.equal(await one(db,"select count(*)::int from market_notifications where listing_id=$1 and kind='listing_pending' and for_admin",[listing]),1);
  await db.query("update market_listings set status='declined' where id=$1",[listing]);await db.query("update market_listings set status='declined' where id=$1",[listing]);
  assert.equal(await one(db,"select count(*)::int from market_notifications where listing_id=$1 and kind='listing_declined' and recipient_id=$2",[listing,identities.seller.id]),1);
  const order=await one(db,"insert into tc42_orders(customer_id,seller_id,total_amount,items) values($1,$2,10,'[]') returning id",[buyer,identities.seller.id]);
  await db.query("insert into store_crypto_invoice(order_id,network,address,units) values($1,'LTC',$2,100000)",[order,'communications-'+crypto.randomUUID()]);
  await db.query("update store_crypto_invoice set state='partial' where order_id=$1",[order]);await db.query("update store_crypto_invoice set state='partial' where order_id=$1",[order]);
  assert.equal(await one(db,"select count(*)::int from market_notifications where order_id=$1 and kind='payment'",[order]),3);
  assert.equal(await as('other',c=>one(c,"select count(*)::int from market_notifications where order_id=$1 and kind='payment'",[order])),0);
 });
 if(local)await check('real JWT support role accesses tickets without gaining admin order privileges',async()=>{assert.equal(await rpc('support_is_staff',{},'support'),true);assert.equal((await api('/rest/v1/tc42_orders',{name:'support'})).length,0);assert((await rpc('support_history',{p_thread:ticket},'support')).length>0);await assert.rejects(rpc('support_reply',{p_thread:ticket,p_body:'Wrong account',p_key:crypto.randomUUID()},'other'))});
}
