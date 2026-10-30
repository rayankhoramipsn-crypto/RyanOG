"use strict";
(async () => {
  await Triso.ready;
  const $ = (id) => document.getElementById(id);
  if (!$("signed")) return;
  const section = document.createElement("section");
  section.id = "public-seller-editor";
  section.innerHTML =
    '<h2>Public seller profile</h2><p>Publishing is optional. Only your chosen display name, biography and avatar are shown, after you have an approved listing. Your account email and private profile remain private.</p><form id="public-seller-form"><label>Display name<input id="public-seller-name" minlength="3" maxlength="60" required></label><label>Biography<textarea id="public-seller-bio" maxlength="500"></textarea></label><label>Avatar HTTPS URL<input id="public-seller-avatar" type="url"></label><label class="checkbox-label"><input id="public-seller-visible" type="checkbox">Publish my seller profile</label><button>Save public profile</button></form><a id="public-seller-link" hidden>View seller profile →</a><p id="public-seller-status" role="status"></p>';
  $("signed").append(section);
  const session = () => {
    try {
      return JSON.parse(sessionStorage.getItem("tc35_auth_session") || "null");
    } catch {
      return null;
    }
  };
  let current = null;
  const known = new Map();
  async function load() {
    const user = session()?.user;
    if (!user) {
      current = null;
      return;
    }
    if (current === user.id) return;
    current = user.id;
    try {
      const rows = await Triso.request(
        "/rest/v1/market_seller_public_profiles?select=*&user_id=eq." +
          encodeURIComponent(user.id),
      );
      const profile = rows[0];
      $("public-seller-name").value = profile?.display_name || "";
      $("public-seller-bio").value = profile?.bio || "";
      $("public-seller-avatar").value = profile?.avatar_url || "";
      $("public-seller-visible").checked = !!profile?.is_public;
      $("public-seller-link").href =
        "seller.html?id=" + encodeURIComponent(user.id);
      $("public-seller-link").hidden = !profile;
    } catch (e) {
      $("public-seller-status").textContent = e.message;
    }
  }
  $("public-seller-form").onsubmit = async (e) => {
    e.preventDefault();
    const user = session()?.user;
    if (!user) return;
    const avatar = $("public-seller-avatar").value.trim();
    if (avatar) {
      try {
        if (new URL(avatar).protocol !== "https:") throw Error();
      } catch {
        $("public-seller-status").textContent = "Avatar must use HTTPS.";
        return;
      }
    }
    const button = e.currentTarget.querySelector("button");
    button.disabled = true;
    try {
      await Triso.request(
        "/rest/v1/market_seller_public_profiles?on_conflict=user_id",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify({
            user_id: user.id,
            display_name: $("public-seller-name").value.trim(),
            bio: $("public-seller-bio").value.trim(),
            avatar_url: avatar || null,
            is_public: $("public-seller-visible").checked,
            updated_at: new Date().toISOString(),
          }),
        },
      );
      $("public-seller-status").textContent = "Public profile saved.";
      current = null;
      await load();
    } catch (error) {
      $("public-seller-status").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
  new MutationObserver(load).observe($("signed"), {
    attributes: true,
    attributeFilter: ["class"],
  });
  load();
  let rendering = false;
  async function links() {
    if (rendering) return;
    const cards = [
      ...document.querySelectorAll("#listings [data-listing-id]"),
    ].filter((c) => !c.querySelector(".seller-profile-link"));
    if (!cards.length) return;
    rendering = true;
    try {
      const ids = cards
        .map((c) => c.dataset.listingId)
        .filter((id) => /^[0-9]{1,18}$/.test(id));
      if (!ids.length) return;
      const owners = await Triso.request(
        "/rest/v1/market_listings?select=id,seller_id&status=eq.approved&id=in.(" +
          ids.join(",") +
          ")",
      );
      const sellerIds = [...new Set(owners.map((p) => p.seller_id))];
      if (!sellerIds.length) return;
      const profiles = await Triso.request(
        "/rest/v1/market_seller_public_profiles?select=user_id,display_name&is_public=eq.true&user_id=in.(" +
          sellerIds.join(",") +
          ")",
      );
      for (const card of cards) {
        const owner = owners.find(
            (p) => String(p.id) === card.dataset.listingId,
          ),
          profile = profiles.find((p) => p.user_id === owner?.seller_id);
        if (!profile) continue;
        const a = document.createElement("a");
        a.className = "seller-profile-link";
        a.href = "seller.html?id=" + encodeURIComponent(profile.user_id);
        a.textContent = profile.display_name;
        card.append(a);
      }
    } catch {
    } finally {
      rendering = false;
    }
  }
  new MutationObserver(links).observe($("listings"), { childList: true });
  links();
})();
