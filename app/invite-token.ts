"use client";

/**
 * Where a guest's invitation token comes from.
 *
 * It arrives in the address (/rsvp?t=…) and is then remembered for the rest of
 * the visit, so moving between the invitation and the reply does not lose it.
 * Nothing is written to a cookie and nothing outlives the browser tab.
 */
const KEY = "he:invite-token";

export function readToken(fromUrl?: string): string {
  if (fromUrl) {
    try { window.sessionStorage.setItem(KEY, fromUrl); } catch { /* private mode */ }
    return fromUrl;
  }
  if (typeof window === "undefined") return "";
  try {
    const params = new URLSearchParams(window.location.search);
    const queried = params.get("t");
    if (queried) {
      window.sessionStorage.setItem(KEY, queried);
      return queried;
    }
    return window.sessionStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}
