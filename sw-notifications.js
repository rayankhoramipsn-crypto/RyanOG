/* Notification-only worker: no page caching, authentication tokens or customer data. */
self.addEventListener('push',event=>{
 let data;try{data=event.data?.json()}catch{return}if(!data||typeof data.tag!=='string'||!/^triso-notice-[0-9]+$/.test(data.tag))return;
 event.waitUntil(self.registration.showNotification('TRISOCMD',{body:'Open TRISOCMD to view your update.',tag:data.tag,data:{url:'/'}}));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const pages=await self.clients.matchAll({type:'window',includeUncontrolled:true});const page=pages.find(p=>new URL(p.url).origin===self.location.origin);if(page)return page.focus();return self.clients.openWindow(new URL('/',self.location.origin).href)})())});
