"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { defaultStoryConfig } from "../lib/story-config";

/**
 * The landing page — a walk through three painted dreamscapes.
 *
 * HOW THE SCROLL WORKS
 * --------------------
 * Each chapter is one full screen tall and carries `scroll-snap-align`, so the
 * page settles gently on a chapter rather than stopping halfway between two.
 * Snapping is set to "proximity", never "mandatory": a guest who wants to fly
 * past can, and the rest of the invitation below scrolls quite normally.
 *
 * The paintings are NOT inside those sections. They are a fixed stack behind
 * everything, one layer per painting. On every frame we work out which chapter
 * is nearest the middle of the screen, and fade the matching layer in while the
 * others fade out. Because a painting is reused by several chapters, walking
 * from Kuching to George Town changes the picture, while walking within one
 * dreamscape simply drifts — which is what makes it feel like moving through
 * rooms rather than flicking through slides.
 *
 * Each layer also drifts and swells very slightly with scroll (a slow Ken
 * Burns), so a still painting breathes.
 *
 * The words fade up as their chapter approaches the middle and sink away after
 * it, driven by that same distance measure. Accent stickers from the couple's
 * own pack float at their own speeds for depth.
 *
 * TO EDIT THE WORDS: they live in public/wedding/story/config.json — each
 * chapter has `overline`, `heading` and `line`, plus `bg` naming which painting
 * it stands in ("dream-1", "dream-2" or "dream-3"). Edit that file, or arrange
 * it visually in Story-Studio.html and download a fresh copy. The site reads it
 * at runtime and falls back to lib/story-config.ts if it cannot be fetched.
 */

type PlaneCfg = {
  art?: string;
  video?: string;
  poster?: string;
  alt?: string;
  x: number; y: number; z?: number; w: number;
  float?: "slow" | "fast";
  flip?: boolean;
  blend?: string;
  opacity?: number;
};
type CaptionCfg = { x?: number; y?: number; size?: number };
type ChapterCfg = {
  id: string;
  kind?: "title" | "finale";
  blue?: boolean;
  bg?: string;
  cap?: CaptionCfg;
  overline: string;
  heading: string;
  line?: string;
  finale?: { overline: string; heading: string; line: string; cta: string };
  planes: PlaneCfg[];
};
type StoryCfg = { version: number; chapters: ChapterCfg[] };

const asset = (name: string) => `/wedding/story/${name}`;
const artwork = (name: string) => asset(/\.[a-z0-9]+$/i.test(name) ? name : `${name}.webp`);
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const x = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return x * x * (3 - 2 * x);
};

