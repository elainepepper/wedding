"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Lenis from "lenis";

const FORM_SCENES = ["#rsvp", "#dress", "#meal", "#travel", "#wishes"];
const DISSOLVE_ITEMS = [
  ".choice-card",
  ".party-rsvp-list fieldset",
  ".guest-meal-list fieldset",
  ".meal-option",
  ".hotel-list > li",
  ".editorial-guide__section",
  ".arrival-grid article",
  ".evening-recap article",
].join(",");

const cinematicEase = (value: number) =>
  1 - Math.pow(1 - Math.min(1, Math.max(0, value)), 4);

/**
 * An intentionally isolated motion adapter.
 *
 * It does not own markup, form state, navigation, or persistence. GSAP and
 * Lenis only observe the existing invitation DOM and write motion-specific
 * CSS custom properties/classes that disappear again on cleanup.
 */
export function MotionEngine() {
  const hookRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const hook = hookRef.current;
    const root = hook?.closest<HTMLElement>(".invitation-scroll");
    if (!hook || !root) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;

    // iOS/Android already provide weighted, momentum-based touch scrolling.
    // Running Lenis and ScrollTrigger beside native touch scrolling adds a
    // second scroll coordinator and can make a newly revealed RSVP chapter
    // jump as measurements refresh. It also keeps an unnecessary RAF loop
    // alive throughout a long, video-backed invitation. Keep the approved
    // motion engine for precise pointers, and let phones use their native,
    // considerably more memory-efficient scrolling.
    if (window.matchMedia("(pointer: coarse), (max-width: 900px)").matches)
      return;

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      duration: 1.4,
      easing: cinematicEase,
      smoothWheel: true,
      syncTouch: false,
      touchMultiplier: 1,
      wheelMultiplier: 0.86,
      anchors: false,
    });

    const onLenisScroll = () => ScrollTrigger.update();
    const onAnimationFrame = (time: number) => lenis.raf(time * 1000);
    lenis.on("scroll", onLenisScroll);
    gsap.ticker.add(onAnimationFrame);
    gsap.ticker.lagSmoothing(0);

    root.classList.add("is-motion-engine-ready");

    const animatedItems = new WeakSet<HTMLElement>();
    let mutations: MutationObserver | null = null;
    const context = gsap.context(() => {
      // One continuous forward camera movement. The fixed MP4/still layers
      // keep their own crossfades; this only adds a 1.00 -> 1.14 scale.
      gsap.fromTo(
        root,
        { "--motion-camera-scale": 1 },
        {
          "--motion-camera-scale": 1.14,
          ease: "none",
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: "bottom bottom",
            scrub: 1.4,
            invalidateOnRefresh: true,
          },
        },
      );

      const registerDissolves = () => {
        const items = Array.from(
          root.querySelectorAll<HTMLElement>(DISSOLVE_ITEMS),
        ).filter((item) => !animatedItems.has(item));

        items.forEach((item, index) => {
          animatedItems.add(item);
          item.classList.add("motion-dissolve-card");
          gsap.fromTo(
            item,
            {
              "--motion-card-y": `${22 + (index % 3) * 4}px`,
              "--motion-card-blur": "8px",
              "--motion-card-opacity": 0.12,
            },
            {
              "--motion-card-y": "0px",
              "--motion-card-blur": "0px",
              "--motion-card-opacity": 1,
              duration: 0.9,
              delay: (index % 3) * 0.07,
              ease: "power2.out",
              scrollTrigger: {
                trigger: item,
                start: "top 91%",
                toggleActions: "play none none reverse",
              },
            },
          );
        });
      };

      registerDissolves();

      // Beaded/divider accents catch light only as they cross the viewport.
      root
        .querySelectorAll<HTMLElement>(
          ".ribbon-divider, .wax-seal, .confirmation-pearls",
        )
        .forEach((accent) => {
          accent.classList.add("motion-shimmer-accent");
          gsap.fromTo(
            accent,
            {
              filter:
                "brightness(0.96) drop-shadow(0 0 1px rgba(255, 244, 232, 0))",
            },
            {
              filter:
                "brightness(1.08) drop-shadow(0 0 5px rgba(255, 244, 232, 0.24))",
              ease: "none",
              scrollTrigger: {
                trigger: accent,
                start: "top 88%",
                end: "bottom 28%",
                scrub: 1.1,
              },
            },
          );
        });

      mutations = new MutationObserver(() => {
        registerDissolves();
        ScrollTrigger.refresh();
      });
      mutations.observe(root, { childList: true, subtree: true });
    }, root);

    // Hybrid snap: after natural scrolling settles, only nudge an RSVP scene
    // when it is already very close to its resting axis. Inputs/date pickers
    // and native touch gestures are never captured or transformed.
    let snapTimer = 0;
    let snapping = false;
    const settleFormScene = () => {
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(() => {
        if (snapping || document.hidden) return;
        const active = document.activeElement;
        if (
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          active instanceof HTMLSelectElement ||
          active instanceof HTMLButtonElement
        )
          return;

        const topInset = Math.max(64, window.innerHeight * 0.08);
        const threshold = Math.min(112, window.innerHeight * 0.14);
        const candidates = FORM_SCENES.map((selector) =>
          root.querySelector<HTMLElement>(selector),
        ).filter((scene): scene is HTMLElement => Boolean(scene));

        const closest = candidates
          .map((scene) => ({
            scene,
            delta: scene.getBoundingClientRect().top - topInset,
          }))
          .filter(
            ({ scene }) => scene.getBoundingClientRect().bottom > topInset,
          )
          .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];

        if (!closest || Math.abs(closest.delta) > threshold) return;
        snapping = true;
        lenis.scrollTo(closest.scene, {
          offset: -topInset,
          duration: 0.62,
          easing: cinematicEase,
          onComplete: () => {
            snapping = false;
          },
        });
      }, 190);
    };

    lenis.on("scroll", settleFormScene);
    const onResize = () => ScrollTrigger.refresh();
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      window.clearTimeout(snapTimer);
      window.removeEventListener("resize", onResize);
      lenis.off("scroll", settleFormScene);
      lenis.off("scroll", onLenisScroll);
      gsap.ticker.remove(onAnimationFrame);
      gsap.ticker.lagSmoothing(500, 33);
      mutations?.disconnect();
      context.revert();
      ScrollTrigger.getAll().forEach((trigger) => {
        if (root.contains(trigger.trigger as Node | null)) trigger.kill();
      });
      lenis.destroy();
      root.classList.remove("is-motion-engine-ready");
      root.style.removeProperty("--motion-camera-scale");
    };
  }, []);

  return <span ref={hookRef} hidden aria-hidden="true" />;
}
