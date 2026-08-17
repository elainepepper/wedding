"use client";

/**
 * One shared music player for the whole visit.
 *
 * Browsers only allow sound to begin inside a real tap or click. The tap on
 * ENTER at the front door is exactly that — so the song starts there, and
 * because this element lives outside any page component, it keeps playing
 * as the guest walks from the archway into the invitation.
 */

let element: HTMLAudioElement | null = null;
const WEDDING_MUSIC_VOLUME = 0.15;

export function musicElement(): HTMLAudioElement {
  if (!element) {
    element = document.createElement("audio");
    element.loop = true;
    element.preload = "auto";
    element.setAttribute("data-wedding-music", "");
    document.body.appendChild(element);
  }
  // The soundtrack should sit behind the invitation, never compete with it.
  // Re-apply this when the shared player is requested so older open tabs also
  // settle to the quieter level after a client-side navigation.
  element.volume = WEDDING_MUSIC_VOLUME;
  return element;
}

/** Start the song inside a guest's gesture. Safe to call more than once. */
export function beginMusic(src = "/wedding/music.mp3") {
  const player = musicElement();
  if (!player.src) player.src = new URL(src, window.location.origin).href;
  player.play().catch(() => undefined);
}
