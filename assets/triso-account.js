/* Authenticated dashboard: existing Auth, canonical orders, notifications and navigation. */
(function(global){
 'use strict';
 const root=document.getElementById('tc31-user');if(!root)return;
 const $=id=>document.getElementById(id),auth=()=>global.TrisoAuth?.read(),ui=global.TrisoAuthUI;
 ui.addTranslations({
 'Account settings':['تنظیمات حساب','إعدادات الحساب'],'Recent activity':['فعالیت‌های اخیر','النشاط الأخير'],'From your private notification history.':['از تاریخچه اعلان‌های خصوصی شما.','من سجل إشعاراتك الخاصة.'],'Personalize your display name and preferences.':['نام نمایشی و تنظیمات شخصی خود را مدیریت کنید.','خصص اسمك المعروض وتفضيلاتك.'],'Save changes':['ذخیره تغییرات','حفظ التغييرات'],'Saving changes…':['در حال ذخیره تغییرات…','جارٍ حفظ التغييرات…'],'Changes saved.':['تغییرات ذخیره شد.','تم حفظ التغييرات.'],'Close settings':['بستن تنظیمات','إغلاق الإعدادات'],'No recent activity yet. Your account notifications will appear here.':['هنوز فعالیت اخیری نیست. اعلان‌های حساب شما اینجا نمایش داده می‌شوند.','لا يوجد نشاط حديث بعد. ستظهر إشعارات حسابك هنا.'],'Activity unavailable. Open notifications to retry.':['فعالیت‌ها در دسترس نیستند. اعلان‌ها را برای تلاش دوباره باز کنید.','النشاط غير متاح. افتح الإشعارات لإعادة المحاولة.'],
 'Manage your account, orders, and gaming purchases in one place.':['حساب، سفارش‌ها و خریدهای گیمینگ خود را در یک‌جا مدیریت کنید.','أدر حسابك وطلباتك ومشتريات الألعاب في مكان واحد.'],
 'Account navigation':['ناوبری حساب','التنقل في الحساب'],'Menu':['منو','القائمة'],'Gaming marketplace':['بازار گیمینگ','سوق الألعاب'],'Marketplace':['بازار کاربران','السوق'],'Categories':['دسته‌بندی‌ها','الفئات'],'How it works':['راهنمای خرید','كيف يعمل'],'Support':['پشتیبانی','الدعم'],'Search products':['جستجوی محصولات','البحث عن المنتجات'],'Search products…':['جستجوی محصولات…','ابحث عن المنتجات…'],'Search':['جستجو','بحث'],'Notifications':['اعلان‌ها','الإشعارات'],'Shopping bag':['سبد خرید','سلة التسوق'],'Account menu':['منوی حساب','قائمة الحساب'],'Your profile':['پروفایل شما','ملفك الشخصي'],'Sign out':['خروج','تسجيل الخروج'],'Dismiss':['بستن','إغلاق'],'Signed in successfully':['با موفقیت وارد شدید','تم تسجيل الدخول بنجاح'],
 'Welcome back, {name}':['خوش آمدید، {name}','مرحبًا بعودتك، {name}'],'Authentication':['روش ورود','طريقة المصادقة'],'Account type':['نوع حساب','نوع الحساب'],'Member since':['تاریخ عضویت','عضو منذ'],'Account overview':['نمای کلی حساب','نظرة عامة على الحساب'],'A quick look at your account and orders.':['نگاهی به حساب و سفارش‌های شما.','نظرة سريعة على حسابك وطلباتك.'],'Total orders':['کل سفارش‌ها','إجمالي الطلبات'],'Completed':['تکمیل‌شده','مكتملة'],'In progress':['در حال انجام','قيد التنفيذ'],'Action needed':['نیازمند اقدام','تحتاج إلى إجراء'],'Closed':['بسته‌شده','مغلقة'],
 'Recent notifications':['اعلان‌های اخیر','الإشعارات الأخيرة'],'Private updates from your notification history.':['به‌روزرسانی‌های خصوصی از تاریخچه اعلان‌های شما.','تحديثات خاصة من سجل إشعاراتك.'],'View all notifications':['همه اعلان‌ها','كل الإشعارات'],'Order center':['مرکز سفارش‌ها','مركز الطلبات'],'Track, manage, and review your orders.':['سفارش‌های خود را پیگیری و مدیریت کنید.','تتبع طلباتك وأدرها وراجعها.'],'Open order tracking':['پیگیری سفارش‌ها','فتح تتبع الطلبات'],'Refresh orders':['به‌روزرسانی سفارش‌ها','تحديث الطلبات'],'Order status summary':['خلاصه وضعیت سفارش‌ها','ملخص حالات الطلبات'],'Your orders at a glance.':['وضعیت سفارش‌ها در یک نگاه.','طلباتك في لمحة.'],'View orders':['مشاهده سفارش‌ها','عرض الطلبات'],'Quick actions':['دسترسی سریع','إجراءات سريعة'],'Common tasks for your account.':['کارهای متداول حساب شما.','مهام شائعة لحسابك.'],'Browse marketplace':['مرور بازار کاربران','تصفح السوق'],'Notification settings':['تنظیمات اعلان‌ها','إعدادات الإشعارات'],
 'Customer account':['حساب مشتری','حساب عميل'],'Seller account':['حساب فروشنده','حساب بائع'],'Support account':['حساب پشتیبانی','حساب دعم'],'Admin account':['حساب مدیر','حساب مسؤول'],'Checking permissions…':['بررسی دسترسی‌ها…','جارٍ التحقق من الصلاحيات…'],'Account permissions unavailable':['دسترسی‌های حساب در دسترس نیست','صلاحيات الحساب غير متاحة'],'Email':['ایمیل','البريد الإلكتروني'],'Not available':['در دسترس نیست','غير متاح'],
 'Loading orders…':['در حال بارگذاری سفارش‌ها…','جارٍ تحميل الطلبات…'],'Refreshing orders…':['در حال به‌روزرسانی سفارش‌ها…','جارٍ تحديث الطلبات…'],'Orders unavailable. Please try Refresh orders.':['سفارش‌ها در دسترس نیستند. به‌روزرسانی سفارش‌ها را دوباره امتحان کنید.','الطلبات غير متاحة. حاول تحديث الطلبات مجددًا.'],'Could not refresh. Previously loaded orders are shown.':['به‌روزرسانی انجام نشد. سفارش‌های قبلی نمایش داده می‌شوند.','تعذر التحديث. تظهر الطلبات المحملة سابقًا.'],'No linked orders yet':['هنوز سفارشی متصل نیست','لا توجد طلبات مرتبطة بعد'],'New orders will appear here automatically.':['سفارش‌های جدید به‌صورت خودکار اینجا نمایش داده می‌شوند.','ستظهر الطلبات الجديدة هنا تلقائيًا.'],'{count} linked orders':['{count} سفارش متصل','{count} طلبات مرتبطة'],'Latest order #{id}':['آخرین سفارش #{id}','آخر طلب #{id}'],'No notifications yet.':['هنوز اعلانی نیست.','لا توجد إشعارات بعد.'],'Loading notifications…':['در حال بارگذاری اعلان‌ها…','جارٍ تحميل الإشعارات…'],'Notifications unavailable. Open notifications to retry.':['اعلان‌ها در دسترس نیستند. برای تلاش دوباره اعلان‌ها را باز کنید.','الإشعارات غير متاحة. افتح الإشعارات لإعادة المحاولة.'],'Categories unavailable':['دسته‌بندی‌ها در دسترس نیستند','الفئات غير متاحة'],'All products':['همه محصولات','كل المنتجات'],'Close tracking':['بستن پیگیری','إغلاق التتبع'],'Track your orders':['پیگیری سفارش‌های شما','تتبع طلباتك'],'Only orders associated with your signed-in account appear here.':['فقط سفارش‌های مرتبط با حساب شما نمایش داده می‌شوند.','تظهر هنا فقط الطلبات المرتبطة بحسابك.']
 });
 const t=(message,values={})=>Object.entries(values).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',String(v)),ui.t(message));
 const put=(id,value)=>{const el=$(id);if(el)el.textContent=value??''};
 let owner=null,user=null,allowed=null,staff=null,orders=null,noticeHome=null,roleGeneration=0;
 const noticeRoot=document.querySelector('.tc34-notice-root');if(noticeRoot)noticeHome=noticeRoot.parentElement;
 const globalFeedback=$('tc-v22-global-feedback');if(globalFeedback)$('acct-feedback-host').append(globalFeedback);
 const settings=global.TrisoAccountSettings;
 function openSettings(){settings?.open()}
 function mountNotices(){if(!noticeRoot)return;const account=$('tc31-panel').classList.contains('active')&&$('tc31-panel').dataset.authMode==='account';const host=account?$('acct-notice-host'):noticeHome;if(host&&noticeRoot.parentElement!==host)host.append(noticeRoot)}
 function roleText(){if(allowed===null||(allowed===false&&staff===null))return 'Checking permissions…';if(allowed==='error'||staff==='error')return 'Account permissions unavailable';if(allowed===true)return 'Admin account';if(staff===true)return 'Support account';return ({seller:'Seller account'})[user?.app_metadata?.role]||'Customer account'}
 function date(value){const d=new Date(value);return value&&Number.isFinite(d.getTime())?d.toLocaleDateString(document.documentElement.lang,{year:'numeric',month:'short',day:'numeric'}):t('Not available')}
 function profile(){
  put('tc31-user-email',user?.email||'');const name=String(user?.user_metadata?.display_name||user?.user_metadata?.full_name||'').trim();put('acct-display-name',name);
  settings?.avatar();
  put('acct-role',user?t(roleText()):'');put('acct-type',user?t(roleText()):'');
  const providers=user?.app_metadata?.providers||[user?.app_metadata?.provider];put('acct-provider',user?providers.filter(v=>typeof v==='string').map(v=>v==='email'?t('Email'):v==='google'?'Google':v).join(', ')||t('Not available'):'');put('acct-created',user?date(user.created_at):'');
 }
 function renderOrders(snapshot=orders){
  orders=snapshot;const active=auth()?.user?.id,valid=active&&snapshot?.owner===active,hasData=valid&&(snapshot.hasData||snapshot.state==='ready'),state=valid?snapshot.state:'idle';
  const model=global.TrisoAccountModel.summarize(valid?snapshot.rows:[],active);
  root.dataset.ordersState=state;root.querySelector('.acct-overview').setAttribute('aria-busy',String(state==='loading'));
  root.querySelectorAll('[data-account-count]').forEach(el=>el.textContent=hasData?new Intl.NumberFormat(document.documentElement.lang).format(model.counts[el.dataset.accountCount]):'—');
  root.querySelectorAll('[data-account-action="refresh"]').forEach(el=>el.disabled=!active||state==='loading');
  const feedback=state==='error'?(hasData?'Could not refresh. Previously loaded orders are shown.':'Orders unavailable. Please try Refresh orders.'):state==='loading'?(hasData?'Refreshing orders…':'Loading orders…'):'';put('acct-orders-feedback',feedback?t(feedback):'');
  const box=$('tc36-orders');box.replaceChildren();const title=document.createElement('strong'),description=document.createElement('small');
  if(!hasData){title.textContent=t(state==='error'?'Orders unavailable. Please try Refresh orders.':'Loading orders…')}
  else if(!model.orders.length){title.textContent=t('No linked orders yet');description.textContent=t('New orders will appear here automatically.')}
  else{title.textContent=t('{count} linked orders',{count:model.counts.total});const latest=model.orders[0];description.textContent=t('Latest order #{id}',{id:String(latest.id).slice(0,8)})+' · '+global.TrisoOrders.statusText(latest.status)}
  box.append(title,description);
 }
 function activity(){
  const snapshot=global.TrisoNotifications?.snapshot(),list=$('acct-activity-list');list.replaceChildren();
  const valid=snapshot&&snapshot.owner===owner&&owner,items=valid?snapshot.items.slice(0,3):[];
  if(!items.length){const li=document.createElement('li');li.className='acct-empty';li.textContent=t(!global.TrisoNotifications?.snapshot?'Activity unavailable. Open notifications to retry.':!valid||snapshot.state==='loading'?'Loading notifications…':snapshot.state==='error'?'Notifications unavailable. Open notifications to retry.':'No recent activity yet. Your account notifications will appear here.');list.append(li)}
  for(const item of items){const li=document.createElement('li'),div=document.createElement('div'),title=document.createElement('strong'),time=document.createElement('time');title.textContent=String(item.title||'');time.textContent=date(item.created_at);if(item.created_at)time.dateTime=item.created_at;div.append(title,time);li.append(div);list.append(li)}
  const unread=valid?Number(snapshot.unread)||0:0;put('acct-unread',unread>99?'99+':String(unread));$('acct-unread').hidden=!unread;
 }
 function paint(){
  root.querySelectorAll('[data-account-copy]').forEach(el=>el.textContent=t(el.dataset.accountCopy));root.querySelectorAll('[data-account-label]').forEach(el=>el.setAttribute('aria-label',t(el.dataset.accountLabel)));root.querySelectorAll('[data-account-placeholder]').forEach(el=>el.placeholder=t(el.dataset.accountPlaceholder));
  $('acct-language').value=['en','fa','ar'].includes(document.documentElement.lang)?document.documentElement.lang:'en';
  root.querySelectorAll('[data-account-message]').forEach(el=>el.textContent=t(el.dataset.accountMessage));
  profile();renderOrders();activity();settings?.paint();if(!$('acct-success').hidden)welcome();
  const tracking=$('tc45-tracking');if(tracking){tracking.querySelector('h2').textContent=t('Track your orders');tracking.querySelector('.tc45-tracking-note').textContent=t('Only orders associated with your signed-in account appear here.');tracking.querySelector('.tc45-track-head button').setAttribute('aria-label',t('Close tracking'));const buttons=tracking.querySelectorAll('.tc45-track-panel>button');if(buttons[0])buttons[0].textContent=t('Refresh orders');if(buttons[1])buttons[1].textContent=t('Support')}
 }
 function sync(){
  const next=auth()?.user||null,id=next?.id||null;
  if(id!==owner){settings?.close();owner=id;allowed=null;staff=null;roleGeneration++;orders=null;$('acct-success').hidden=true;root.dataset.admin='false';root.querySelectorAll('details[open]').forEach(el=>el.open=false)}
  user=next;if(!owner){root.style.display='none';put('acct-welcome','');global.tc45CloseTracking?.()}
  profile();renderOrders();activity();mountNotices();
 }
 function welcome(){put('acct-welcome',t('Welcome back, {name}',{name:user?.user_metadata?.display_name||user?.user_metadata?.full_name||user?.email||''}))}
 function signedIn(){sync();if(!owner||$('tc31-panel').dataset.authMode!=='account')return;welcome();$('acct-success').hidden=false}
 function categories(){
  const select=$('tc39-category'),host=$('acct-category-options');host.replaceChildren();
  if(!select||select.options.length<2){host.append(document.createTextNode(t('Categories unavailable')));return}
  [...select.options].forEach(option=>{const b=document.createElement('button');b.type='button';b.textContent=option.value?option.textContent:t('All products');b.onclick=()=>{select.value=option.value;global.tc39Filter?.();global.showScreen('store-screen');root.querySelector('.acct-categories').open=false};host.append(b)});
 }
 root.querySelector('[data-account-home]').addEventListener('click',event=>{event.preventDefault();global.showScreen('store-screen')});
 root.addEventListener('click',event=>{
  const button=event.target.closest('[data-account-action]');if(!button)return;
  const action=button.dataset.accountAction;
  if(action==='settings')openSettings();if(action==='close-settings')settings?.close();if(['overview','activity','tracking'].includes(action))settings?.close();if(action==='activity'){$('acct-activity-title').tabIndex=-1;$('acct-activity-title').focus();$('acct-activity-title').scrollIntoView({block:'center'});root.querySelector('.acct-user-menu').open=false}
  if(action==='logout')global.tc31Logout();if(action==='tracking')global.tc45OpenTracking();if(action==='refresh')global.TrisoOrders.load();if(action==='cart')global.tc39CartOpen?.();if(action==='trust')global.showScreen('tc31-trust');if(action==='notifications'){global.TrisoNotifications?.open()}
  if(action==='dismiss')$('acct-success').hidden=true;
  if(action==='profile'){root.querySelector('.acct-profile').scrollIntoView({block:'center',behavior:'smooth'});$('tc31-user-email').tabIndex=-1;$('tc31-user-email').focus();root.querySelector('.acct-user-menu').open=false}
  if(action==='menu'){const open=$('acct-nav-links').classList.toggle('acct-open');button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-controls','acct-nav-links')}
 });
 $('acct-search-form').addEventListener('submit',event=>{event.preventDefault();const input=$('tc39-search');if(!input)return;input.value=$('acct-search').value.trim();const native=$('tc-native-search');if(native)native.value=input.value;global.tc39Filter?.();global.showScreen('store-screen')});
 $('acct-language').onchange=()=>ui.language($('acct-language').value);
 const menuButton=root.querySelector('[data-account-action="menu"]');menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-controls','acct-nav-links');
 root.addEventListener('keydown',event=>{if(event.key==='Escape'){root.querySelectorAll('details[open]').forEach(el=>el.open=false);$('acct-nav-links').classList.remove('acct-open');menuButton.setAttribute('aria-expanded','false')}});
 async function role(value){
  const stamp=++roleGeneration,identity=auth();allowed=value===null?'error':value;staff=null;root.dataset.admin=String(value===true);profile();
  if(value!==false||!identity?.access_token)return;
  try{const r=await fetch('https://cxtytbjvdlngahytfilr.supabase.co/rest/v1/rpc/support_is_staff',{method:'POST',headers:{apikey:SUPA_KEY,Authorization:'Bearer '+identity.access_token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});const result=await r.json();if(!r.ok||typeof result!=='boolean')throw Error();if(stamp!==roleGeneration||auth()?.user?.id!==identity.user.id||auth()?.access_token!==identity.access_token)return;staff=result}
  catch{if(stamp!==roleGeneration||auth()?.user?.id!==identity.user.id||auth()?.access_token!==identity.access_token)return;staff='error'}profile();
 }
 global.TrisoAccount={sync,signedIn,role};
 sync();paint();categories();global.TrisoOrders?.subscribe(renderOrders);
 if(owner&&$('tc31-panel').dataset.authMode==='account')global.TrisoOrders?.load();
 const categorySelect=$('tc39-category');if(categorySelect)new MutationObserver(categories).observe(categorySelect,{childList:true});
 new MutationObserver(()=>{paint();categories()}).observe(document.documentElement,{attributes:true,attributeFilter:['lang','dir']});
 new MutationObserver(mountNotices).observe($('tc31-panel'),{attributes:true,attributeFilter:['class','data-auth-mode']});
 global.addEventListener('triso:session',sync);global.addEventListener('storage',sync);global.addEventListener('triso:notifications',activity);
 const refreshVisible=()=>{if(owner&&!document.hidden&&$('tc31-panel').classList.contains('active'))global.TrisoOrders?.load()};
 document.addEventListener('visibilitychange',refreshVisible);setInterval(refreshVisible,30000);
})(window);
