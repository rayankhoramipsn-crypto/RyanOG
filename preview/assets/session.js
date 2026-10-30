/* Shared staging session bootstrap. RLS remains the authorization boundary. */
"use strict";
window.Triso = (() => {
  const storageKey = "tc35_auth_session";
  const config = Object.freeze({
    url: "https://cxtytbjvdlngahytfilr.supabase.co",
    key: "sb_publishable_AqZWjpgyZ_h6-EKwOySyGQ_0LE8bcRm",
  });
  let session = null;
  const read = () => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) || "null");
    } catch {
      return null;
    }
  };
  function save(value) {
    session = value;
    try {
      if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
      else sessionStorage.removeItem(storageKey);
    } catch {}
  }
  async function authRequest(path, body, accessToken) {
    const response = await fetch(config.url + "/auth/v1/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        apikey: config.key,
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: "Bearer " + accessToken } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error("Session expired. Please sign in again.");
    return response.json();
  }
  async function restore() {
    const stored = read();
    if (!stored?.access_token) return;
    try {
      session = stored;
      if (!stored.expires_at || stored.expires_at < Date.now() / 1000 + 90) {
        if (!stored.refresh_token) throw Error("Session expired");
        const fresh = await authRequest("token?grant_type=refresh_token", {
          refresh_token: stored.refresh_token,
        });
        save({
          ...fresh,
          expires_at: Math.floor(Date.now() / 1000) + fresh.expires_in,
        });
      }
      const user = await authRequest("user", null, session.access_token);
      save({ ...session, user });
    } catch {
      save(null);
    }
  }
  const ready = restore();
  return {
    config,
    ready,
    get session() {
      return session;
    },
    async signOut() {
      const current = session;
      save(null);
      if (current?.access_token)
        await authRequest("logout", {}, current.access_token).catch(() => {});
    },
  };
})();
// A shared REST/Storage client; sessions are refreshed before authenticated operations.
(() => {
  let pendingRefresh = null;
  Triso.request = async function (path, options = {}) {
    await Triso.ready;
    let session;
    try {
      session = JSON.parse(
        sessionStorage.getItem("tc35_auth_session") || "null",
      );
    } catch {}
    if (
      session?.access_token &&
      session.refresh_token &&
      (!session.expires_at || session.expires_at < Date.now() / 1000 + 90)
    ) {
      if (!pendingRefresh)
        pendingRefresh = (async () => {
          const res = await fetch(
            Triso.config.url + "/auth/v1/token?grant_type=refresh_token",
            {
              method: "POST",
              headers: {
                apikey: Triso.config.key,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ refresh_token: session.refresh_token }),
              signal: AbortSignal.timeout(15000),
            },
          );
          if (!res.ok) throw Error("Please sign in again.");
          const data = await res.json();
          data.expires_at =
            Math.floor(Date.now() / 1000) + (data.expires_in || 3600);
          sessionStorage.setItem("tc35_auth_session", JSON.stringify(data));
          return data;
        })().finally(() => {
          pendingRefresh = null;
        });
      session = await pendingRefresh;
    }
    const headers = {
      apikey: Triso.config.key,
      ...(session?.access_token
        ? { Authorization: "Bearer " + session.access_token }
        : {}),
      ...options.headers,
    };
    const res = await fetch(Triso.config.url + path, {
      ...options,
      headers,
      signal: options.signal || AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw Error(
        e.message ||
          e.error_description ||
          e.error ||
          "Request failed (" + res.status + ")",
      );
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  };
})();
