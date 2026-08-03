"use client";

import { useEffect, useRef, useState } from "react";

const TWIRL = "/wedding/story/twirl-scrub.mp4";
const POSTER = "/wedding/story/twirl-poster.webp";

/**
 * The twirl film, used twice.
 *
 * TwirlLoader covers the page while the first painting and the fonts arrive,
 * then dissolves. It never waits longer than a couple of seconds, so a slow
 * connection is a shorter wait rather than a locked door.
 *
 * TwirlDivider is the band between the story and the invitation — the couple
 * turning, once, as a guest crosses from one into the other.
 */

export function TwirlLoader() {
  const [gone, setGone] = useState(false);
  // Rendered only once JavaScript is running. If a script ever fails, the
  // visitor gets an ordinary scrollable page rather than a full-screen cover
  // with nothing behind it to dismiss it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let timer = 0;
    const finish = () => {
      window.clearTimeout(timer);
      // a beat, so the film is seen rather than glimpsed
      timer = window.setTimeout(() => setGone(true), 420);
    };
    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
    // never hold the page hostage to a slow asset
    const ceiling = window.setTimeout(() => setGone(true), 2600);
    return () => {
      window.removeEventListener("load", finish);
      window.clearTimeout(timer);
      window.clearTimeout(ceiling);
    };
  }, []);

  if (gone || !mounted) return null;
  return (
    <div className="twirl-loader" aria-hidden="true">
      <video src={TWIRL} poster={POSTER} autoPlay muted loop playsInline preload="auto" />
      <p>Elaine <span>&amp;</span> Haykal</p>
    </div>
  );
}

export function TwirlDivider() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // only turn while anyone can actually see it
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) void video.play().catch(() => undefined);
        else video.pause();
      });
    }, { threshold: 0.25 });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="twirl-divider" aria-hidden="true">
      <video ref={videoRef} src={TWIRL} poster={POSTER} muted loop playsInline preload="none" />
    </div>
  );
}
