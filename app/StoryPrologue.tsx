"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { defaultStoryConfig } from "../lib/story-config";

type PlaneCfg = {
  art?: string;
  video?: string;
  poster?: string;
  slot?: string;
  alt?: string;
  x: number;
  y: number;
  z?: number;
  w: number;
  float?: "slow" | "fast";
  flip?: boolean;
  blend?: string;
  opacity?: number;
};

type CaptionCfg = { x?: number; y?: number; size?: number };
type ChapterCfg = {
  id: string;
  cap?: CaptionCfg;
  kind?: "title" | "finale";
  blue?: boolean;
  border?: string;
  overline: string;
  heading: string;
  line?: string;
  finale?: { overline: string; heading: string; line: string; cta: string };
  planes: PlaneCfg[];
};

type StoryCfg = {
  version: number;
  depth: number;
  stations: { x: number; y: number }[];
  chapters: ChapterCfg[];
};

type WebkitAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

const asset = (name: string) => `/wedding/story/${name}`;
// A plane may name its artwork with or without a file extension, so a new
// sticker can simply be dropped into public/wedding/story/ as a .png, .webp
// or .jpg without anything here needing to change.
const artwork = (name: string) => asset(/\.[a-z0-9]+$/i.test(name) ? name : `${name}.webp`);
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, amount: number) => a + (b - a) * amount;
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const x = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return x * x * (3 - 2 * x);
};

/**
 * iOS-safe cinematic story.
 *
 * The previous version moved one enormous preserve-3d world thousands of
 * pixels through the camera. Mobile Safari can cull that transformed parent,
 * especially when it sits inside an overflow-clipped ancestor. This version
 * keeps the camera stationary and animates only the two chapters nearest the
 * viewport with translate/scale/opacity. It preserves the fly-through feeling
 * without crossing Safari's perspective plane or allocating dozens of GPU
 * layers at once.
 */
