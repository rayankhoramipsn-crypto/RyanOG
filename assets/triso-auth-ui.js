/* Account copy follows the existing document language/direction selected by setLang. */
(function(global){
 'use strict';
 const copy={
 'Connecting to Google…':['در حال اتصال به گوگل…','جارٍ الاتصال بـ Google…'],
 'Google sign-in is not configured on this site. Please use email sign-in.':['ورود با گوگل در این سایت پیکربندی نشده است. لطفاً با ایمیل وارد شوید.','تسجيل الدخول باستخدام Google غير مُعدّ على هذا الموقع. استخدم البريد الإلكتروني.'],
 'Google sign-in settings could not be checked. Please try again.':['تنظیمات ورود با گوگل بررسی نشد. دوباره تلاش کنید.','تعذر التحقق من إعدادات تسجيل الدخول باستخدام Google. حاول مجددًا.'],
 'Google sign-in needs browser session storage. Allow it and try again.':['ورود با گوگل به ذخیره‌سازی نشست مرورگر نیاز دارد. آن را مجاز کنید و دوباره تلاش کنید.','يتطلب تسجيل الدخول باستخدام Google تخزين جلسة المتصفح. اسمح به وحاول مجددًا.'],
 'Language':['زبان','اللغة'],
 'Sign in':['ورود','تسجيل الدخول'],
 'Create account':['ایجاد حساب','إنشاء حساب'],
 'Reset password':['بازیابی رمز عبور','إعادة تعيين كلمة المرور'],
 'Set a new password':['تنظیم رمز عبور جدید','تعيين كلمة مرور جديدة'],
 'Verify your email':['تأیید ایمیل','تأكيد البريد الإلكتروني'],
 'Your account':['حساب شما','حسابك'],
 'Your account, your gaming marketplace.':['حساب شما در بازار گیمینگ.','حسابك في سوق الألعاب.'],
 'Email address':['آدرس ایمیل','البريد الإلكتروني'],
 'Password':['رمز عبور','كلمة المرور'],
 'Confirm password':['تکرار رمز عبور','تأكيد كلمة المرور'],
 'New password':['رمز عبور جدید','كلمة المرور الجديدة'],
 'Confirm new password':['تکرار رمز عبور جدید','تأكيد كلمة المرور الجديدة'],
 'Display name':['نام نمایشی','الاسم المعروض'],
 'Your display name':['نام نمایشی شما','اسمك المعروض'],
 'Your password':['رمز عبور شما','كلمة المرور الخاصة بك'],
 'At least 8 characters':['حداقل ۸ نویسه','٨ أحرف على الأقل'],
 'Repeat your password':['تکرار رمز عبور','أعد إدخال كلمة المرور'],
 'Repeat new password':['تکرار رمز عبور جدید','أعد إدخال كلمة المرور الجديدة'],
 'Remember me on this device':['مرا در این دستگاه به خاطر بسپار','تذكرني على هذا الجهاز'],
 'Forgot password?':['رمز عبور را فراموش کرده‌اید؟','نسيت كلمة المرور؟'],
 'Continue with Google':['ادامه با گوگل','المتابعة باستخدام Google'],
 'New here?':['کاربر جدید هستید؟','مستخدم جديد؟'],
 'Already have an account?':['حساب کاربری دارید؟','لديك حساب بالفعل؟'],
 'or':['یا','أو'],
 'Back to shop':['بازگشت به فروشگاه','العودة إلى المتجر'],
 'Back to sign in':['بازگشت به ورود','العودة إلى تسجيل الدخول'],
 'Resend verification email':['ارسال دوباره ایمیل تأیید','إعادة إرسال رسالة التأكيد'],
 'Enter your account email to receive a secure password reset link.':['برای دریافت پیوند امن بازیابی رمز، ایمیل حساب خود را وارد کنید.','أدخل بريد حسابك لتلقي رابط آمن لإعادة تعيين كلمة المرور.'],
 'Choose a new password for your account.':['رمز عبور جدیدی برای حساب خود انتخاب کنید.','اختر كلمة مرور جديدة لحسابك.'],
 'Send reset link':['ارسال پیوند بازیابی','إرسال رابط إعادة التعيين'],
 'Save new password':['ذخیره رمز عبور جدید','حفظ كلمة المرور الجديدة'],
 'Need a new reset link?':['پیوند بازیابی جدید می‌خواهید؟','تحتاج إلى رابط جديد؟'],
 'Request a new confirmation email. This does not reset your password.':['ایمیل تأیید جدید درخواست کنید. این کار رمز عبور شما را تغییر نمی‌دهد.','اطلب رسالة تأكيد جديدة. لن يؤدي ذلك إلى تغيير كلمة المرور.'],
 'Verify your email before signing in. Use a unique password.':['پیش از ورود ایمیل خود را تأیید کنید. از رمز عبور منحصربه‌فرد استفاده کنید.','أكد بريدك قبل تسجيل الدخول. استخدم كلمة مرور فريدة.'],
 'Show':['نمایش','إظهار'], 'Hide':['پنهان','إخفاء'],
 'Show password':['نمایش رمز عبور','إظهار كلمة المرور'], 'Hide password':['پنهان کردن رمز عبور','إخفاء كلمة المرور'],
 'Display name must be 2–40 characters.':['نام نمایشی باید ۲ تا ۴۰ نویسه باشد.','يجب أن يكون الاسم المعروض من حرفين إلى ٤٠ حرفًا.'],
 'Enter a valid email address.':['آدرس ایمیل معتبر وارد کنید.','أدخل بريدًا إلكترونيًا صالحًا.'],
 'Password must contain at least 8 characters.':['رمز عبور باید حداقل ۸ نویسه داشته باشد.','يجب أن تتكون كلمة المرور من ٨ أحرف على الأقل.'],
 'Passwords do not match.':['رمزهای عبور یکسان نیستند.','كلمتا المرور غير متطابقتين.'],
 'Creating your account…':['در حال ایجاد حساب…','جارٍ إنشاء حسابك…'],
 'Account created. Check your inbox to verify your email before signing in.':['حساب ایجاد شد. پیش از ورود، ایمیل خود را از طریق پیام دریافتی تأیید کنید.','تم إنشاء الحساب. تحقق من بريدك لتأكيده قبل تسجيل الدخول.'],
 'Account created. Sign in to continue.':['حساب ایجاد شد. برای ادامه وارد شوید.','تم إنشاء الحساب. سجل الدخول للمتابعة.'],
 'Signing in…':['در حال ورود…','جارٍ تسجيل الدخول…'],
 'Signed in successfully. Welcome back.':['با موفقیت وارد شدید. خوش آمدید.','تم تسجيل الدخول بنجاح. مرحبًا بعودتك.'],
 'Signed in successfully.':['با موفقیت وارد شدید.','تم تسجيل الدخول بنجاح.'],
 'Email verified successfully. Sign in to continue.':['ایمیل با موفقیت تأیید شد. برای ادامه وارد شوید.','تم تأكيد البريد بنجاح. سجل الدخول للمتابعة.'],
 'This verification link could not be verified or has expired. Request a new confirmation email.':['پیوند تأیید نامعتبر یا منقضی شده است. ایمیل تأیید جدید درخواست کنید.','رابط التأكيد غير صالح أو انتهت صلاحيته. اطلب رسالة تأكيد جديدة.'],
 'This password recovery link could not be verified. Request a new reset email.':['پیوند بازیابی رمز تأیید نشد. ایمیل بازیابی جدید درخواست کنید.','تعذر التحقق من رابط استعادة كلمة المرور. اطلب رسالة جديدة.'],
 'This sign-in link could not be verified. Please sign in again.':['پیوند ورود تأیید نشد. دوباره وارد شوید یا ایمیل تأیید جدید درخواست کنید.','تعذر التحقق من رابط الدخول. سجل الدخول مجددًا أو اطلب رسالة تأكيد جديدة.'],
 'Verified. Choose a new password below.':['پیوند تأیید شد. رمز عبور جدید انتخاب کنید.','تم التحقق. اختر كلمة مرور جديدة أدناه.'],
 'If an account needs confirmation, a verification email has been sent. Check your inbox and spam.':['اگر حساب به تأیید نیاز داشته باشد، ایمیل ارسال شده است. صندوق ورودی و هرزنامه را بررسی کنید.','إذا كان الحساب بحاجة إلى تأكيد، فقد أُرسلت رسالة. تحقق من الوارد والبريد غير المرغوب فيه.'],
 'Sending your reset link…':['در حال ارسال پیوند بازیابی…','جارٍ إرسال رابط إعادة التعيين…'],
 'If an account exists for this email, we sent a reset link. Check inbox and spam.':['اگر حسابی با این ایمیل وجود داشته باشد، پیوند بازیابی ارسال شد. صندوق ورودی و هرزنامه را بررسی کنید.','إذا وُجد حساب لهذا البريد، فقد أرسلنا رابطًا. تحقق من الوارد والبريد غير المرغوب فيه.'],
 'Updating password…':['در حال تغییر رمز عبور…','جارٍ تحديث كلمة المرور…'],
 'Your password was changed. Sign in with your new password.':['رمز عبور تغییر کرد. با رمز جدید وارد شوید.','تم تغيير كلمة المرور. سجل الدخول بكلمة المرور الجديدة.'],
 'This reset link is no longer active. Request a new one.':['این پیوند بازیابی دیگر فعال نیست. پیوند جدید درخواست کنید.','لم يعد رابط إعادة التعيين نشطًا. اطلب رابطًا جديدًا.'],
 'Too many requests. Please wait before trying again.':['درخواست‌ها زیاد است. کمی صبر کنید و دوباره تلاش کنید.','طلبات كثيرة. انتظر قليلًا قبل المحاولة مجددًا.'],
 'Email or password is incorrect.':['ایمیل یا رمز عبور نادرست است.','البريد الإلكتروني أو كلمة المرور غير صحيحة.'],
 'Verify your email before signing in. You can resend the confirmation email below.':['پیش از ورود ایمیل خود را تأیید کنید. می‌توانید ایمیل تأیید را دوباره درخواست کنید.','أكد بريدك قبل تسجيل الدخول. يمكنك طلب إعادة إرسال رسالة التأكيد أدناه.'],
 'Use a stronger password and try again.':['از رمز عبور قوی‌تری استفاده کنید.','استخدم كلمة مرور أقوى وحاول مجددًا.'],
 'Unable to complete the request. Please try again.':['درخواست انجام نشد. دوباره تلاش کنید.','تعذر إكمال الطلب. حاول مجددًا.'],
 'Network unavailable. Check your connection and try again.':['شبکه در دسترس نیست. اتصال را بررسی و دوباره تلاش کنید.','الشبكة غير متاحة. تحقق من اتصالك وحاول مجددًا.'],
 'Check the highlighted fields and try again.':['فیلدهای مشخص‌شده را بررسی و دوباره تلاش کنید.','تحقق من الحقول المحددة وحاول مجددًا.'],
 'Google sign-in needs a hosted HTTPS URL.':['ورود با گوگل به آدرس HTTPS نیاز دارد.','يتطلب تسجيل الدخول باستخدام Google عنوان HTTPS مستضافًا.'],
 'Open the live website to reset your password.':['برای بازیابی رمز، وب‌سایت را با HTTPS باز کنید.','افتح الموقع عبر HTTPS لإعادة تعيين كلمة المرور.'],
 'Connection interrupted. Your remembered login is saved; retry when online.':['ارتباط قطع شد. ورود ذخیره‌شده محفوظ است؛ پس از اتصال دوباره تلاش کنید.','انقطع الاتصال. تم الاحتفاظ بتسجيل دخولك؛ أعد المحاولة عند الاتصال.'],
 'Session expired. Please sign in again.':['نشست منقضی شد. دوباره وارد شوید.','انتهت الجلسة. سجل الدخول مجددًا.'],
 'You appear offline. Your login remains remembered.':['به نظر می‌رسد آفلاین هستید. ورود ذخیره‌شده محفوظ است.','يبدو أنك غير متصل. تم الاحتفاظ بتسجيل دخولك.'],
 'Network unavailable; remembered login will be retried.':['شبکه در دسترس نیست؛ ورود ذخیره‌شده دوباره بررسی می‌شود.','الشبكة غير متاحة؛ ستتم إعادة محاولة تسجيل الدخول المحفوظ.'],
 'Signed out.':['از حساب خارج شدید.','تم تسجيل الخروج.']
 };
 const t=message=>copy[message]?.[({fa:0,ar:1})[document.documentElement.lang.split('-')[0]]]||message;
 function set(el,message){if(!el)return;el.dataset.authCopy=message;el.textContent=t(message)}
 function mode(name){
  const title={signin:'Sign in',signup:'Create account',forgot:'Reset password',reset:'Set a new password',verify:'Verify your email',account:'Your account'}[name]||'Sign in';
  set(document.querySelector('#tc31-panel .tc31-heading'),title);
  set(document.getElementById('tc-v22-hero-copy'),'Your account, your gaming marketplace.');
 }
 function language(lang){global.setLang(lang,['fa','ar'].includes(lang)?'rtl':'ltr','navbar');global.tc37Close?.();global.showScreen('tc31-panel');paint()}
 function paint(){
  const select=document.getElementById('tc-auth-language');if(select)select.value=['en','fa','ar'].includes(document.documentElement.lang)?document.documentElement.lang:'en';
  document.querySelectorAll('#tc31-panel [data-auth-label]').forEach(el=>el.setAttribute('aria-label',t(el.dataset.authLabel)));
  document.querySelectorAll('#tc31-panel [data-auth-copy]').forEach(el=>el.textContent=t(el.dataset.authCopy));
  document.querySelectorAll('#tc31-panel [data-auth-placeholder]').forEach(el=>el.placeholder=t(el.dataset.authPlaceholder));
  document.querySelectorAll('#tc31-panel [data-auth-reveal]').forEach(el=>{const show=el.getAttribute('aria-pressed')==='true';el.textContent=t(show?'Hide':'Show');el.setAttribute('aria-label',t(show?'Hide password':'Show password'))});
 }
 function error(e){
  if(e?.status===429||['over_request_rate_limit','over_email_send_rate_limit'].includes(e?.code))return 'Too many requests. Please wait before trying again.';
  if(e?.code==='email_not_confirmed')return 'Verify your email before signing in. You can resend the confirmation email below.';
  if(['invalid_credentials','invalid_grant'].includes(e?.code))return 'Email or password is incorrect.';
  if(e?.code==='weak_password')return 'Use a stronger password and try again.';
  if(e?.code==='email_address_invalid')return 'Enter a valid email address.';
  if(e instanceof TypeError||['TimeoutError','AbortError'].includes(e?.name))return 'Network unavailable. Check your connection and try again.';
  return Object.hasOwn(copy,e?.message)?e.message:'Unable to complete the request. Please try again.';
 }
 global.TrisoAuthUI={t,set,mode,paint,error,language};
 new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['lang','dir']});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',paint);else paint();
})(window);
