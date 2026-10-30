"use strict";
(async () => {
  await Triso.ready;
  if (Triso.session?.user?.app_metadata?.role !== "admin") return;
  const dashboard = document.getElementById("dashboard");
  if (!dashboard) return;
  const el = (tag, text) => {
    const e = document.createElement(tag);
    if (text) e.textContent = text;
    return e;
  };
  const section = el("section");
  section.id = "operation-merchandising";
  section.append(el("h2", "Featured products and offers"));
  const form = el("form"),
    select = el("select"),
    featured = el("input"),
    compare = el("input"),
    save = el("button", "Save merchandising"),
    status = el("p");
  status.setAttribute("role", "status");
  select.required = true;
  select.id = "merch-product";
  featured.type = "checkbox";
  featured.id = "merch-featured";
  compare.type = "number";
  compare.min = "0.01";
  compare.step = "0.01";
  compare.id = "merch-compare";
  save.type = "submit";
  for (const [text, input] of [
    ["Product", select],
    ["Featured product", featured],
    ["Original price (optional, USD)", compare],
  ]) {
    const label = el("label", text);
    label.append(input);
    form.append(label);
  }
  form.append(save);
  section.append(form, status);
  const sales = el("button", "Refresh best sellers"),
    explain = el(
      "p",
      "Best sellers count paid/fulfilled tc42_orders only. Refreshing statistics does not modify orders or activate payments.",
    );
  sales.type = "button";
  section.append(el("h3", "Sales statistics"), explain, sales);
  dashboard.append(section);
  let products = [],
    merch = new Map();
  const json = (body) => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  function show() {
    const current = merch.get(select.value);
    featured.checked = !!current?.featured;
    compare.value = current?.compare_at_price || "";
  }
  try {
    [products, merch] = await Promise.all([
      Triso.request(
        "/rest/v1/products?select=id,title,price&order=id.desc&limit=1000",
      ),
      Triso.request("/rest/v1/product_merchandising?select=*"),
    ]);
    merch = new Map(merch.map((p) => [String(p.product_id), p]));
    select.append(...products.map((p) => new Option(p.title, String(p.id))));
    save.disabled = !products.length;
    show();
  } catch (e) {
    status.textContent = e.message;
    save.disabled = true;
  }
  select.onchange = show;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const p = products.find((p) => String(p.id) === select.value);
    if (!p) return;
    const price = compare.value ? Number(compare.value) : null;
    if (
      price !== null &&
      (!Number.isFinite(price) || price <= Number(p.price))
    ) {
      status.textContent =
        "Original price must exceed the current product price.";
      return;
    }
    save.disabled = true;
    try {
      const body = {
        product_id: p.id,
        featured: featured.checked,
        compare_at_price: price,
        updated_at: new Date().toISOString(),
      };
      await Triso.request(
        "/rest/v1/product_merchandising?on_conflict=product_id",
        {
          ...json(body),
          headers: {
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
        },
      );
      merch.set(String(p.id), body);
      status.textContent = "Merchandising saved.";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      save.disabled = false;
    }
  };
  sales.onclick = async () => {
    sales.disabled = true;
    try {
      const result = await Triso.request(
        "/rest/v1/rpc/refresh_product_sales_snapshots",
        json({}),
      );
      status.textContent =
        "Sales snapshot refreshed for " + result + " products.";
    } catch (e) {
      status.textContent = e.message;
    } finally {
      sales.disabled = false;
    }
  };
})();
