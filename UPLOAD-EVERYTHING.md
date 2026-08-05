"use client";

/**
 * A sideways gallery of the two of you, swiped rather than scrolled.
 *
 * Snapping here is horizontal and confined to this rail — it never touches
 * the page's own vertical scrolling, which is the thing that caused trouble
 * on iOS before.
 *
 * Drop photos at /public/wedding/gallery/01.webp … 06.webp. Any slot without
 * a file shows a quiet placeholder rather than a broken image.
 */
const slots = [1, 2, 3, 4, 5, 6];

export function PhotoRail() {
  return (
    <div className="photo-rail" role="group" aria-label="Photographs">
      {slots.map((n) => {
        const file = `/wedding/gallery/0${n}.webp`;
        return (
          <figure key={n}>
            <img
              src={file}
              alt=""
              loading="lazy"
              onError={(event) => {
                const figure = event.currentTarget.parentElement;
                if (!figure) return;
                event.currentTarget.remove();
                const caption = document.createElement("figcaption");
                caption.textContent = "A photograph will live here";
                figure.appendChild(caption);
              }}
            />
          </figure>
        );
      })}
    </div>
  );
}
