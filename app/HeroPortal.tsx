"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { readToken } from "./invite-token";
import { beginMusic } from "./music";
import { thriftyConnection } from "./Dreamscape";
import { Butterflies } from "./Butterflies";
import BubbleCursor from "./BubbleCursor";

/**
 * The archway — the first thing anyone sees.
 *
 * A soft lilac wall with a tall arched window cut into it, the film playing
 * only inside the arch. The invitation token is caught quietly on arrival and
 * held; it travels onward when the guest steps through.
 *
 * Anyone without an invitation may look, but ENTER tells them the invitation
 * is personal rather than opening the door.
 */
export function HeroPortal() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [crossing, setCrossing] = useState(false);
  const [refused, setRefused] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => { setToken(readToken() || ""); }, []);

  // iPhones only autoplay a film they are certain is silent, and React does
  // not always write the muted attribute into the first HTML — so the film
  // arrived "unmuted", was refused, and a play badge appeared over the arch.
  // Mute it by hand, ask it to play, and ask once more on the first touch.
  useEffect(() => {
    const film = videoRef.current;
    if (!film) return;
    // On a metered or slow connection the poster painting stands alone rather
    // than pulling several megabytes of film through the arch.
    if (thriftyConnection()) { film.removeAttribute("src"); film.load(); return; }
    film.muted = true;
    film.defaultMuted = true;
    const start = () => { film.play().then(detach).catch(() => undefined); };
    const events = ["touchend", "click"] as const;
    const detach = () => events.forEach((name) => window.removeEventListener(name, start));
    start();
    events.forEach((name) => window.addEventListener(name, start, { passive: true }));
    return detach;
  }, []);

  const enter = () => {
    if (crossing) return;
    // The tap on ENTER is the one moment a browser lets sound begin — the
    // song starts here and carries on into the invitation.
    beginMusic();
    if (!token) { setRefused(true); return; }
    setCrossing(true);
    // straight to the invitation itself — the welcome was an empty scroll
    window.setTimeout(() => router.push(`/rsvp?t=${encodeURIComponent(token)}`), 1150);
  };

  return (
    <main className={`portal${crossing ? " is-crossing" : ""}`}>
      <div className="portal-arch">
        <video
          ref={videoRef}
          className="portal-film"
          src="/wedding/story/videos/dream-1.mp4"
          poster="/wedding/story/bg/dream-1.webp"
          playsInline
          autoPlay
          loop
          muted
          preload="auto"
          onError={(event) => { (event.currentTarget as HTMLVideoElement).style.display = "none"; }}
        />
        <div className="portal-words">
          <p className="portal-eyebrow">An invitation from</p>
          <h1>Elaine <span>&amp;</span> Haykal</h1>
          <p className="portal-place">Kuala Lumpur</p>
          <button type="button" className="portal-enter" onClick={enter}>Enter</button>
          {refused ? (
            <p className="portal-refused">
              This portal is reserved for invited guests. Please use the personalised link provided to you.
            </p>
          ) : null}
        </div>
      </div>
      <BubbleCursor zIndex={9998} />
      <Butterflies flying={crossing} />
    </main>
  );
}
