"use client";

import { useEffect, useRef, useState } from "react";
import BubbleCursor from "../BubbleCursor";

const goTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
};

type PartyDetails = { when: string; where: string; dress: string; entry: string };

/*
 * THE DESCENT.
 *
 * One continuous fall from the wedding world into the night beneath it.
 * The page opens where the invitation left off — ivory, blush, composed —
 * and darkens by degrees as the guest scrolls: through a parted veil, past
 * the first poured glass, into a small hot room where the music is close.
 * Scroll is the clock; --party-progress carries the whole transformation
 * so palette, light and depth all move together instead of independently.
 *
 * The access logic is untouched: the personal token is verified against
 * the guest database exactly as before, and ?preview=1 shows placeholder
 * details only.
 */

export function AfterPartyExperience() {
  const [state, setState] = useState<"checking" | "unlocked" | "denied">("checking");
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState<PartyDetails | null>(null);
  const [active, setActive] = useState("door");
  const shellRef = useRef<HTMLElement | null>(null);

  // The invitation itself is the key: the personal token is verified against
  // the guest database on load. No password, nothing to remember.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Preview: the page opens on placeholder details so the design can be
    // reviewed end to end. The real when/where stays behind the guest key.
    if (params.get("preview") === "1") {
      setDetails({
        when: "After the final toast",
        where: "Revealed at the reception",
        dress: "Come exactly as you are",
        entry: "Give your name quietly at the door",
      });
      setState("unlocked");
      return;
    }
    const token = params.get("token") || "";
    let cancelled = false;
    fetch("/api/after-party", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const result = await response.json() as { ok?: boolean; error?: string; details?: PartyDetails };
        if (cancelled) return;
        if (response.ok && result.ok) {
          setDetails(result.details ?? null);
          setState("unlocked");
        } else {
          setMessage(result.error || "This private chapter is not included in your invitation.");
          setState("denied");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessage("The private chapter could not open just now. Please try your invitation link once more.");
          setState("denied");
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (state !== "unlocked") return;
    const scenes = Array.from(document.querySelectorAll<HTMLElement>("[data-party-scene]"));
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          setActive(entry.target.id);
        }
      }),
      { threshold: 0.35 },
    );
    scenes.forEach((scene) => observer.observe(scene));
    return () => observer.disconnect();
  }, [state]);

  // The descent engine: one rAF loop drives --party-progress (how deep into
  // the night the guest has scrolled, 0 to 1, with a little mass so it
  // settles rather than snaps) and the damped pointer vars behind the
  // parallax. CSS variables only — no React state per frame, no rerenders.
  useEffect(() => {
    if (state !== "unlocked") return;
    const shell = shellRef.current;
    if (!shell) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let progress = 0;
    let px = 0, py = 0, targetX = 0, targetY = 0;
    const render = () => {
      frame = 0;
      const depth = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const target = Math.min(1, Math.max(0, window.scrollY / depth));
      progress = reduced ? target : progress + (target - progress) * 0.12;
      px += (targetX - px) * 0.06;
      py += (targetY - py) * 0.06;
      shell.style.setProperty("--party-progress", progress.toFixed(4));
      if (!reduced) {
        shell.style.setProperty("--pp-x", px.toFixed(3));
        shell.style.setProperty("--pp-y", py.toFixed(3));
      }
      if (
        Math.abs(target - progress) > 0.001 ||
        Math.abs(targetX - px) > 0.002 ||
        Math.abs(targetY - py) > 0.002
      ) frame = requestAnimationFrame(render);
    };
    const wake = () => { if (!frame) frame = requestAnimationFrame(render); };
    const pointer = (event: PointerEvent) => {
      if (event.pointerType === "touch" || reduced) return;
      targetX = (event.clientX / window.innerWidth - 0.5) * 2;
      targetY = (event.clientY / window.innerHeight - 0.5) * 2;
      wake();
    };
    const sleep = () => { if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; } else wake(); };
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", wake);
    window.addEventListener("pointermove", pointer, { passive: true });
    document.addEventListener("visibilitychange", sleep);
    wake();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", wake);
      window.removeEventListener("pointermove", pointer);
      document.removeEventListener("visibilitychange", sleep);
    };
  }, [state]);

  if (state === "checking") {
    return (
      <main className="after-party">
        <section className="party-scene party-gate is-visible">
          <div className="party-stars" aria-hidden="true">✦　·　✧　·　✦</div>
          <div className="secret-card reveal">
            <p className="eyebrow">One moment</p>
            <span className="secret-key" aria-hidden="true">✦</span>
            <h1>Opening your<br />private chapter…</h1>
          </div>
        </section>
      </main>
    );
  }

  if (state === "denied") {
    return (
      <main className="after-party">
        <section className="party-scene party-gate is-visible">
          <div className="party-stars" aria-hidden="true">✦　·　✧　·　✦</div>
          <div className="secret-card reveal">
            <p className="eyebrow">Elaine &amp; Haykal</p>
            <span className="secret-key" aria-hidden="true">✦</span>
            <h1>This page is<br />resting quietly.</h1>
            <p className="secret-note">{message}</p>
            <a className="party-button" href="/">Return to the invitation</a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="after-party descent" ref={shellRef}>
      {/* The night, painted in three fixed layers that cross-fade as the
          guest descends. Opacity only — cheap on a phone GPU. */}
      <div className="descent-sky" aria-hidden="true">
        <i className="descent-sky-day" />
        <i className="descent-sky-dusk" />
        <i className="descent-sky-night" />
        <i className="descent-grain" />
      </div>

      <nav className="party-nav" aria-label="After party sections">
        {["door", "pour", "details"].map((id) => (
          <button
            key={id}
            type="button"
            className={active === id ? "is-active" : ""}
            onClick={() => goTo(id)}
            aria-label={`Go to ${id}`}
          />
        ))}
      </nav>

      {/* 1 — THE REMAINS OF THE WEDDING: still ivory, already quieter. */}
      <section id="remains" className="party-scene descent-scene descent-scene--remains is-visible" data-party-scene>
        <div className="descent-copy reveal">
          <p className="descent-line descent-line--serif">When the last dance is done…</p>
        </div>
      </section>

      {/* 2 — THE HIDDEN DOOR: a parted veil with darkness behind it. */}
      <section id="door" className="party-scene descent-scene descent-scene--door" data-party-scene>
        <div className="descent-veil" aria-hidden="true">
          <i className="descent-veil-left" />
          <i className="descent-veil-right" />
          <i className="descent-veil-dark" />
        </div>
        <div className="descent-copy reveal">
          <p className="descent-whisper">For invited guests</p>
          <h1 className="descent-title">The night<br />continues.</h1>
          <p className="descent-note">Your invitation is the key — it already opened this door.</p>
        </div>
      </section>

      {/* 3 — THE DESCENT: nearly empty, the world visibly turning. */}
      <section id="turning" className="party-scene descent-scene descent-scene--turning" data-party-scene>
        <div className="descent-copy reveal">
          <p className="descent-line">Leave the ballroom where it is.</p>
        </div>
      </section>

      {/* 4 — THE FIRST POUR: the threshold ritual. */}
      <section id="pour" className="party-scene descent-scene descent-scene--pour" data-party-scene>
        <div className="pour-figure reveal" aria-hidden="true">
          <svg viewBox="0 0 200 260" className="pour-glass">
            <defs>
              <clipPath id="coupe-bowl">
                <path d="M30 40 C30 40 34 92 100 92 C166 92 170 40 170 40 Z" />
              </clipPath>
            </defs>
            {/* liquid, rising with the scroll */}
            <g clipPath="url(#coupe-bowl)">
              <rect className="pour-liquid" x="20" y="40" width="160" height="60" />
              <ellipse className="pour-surface" cx="100" cy="0" rx="70" ry="4" />
            </g>
            {/* the coupe itself: one thin editorial line */}
            <path
              className="pour-line"
              d="M30 40 C30 40 34 92 100 92 C166 92 170 40 170 40 M100 92 L100 210 M62 216 C62 211 138 211 138 216"
            />
            {/* one caught reflection, the pearl of the night */}
            <circle className="pour-glint" cx="63" cy="56" r="2.4" />
          </svg>
        </div>
        <div className="descent-copy reveal">
          <h2 className="descent-title descent-title--pour">Now, we raise a glass.</h2>
        </div>
      </section>

      {/* 5 — QUIET DARKNESS: nothing, on purpose. */}
      <section id="dark" className="party-scene descent-scene descent-scene--dark" data-party-scene aria-hidden="true" />

      {/* 6 — THE WORLD LOOSENS: the same serif, enormous, cropping away. */}
      <section id="loosen" className="party-scene descent-scene descent-scene--loosen" data-party-scene>
        <div className="descent-copy reveal">
          <h2 className="descent-huge"><span>A little louder.</span><em>A little later.</em></h2>
        </div>
      </section>

      {/* 7 — THE SECRET BROADCAST: close to the music, close to us. */}
      <section id="broadcast" className="party-scene descent-scene descent-scene--broadcast" data-party-scene>
        <div className="descent-copy reveal">
          <p className="descent-live"><i aria-hidden="true" /> Private transmission</p>
          <p className="descent-line descent-line--broadcast">Close to the music.<br />Close to us.</p>
        </div>
      </section>

      {/* 8 — THE PRACTICAL: everything a night owl needs, in the dark. */}
      <section id="details" className="party-scene descent-scene descent-scene--details" data-party-scene>
        <div className="descent-copy reveal">
          <h2 className="descent-subtitle">One more round</h2>
          <dl className="descent-details">
            <div><dt>When</dt><dd>{details?.when}</dd></div>
            <div><dt>Where</dt><dd>{details?.where}</dd></div>
            <div><dt>To wear</dt><dd>{details?.dress}</dd></div>
            <div><dt>At the door</dt><dd>{details?.entry}</dd></div>
          </dl>
          <p className="descent-note">Kindly keep this page between us — the guest list is by invitation only, so please don&rsquo;t forward this link.</p>
        </div>
      </section>

      {/* 9 — THE ENDING: back out into the night air. */}
      <section id="finale" className="party-scene descent-scene descent-scene--finale" data-party-scene>
        <div className="descent-copy reveal">
          <p className="descent-whisper">Elaine &amp; Haykal</p>
          <h2 className="descent-title">See you on<br />the other side.</h2>
          <p className="descent-note">7 November 2026 · Kuala Lumpur</p>
          <a className="party-button" href="/">Back to the invitation</a>
        </div>
      </section>

      {/* the same bubble, a shade smokier after midnight */}
      <BubbleCursor
        zIndex={9998}
        fill="rgba(226, 168, 148, 0.35)"
        stroke="rgba(214, 140, 120, 0.6)"
      />
    </main>
  );
}
