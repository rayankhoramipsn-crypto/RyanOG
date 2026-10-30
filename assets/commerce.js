/* Shared presentation and accessible interactions; no synthetic commerce data. */
"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  const isStore = !!$("store-screen");
  const copy = {
    en: {
      quantity: "Quantity",
      addBag: "Add to bag",
      viewBag: "View bag →",
      addedBag: "Added to your bag.",
      menu: "Menu",
      shop: "Shop",
      market: "Marketplace",
      journal: "Journal",
      help: "Help",
      account: "Account",
      bag: "Shopping bag",
      skip: "Skip to products",
      staging: "Staging preview · Purchases and payments are disabled",
      heroLabel: "A BETTER WAY TO PLAY",
      heroTitle: "Your next level.|Starts here.",
      heroDesc:
        "Gaming essentials, digital discoveries, and gear for the way you play. Find your next upgrade.",
      explore: "Explore products ↗",
      discover: "Shop by category",
      discoverLabel: "FIND YOUR NEXT UPGRADE",
      categories: "Explore the essentials.",
      categoryIntro: "Your game. Your setup. Your next chapter.",
      browse: "Browse collection",
      fortnite: "Fortnite",
      accessories: "Gaming accessories",
      giftCards: "Gift cards",
      allProducts: "All products",
      collectionLabel: "THE COLLECTION",
      collection: "Made for your next session.",
      collectionDesc:
        "Explore available products. Find something that fits your game.",
      search: "Search products…",
      sort: "Sort products",
      newest: "New arrivals",
      low: "Price: low to high",
      high: "Price: high to low",
      details: "View details",
      stock: "In stock",
      unavailable: "Out of stock",
      noProducts: "No products available in this collection.",
      noResults: "No matching products. Try another search or category.",
      loadError: "We couldn’t load the collection. Please try again.",
      retry: "Try again",
      noImage: "Image unavailable",
      journalLabel: "THE JOURNAL",
      journalTitle: "A little knowledge.|A better game.",
      journalDesc:
        "Product insights, buying guides, and gaming stories. Read the latest published articles from our journal.",
      journalCta: "Explore the journal ↗",
      whyLabel: "THE TRISOCMD APPROACH",
      whyTitle: "Good gear.|Clear information.",
      why1: "Know what you’re getting",
      why1Desc:
        "Product descriptions, specifications, and availability in one place.",
      why2: "Support when you need it",
      why2Desc:
        "Find answers or reach the store through our published support channel.",
      why3: "A moderated marketplace",
      why3Desc:
        "Community listings are reviewed before they appear. Review the terms before trading.",
      needHelp: "A question before you choose?",
      helpDesc:
        "Explore account help, delivery information, and purchase conditions.",
      footerDesc: "Gaming essentials. Thoughtful choices. Made for players.",
      policy: "Purchase conditions",
      contact: "Contact",
      videos: "Video reviews",
      marketTitle: "Community marketplace",
      marketSub: "Discover listings. Connect with sellers.",
      marketIntro:
        "Browse approved community listings or submit an item you legitimately own. Never share passwords or recovery information.",
      allListings: "All platforms",
      listingSearch: "Search listings…",
      priceAsc: "Price: low to high",
      priceDesc: "Price: high to low",
      latest: "Default order",
      related: "Related products",
      zoom: "Enlarge product image",
      close: "Close",
      checkoutDisabled:
        "Purchases and payments are disabled in this staging preview.",
      subtotal: "Subtotal",
      emptyBag: "Your bag is empty.",
      continueShopping: "Continue shopping",
      remove: "Remove",
      admin: "Administration",
      products: "Products",
      moderation: "Moderation",
      tickets: "Support",
      orders: "Orders",
      content: "Articles",
      readArticle: "Read article →",
      articleFilter: "Search articles…",
      allArticles: "All categories",
    },
    fa: {
      quantity: "تعداد",
      addBag: "افزودن به سبد",
      viewBag: "مشاهده سبد ←",
      addedBag: "به سبد خرید اضافه شد.",
      menu: "منو",
      shop: "فروشگاه",
      market: "مارکت‌پلیس",
      journal: "مجله",
      help: "راهنما",
      account: "حساب کاربری",
      bag: "سبد خرید",
      skip: "رفتن به محصولات",
      staging: "پیش‌نمایش آزمایشی · خرید و پرداخت غیرفعال است",
      heroLabel: "تجربه‌ای بهتر برای بازی",
      heroTitle: "مرحله بعدی تو|از اینجا شروع می‌شود.",
      heroDesc:
        "لوازم گیمینگ، محصولات دیجیتال و تجهیزات متناسب با سبک بازی تو. ارتقای بعدی‌ات را پیدا کن.",
      explore: "مشاهده محصولات ↖",
      discover: "دسته‌بندی محصولات",
      discoverLabel: "ارتقای بعدی‌ات را پیدا کن",
      categories: "دنیای انتخاب‌های تو.",
      categoryIntro: "بازی تو. تجهیزات تو. فصل بعدی تو.",
      browse: "مشاهده مجموعه",
      fortnite: "فورتنایت",
      accessories: "لوازم جانبی گیمینگ",
      giftCards: "گیفت کارت",
      allProducts: "همه محصولات",
      collectionLabel: "مجموعه محصولات",
      collection: "برای نوبت بعدی بازی تو.",
      collectionDesc: "محصولات موجود را ببین و انتخاب مناسب خودت را پیدا کن.",
      search: "جست‌وجوی محصولات…",
      sort: "مرتب‌سازی محصولات",
      newest: "جدیدترین محصولات",
      low: "قیمت: کم به زیاد",
      high: "قیمت: زیاد به کم",
      details: "مشاهده جزئیات",
      stock: "موجود",
      unavailable: "ناموجود",
      noProducts: "هنوز محصولی در این مجموعه موجود نیست.",
      noResults: "محصولی پیدا نشد. جست‌وجو یا دسته‌بندی را تغییر بده.",
      loadError: "دریافت محصولات ممکن نشد. دوباره تلاش کن.",
      retry: "تلاش دوباره",
      noImage: "تصویر موجود نیست",
      journalLabel: "مجله",
      journalTitle: "کمی آگاهی بیشتر.|تجربه‌ای بهتر از بازی.",
      journalDesc:
        "معرفی محصولات، راهنماهای خرید و داستان‌های دنیای گیم. جدیدترین مطالب منتشرشده مجله را بخوان.",
      journalCta: "مطالعه مجله ↖",
      whyLabel: "رویکرد تریسو",
      whyTitle: "تجهیزات خوب.|اطلاعات شفاف.",
      why1: "با آگاهی انتخاب کن",
      why1Desc: "توضیحات، مشخصات فنی و موجودی محصولات در یک جا.",
      why2: "پشتیبانی در دسترس",
      why2Desc:
        "پاسخ پرسش‌هایت را پیدا کن یا از راه ارتباطی فروشگاه با ما تماس بگیر.",
      why3: "مارکت‌پلیس با نظارت",
      why3Desc:
        "آگهی‌ها پیش از نمایش بررسی می‌شوند. قبل از معامله شرایط را بخوان.",
      needHelp: "پیش از انتخاب سؤالی داری؟",
      helpDesc: "راهنمای حساب، اطلاعات تحویل و شرایط خرید را بخوان.",
      footerDesc: "نیازهای گیمینگ. انتخاب آگاهانه. ساخته‌شده برای بازیکن‌ها.",
      policy: "شرایط خرید",
      contact: "تماس",
      videos: "بررسی ویدیویی",
      marketTitle: "مارکت‌پلیس بازیکن‌ها",
      marketSub: "آگهی‌ها را ببین. با فروشندگان ارتباط بگیر.",
      marketIntro:
        "آگهی‌های تأییدشده را مرور کن یا کالایی را که قانوناً متعلق به توست ثبت کن. رمز عبور یا اطلاعات بازیابی را منتشر نکن.",
      allListings: "همه پلتفرم‌ها",
      listingSearch: "جست‌وجوی آگهی‌ها…",
      priceAsc: "قیمت: کم به زیاد",
      priceDesc: "قیمت: زیاد به کم",
      latest: "ترتیب پیش‌فرض",
      related: "محصولات مرتبط",
      zoom: "بزرگ‌نمایی تصویر محصول",
      close: "بستن",
      checkoutDisabled: "خرید و پرداخت در این پیش‌نمایش آزمایشی غیرفعال است.",
      subtotal: "جمع سبد",
      emptyBag: "سبد خرید خالی است.",
      continueShopping: "ادامه مشاهده محصولات",
      remove: "حذف",
      admin: "مدیریت",
      products: "محصولات",
      moderation: "بررسی آگهی‌ها",
      tickets: "پشتیبانی",
      orders: "سفارش‌ها",
      content: "مقاله‌ها",
      readArticle: "مطالعه مقاله ←",
      articleFilter: "جست‌وجوی مقاله‌ها…",
      allArticles: "همه دسته‌بندی‌ها",
    },
    ar: {
      quantity: "الكمية",
      addBag: "أضف إلى السلة",
      viewBag: "عرض السلة ←",
      addedBag: "أُضيف إلى السلة.",
      menu: "القائمة",
      shop: "المتجر",
      market: "السوق",
      journal: "المجلة",
      help: "المساعدة",
      account: "حسابي",
      bag: "سلة التسوق",
      skip: "انتقل إلى المنتجات",
      staging: "معاينة تجريبية · الشراء والدفع معطّلان",
      heroLabel: "تجربة لعب أفضل",
      heroTitle: "مستواك القادم.|يبدأ هنا.",
      heroDesc:
        "أساسيات الألعاب والمنتجات الرقمية والمعدات المناسبة لطريقة لعبك. اكتشف ترقيتك التالية.",
      explore: "استكشف المنتجات ↖",
      discover: "تسوّق حسب الفئة",
      discoverLabel: "اكتشف ترقيتك التالية",
      categories: "استكشف الأساسيات.",
      categoryIntro: "لعبتك. تجهيزاتك. فصلك القادم.",
      browse: "استعرض المجموعة",
      fortnite: "فورتنايت",
      accessories: "ملحقات الألعاب",
      giftCards: "بطاقات الهدايا",
      allProducts: "جميع المنتجات",
      collectionLabel: "مجموعة المنتجات",
      collection: "لجلسة لعبك القادمة.",
      collectionDesc: "استكشف المنتجات المتاحة واختر ما يناسب لعبتك.",
      search: "ابحث عن المنتجات…",
      sort: "ترتيب المنتجات",
      newest: "وصل حديثاً",
      low: "السعر: من الأقل للأعلى",
      high: "السعر: من الأعلى للأقل",
      details: "عرض التفاصيل",
      stock: "متوفر",
      unavailable: "غير متوفر",
      noProducts: "لا توجد منتجات متاحة في هذه المجموعة.",
      noResults: "لا توجد نتائج. جرّب بحثاً أو فئة أخرى.",
      loadError: "تعذّر تحميل المجموعة. حاول مرة أخرى.",
      retry: "حاول مجدداً",
      noImage: "الصورة غير متاحة",
      journalLabel: "المجلة",
      journalTitle: "معرفة أكثر.|تجربة لعب أفضل.",
      journalDesc:
        "معلومات المنتجات وأدلة الشراء وقصص الألعاب. اقرأ أحدث المقالات المنشورة في مجلتنا.",
      journalCta: "استكشف المجلة ↖",
      whyLabel: "نهج تريسو",
      whyTitle: "معدات جيدة.|معلومات واضحة.",
      why1: "اختر بمعرفة",
      why1Desc: "الأوصاف والمواصفات والتوفر في مكان واحد.",
      why2: "دعم عند الحاجة",
      why2Desc: "ابحث عن إجابات أو تواصل معنا عبر قناة الدعم المنشورة.",
      why3: "سوق خاضع للمراجعة",
      why3Desc: "تُراجع الإعلانات قبل نشرها. اقرأ الشروط قبل التعامل.",
      needHelp: "لديك سؤال قبل الاختيار؟",
      helpDesc: "اطّلع على مساعدة الحساب ومعلومات التسليم وشروط الشراء.",
      footerDesc: "أساسيات الألعاب. اختيارات مدروسة. صُنع للاعبين.",
      policy: "شروط الشراء",
      contact: "تواصل معنا",
      videos: "مراجعات الفيديو",
      marketTitle: "سوق مجتمع اللاعبين",
      marketSub: "اكتشف الإعلانات. تواصل مع البائعين.",
      marketIntro:
        "تصفّح الإعلانات المعتمدة أو أرسل إعلاناً لمنتج تملكه بشكل مشروع. لا تشارك كلمات المرور أو معلومات الاسترداد.",
      allListings: "جميع المنصات",
      listingSearch: "ابحث في الإعلانات…",
      priceAsc: "السعر: من الأقل للأعلى",
      priceDesc: "السعر: من الأعلى للأقل",
      latest: "الترتيب الافتراضي",
      related: "منتجات ذات صلة",
      zoom: "تكبير صورة المنتج",
      close: "إغلاق",
      checkoutDisabled: "الشراء والدفع معطّلان في هذه المعاينة التجريبية.",
      subtotal: "المجموع الفرعي",
      emptyBag: "سلتك فارغة.",
      continueShopping: "متابعة التسوق",
      remove: "إزالة",
      admin: "الإدارة",
      products: "المنتجات",
      moderation: "مراجعة الإعلانات",
      tickets: "الدعم",
      orders: "الطلبات",
      content: "المقالات",
      readArticle: "اقرأ المقال ←",
      articleFilter: "ابحث في المقالات…",
      allArticles: "جميع الفئات",
    },
  };
  let legacySetLang = null;
  let locale = "en";
  try {
    locale =
      localStorage.getItem("triso_locale") ||
      JSON.parse(localStorage.getItem("trisocmd_test_state") || "{}").lang ||
      "en";
  } catch {}
  if (!copy[locale]) locale = "en";
  const tr = (k) => copy[locale][k] || copy.en[k] || k;
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text != null) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const put = (selector, text) => {
    document.querySelectorAll(selector).forEach((n) => {
      if (n.textContent !== text) n.textContent = text;
    });
  };
  const split = (selector, key) => {
    const target = document.querySelector(selector);
    if (!target) return;
    const parts = tr(key).split("|");
    target.replaceChildren(
      document.createTextNode(parts[0]),
      document.createElement("br"),
      el("em", parts[1] || ""),
    );
  };
  const money = (n) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
    }).format(Number(n) || 0);
  function setLocale(value) {
    if (!copy[value]) return;
    locale = value;
    try {
      localStorage.setItem("triso_locale", locale);
    } catch {}
    if (isStore && legacySetLang && currentLang !== locale) {
      const screen = document.querySelector(".screen.active")?.id;
      legacySetLang(locale, locale === "en" ? "ltr" : "rtl");
      if (screen) showScreen(screen);
    }
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "en" ? "ltr" : "rtl";
    document
      .querySelectorAll(".locale-picker")
      .forEach((n) => (n.value = locale));
    document
      .querySelectorAll("[data-copy]")
      .forEach((n) => (n.textContent = tr(n.dataset.copy)));
    if (isStore) storeCopy();
    translateStatic();
    document.dispatchEvent(
      new CustomEvent("triso:language", { detail: locale }),
    );
  }
  function storeCopy() {
    if (typeof currentLang !== "undefined") {
      currentLang = locale;
      currentDir = locale === "en" ? "ltr" : "rtl";
      state.lang = locale;
      state.dir = currentDir;
      saveState();
    }
    put("#hero-label", tr("heroLabel"));
    split("#hero-title", "heroTitle");
    put(".tc-hero-desc", tr("heroDesc"));
    put(".tc-main-cta", tr("explore"));
    put(".tc-secondary-cta", tr("discover"));
    put(".tc-market-hero-link b", tr("marketTitle"));
    put(".tc-market-hero-link small", tr("marketSub"));
    put(".tc-market-hero-link>strong", tr("market") + " ↗");
    put(".tc-shop-heading .tc-section-kicker", tr("collectionLabel"));
    put(".tc-shop-heading h2", tr("collection"));
    put(".tc-shop-heading p", tr("collectionDesc"));
    put(".tc-shop-aside", tr("newest"));
    const count = $("tc39-count");
    const cartButton = document.querySelector(".tc39-cart-button");
    if (cartButton && count)
      cartButton.replaceChildren(
        document.createTextNode(tr("bag") + " "),
        count,
      );
    put(".tc-editorial .tc-section-kicker", tr("journalLabel"));
    split(".tc-editorial h2", "journalTitle");
    put(".tc-editorial p", tr("journalDesc"));
    put(".tc-editorial-pill", tr("journalCta"));
    put(".tc-feature-intro .tc-section-kicker", tr("whyLabel"));
    split(".tc-feature-intro h2", "whyTitle");
    for (let i = 1; i <= 3; i++) {
      put(".tc-feature-grid>div:nth-child(" + i + ") h3", tr("why" + i));
      put(
        ".tc-feature-grid>div:nth-child(" + i + ") p",
        tr("why" + i + "Desc"),
      );
    }
    put(".tc-footer p", tr("footerDesc"));
    put(".tc49-quick-help strong", tr("needHelp"));
    put(".tc49-quick-help p", tr("helpDesc"));
    put('.tc49-quick-help a[href="help/"]', tr("help"));
    put('.tc49-quick-help a[href="policies/"]', tr("policy"));
    put(".tc39-cart-head h2", tr("bag"));
    put(".tc39-cart-note", tr("checkoutDisabled"));
    put(".tc39-cart-panel .tc39-add", tr("continueShopping"));
    put("#tc45-cart-checkout", tr("checkoutDisabled"));
    put("#tc41-fab", tr("tickets") + " ↗");
    const search = $("tc39-search");
    search.placeholder = tr("search");
    search.setAttribute("aria-label", tr("search"));
    $("tc39-category").setAttribute("aria-label", tr("categories"));
    $("tc39-sort").setAttribute("aria-label", tr("sort"));
    for (const [value, key] of [
      ["featured", "newest"],
      ["low", "low"],
      ["high", "high"],
    ]) {
      $("tc39-sort").querySelector('[value="' + value + '"]').textContent =
        tr(key);
    }
    put(".tc-editorial-art>small", tr("journalDesc").split(".")[0]);
    const footer = document.querySelector(".tc-footer-links");
    const targets = [
      ["contact", "https://t.me/trisocmd"],
      ["journal", "blog/"],
      ["videos", "videos/"],
      ["help", "help/"],
      ["policy", "policies/"],
    ];
    footer.replaceChildren(
      ...targets.map(([key, href]) => {
        const a = el("a", tr(key));
        a.href = href;
        return a;
      }),
    );
    renderCatalog();
  }
  function renderCatalog() {
    const grid = $("product-grid");
    if (!window.trisoCatalogLoaded) {
      grid.setAttribute("aria-busy", "true");
      return;
    }
    grid.setAttribute("aria-busy", "false");
    grid.replaceChildren();
    $("store-empty").style.display = "none";
    const products = tc39Filtered();
    const first = $("tc39-category").options[0];
    if (first) first.textContent = tr("allProducts");
    if (!products.length) {
      const empty = el("div", null, "empty-state");
      empty.setAttribute("role", "status");
      empty.append(
        el(
          "p",
          tr(
            window.trisoCatalogError
              ? "loadError"
              : state.products.length
                ? "noResults"
                : "noProducts",
          ),
        ),
      );
      if (window.trisoCatalogError) {
        const button = el("button", tr("retry"));
        button.onclick = async () => {
          button.disabled = true;
          const data = await supaLoadProducts();
          state.products = data || [];
          window.trisoCatalogError = data === null;
          renderCatalog();
        };
        empty.append(button);
      }
      grid.append(empty);
      return;
    }
    for (const p of products) {
      const card = el("article", null, "product-card"),
        photo = el("div", null, "product-photo");
      if (tc50ImgUrl(p.img)) {
        const img = el("img");
        img.src = p.img;
        img.alt = p.title;
        img.width = 400;
        img.height = 300;
        img.loading = "lazy";
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";
        img.onerror = () => photo.replaceChildren(el("span", tr("noImage")));
        photo.append(img);
      } else photo.append(el("span", tr("noImage")));
      const body = el("div", null, "product-body");
      body.append(
        el("span", p.category || tr("products"), "category-label"),
        el("h3", p.title, "product-title"),
        el("p", getDesc(p), "product-desc"),
      );
      const footer = el("div", null, "product-footer"),
        a = el("a", tr("details"), "product-buy-btn");
      a.href = "product.html?id=" + encodeURIComponent(p.id);
      footer.append(el("strong", money(p.price), "product-price"), a);
      body.append(
        footer,
        el(
          "span",
          Number(p.stock) > 0
            ? tr("stock") +
                " · " +
                new Intl.NumberFormat(locale).format(p.stock)
            : tr("unavailable"),
          "stock-label" + (Number(p.stock) > 0 ? "" : " unavailable"),
        ),
      );
      card.append(photo, body);
      card.dataset.productId = String(p.id);
      grid.append(card);
    }
    document.dispatchEvent(new Event("triso:catalog-rendered"));
  }
  // Exact phrase translations only touch UI text, never user content or product/article bodies.
  const phrases = window.TrisoPhrases;
  const originals = new WeakMap();
  function translateStatic() {
    const scope = document.body;
    if (!scope) return;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    const list = [];
    while (walker.nextNode()) list.push(walker.currentNode);
    for (const n of list) {
      if (
        n.parentElement.closest(
          "script,style,[data-copy],[data-user-content],.product-title,.product-desc,.category-label,.product-price,.tc41-bubble,.tc46-card strong,.review-text,#article-body,#description,#title,#specs,#messages,#admin-list,#related-products,.listing h2,.listing h3,.listing .price,.listing .pill,.listing>p:not(.muted)",
        )
      )
        continue;
      const text = n.textContent.trim();
      if (!text) continue;
      if (phrases[text] || window.TrisoDynamicPhrase?.(text, "en"))
        originals.set(n, text);
      const original = originals.get(n) || text,
        entry = phrases[original];
      if (!entry) {
        const translated = window.TrisoDynamicPhrase?.(original, locale);
        if (translated && n.textContent !== translated)
          n.textContent = translated;
      }
      if (entry) {
        const value =
          locale === "en" ? original : entry[locale === "fa" ? 0 : 1];
        if (n.textContent !== value) n.textContent = value;
      }
    }
    for (const n of document.querySelectorAll(
      "input[placeholder],textarea[placeholder]",
    )) {
      if (!n.dataset.originalPlaceholder)
        n.dataset.originalPlaceholder = n.placeholder;
      const value = n.dataset.originalPlaceholder;
      if (phrases[value])
        n.placeholder =
          locale === "en" ? value : phrases[value][locale === "fa" ? 0 : 1];
      if (!n.getAttribute("aria-label") || n.dataset.autoAria) {
        n.setAttribute("aria-label", n.placeholder);
        n.dataset.autoAria = "1";
      }
    }
  }
  function dialogAccess() {
    let active = null,
      previous = null;
    const observer = new MutationObserver(() => {
      const dialog = [
        ...document.querySelectorAll('[role="dialog"],[aria-modal="true"]'),
      ]
        .reverse()
        .find(
          (n) =>
            n.getClientRects().length &&
            getComputedStyle(n).visibility !== "hidden" &&
            !n.closest('[aria-hidden="true"]'),
        );
      if (dialog === active) return;
      if (dialog) {
        previous = document.activeElement;
        active = dialog;
        dialog.querySelector("button,a[href],input")?.focus();
      } else {
        active = null;
        previous?.focus?.();
      }
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "aria-hidden", "style"],
      subtree: true,
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Tab" && active) {
        const elements = [
          ...active.querySelectorAll(
            'button,a[href],input,select,textarea,[tabindex="0"]',
          ),
        ].filter((n) => !n.disabled && n.getClientRects().length);
        if (!elements.length) return;
        const first = elements[0],
          last = elements.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            !active.contains(document.activeElement))
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }
  function marketplace() {
    const list = $("listings");
    if (!list) return;
    put("main>h1", tr("marketTitle"));
    put("main>p", tr("marketIntro"));
    const bar = el("div", null, "listing-filters"),
      input = el("input"),
      platform = el("select"),
      sort = el("select");
    input.type = "search";
    input.placeholder = tr("listingSearch");
    input.setAttribute("aria-label", tr("listingSearch"));
    platform.setAttribute("aria-label", tr("allListings"));
    sort.setAttribute("aria-label", tr("sort"));
    sort.append(
      new Option(tr("latest"), ""),
      new Option(tr("priceAsc"), "low"),
      new Option(tr("priceDesc"), "high"),
    );
    bar.append(input, platform, sort);
    list.before(bar);
    let rows = [];
    let busy = false;
    function filter() {
      const values = [
          ...new Set(
            rows
              .map((n) => n.querySelector(".pill")?.textContent)
              .filter(Boolean),
          ),
        ],
        prior = platform.value;
      platform.replaceChildren(
        new Option(tr("allListings"), ""),
        ...values.map((v) => new Option(v, v)),
      );
      platform.value = values.includes(prior) ? prior : "";
      rows.forEach(
        (n) =>
          (n.hidden =
            !n.textContent.toLowerCase().includes(input.value.toLowerCase()) ||
            (!!platform.value &&
              n.querySelector(".pill")?.textContent !== platform.value)),
      );
      const sorted = [...rows];
      if (sort.value)
        sorted.sort((a, b) => {
          const price = (n) =>
            Number(
              n.querySelector(".price")?.textContent.replace(/[^0-9.]/g, ""),
            ) || 0;
          return (price(a) - price(b)) * (sort.value === "high" ? -1 : 1);
        });
      busy = true;
      observer.disconnect();
      sorted.forEach((n) => list.append(n));
      observer.observe(list, { childList: true });
      busy = false;
    }
    const observer = new MutationObserver(() => {
      if (busy) return;
      rows = [...list.querySelectorAll(":scope>.card")];
      filter();
    });
    observer.observe(list, { childList: true });
    rows = [...list.querySelectorAll(":scope>.card")];
    input.oninput = filter;
    platform.onchange = filter;
    sort.onchange = filter;
    filter();
    document.addEventListener("triso:language", () => {
      input.placeholder = tr("listingSearch");
      input.setAttribute("aria-label", tr("listingSearch"));
      put("main>h1", tr("marketTitle"));
      put("main>p", tr("marketIntro"));
      sort.options[0].textContent = tr("latest");
      sort.options[1].textContent = tr("priceAsc");
      sort.options[2].textContent = tr("priceDesc");
      filter();
    });
  }
  function contentTools() {
    if ($("zoom-image")) {
      const dialog = el("dialog", null, "lightbox"),
        close = el("button", tr("close")),
        image = el("img");
      close.type = "button";
      close.onclick = () => dialog.close();
      dialog.append(close, image);
      document.body.append(dialog);
      $("zoom-image").onclick = () => {
        const hero = $("hero");
        if (!hero.src || hero.classList.contains("hidden")) return;
        image.src = hero.src;
        image.alt = hero.alt;
        dialog.showModal();
      };
      dialog.onclick = (e) => {
        if (e.target === dialog) dialog.close();
      };
      document.addEventListener("triso:language", () => {
        close.textContent = tr("close");
        $("zoom-image").setAttribute("aria-label", tr("zoom"));
      });
    }
    if ($("dashboard")) {
      document.body.classList.add("admin-page");
      const nav = el("nav", null, "admin-sidebar");
      nav.setAttribute("aria-label", tr("admin"));
      for (const [i, key] of [
        "products",
        "moderation",
        "tickets",
        "orders",
        "content",
      ].entries()) {
        const a = el("a", tr(key));
        if (key === "products") a.href = "../index.html#admin";
        else {
          const section = $("dashboard").children[i];
          if (section) {
            section.id = "operation-" + key;
            a.href = "#" + section.id;
          }
        }
        nav.append(a);
      }
      const categoriesLink = el("a", "Categories");
      categoriesLink.href = "#operation-categories";
      nav.append(categoriesLink);
      const merchandisingLink = el("a", "Featured products and offers");
      merchandisingLink.href = "#operation-merchandising";
      nav.append(merchandisingLink);
      $("dashboard").before(nav);
      const sync = () => {
        nav.hidden = $("dashboard").classList.contains("hidden");
      };
      new MutationObserver(sync).observe($("dashboard"), {
        attributes: true,
        attributeFilter: ["class"],
      });
      sync();
      document.addEventListener("triso:language", () =>
        [...nav.children]
          .slice(0, 5)
          .forEach(
            (a, i) =>
              (a.textContent = tr(
                ["products", "moderation", "tickets", "orders", "content"][i],
              )),
          ),
      );
    }
  }
  function init() {
    if (!isStore) {
      const header = document.querySelector("body>header");
      if (header) {
        const picker = el("select", null, "locale-picker");
        picker.setAttribute("aria-label", "Language");
        picker.append(
          new Option("English", "en"),
          new Option("فارسی", "fa"),
          new Option("العربية", "ar"),
        );
        header.append(picker);
      }
      const base = location.pathname.replace(/[^/]*$/, "");
      const nested = /\/(blog|admin|help|videos|policies)\//.test(base);
      const prefix = nested ? "../" : "";
      const footer = el("footer", null, "page-footer");
      for (const [key, path] of [
        ["shop", "index.html"],
        ["market", "marketplace.html"],
        ["journal", "blog/"],
        ["help", "help/"],
        ["policy", "policies/"],
      ]) {
        const a = el("a");
        a.dataset.copy = key;
        a.href = prefix + path;
        footer.append(a);
      }
      document.body.append(footer);
      const banner = el("div", tr("staging"), "staging-banner");
      banner.dataset.copy = "staging";
      document.body.append(banner);
    }
    document
      .querySelectorAll(".locale-picker")
      .forEach((p) => (p.onchange = () => setLocale(p.value)));
    if (isStore) {
      window.renderStore = renderCatalog;
      const menu = document.querySelector(".menu-toggle"),
        links = $("commerce-menu");
      menu.onclick = () => {
        const open = menu.getAttribute("aria-expanded") !== "true";
        menu.setAttribute("aria-expanded", String(open));
        links.classList.toggle("menu-open", open);
      };
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          menu.setAttribute("aria-expanded", "false");
          links.classList.remove("menu-open");
        }
      });
      links.querySelectorAll("a,button").forEach((n) =>
        n.addEventListener("click", () => {
          links.classList.remove("menu-open");
          menu.setAttribute("aria-expanded", "false");
        }),
      );
      document.querySelectorAll("[data-category]").forEach(
        (a) =>
          (a.onclick = () => {
            const select = $("tc39-category"),
              category = a.dataset.category;
            if (
              category &&
              ![...select.options].some((o) => o.value === category)
            )
              select.add(new Option(category, category));
            select.value = category;
            renderCatalog();
          }),
      );
      const disabled = () => {
        if (typeof toast === "function") toast(tr("checkoutDisabled"));
      };
      for (const name of [
        "startCheckout",
        "tc41OpenCheckout",
        "tc41Continue",
        "tc42SaveOrder",
        "tc43CreateInvoice",
        "tc46SetOrderStatus",
      ])
        window[name] = disabled;
      const checkout = $("tc45-cart-checkout");
      checkout.disabled = true;
      checkout.onclick = disabled;
      const openBag = window.tc39CartOpen;
      window.tc39CartOpen = () => {
        openBag();
        $("tc45-cart-checkout").disabled = true;
        put("#tc45-cart-checkout", tr("checkoutDisabled"));
        put(".tc39-cart-note", tr("checkoutDisabled"));
        translateStatic();
      };
      window.openProduct = (id) => {
        location.href = "product.html?id=" + encodeURIComponent(id);
      };
      const lang = window.setLang;
      legacySetLang = lang;
      window.setLang = (value, dir) => {
        lang(value, dir);
        setLocale(value);
      };
      window.addEventListener("triso:catalog-ready", () => {
        setLocale(locale);
        if (new URLSearchParams(location.search).get("bag") === "1")
          tc39CartOpen();
      });
    } else if (location.pathname.endsWith("/marketplace.html")) marketplace();
    document.addEventListener("triso:bag-added", () => {
      const feedback = $("bag-feedback");
      if (feedback) feedback.textContent = tr("addedBag");
    });
    contentTools();
    setLocale(locale);
    dialogAccess();
    let pending = false;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        observer.disconnect();
        translateStatic();
        observer.observe(document.body, { childList: true, subtree: true });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
