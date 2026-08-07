"use client";

import { useEffect, useState } from "react";
import { removeBrokenImage } from "../image-fallback";

const goTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
};

type PartyDetails = { when: string; where: string; dress: string; entry: string };

export function AfterPartyExperience() {
  const [state, setState] = useState<"checking" | "unlocked" | "denied">("checking");
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState<PartyDetails | null>(null);
  const [active, setActive] = useState("midnight");

  // The invitation itself is the key: the personal token is verified against
  // the guest database on load. No password, nothing to remember.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
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
      { threshold: 0.5 },
    );
    scenes.forEach((scene) => observer.observe(scene));
    return () => observer.disconnect();
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
    <main className="after-party is-unlocked">
      <nav className="party-nav" aria-label="After party sections">
        {["midnight", "details", "finale"].map((id) => (
          <button
            key={id}
            type="button"
            className={active === id ? "is-active" : ""}
            onClick={() => goTo(id)}
            aria-label={`Go to ${id}`}
          />
        ))}
      </nav>

      <section id="midnight" className="party-scene party-scene--midnight is-visible" data-party-scene>
        <div className="party-moon" aria-hidden="true">☾</div>
        <div className="party-copy reveal">
          <p className="eyebrow">For your eyes only</p>
          <h2>The celebration<br />continues.</h2>
          <p>A little louder. A little later. Strictly for our favourite night owls — and your invitation is the key.</p>
          <button className="party-button" type="button" onClick={() => goTo("details")}>Follow the stars ↓</button>
        </div>
      </section>

      <section id="details" className="party-scene party-scene--details" data-party-scene>
        <img className="party-glass party-glass--details" src="/wedding/pearl-floral.webp" alt="" loading="lazy" aria-hidden="true" onError={removeBrokenImage} />
        <div className="party-copy party-copy--card reveal">
          <p className="eyebrow">The private chapter</p>
          <h2>One more round</h2>
          <div className="party-detail-list">
            <p><span>When</span><strong>{details?.when}</strong></p>
            <p><span>Where</span><strong>{details?.where}</strong></p>
            <p><span>To wear</span><strong>{details?.dress}</strong></p>
            <p><span>At the door</span><strong>{details?.entry}</strong></p>
          </div>
          <p className="secret-note">Kindly keep this page between us — the guest list is by invitation only, so please don&rsquo;t forward this link.</p>
          <button className="party-button" type="button" onClick={() => goTo("finale")}>I&rsquo;m in ↓</button>
        </div>
      </section>

      <section id="finale" className="party-scene party-scene--finale" data-party-scene>
        <div className="party-fireworks" aria-hidden="true">
          <i>✦</i><i>✧</i><i>✦</i><i>✧</i><i>✦</i>
        </div>
        <div className="party-copy reveal">
          <p className="eyebrow">Elaine &amp; Haykal</p>
          <h2>See you on<br />the other side.</h2>
          <p>7 November 2026 · Kuala Lumpur</p>
          <a className="party-button" href="/">Back to the invitation</a>
        </div>
      </section>
    </main>
  );
}
