"use strict";
(async () => {
  await Triso.ready;
  const $ = (id) => document.getElementById(id),
    id = new URLSearchParams(location.search).get("id");
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id || "")) {
    $("seller-notice").textContent = "Seller profile unavailable.";
    return;
  }
  try {
    const rows = await Triso.request(
      "/rest/v1/market_seller_public_profiles?select=user_id,display_name,bio,avatar_url,is_public&user_id=eq." +
        encodeURIComponent(id),
    );
    const profile = rows[0];
    if (!profile) {
      $("seller-notice").textContent = "Seller profile unavailable.";
      return;
    }
    $("seller-name").dataset.userContent = "";
    $("seller-name").textContent = profile.display_name;
    $("seller-bio").textContent = profile.bio;
    $("seller-notice").textContent = profile.is_public
      ? ""
      : "This profile is private and visible only to its owner or administrators.";
    document.title = profile.display_name + " | TRISOCMD";
    if (profile.avatar_url) {
      try {
        const url = new URL(profile.avatar_url);
        if (url.protocol === "https:") {
          $("seller-avatar").src = url.href;
          $("seller-avatar").hidden = false;
        }
      } catch {}
    }
    const listings = await Triso.request(
      "/rest/v1/market_listings?select=id,title,description,price,image_url,platform&status=eq.approved&seller_id=eq." +
        encodeURIComponent(id) +
        "&order=submitted_at.desc&limit=100",
    );
    const root = $("seller-listings");
    root.replaceChildren();
    for (const p of listings) {
      const card = document.createElement("article");
      card.className = "card";
      const h = document.createElement("h3");
      h.textContent = p.title;
      const desc = document.createElement("p");
      desc.textContent = p.description;
      const price = document.createElement("strong");
      price.textContent = new Intl.NumberFormat(document.documentElement.lang, {
        style: "currency",
        currency: "USD",
      }).format(p.price);
      const a = document.createElement("a");
      a.href = "marketplace.html?listing=" + encodeURIComponent(p.id);
      a.textContent = "View listing →";
      card.append(h, desc, price, a);
      root.append(card);
    }
    if (!listings.length) root.textContent = "No approved listings yet.";
  } catch (e) {
    $("seller-notice").textContent = e.message;
  }
})();
