"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { readToken } from "./invite-token";
import { Butterflies } from "./Butterflies";

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

  const enter = () => {
    if (crossing) return;
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
      <Butterflies flying={crossing} />
    </main>
  );
}
