"use client";

/** One strong photograph closes the invitation without carousel UI. */
export function PhotoRail() {
  return (
    <figure className="photo-rail photo-reveal" aria-label="Elaine and Haykal">
      <img
        className="photo-reveal__portrait"
        src="/wedding/gallery/01.webp"
        alt="Elaine and Haykal"
        loading="lazy"
      />
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
    </figure>
  );
}
