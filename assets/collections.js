"use strict";
(() => {
  if (!document.getElementById("product-grid")) return;
  const catalog = document.querySelector(".product-section");
  const nav = document.createElement("div");
  nav.className = "collection-tabs";
  nav.setAttribute("role", "group");
  const labels = {
    en: {
      all: "All products",
      featured: "Featured",
      new: "New arrivals",
      best: "Best sellers",
      offers: "Special offers",
      unavailable: "No products in this collection yet.",
      error: "Collections are temporarily unavailable.",
      featuredBadge: "Featured",
    },
    fa: {
      all: "همه محصولات",
      featured: "محصولات ویژه",
      new: "جدیدترین‌ها",
      best: "پرفروش‌ها",
      offers: "پیشنهادهای ویژه",
      unavailable: "هنوز محصولی در این مجموعه وجود ندارد.",
      error: "دریافت مجموعه‌ها موقتاً ممکن نیست.",
      featuredBadge: "ویژه",
    },
    ar: {
      all: "جميع المنتجات",
      featured: "منتجات مختارة",
      new: "وصل حديثاً",
      best: "الأكثر مبيعاً",
      offers: "عروض خاصة",
      unavailable: "لا توجد منتجات في هذه المجموعة بعد.",
      error: "المجموعات غير متاحة مؤقتاً.",
      featuredBadge: "مختار",
    },
  };
  const language = () =>
    document.documentElement.lang in labels
      ? document.documentElement.lang
      : "en";
  const t = (key) => labels[language()][key];
  let active = "all",
    metadata = new Map(),
    sales = new Map(),
    ready = false;
  const buttons = {};
  for (const key of ["all", "featured", "new", "best", "offers"]) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = t(key);
    b.setAttribute("aria-pressed", String(key === active));
    b.onclick = () => {
      active = key;
      refresh();
    };
    buttons[key] = b;
    nav.append(b);
  }
  const status = document.createElement("p");
  status.className = "collection-status";
  status.setAttribute("role", "status");
  catalog.prepend(nav, status);
  const original = window.tc39Filtered;
  window.tc39Filtered = () => {
    let rows = original();
    if (active === "featured")
      rows = rows.filter((p) => metadata.get(String(p.id))?.featured);
    if (active === "new")
      rows = rows.filter(
        (p) =>
          p.createdAt &&
          Date.now() - new Date(p.createdAt).getTime() >= 0 &&
          Date.now() - new Date(p.createdAt).getTime() < 30 * 86400000,
      );
    if (active === "offers")
      rows = rows.filter(
        (p) =>
          Number(metadata.get(String(p.id))?.compare_at_price) >
          Number(p.price),
      );
    if (active === "best")
      rows = rows
        .filter((p) => Number(sales.get(String(p.id))?.units_sold) > 0)
        .sort((a, b) =>
          document.getElementById("tc39-sort").value === "featured"
            ? Number(sales.get(String(b.id))?.units_sold) -
              Number(sales.get(String(a.id))?.units_sold)
            : 0,
        );
    return rows;
  };
  function decorate() {
    for (const card of document.querySelectorAll(
      "#product-grid .product-card",
    )) {
      const meta = metadata.get(card.dataset.productId),
        product = state.products.find(
          (p) => String(p.id) === card.dataset.productId,
        );
      if (!product) continue;
      if (meta?.featured && !card.querySelector(".curation-badge")) {
        const badge = document.createElement("span");
        badge.className = "curation-badge";
        badge.textContent = t("featuredBadge");
        card.append(badge);
      }
      if (
        Number(meta?.compare_at_price) > Number(product.price) &&
        !card.querySelector(".compare-price")
      ) {
        const old = document.createElement("del");
        old.className = "compare-price";
        old.textContent = new Intl.NumberFormat(language(), {
          style: "currency",
          currency: "USD",
        }).format(meta.compare_at_price);
        card.querySelector(".product-price").append(old);
      }
    }
  }
  function refresh() {
    for (const [key, b] of Object.entries(buttons)) {
      b.textContent = t(key);
      b.setAttribute("aria-pressed", String(active === key));
      b.disabled = !ready && ["featured", "best", "offers"].includes(key);
    }
    if (window.trisoCatalogLoaded) renderStore();
    decorate();
  }
  const load = async (table) => {
    const res = await fetch(SUPA_URL + "/rest/v1/" + table + "?select=*", {
      headers: { apikey: SUPA_KEY },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw Error("Collections unavailable");
    return res.json();
  };
  Promise.all([load("product_merchandising"), load("product_sales_snapshots")])
    .then(([merch, counts]) => {
      metadata = new Map(merch.map((p) => [String(p.product_id), p]));
      sales = new Map(counts.map((p) => [String(p.product_id), p]));
      ready = true;
      refresh();
    })
    .catch(() => {
      status.textContent = t("error");
      refresh();
    });
  document.addEventListener("triso:catalog-rendered", decorate);
  document.addEventListener("triso:language", refresh);
  window.addEventListener("triso:catalog-ready", refresh);
  refresh();
})();
