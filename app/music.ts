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

export function musicElement(): HTMLAudioElement {
  if (!element) {
    element = document.createElement("audio");
    element.loop = true;
    element.preload = "auto";
    element.setAttribute("data-wedding-music", "");
    document.body.appendChild(element);
  }
  return element;
}

/** Start the song inside a guest's gesture. Safe to call more than once. */
export function beginMusic(src = "/wedding/music.mp3") {
  const player = musicElement();
  if (!player.src) player.src = new URL(src, window.location.origin).href;
  player.play().catch(() => undefined);
}
