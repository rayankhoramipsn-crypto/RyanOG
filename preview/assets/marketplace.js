"use strict";
(() => {
  const $ = (id) => document.getElementById(id),
    bucket = "market-gallery";
  const request = (path, options = {}) => Triso.request(path, options);
  const json = (method, body) => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const session = () => {
    try {
      return JSON.parse(sessionStorage.getItem("tc35_auth_session") || "null");
    } catch {
      return null;
    }
  };
  let previews = [];
  function reset() {
    previews.forEach(URL.revokeObjectURL);
    previews = [];
    $("upload-preview").replaceChildren();
  }
  function validate(files) {
    if (files.length > 6) throw Error("Choose up to six images.");
    for (const file of files) {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024 ||
        !file.size
      )
        throw Error("Use JPEG, PNG or WebP images up to 5 MB.");
    }
    return files;
  }
  $("listing-images").onchange = () => {
    reset();
    try {
      const files = validate([...$("listing-images").files]);
      for (const f of files) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(f);
        previews.push(img.src);
        img.alt = f.name;
        img.width = 110;
        img.height = 90;
        $("upload-preview").append(img);
      }
      $("upload-status").textContent = "";
    } catch (e) {
      $("upload-status").textContent = e.message;
      $("listing-images").value = "";
    }
  };
  window.addEventListener("triso:upload-reset", reset);
  async function upload(listingId, files) {
    validate(files);
    const user = session()?.user;
    if (!user) throw Error("Sign in to upload images.");
    const existing = await request(
      "/rest/v1/market_listing_media?select=sort_order&listing_id=eq." +
        encodeURIComponent(listingId),
    );
    const occupied = new Set(existing.map((x) => x.sort_order));
    const free = [0, 1, 2, 3, 4, 5].filter((x) => !occupied.has(x));
    if (files.length > free.length)
      throw Error("A listing can have at most six gallery images.");
    for (let i = 0; i < files.length; i++) {
      const file = files[i],
        ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[
          file.type
        ],
        path =
          user.id + "/" + listingId + "/" + crypto.randomUUID() + "." + ext;
      $("upload-status").textContent =
        "Uploading image " + (i + 1) + " / " + files.length + "…";
      await request("/storage/v1/object/" + bucket + "/" + path, {
        method: "POST",
        headers: { "Content-Type": file.type, "x-upsert": "false" },
        body: file,
      });
      try {
        await request(
          "/rest/v1/market_listing_media",
          json("POST", {
            listing_id: listingId,
            seller_id: user.id,
            object_path: path,
            alt_text: "",
            sort_order: free[i],
          }),
        );
      } catch (error) {
        await request(
          "/storage/v1/object/" + bucket,
          json("DELETE", { prefixes: [path] }),
        ).catch(() => {});
        throw error;
      }
    }
    $("upload-status").textContent =
      "Gallery saved. Images will be reviewed with the listing.";
    document.dispatchEvent(new Event("triso:gallery-updated"));
  }
  window.trisoUploadListing = (id) =>
    upload(id, [...$("listing-images").files]);
  async function signed(path) {
    const result = await request(
      "/storage/v1/object/sign/" + bucket + "/" + path,
      json("POST", { expiresIn: 300 }),
    );
    if (!result?.signedURL) throw Error("Image unavailable");
    return Triso.config.url + "/storage/v1" + result.signedURL;
  }
  async function gallery(card, id) {
    const media = await request(
      "/rest/v1/market_listing_media?select=id,object_path,alt_text,sort_order&listing_id=eq." +
        encodeURIComponent(id) +
        "&order=sort_order.asc",
    );
    if (!media.length) return;
    const strip = document.createElement("div");
    strip.className = "listing-gallery";
    strip.setAttribute("aria-label", "Listing gallery");
    const lightbox = document.createElement("dialog");
    lightbox.className = "lightbox";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Close";
    close.onclick = () => lightbox.close();
    const large = document.createElement("img");
    lightbox.append(close, large);
    card.append(lightbox);
    lightbox.onclick = (e) => {
      if (e.target === lightbox) lightbox.close();
    };
    for (const m of media) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gallery-thumbnail";
      const image = document.createElement("img");
      image.alt =
        m.alt_text ||
        card.querySelector("h2,h3")?.textContent ||
        "Listing image";
      image.loading = "lazy";
      image.width = 120;
      image.height = 90;
      button.append(image);
      button.setAttribute("aria-label", "Enlarge " + image.alt);
      try {
        image.src = await signed(m.object_path);
      } catch {
        continue;
      }
      button.onclick = async () => {
        try {
          large.src = await signed(m.object_path);
          large.alt = image.alt;
          lightbox.showModal();
        } catch (e) {
          $("notice").textContent = e.message;
        }
      };
      const item = document.createElement("div");
      item.append(button);
      const canRemove =
        session()?.user &&
        (session().user.app_metadata?.role === "admin" ||
          (card.closest("#mine") && /pending/.test(card.textContent)));
      if (canRemove) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove image";
        remove.className = "remove-image";
        remove.onclick = async () => {
          if (!confirm("Remove this listing image?")) return;
          remove.disabled = true;
          try {
            const removed = await request(
              "/rest/v1/market_listing_media?id=eq." +
                encodeURIComponent(m.id) +
                "&select=id",
              {
                ...json("DELETE", undefined),
                body: undefined,
                headers: { Prefer: "return=representation" },
              },
            );
            if (!removed?.length)
              throw Error("Image no longer editable or access denied.");
            await request(
              "/storage/v1/object/" + bucket,
              json("DELETE", { prefixes: [m.object_path] }),
            );
            item.remove();
            $("notice").textContent = "Image removed.";
          } catch (e) {
            $("notice").textContent = e.message;
            remove.disabled = false;
          }
        };
        item.append(remove);
      }
      strip.append(item);
    }
    if (strip.children.length) card.append(strip);
  }
  const processed = new WeakSet();
  let focused = false;
  function enhance() {
    for (const card of document.querySelectorAll("[data-listing-id]")) {
      if (processed.has(card)) continue;
      processed.add(card);
      const selected = new URLSearchParams(location.search).get("listing");
      if (!focused && selected === card.dataset.listingId) {
        focused = true;
        card.tabIndex = -1;
        card.classList.add("selected-listing");
        card.scrollIntoView({ block: "center" });
        card.focus({ preventScroll: true });
      }
      gallery(card, card.dataset.listingId).catch(() => {});
      if (card.closest("#mine")) {
        const status = card.textContent;
        if (!/pending/.test(status)) continue;
        const label = document.createElement("label"),
          input = document.createElement("input");
        label.textContent = "Add gallery images";
        input.type = "file";
        input.multiple = true;
        input.accept = "image/jpeg,image/png,image/webp";
        input.setAttribute("aria-label", "Add gallery images");
        label.append(input);
        const add = document.createElement("button");
        add.type = "button";
        add.textContent = "Upload selected images";
        add.onclick = async () => {
          add.disabled = true;
          try {
            await upload(card.dataset.listingId, [...input.files]);
            input.value = "";
            card.querySelector(".listing-gallery")?.remove();
            await gallery(card, card.dataset.listingId);
            $("notice").textContent = "Gallery saved for moderation.";
          } catch (e) {
            $("notice").textContent = e.message;
          } finally {
            add.disabled = false;
          }
        };
        card.append(label, add);
      }
    }
  }
  const observer = new MutationObserver(enhance);
  for (const id of ["listings", "mine", "queue"])
    if ($(id)) observer.observe($(id), { childList: true });
  enhance();
  // Owner profile and real submission summary. Pro privileges are never editable here.
  const profile = document.createElement("section");
  profile.id = "seller-profile";
  profile.hidden = true;
  profile.innerHTML =
    '<h2>Seller profile</h2><p id="seller-summary"></p><form id="seller-profile-form"><label>Display name<input id="seller-display-name" maxlength="60" required></label><button>Save profile</button></form><p id="seller-profile-status" role="status"></p>';
  $("signed").append(profile);
  let lastUser = null;
  async function loadProfile() {
    const user = session()?.user;
    if (!user) {
      profile.hidden = true;
      lastUser = null;
      return;
    }
    if (lastUser === user.id) return;
    lastUser = user.id;
    profile.hidden = false;
    try {
      const [profiles, rows] = await Promise.all([
        request(
          "/rest/v1/seller_profiles?select=display_name,is_pro,pro_until&user_id=eq." +
            encodeURIComponent(user.id),
        ),
        request(
          "/rest/v1/market_listings?select=status&seller_id=eq." +
            encodeURIComponent(user.id),
        ),
      ]);
      $("seller-display-name").value = profiles[0]?.display_name || "";
      profile.dataset.exists = String(!!profiles.length);
      $("seller-summary").textContent =
        rows.length +
        " submissions · " +
        rows.filter((r) => r.status === "approved").length +
        " approved · " +
        rows.filter((r) => r.status === "pending").length +
        " pending";
    } catch (e) {
      $("seller-profile-status").textContent = e.message;
    }
  }
  $("seller-profile-form").onsubmit = async (e) => {
    e.preventDefault();
    const user = session()?.user;
    if (!user) return;
    const display_name = $("seller-display-name").value.trim();
    if (!display_name || display_name.length > 60) return;
    const button = e.currentTarget.querySelector("button");
    button.disabled = true;
    try {
      const exists = profile.dataset.exists === "true";
      await request(
        "/rest/v1/seller_profiles" +
          (exists ? "?user_id=eq." + encodeURIComponent(user.id) : ""),
        json(
          exists ? "PATCH" : "POST",
          exists ? { display_name } : { user_id: user.id, display_name },
        ),
      );
      profile.dataset.exists = "true";
      $("seller-profile-status").textContent = "Profile saved.";
    } catch (error) {
      $("seller-profile-status").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
  window.addEventListener("triso:listing-saved", () => {
    lastUser = null;
    loadProfile();
  });
  const authObserver = new MutationObserver(loadProfile);
  authObserver.observe($("signed"), {
    attributes: true,
    attributeFilter: ["class"],
  });
  Triso.ready.then(loadProfile);
})();
