"use client";

import { useEffect, useRef } from "react";

const photographs = ["01", "02", "03", "04", "05", "06"];

/** An editorial contact strip: native swipe/trackpad scrolling, no widget UI. */
export function PhotoRail() {
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const frame = window.requestAnimationFrame(() => {
      const primary = rail.querySelector<HTMLElement>("[data-gallery-primary]");
      if (!primary) return;
      rail.scrollLeft =
        primary.offsetLeft - (rail.clientWidth - primary.clientWidth) / 2;
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="photo-reveal">
      <div
        ref={railRef}
        className="photo-rail"
        role="region"
        aria-label="Elaine and Haykal photographs"
        tabIndex={0}
      >
        <figure
          className="photo-rail__item photo-rail__item--bookend"
          aria-hidden="true"
        >
          <img src="/wedding/gallery/06.webp" alt="" loading="lazy" />
        </figure>
        {photographs.map((photo, index) => (
          <figure
            className="photo-rail__item"
            data-gallery-primary={index === 0 ? "true" : undefined}
            key={photo}
          >
            <img
              src={`/wedding/gallery/${photo}.webp`}
              alt={`Elaine and Haykal, photograph ${index + 1} of ${photographs.length}`}
              loading="lazy"
            />
          </figure>
        ))}
      </div>
      <img
        className="photo-reveal__foreground photo-reveal__foreground--left"
        src="/wedding/story/pearl-swag-left.webp"
        alt=""
        aria-hidden="true"
        loading="lazy"
      />
      <img
        className="photo-reveal__foreground photo-reveal__foreground--right"
        src="/wedding/story/pearl-swag-right.webp"
        alt=""
        aria-hidden="true"
        loading="lazy"
      />
    </div>
  );
}
