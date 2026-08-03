"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * The three paintings, behind the whole invitation.
 *
 * Every section on the site — the story chapters and the RSVP journey alike —
 * is tagged with a painting. As you scroll, whichever section is nearest the
 * middle of the screen decides which painting is showing, and the layers cross
 * fade between them. Sections that share a painting simply drift; crossing into
 * one that names a different painting changes the world.
 *
 * Story chapters carry their own `data-sky` from config.json. Any other section
 * is given one here, cycling through the three, so the walk keeps changing as a
 * guest moves down through the invitation.
 *
 * Nothing here uses a 3D world: it is three fixed images whose opacity and
 * scale change. That keeps iOS Safari comfortable no matter how long the page.
 */

const SKIES = ["dream-1", "dream-2", "dream-3"] as const;
const asset = (name: string) => `/wedding/story/${name}`;
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const x = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return x * x * (3 - 2 * x);
};

export function DreamBackdrop() {
  const skyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sky = skyRef.current;
    if (!sky) return;
    const layers = Array.from(sky.querySelectorAll<HTMLElement>(".dream-sky"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    let frame = 0;
    let drift = 0;
    let sections: HTMLElement[] = [];
    let lastCount = 0;

    // Sections come and go as the journey unlocks, so the list is refreshed
    // whenever its length changes rather than captured once.
    const collect = () => {
      sections = Array.from(document.querySelectorAll<HTMLElement>("[data-scene], .dream-chapter"))
        .filter((node) => node.offsetParent !== null || node.classList.contains("dream-chapter"));
      let cycle = 0;
      sections.forEach((node) => {
        if (node.dataset.sky) return;                       // a story chapter chose its own
        node.dataset.sky = SKIES[cycle % SKIES.length];
        cycle += 1;
      });
      lastCount = sections.length;
    };

    const render = () => {
      frame = 0;
      const middle = window.innerHeight / 2;
      const height = Math.max(1, window.innerHeight);
      if (document.querySelectorAll("[data-scene], .dream-chapter").length !== lastCount) collect();

      const wanted = new Map<string, number>();
      sections.forEach((node) => {
        const box = node.getBoundingClientRect();
        if (box.height === 0) return;
        const centre = box.top + box.height / 2;
        const nearness = 1 - smoothstep(0, height * 0.92, Math.abs(centre - middle));
        const name = node.dataset.sky || SKIES[0];
        wanted.set(name, Math.max(wanted.get(name) ?? 0, nearness));
      });

      // If nothing is near — a very tall section, say — hold the last painting
      // rather than fading to nothing.
      const strongest = Math.max(0, ...wanted.values());
      layers.forEach((layer) => {
        const value = wanted.get(layer.dataset.sky || "") ?? 0;
        const opacity = strongest < 0.05
          ? Number(layer.style.opacity || 0)
          : smoothstep(0.1, 0.6, value / Math.max(0.35, strongest));
        layer.style.opacity = Number(opacity).toFixed(3);
      });

      // the slow swell, measured across the whole page
      const scrollable = Math.max(1, document.documentElement.scrollHeight - height);
      const progress = clamp(window.scrollY / scrollable);
      drift += (progress - drift) * (reduce.matches ? 1 : 0.08);
      sky.style.setProperty("--drift", drift.toFixed(4));
      if (Math.abs(progress - drift) > 0.0005) requestRender();
    };
    const requestRender = () => { if (!frame) frame = requestAnimationFrame(render); };

    collect();
    render();
    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", () => { collect(); requestRender(); }, { passive: true });
    reduce.addEventListener("change", requestRender);
    const watcher = window.setInterval(() => {
      if (document.querySelectorAll("[data-scene], .dream-chapter").length !== lastCount) { collect(); requestRender(); }
    }, 900);
    return () => {
      window.removeEventListener("scroll", requestRender);
      reduce.removeEventListener("change", requestRender);
      window.clearInterval(watcher);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="dream-skies" ref={skyRef} aria-hidden="true">
      {SKIES.map((name, index) => (
        <div
          key={name}
          className="dream-sky"
          data-sky={name}
          style={{ "--layer": index, opacity: index === 0 ? 1 : 0 } as CSSProperties}
        >
          <picture>
            <source media="(max-width: 780px)" srcSet={asset(`bg/${name}-tall.webp`)} />
            <img src={asset(`bg/${name}.webp`)} alt="" loading={index === 0 ? "eager" : "lazy"} />
          </picture>
        </div>
      ))}
      <div className="dream-mist" />
    </div>
  );
}