export function StoryPrologue({ guestName, onEnter }: { guestName?: string; onEnter: () => void }) {
  const [cfg, setCfg] = useState<StoryCfg>(defaultStoryConfig as unknown as StoryCfg);
  const [activeChapter, setActiveChapter] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const cueRef = useRef<HTMLParagraphElement | null>(null);
  const borderARef = useRef<HTMLDivElement | null>(null);
  const borderBRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/wedding/story/config.json", { cache: "no-cache" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.chapters) && data.chapters.length > 1) {
          setCfg(data as StoryCfg);
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const playPaperTap = useCallback(() => {
    try {
      const AudioContextCtor = window.AudioContext || (window as WebkitAudioWindow).webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = audioContextRef.current ?? new AudioContextCtor();
      audioContextRef.current = context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(540, now);
      oscillator.frequency.exponentialRampToValueAtTime(760, now + 0.08);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.022, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.11);
    } catch {
      // Sound feedback is decorative; navigation must never depend on it.
    }
  }, []);

  const goToChapter = useCallback((nextIndex: number) => {
    const track = trackRef.current;
    if (!track) return;
    const index = clamp(nextIndex, 0, Math.max(0, cfg.chapters.length - 1));
    const rect = track.getBoundingClientRect();
    const documentTop = window.scrollY + rect.top;
    const distance = Math.max(0, track.offsetHeight - window.innerHeight);
    const ratio = cfg.chapters.length > 1 ? index / (cfg.chapters.length - 1) : 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    playPaperTap();
    navigator.vibrate?.(8);
    window.scrollTo({ top: documentTop + distance * ratio, behavior: reduceMotion ? "auto" : "smooth" });
  }, [cfg.chapters.length, playPaperTap]);

  useEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    const world = worldRef.current;
    if (!track || !stage || !world) return;

    const chapterNodes = Array.from(world.querySelectorAll<HTMLElement>(".story-chapter"));
    const planeNodes = Array.from(world.querySelectorAll<HTMLElement>(".story-plane"));
    const videos = Array.from(world.querySelectorAll<HTMLVideoElement>("video[data-chapter]"));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(pointer: coarse)");

    let targetProgress = 0;
    let smoothProgress = 0;
    let targetPointerX = 0;
    let targetPointerY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let raf = 0;
    let lastChapter = -1;
    let borderShown: string | null | undefined;

    const readProgress = () => {
      const rect = track.getBoundingClientRect();
      const distance = Math.max(1, track.offsetHeight - window.innerHeight);
      return clamp(-rect.top / distance);
    };

    const setBorder = (name: string | null) => {
      if (borderShown === name) return;
      borderShown = name;
      const a = borderARef.current;
      const b = borderBRef.current;
      if (!a || !b) return;
      const visible = a.classList.contains("is-on") ? a : b;
      const hidden = visible === a ? b : a;
      if (name) {
        hidden.style.backgroundImage = `url("${asset(`bg/${name}.webp`)}")`;
        hidden.classList.add("is-on");
      }
      visible.classList.remove("is-on");
    };

    const render = () => {
      raf = 0;
      targetProgress = readProgress();
      const progressDamping = reduceMotion.matches ? 1 : coarsePointer.matches ? 0.24 : 0.14;
      const pointerDamping = reduceMotion.matches ? 1 : 0.12;
      smoothProgress = lerp(smoothProgress, targetProgress, progressDamping);
      pointerX = lerp(pointerX, targetPointerX, pointerDamping);
      pointerY = lerp(pointerY, targetPointerY, pointerDamping);
      if (Math.abs(smoothProgress - targetProgress) < 0.00008) smoothProgress = targetProgress;

      const chapterCount = cfg.chapters.length;
      const station = smoothProgress * Math.max(1, chapterCount - 1);
      const current = clamp(Math.round(station), 0, chapterCount - 1);
      const viewport = Math.max(520, window.innerHeight);

      stage.style.setProperty("--story-pointer-x", `${(pointerX * 11).toFixed(2)}px`);
      stage.style.setProperty("--story-pointer-y", `${(pointerY * 7).toFixed(2)}px`);
      stage.style.setProperty("--story-progress", smoothProgress.toFixed(5));

      if (current !== lastChapter) {
        lastChapter = current;
        setActiveChapter(current);
        const chapter = cfg.chapters[current];
        stage.dataset.storyChapter = chapter?.id ?? "title";
        stage.dataset.storyBlue = chapter?.blue ? "true" : "false";
        setBorder(chapter?.border ?? null);
      }

      chapterNodes.forEach((chapter, index) => {
        const delta = index - station;
        const distance = Math.abs(delta);
        const opacity = 1 - smoothstep(0.42, 1.02, distance);
        const scale = clamp(1 - delta * 0.14, 0.82, 1.17);
        const y = delta * viewport * 0.15;
        const stationOffset = cfg.stations[index] ?? { x: 0, y: 0 };
        const x = stationOffset.x * 0.055 + pointerX * (index === current ? 12 : 5);
        const tilt = reduceMotion.matches ? 0 : pointerX * (index === current ? 0.45 : 0.18);

        chapter.style.opacity = opacity.toFixed(3);
        chapter.style.visibility = distance > 1.15 ? "hidden" : "visible";
        chapter.style.pointerEvents = distance < 0.42 ? "auto" : "none";
        chapter.style.zIndex = String(30 - Math.round(distance * 10));
        chapter.style.transform = `translate3d(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${y.toFixed(2)}px), 0) scale(${scale.toFixed(4)}) rotate(${tilt.toFixed(3)}deg)`;
        chapter.classList.toggle("is-current", index === current);
        chapter.classList.toggle("is-near", distance < 1.05);
      });

      planeNodes.forEach((plane) => {
        const chapterIndex = Number(plane.dataset.chapter ?? 0);
        const delta = chapterIndex - station;
        if (Math.abs(delta) > 1.1) return;
        const depth = Number(plane.dataset.depth ?? 0);
        const baseScale = Number(plane.dataset.scale ?? 1);
        const foreground = clamp((depth + 300) / 600, 0, 1);
        const driftX = reduceMotion.matches ? 0 : pointerX * (4 + foreground * 14);
        const driftY = reduceMotion.matches ? 0 : pointerY * (3 + foreground * 9) - delta * depth * 0.018;
        const scrollScale = baseScale * (1 + (1 - Math.min(1, Math.abs(delta))) * foreground * 0.018);
        const flip = plane.dataset.flip === "true" ? -1 : 1;
        plane.style.transform = `translate3d(calc(-50% + ${driftX.toFixed(2)}px), calc(-50% + ${driftY.toFixed(2)}px), 0) scale(${(scrollScale * flip).toFixed(4)}, ${scrollScale.toFixed(4)})`;
      });

      videos.forEach((video) => {
        const chapterIndex = Number(video.dataset.chapter ?? 0);
        if (!Number.isFinite(video.duration) || video.duration <= 0 || Math.abs(chapterIndex - station) > 1.15) return;
        const local = clamp(station - (chapterIndex - 1));
        const target = local * Math.max(0, video.duration - 0.05);
        if (Math.abs((video.currentTime || 0) - target) > 0.035) {
          try { video.currentTime = target; } catch { /* metadata may not be ready yet */ }
        }
      });

      if (cueRef.current) cueRef.current.style.opacity = station < 0.28 ? String(1 - station / 0.28) : "0";

      const unsettled = Math.abs(smoothProgress - targetProgress) > 0.00008
        || Math.abs(pointerX - targetPointerX) > 0.001
        || Math.abs(pointerY - targetPointerY) > 0.001;
      if (unsettled) raf = requestAnimationFrame(render);
    };

    const requestRender = () => { if (!raf) raf = requestAnimationFrame(render); };
    const pointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      targetPointerX = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      targetPointerY = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
      requestRender();
    };
    const touchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      targetPointerX = clamp((touch.clientX / Math.max(1, window.innerWidth) - 0.5) * 1.1, -0.55, 0.55);
      targetPointerY = clamp((touch.clientY / Math.max(1, window.innerHeight) - 0.5) * 0.7, -0.35, 0.35);
      requestRender();
    };
    const resetPointer = () => {
      targetPointerX = 0;
      targetPointerY = 0;
      requestRender();
    };

    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", requestRender, { passive: true });
    window.addEventListener("pointermove", pointerMove, { passive: true });
    window.addEventListener("touchmove", touchMove, { passive: true });
    window.addEventListener("touchend", resetPointer, { passive: true });
    videos.forEach((video) => video.addEventListener("loadedmetadata", requestRender));
    reduceMotion.addEventListener("change", requestRender);
    coarsePointer.addEventListener("change", requestRender);
    render();

    return () => {
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", requestRender);
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("touchend", resetPointer);
      reduceMotion.removeEventListener("change", requestRender);
      coarsePointer.removeEventListener("change", requestRender);
      videos.forEach((video) => video.removeEventListener("loadedmetadata", requestRender));
      if (raf) cancelAnimationFrame(raf);
    };
  }, [cfg]);

  useEffect(() => () => {
    void audioContextRef.current?.close().catch(() => undefined);
  }, []);

  // Caption nudges and sizing, authored in Story Studio.
  const capStyle = (chapter: ChapterCfg): CSSProperties => ({
    "--cap-x": `${chapter.cap?.x ?? 0}%`,
    "--cap-y": `${chapter.cap?.y ?? 0}%`,
    "--cap-size": chapter.cap?.size ?? 1,
  } as CSSProperties);

  const renderTitleHeading = (heading: string) => {
    const parts = heading.split("&");
    if (parts.length !== 2) return <h1>{heading}</h1>;
    return <h1>{parts[0].trim()} <span>&amp;</span> {parts[1].trim()}</h1>;
  };

  const trackHeight = `${Math.max(700, cfg.chapters.length * 118)}svh`;
  const currentChapter = cfg.chapters[activeChapter];

  return (
    <div className="story-track" ref={trackRef} style={{ height: trackHeight }}>
      <div className="story-stage" ref={stageRef} data-story-chapter="title">
        <div className="story-border" ref={borderARef} aria-hidden="true" />
        <div className="story-border" ref={borderBRef} aria-hidden="true" />
        <div className="story-grain" aria-hidden="true" />
        <div className="story-world" ref={worldRef}>
          {cfg.chapters.map((chapter, chapterIndex) => (
            <section
              key={chapter.id}
              className="story-chapter"
              aria-label={chapter.kind === "title" ? "Our story begins" : `${chapter.overline}: ${chapter.heading}`}
            >
              {chapter.planes.map((plane, planeIndex) => {
                const baseScale = clamp(1 + (plane.z ?? 0) / 1000, 0.72, 1.14);
                const planeStyle = {
                  width: `${plane.w}%`,
                  left: `${50 + plane.x}%`,
                  top: `${50 + plane.y}%`,
                  opacity: plane.opacity,
                } as CSSProperties;
                return (
                  <div
                    key={`${chapter.id}-${planeIndex}`}
                    className={`story-plane${plane.float ? ` float float--${plane.float}` : ""}`}
                    data-chapter={chapterIndex}
                    data-depth={plane.z ?? 0}
                    data-scale={baseScale}
                    data-flip={plane.flip ? "true" : "false"}
                    style={planeStyle}
                  >
                    {plane.video ? (
                      <video
                        data-chapter={chapterIndex}
                        src={asset(plane.video)}
                        poster={plane.poster ? asset(plane.poster) : undefined}
                        muted
                        playsInline
                        preload="metadata"
                        style={plane.blend ? { mixBlendMode: plane.blend as CSSProperties["mixBlendMode"] } : undefined}
                      />
                    ) : plane.slot ? (
                      <div className="story-slot"><span>{plane.slot}</span></div>
                    ) : (
                      <img
                        src={artwork(plane.art as string)}
                        alt={plane.alt ?? ""}
                        aria-hidden={plane.alt ? undefined : true}
                        loading={chapterIndex > 1 ? "lazy" : "eager"}
                        decoding="async"
                        fetchPriority={chapterIndex === 0 && planeIndex < 2 ? "high" : "auto"}
                        style={plane.blend ? { mixBlendMode: plane.blend as CSSProperties["mixBlendMode"] } : undefined}
                      />
                    )}
                  </div>
                );
              })}

              {chapter.kind === "title" ? (
                <div className="story-title" style={capStyle(chapter)}>
                  <p className="overline">{chapter.overline}</p>
                  {renderTitleHeading(chapter.heading)}
                  <p className="line">
                    {guestName && guestName.toLowerCase() !== "guest"
                      ? `${chapter.line} — for ${guestName}`
                      : chapter.line}
                  </p>
                </div>
              ) : chapter.kind === "finale" ? null : (
                <div className={`story-caption${chapter.blue ? " story-caption--blue" : ""}`} style={capStyle(chapter)}>
                  <p className="overline">{chapter.overline}</p>
                  <h2>{chapter.heading}</h2>
                  {chapter.line ? <p className="line">{chapter.line}</p> : null}
                </div>
              )}

              {chapter.kind === "finale" && chapter.finale ? (
                <div className="story-finale" style={capStyle(chapter)}>
                  <p className="overline">{chapter.finale.overline}</p>
                  <h2>{chapter.finale.heading}</h2>
                  <p className="line">
                    {chapter.finale.line.split("\n").map((part, index) => (
                      <span key={part}>{index > 0 ? <br /> : null}{part}</span>
                    ))}
                  </p>
                  <button type="button" className="story-cta" onClick={() => { playPaperTap(); onEnter(); }}>
                    {chapter.finale.cta}
                  </button>
                </div>
              ) : null}
            </section>
          ))}
        </div>

        <p className="story-cue" ref={cueRef} aria-hidden="true"><i /> Scroll to turn the page</p>

        <div className="story-controls" aria-label="Our story chapter controls">
          <button type="button" onClick={() => goToChapter(activeChapter - 1)} disabled={activeChapter === 0} aria-label="Previous story chapter">←</button>
          <div>
            <small>{String(activeChapter + 1).padStart(2, "0")} / {String(cfg.chapters.length).padStart(2, "0")}</small>
            <strong>{currentChapter?.kind === "title" ? "Our story" : currentChapter?.overline.replace(/^Chapter\s+[^·]+·\s*/i, "")}</strong>
            <i aria-hidden="true" style={{ "--story-heart": `${((activeChapter + 1) / cfg.chapters.length) * 100}%` } as CSSProperties}><span style={{ width: `${((activeChapter + 1) / cfg.chapters.length) * 100}%` }} /></i>
          </div>
          <button type="button" onClick={() => goToChapter(activeChapter + 1)} disabled={activeChapter === cfg.chapters.length - 1} aria-label="Next story chapter">→</button>
        </div>
      </div>
    </div>
  );
}
