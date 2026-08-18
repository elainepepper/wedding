"use client";

import { useEffect, useRef } from "react";
import { MotionEngine } from "./MotionEngine";

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const phase = (value: number, start: number, end: number) => {
  const progress = clamp((value - start) / Math.max(0.001, end - start));
  return progress * progress * (3 - 2 * progress);
};

type CinematicMotionProps = {
  confirmed: boolean;
};

/**
 * One lightweight motion conductor for the guest invitation.
 *
 * It writes damped pointer and scroll progress to CSS custom properties. The
 * React tree never rerenders on pointermove or scroll; scene CSS decides how
 * much (usually very little) each existing artwork layer may respond.
 */
export function CinematicMotion({ confirmed }: CinematicMotionProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const root = layer?.closest<HTMLElement>(".invitation-scroll");
    if (!layer || !root) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)");
    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let lastTime = performance.now();
    let trackedScenes: HTMLElement[] = [];

    const scanScenes = () =>
      Array.from(root.querySelectorAll<HTMLElement>("[data-cinematic]"));

    const render = (time = performance.now()) => {
      frame = 0;
      if (document.hidden) return;

      const elapsed = Math.max(1, Math.min(50, time - lastTime));
      lastTime = time;
      const alpha = reduceMotion.matches
        ? 1
        : 1 - Math.pow(0.9, elapsed / 16.667);
      currentX += (targetX - currentX) * alpha;
      currentY += (targetY - currentY) * alpha;

      root.style.setProperty("--motion-x", currentX.toFixed(4));
      root.style.setProperty("--motion-y", currentY.toFixed(4));
      // Existing manager-arranged decoration layers use these names.
      document.documentElement.style.setProperty(
        "--pointer-x",
        currentX.toFixed(4),
      );
      document.documentElement.style.setProperty(
        "--pointer-y",
        currentY.toFixed(4),
      );

      const viewport = Math.max(1, window.innerHeight);
      trackedScenes.forEach((scene) => {
        const rect = scene.getBoundingClientRect();
        const travel = clamp(
          (viewport - rect.top) / Math.max(1, viewport + rect.height),
        );
        const enter = clamp((viewport * 0.92 - rect.top) / (viewport * 0.72));
        const leave = clamp((viewport * 0.2 - rect.bottom) / (viewport * 0.72));
        const exit = clamp((viewport * 0.9 - rect.bottom) / (viewport * 0.7));
        scene.style.setProperty("--cinematic-progress", travel.toFixed(4));
        scene.style.setProperty("--cinematic-enter", enter.toFixed(4));
        scene.style.setProperty("--cinematic-leave", leave.toFixed(4));
        scene.style.setProperty("--cinematic-exit", exit.toFixed(4));
        const key = scene.dataset.cinematic;
        if (key) root.style.setProperty(`--${key}-progress`, enter.toFixed(4));

        if (key === "kl") {
          // The environmental journey starts before the guide typography and
          // relaxes again as the following chapter takes over.
          const journey =
            phase(enter, 0.04, 0.82) * (1 - phase(leave, 0.02, 0.78));
          const title = phase(enter, 0.58, 0.92);
          scene.style.setProperty("--kl-journey", journey.toFixed(4));
          scene.style.setProperty("--kl-title", title.toFixed(4));
          root.style.setProperty("--kl-journey", journey.toFixed(4));
        }

        if (key === "salon") {
          // A longer progress range lets the title hold while architecture
          // continues approaching around it, without scroll-jacking.
          const arrival = phase(
            (viewport * 0.92 - rect.top) / (viewport * 1.25),
            0,
            1,
          );
          scene.style.setProperty("--salon-arrival", arrival.toFixed(4));
        }

        if (key === "finale") {
          const stage = scene.querySelector<HTMLElement>(".photo-reveal-stage");
          const stageTop = stage?.getBoundingClientRect().top ?? rect.top;
          const reveal = phase(
            (viewport * 0.78 - stageTop) / (viewport * 0.58),
            0,
            1,
          );
          scene.style.setProperty("--finale-reveal", reveal.toFixed(4));
        }
      });

      if (
        Math.abs(targetX - currentX) > 0.001 ||
        Math.abs(targetY - currentY) > 0.001
      ) {
        frame = requestAnimationFrame(render);
      }
    };

    const requestRender = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!finePointer.matches || event.pointerType === "touch") return;
      targetX = clamp((event.clientX / window.innerWidth - 0.5) * 2, -1, 1);
      targetY = clamp((event.clientY / window.innerHeight - 0.5) * 2, -1, 1);
      requestRender();
    };

    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
      requestRender();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting)
            entry.target.classList.add("is-cinematically-visible");
        });
      },
      { rootMargin: "8% 0px -8%", threshold: 0.14 },
    );
    const observed = new WeakSet<HTMLElement>();
    const observeScenes = () => {
      trackedScenes = scanScenes();
      if (!trackedScenes.some((scene) => scene.dataset.cinematic === "kl"))
        root.style.setProperty("--kl-journey", "0");
      trackedScenes.forEach((scene) => {
        if (observed.has(scene)) return;
        observed.add(scene);
        observer.observe(scene);
      });
      requestRender();
    };
    observeScenes();
    const sceneChanges = new MutationObserver(observeScenes);
    sceneChanges.observe(root, { childList: true, subtree: true });

    const onVisibility = () => {
      if (document.hidden && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else if (!document.hidden) {
        lastTime = performance.now();
        requestRender();
      }
    };

    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", requestRender, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    reduceMotion.addEventListener("change", requestRender);
    finePointer.addEventListener("change", requestRender);
    requestRender();

    return () => {
      observer.disconnect();
      sceneChanges.disconnect();
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", requestRender);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      reduceMotion.removeEventListener("change", requestRender);
      finePointer.removeEventListener("change", requestRender);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!confirmed) return;
    const layer = layerRef.current;
    const root = layer?.closest<HTMLElement>(".invitation-scroll");
    if (!root) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    root.classList.add("is-confirmation-transition");
    const reveal = window.setTimeout(
      () => root.classList.add("is-confirmation-revealed"),
      reduced ? 40 : 900,
    );
    const clear = window.setTimeout(
      () => root.classList.remove("is-confirmation-transition"),
      reduced ? 180 : 1750,
    );
    return () => {
      window.clearTimeout(reveal);
      window.clearTimeout(clear);
      root.classList.remove(
        "is-confirmation-transition",
        "is-confirmation-revealed",
      );
    };
  }, [confirmed]);

  return (
    <div className="cinematic-overlays" ref={layerRef} aria-hidden="true">
      <div className="cinematic-veil" />
      <MotionEngine />
    </div>
  );
}
