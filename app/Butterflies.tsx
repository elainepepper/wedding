"use client";

/**
 * Two butterflies that cross the screen once, as a guest passes from the
 * portal into the invitation. They are decorative and never interactive.
 */
export function Butterflies({ flying }: { flying: boolean }) {
  return (
    <div className={`butterflies${flying ? " is-flying" : ""}`} aria-hidden="true">
      {[1, 2].map((n) => (
        <span className={`butterfly butterfly--${n}`} key={n}>
          <i>
            <svg viewBox="0 0 24 24" fill="currentColor" width="100%" height="100%">
              <path d="M12 12c-1.6-3.4-4-5.6-6.4-5.6C3.6 6.4 2.4 7.8 2.4 9.6c0 2.4 2.6 4.6 6 5.4-1.7.5-2.9 1.5-2.9 2.7 0 1 .8 1.7 1.9 1.7 1.8 0 3.5-1.7 4.6-4.3V12Z" />
              <path d="M12 12c1.6-3.4 4-5.6 6.4-5.6 2 0 3.2 1.4 3.2 3.2 0 2.4-2.6 4.6-6 5.4 1.7.5 2.9 1.5 2.9 2.7 0 1-.8 1.7-1.9 1.7-1.8 0-3.5-1.7-4.6-4.3V12Z" />
              <path d="M11.6 7.2h.8v10h-.8z" />
            </svg>
          </i>
        </span>
      ))}
    </div>
  );
}
