"use strict";
(async () => {
  await Triso.ready;
  const root = document.getElementById("dashboard");
  if (!root || Triso.session?.user?.app_metadata?.role !== "admin") return;
  const node = (tag, text) => {
    const e = document.createElement(tag);
    if (text != null) e.textContent = text;
    return e;
  };
  const section = node("section");
  section.id = "operation-categories";
  const heading = node("h2", "Product categories"),
    description = node(
      "p",
      "Categories are derived from products. Rename a category across its products; access is enforced by product RLS.",
    );
  const form = node("form"),
    from = node("select"),
    name = node("input"),
    save = node("button", "Rename category"),
    status = node("p");
  const sourceLabel = node("label", "Current category"),
    newLabel = node("label", "New category name");
  from.required = true;
  from.id = "category-source";
  name.id = "category-name";
  name.required = true;
  name.maxLength = 80;
  save.type = "submit";
  sourceLabel.append(from);
  newLabel.append(name);
  form.append(sourceLabel, newLabel, save);
  status.setAttribute("role", "status");
  section.append(heading, description, form, status);
  root.append(section);
  let categories = [];
  async function load() {
    try {
      if (
        (await Triso.request("/rest/v1/rpc/is_admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })) !== true
      )
        throw Error("Administrator access required.");
      let rows = [],
        offset = 0;
      for (;;) {
        const batch = await Triso.request(
          "/rest/v1/products?select=category&order=id.asc&limit=500&offset=" +
            offset,
        );
        rows.push(...batch);
        if (batch.length < 500) break;
        offset += 500;
      }
      categories = [
        ...new Set(rows.map((r) => r.category).filter(Boolean)),
      ].sort();
      from.replaceChildren(...categories.map((c) => new Option(c, c)));
      save.disabled = !categories.length;
      if (!categories.length) status.textContent = "No product categories yet.";
    } catch (e) {
      status.textContent = e.message;
      save.disabled = true;
    }
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const current = from.value,
      next = name.value.trim();
    if (!current || !next || current === next) return;
    if (
      !confirm(
        "Rename category “" +
          current +
          "” to “" +
          next +
          "” for all matching products?",
      )
    )
      return;
    save.disabled = true;
    try {
      const rows = await Triso.request(
        "/rest/v1/products?category=eq." + encodeURIComponent(current),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({ category: next }),
        },
      );
      if (!rows?.length)
        throw Error(
          "No products changed. Check permissions or refresh categories.",
        );
      name.value = "";
      status.textContent = "Category updated.";
      await load();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      save.disabled = !categories.length;
    }
  };
  await load();
})();
