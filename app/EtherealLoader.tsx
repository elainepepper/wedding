"use client";

import { useEffect, useState } from "react";

/**
 * The loader that covers first paint.
 *
 * It waits for the first background film to be playable, then dissolves over
 * 1500ms. It never waits longer than the fallback, never blocks scrolling and
 * never renders on the server — if a script fails, a guest gets an ordinary
 * page rather than a cover with nothing behind it to remove it.
 */
export function EtherealLoader({ ready, fallbackMs = 4000 }: { ready?: boolean; fallbackMs?: number }) {
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // the film says it can play — or the fallback decides we have waited enough
  useEffect(() => {
    if (!mounted) return;
    const ceiling = window.setTimeout(() => setLeaving(true), fallbackMs);
    return () => window.clearTimeout(ceiling);
  }, [mounted, fallbackMs]);

  useEffect(() => { if (ready) setLeaving(true); }, [ready]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setGone(true), 1500);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  if (!mounted || gone) return null;
  return (
    <div className={`ethereal-loader${leaving ? " is-leaving" : ""}`} aria-hidden="true">
      <p>Haykal <span>&amp;</span> Elaine</p>
    </div>
  );
}
