"use client";

import { FormEvent, useEffect, useState } from "react";

const goTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
};

export function AfterPartyExperience() {
  const [answer, setAnswer] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState("secret");
  const [token, setToken] = useState("");

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  useEffect(() => {
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
  }, [unlocked]);

  const unlock = async (event: FormEvent) => {
    event.preventDefault();
    setChecking(true);
    setError("");
    try {
      const response = await fetch("/api/after-party", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer, token }),
      });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        setError(result.error || "Not quite. Think of the little kick we put on everything.");
        return;
      }
      setUnlocked(true);
      window.setTimeout(() => goTo("midnight"), 100);
    } catch {
      setError("The secret door is being shy. Please try once more.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className={`after-party${unlocked ? " is-unlocked" : ""}`}>
      {unlocked ? (
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
      ) : null}

      <section id="secret" className="party-scene party-gate is-visible" data-party-scene>
        <img className="party-glass" src="/wedding/pearl-floral.png" alt="" aria-hidden="true" />
        <div className="party-stars" aria-hidden="true">✦　·　✧　·　✦</div>
        <form className="secret-card reveal" onSubmit={unlock}>
          <p className="eyebrow">For selected guests</p>
          <span className="secret-key" aria-hidden="true">✦</span>
          <h1>A little secret<br />for later…</h1>
          <label>
            <span>What’s our favourite spice?</span>
            <input
              type="password"
              value={answer}
              onChange={(event) => { setAnswer(event.target.value); setError(""); }}
              autoComplete="off"
              placeholder="Your answer"
              autoFocus
            />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="party-button" type="submit" disabled={checking || !answer.trim()}>
            {checking ? "Whispering…" : "Whisper the answer"}
          </button>
        </form>
      </section>

      {unlocked ? (
        <>
          <section id="midnight" className="party-scene party-scene--midnight" data-party-scene>
            <div className="party-moon" aria-hidden="true">☾</div>
            <div className="party-copy reveal">
              <p className="eyebrow">The night isn’t over</p>
              <h2>Meet us<br />after midnight.</h2>
              <p>A little louder. A little later. Strictly for our favourite night owls.</p>
              <button className="party-button" type="button" onClick={() => goTo("details")}>Follow the stars ↓</button>
            </div>
          </section>

          <section id="details" className="party-scene party-scene--details" data-party-scene>
            <img className="party-glass party-glass--details" src="/wedding/pearl-floral.png" alt="" loading="lazy" aria-hidden="true" />
            <div className="party-copy party-copy--card reveal">
              <p className="eyebrow">The secret chapter</p>
              <h2>One more round</h2>
              <div className="party-detail-list">
                <p><span>When</span><strong>After the final toast</strong></p>
                <p><span>Where</span><strong>Revealed at the reception</strong></p>
                <p><span>Mood</span><strong>Shimmer, mischief &amp; dancing</strong></p>
              </div>
              <p className="secret-note">Keep this page between us. The best stories begin quietly.</p>
              <button className="party-button" type="button" onClick={() => goTo("finale")}>I’m in ↓</button>
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
        </>
      ) : null}
    </main>
  );
}
