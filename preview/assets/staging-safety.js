/* Fail closed before legacy checkout code loads. Only this staging site uses this file. */
"use strict";
(() => {
  const originalFetch = window.fetch.bind(window);
  const blocked =
    /\/(?:functions\/v1\/[^/?]+|rest\/v1\/rpc\/(?:tc42_create_order|tc46_transition_order))(?:[/?]|$)/;
  window.fetch = (input, options) => {
    const url = new URL(
      typeof input === "string" ? input : input.url || String(input),
      location.href,
    );
    if (
      url.hostname === "cxtytbjvdlngahytfilr.supabase.co" &&
      blocked.test(url.pathname)
    )
      return Promise.reject(
        new Error("Purchases and payment operations are disabled in staging."),
      );
    return originalFetch(input, options);
  };
})();
