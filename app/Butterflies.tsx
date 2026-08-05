"use client";

/**
 * Two butterflies that cross the screen once, as a guest steps through the
 * archway. They are hidden until that moment: the animation is what makes
 * them visible at all, so nothing shows on load.
 */
export function Butterflies({ flying }: { flying: boolean }) {
  return (
    <div className={`butterflies${flying ? " is-flying" : ""}`} aria-hidden="true">
      {[1, 2].map((n) => (
        <span className={`butterfly butterfly--${n}`} key={n}>
          <i>
            <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
              <path
                d="M12 12c-1.6-3.4-4-5.6-6.4-5.6C3.6 6.4 2.4 7.8 2.4 9.6c0 2.4 2.6 4.6 6 5.4-1.7.5-2.9 1.5-2.9 2.7 0 1 .8 1.7 1.9 1.7 1.8 0 3.5-1.7 4.6-4.3V12Z"
                fill="rgba(233, 168, 184, 0.55)"
                stroke="rgba(201, 120, 143, 0.5)"
                strokeWidth="0.6"
              />
              <path
                d="M12 12c1.6-3.4 4-5.6 6.4-5.6 2 0 3.2 1.4 3.2 3.2 0 2.4-2.6 4.6-6 5.4 1.7.5 2.9 1.5 2.9 2.7 0 1-.8 1.7-1.9 1.7-1.8 0-3.5-1.7-4.6-4.3V12Z"
                fill="rgba(244, 199, 209, 0.5)"
                stroke="rgba(201, 120, 143, 0.45)"
                strokeWidth="0.6"
              />
              <path d="M11.75 7.4h.5v9.4h-.5z" fill="rgba(201, 120, 143, 0.4)" />
            </svg>
          </i>
        </span>
      ))}
    </div>
  );
}
