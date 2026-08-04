"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { Dreamscape } from "../Dreamscape";
import BubbleCursor from "../BubbleCursor";
import { SiteMenu } from "../SiteMenu";
import { EtherealLoader } from "../EtherealLoader";
import { Butterflies } from "../Butterflies";
import { useRouter } from "next/navigation";

/**
 * /welcome — the invitation itself, and nothing else.
 *
 * Four unhurried pages: a greeting, the invitation line, the date, the place.
 * Each is one screen tall; the words rise as a page arrives at the middle of
 * the screen and sink as it leaves, driven by a single distance measure. The
 * paintings behind them belong to <Dreamscape /> and change as guests walk
 * down. The RSVP lives at its own address, reached from the last page.
 */

type Panel = {
  id: string;
  sky: string;
  overline?: string;
  heading?: string;
  script?: string;
  lines?: string[];
};

const panels: Panel[] = [
  { id: "hello", sky: "dream-1", overline: "Elaine & Haykal", script: "Hello", heading: "", lines: ["7 November 2026 · Kuala Lumpur"] },
  {
    id: "invitation",
    sky: "dream-2",
    overline: "Together with our families",
    heading: "we invite you",
    lines: ["to celebrate our marriage", "at a reception in their honour"],
  },
  { id: "when", sky: "dream-3", overline: "The day", heading: "Saturday, 7 November 2026", lines: ["Doors from 6:00pm", "The celebration begins at 7:00pm"] },
  { id: "where", sky: "dream-1", overline: "The place", heading: "The Grand Salon", lines: ["Grand Hyatt Kuala Lumpur", "12 Jalan Pinang, 50450 Kuala Lumpur"] },
];

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const x = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return x * x * (3 - 2 * x);
};

export function WelcomeExperience() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [filmReady, setFilmReady] = useState(false);
  const [crossing, setCrossing] = useState(false);
  const router = useRouter();

  // the portal pushes into the world: the page zooms and softens while two
  // butterflies cross, then the RSVP takes over
  const enter = (event: ReactMouseEvent) => {
    event.preventDefault();
    if (crossing) return;
    setCrossing(true);
    window.setTimeout(() => router.push("/rsvp"), 1150);
  };

  useEffect(() => { setReady(true); }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const pages = Array.from(track.querySelectorAll<HTMLElement>(".welcome-page"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const render = () => {
      frame = 0;
      const height = Math.max(1, window.innerHeight);
      const middle = height / 2;
      pages.forEach((page) => {
        const box = page.getBoundingClientRect();
        const offset = (box.top + box.height / 2 - middle) / height;
        const presence = 1 - smoothstep(0, 0.92, Math.abs(offset));
        page.style.opacity = reduce.matches ? (presence > 0.5 ? "1" : "0") : presence.toFixed(3);
        page.style.setProperty("--rise", reduce.matches ? "0px" : `${(offset * height * 0.14).toFixed(1)}px`);
      });
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(render); };
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request, { passive: true });
    render();
    return () => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <main className={`welcome portal-sweep${crossing ? " is-sweeping" : ""}`}>
      <EtherealLoader ready={filmReady} />
      <Dreamscape onReady={() => setFilmReady(true)} />
      <SiteMenu links={[
        { href: "/welcome", label: "Welcome" },
        { href: "/rsvp", label: "RSVP" },
        { href: "/rsvp#recommendations", label: "Recommendations & FAQ" },
        { href: "/rsvp#confirmation", label: "Confirmation" },
      ]} />
      <Link className="fixed-rsvp" href="/rsvp" onClick={enter}>RSVP</Link>
      {ready ? <BubbleCursor zIndex={95} /> : null}
      <div className="welcome-track" ref={trackRef}>
        {panels.map((panel, index) => (
          <section key={panel.id} className="welcome-page" data-sky={panel.sky} data-scene id={panel.id}>
            <div className="welcome-words">
              {panel.overline ? <p className="overline">{panel.overline}</p> : null}
              {panel.script ? <p className="script">{panel.script}</p> : null}
              {panel.heading ? <h1>{panel.heading}</h1> : null}
              {panel.lines?.map((line) => <p className="line" key={line}>{line}</p>)}
              {index === panels.length - 1 ? (
                <Link className="welcome-cta" href="/rsvp" onClick={enter}>Enter</Link>
              ) : null}
            </div>
          </section>
        ))}
      </div>
      <p className="welcome-cue" aria-hidden="true"><i /> Scroll gently</p>
      <Butterflies flying={crossing} />
    </main>
  );
}
