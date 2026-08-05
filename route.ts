"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * The painted world behind the whole site.
 *
 * Three fixed layers, one per painting, sitting behind every section. Any
 * element carrying `data-sky="dream-2"` claims a painting: the story chapters
 * on the landing page, and every scene of the invitation below it. On each
 * frame we measure how near each claimant is to the middle of the screen and
 * fade the matching painting in, so the world changes as a guest walks down
 * the page rather than jumping at section boundaries.
 *
 * Everything scrolls over the top; only opacity and a slow swell animate, so
 * this stays comfortable on iOS Safari.
 *
 * Each painting can also be a short film. If a matching .mp4 exists at
 * /wedding/story/videos/<name>.mp4 the layer plays it over the painting; if it
 * is missing, slow to arrive, or the guest prefers reduced motion, the
 * painting simply stays. The still is always underneath, so there is no state
 * in which a layer is blank.
 */

const SKIES = ["dream-1", "dream-2", "dream-3"] as const;
const asset = (name: string) => `/wedding/story/${name}`;
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const x = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return x * x * (3 - 2 * x);
};

export function Dreamscape({ onReady }: { onReady?: () => void } = {}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [motion, setMotion] = useState(true);
  const announced = useRef(false);

  // reduced motion means the paintings hold still — no video is even fetched
  // Parallax: the paintings move a fraction of the page's own scroll, which
  // reads as depth. One transform on one fixed layer, so it stays cheap.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = boxRef.current;
    if (!box) return;
    let frame = 0;
    const render = () => {
      frame = 0;
      box.style.setProperty("--parallax", `${Math.round(window.scrollY * -0.06)}px`);
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(render); };
    window.addEventListener("scroll", request, { passive: true });
    render();
    return () => {
      window.removeEventListener("scroll", request);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setMotion(!reduce.matches);
    apply();
    reduce.addEventListener("change", apply);
    return () => reduce.removeEventListener("change", apply);
  }, []);

  // whatever happens, the page is never held hostage to a video
  useEffect(() => {
    if (!motion) { announced.current = true; onReady?.(); return; }
    const timer = window.setTimeout(() => {
      if (!announced.current) { announced.current = true; onReady?.(); }
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [motion, onReady]);

  const filmReady = () => {
    if (announced.current) return;
    announced.current = true;
    onReady?.();
  };

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const layers = Array.from(box.querySelectorAll<HTMLElement>(".dream-sky"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let drift = 0;

    const render = () => {
      frame = 0;
      const height = Math.max(1, window.innerHeight);
      const middle = height / 2;

      // every claimant on the page, re-read each frame so sections that appear
      // as the guest answers questions are picked up without any wiring
      const claims = Array.from(document.querySelectorAll<HTMLElement>("[data-sky]"))
        .filter((node) => !node.classList.contains("dream-sky"));

      const wanted = new Map<string, number>();
      claims.forEach((node) => {
        if (node.offsetParent === null && node.getClientRects().length === 0) return;
        const rect = node.getBoundingClientRect();
        if (rect.height === 0) return;
        const centre = rect.top + rect.height / 2;
        const nearness = 1 - smoothstep(0, height * 0.92, Math.abs(centre - middle));
        const name = node.dataset.sky || "";
        wanted.set(name, Math.max(wanted.get(name) ?? 0, nearness));
      });

      let strongest = 0;
      layers.forEach((layer) => {
        const value = wanted.get(layer.dataset.sky || "") ?? 0;
        strongest = Math.max(strongest, value);
        layer.style.opacity = smoothstep(0.12, 0.62, value).toFixed(3);
      });
      // nothing nearby (a very tall section) — hold the first painting rather
      // than letting the page fall through to bare colour
      if (strongest < 0.05) layers.forEach((layer, index) => { layer.style.opacity = index === 0 ? "1" : "0"; });

      const doc = document.documentElement;
      const progress = clamp(window.scrollY / Math.max(1, doc.scrollHeight - height));
      drift += (progress - drift) * (reduce.matches ? 1 : 0.08);
      box.style.setProperty("--drift", drift.toFixed(4));

      if (Math.abs(progress - drift) > 0.0005) request();
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(render); };

    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request, { passive: true });
    reduce.addEventListener("change", request);
    // sections appear and disappear as the journey unlocks
    const observer = new MutationObserver(request);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class"] });
    render();

    return () => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      reduce.removeEventListener("change", request);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="dream-skies dream-skies--site" ref={boxRef} aria-hidden="true">
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
          {motion ? (
            <video
              className="dream-film"
              src={asset(`videos/${name}.mp4`)}
              poster={asset(`bg/${name}.webp`)}
              playsInline
              autoPlay
              loop
              muted
              preload={index === 0 ? "auto" : "metadata"}
              onCanPlayThrough={index === 0 ? filmReady : undefined}
              onLoadedData={index === 0 ? filmReady : undefined}
              onError={(event) => {
                // no film for this painting — leave the still showing
                (event.currentTarget as HTMLVideoElement).remove();
                if (index === 0) filmReady();
              }}
            />
          ) : null}
        </div>
      ))}
      <div className="dream-mist" />
    </div>
  );
}