export function StoryPrologue({ guestName, onEnter }: { guestName?: string; onEnter: () => void }) {
  const [cfg, setCfg] = useState<StoryCfg>(defaultStoryConfig as unknown as StoryCfg);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const skyRef = useRef<HTMLDivElement | null>(null);
  const cueRef = useRef<HTMLParagraphElement | null>(null);
  const dotsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/wedding/story/config.json", { cache: "no-cache" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.chapters) && data.chapters.length) setCfg(data as StoryCfg);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // the distinct paintings, in the order they first appear
  const skies = Array.from(new Set(cfg.chapters.map((chapter) => chapter.bg ?? "dream-1")));

  useEffect(() => {
    const track = trackRef.current;
    const sky = skyRef.current;
    if (!track || !sky) return;

    const chapterNodes = Array.from(track.querySelectorAll<HTMLElement>(".dream-chapter"));
    const skyNodes = Array.from(sky.querySelectorAll<HTMLElement>(".dream-sky"));
    const videos = Array.from(track.querySelectorAll<HTMLVideoElement>("video[data-chapter]"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    let frame = 0;
    let drift = 0;
    let lastCurrent = -1;

    const render = () => {
      frame = 0;
      const middle = window.innerHeight / 2;
      const height = Math.max(1, window.innerHeight);

      // how close each chapter is to the middle of the screen, 1 = dead centre
      const nearness = chapterNodes.map((node) => {
        const box = node.getBoundingClientRect();
        const centre = box.top + box.height / 2;
        return 1 - smoothstep(0, height * 0.92, Math.abs(centre - middle));
      });

      let current = 0;
      nearness.forEach((value, index) => { if (value > nearness[current]) current = index; });

      // the words rise as their chapter arrives and sink once it leaves
      chapterNodes.forEach((node, index) => {
        const box = node.getBoundingClientRect();
        const centre = box.top + box.height / 2;
        const offset = (centre - middle) / height;      // -1 above, +1 below
        const presence = nearness[index];
        node.style.opacity = reduce.matches ? (presence > 0.55 ? "1" : "0") : presence.toFixed(3);
        node.style.setProperty("--rise", reduce.matches ? "0px" : `${(offset * height * 0.16).toFixed(1)}px`);
        node.style.setProperty("--near", presence.toFixed(3));
        node.style.pointerEvents = presence > 0.6 ? "auto" : "none";
      });

      // each painting shows while any of its chapters is near
      const wanted = new Map<string, number>();
      chapterNodes.forEach((node, index) => {
        const name = node.dataset.sky || "";
        wanted.set(name, Math.max(wanted.get(name) ?? 0, nearness[index]));
      });
      skyNodes.forEach((node) => {
        const value = wanted.get(node.dataset.sky || "") ?? 0;
        // a gentle curve so two paintings never both sit at half strength
        node.style.opacity = smoothstep(0.12, 0.62, value).toFixed(3);
      });

      // the slow swell, shared by every layer
      const trackBox = track.getBoundingClientRect();
      const progress = clamp(-trackBox.top / Math.max(1, trackBox.height - height));
      drift += (progress - drift) * (reduce.matches ? 1 : 0.08);
      sky.style.setProperty("--drift", drift.toFixed(4));

      videos.forEach((video) => {
        if (!isFinite(video.duration) || video.duration <= 0) return;
        const index = Number(video.dataset.chapter);
        const value = nearness[index] ?? 0;
        const target = value * Math.max(0, video.duration - 0.05);
        if (Math.abs((video.currentTime || 0) - target) > 0.04) {
          try { video.currentTime = target; } catch {}
        }
      });

      if (current !== lastCurrent) {
        lastCurrent = current;
        dotsRef.current?.querySelectorAll("i").forEach((dot, index) => dot.classList.toggle("is-on", index === current));
      }
      if (cueRef.current) cueRef.current.style.opacity = nearness[0] > 0.75 ? "1" : "0";
      if (Math.abs(progress - drift) > 0.0005) requestRender();
    };
    const requestRender = () => { if (!frame) frame = requestAnimationFrame(render); };

    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", requestRender, { passive: true });
    videos.forEach((video) => video.addEventListener("loadedmetadata", requestRender));
    reduce.addEventListener("change", requestRender);
    render();
    return () => {
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", requestRender);
      reduce.removeEventListener("change", requestRender);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [cfg]);

  const capStyle = (chapter: ChapterCfg): CSSProperties => ({
    "--cap-x": `${chapter.cap?.x ?? 0}%`,
    "--cap-y": `${chapter.cap?.y ?? 0}%`,
    "--cap-size": chapter.cap?.size ?? 1,
  } as CSSProperties);

  const renderNames = (heading: string) => {
    const parts = heading.split("&");
    if (parts.length !== 2) return <h1>{heading}</h1>;
    return <h1>{parts[0].trim()}<span>&amp;</span>{parts[1].trim()}</h1>;
  };

  return (
    <div className="dream" ref={trackRef}>
      {/* the paintings: one fixed layer each, cross-fading as chapters pass */}
      <div className="dream-skies" ref={skyRef} aria-hidden="true">
        {skies.map((name, index) => (
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

      <div className="dream-dots" ref={dotsRef} aria-hidden="true">
        {cfg.chapters.map((chapter) => <i key={chapter.id} />)}
      </div>
      <p className="dream-cue" ref={cueRef} aria-hidden="true"><i /> Scroll gently</p>

      {cfg.chapters.map((chapter, index) => (
        <section
          key={chapter.id}
          className={`dream-chapter${chapter.kind ? ` dream-chapter--${chapter.kind}` : ""}${chapter.blue ? " is-blue" : ""}`}
          data-sky={chapter.bg ?? "dream-1"}
          aria-label={chapter.kind === "title" ? "Our story begins" : `${chapter.overline}: ${chapter.heading}`}
        >
          {chapter.planes?.map((plane, planeIndex) => (
            <div
              key={planeIndex}
              className={`dream-accent${plane.float ? ` float float--${plane.float}` : ""}`}
              style={{
                width: `${plane.w}%`,
                left: `${50 + plane.x}%`,
                top: `${50 + plane.y}%`,
                opacity: plane.opacity,
                "--depth": plane.z ?? 0,
              } as CSSProperties}
            >
              {plane.video ? (
                <video
                  data-chapter={index}
                  src={asset(plane.video)}
                  poster={plane.poster ? asset(plane.poster) : undefined}
                  muted
                  playsInline
                  preload="metadata"
                  style={plane.blend ? { mixBlendMode: plane.blend as never } : undefined}
                />
              ) : (
                <img
                  src={artwork(plane.art as string)}
                  alt={plane.alt ?? ""}
                  aria-hidden={plane.alt ? undefined : true}
                  loading={index > 1 ? "lazy" : undefined}
                  style={{
                    ...(plane.blend ? { mixBlendMode: plane.blend as never } : null),
                    ...(plane.flip ? { transform: "scaleX(-1)" } : null),
                  }}
                />
              )}
            </div>
          ))}

          <div className="dream-words" style={capStyle(chapter)}>
            {chapter.kind === "title" ? (
              <>
                <p className="overline">{chapter.overline}</p>
                {renderNames(chapter.heading)}
                <p className="line">
                  {guestName && guestName !== "guest" ? `${chapter.line} — for ${guestName}` : chapter.line}
                </p>
              </>
            ) : (
              <>
                <p className="overline">{chapter.overline}</p>
                <h2>{chapter.heading}</h2>
                {chapter.line ? <p className="line">{chapter.line}</p> : null}
              </>
            )}

            {chapter.kind === "finale" && chapter.finale ? (
              <div className="dream-invite">
                <p className="overline">{chapter.finale.overline}</p>
                <p className="date">{chapter.finale.heading}</p>
                <p className="line">
                  {chapter.finale.line.split("\n").map((part, i) => (
                    <span key={i}>{i > 0 ? <br /> : null}{part}</span>
                  ))}
                </p>
                <button type="button" className="dream-cta" onClick={onEnter}>{chapter.finale.cta}</button>
              </div>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
