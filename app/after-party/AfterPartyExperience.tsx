"use client";

import { useEffect, useState } from "react";

type PartyDetails = {
  when: string;
  where: string;
  dress: string;
  entry: string;
};

export function AfterPartyExperience() {
  const [state, setState] = useState<"checking" | "unlocked" | "denied">(
    "checking",
  );
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState<PartyDetails | null>(null);
  const [returnHref, setReturnHref] = useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || "";
    const requestedReturn = params.get("returnTo") || "";
    const safeReturn = requestedReturn.startsWith("/i/")
      ? requestedReturn
      : token
        ? `/i/${encodeURIComponent(token)}`
        : "/";
    setReturnHref(params.get("preview") === "1" ? "/preview" : safeReturn);

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

    // The invitation itself is the key: the server verifies this token before
    // returning any private after-party detail.
    let cancelled = false;

    fetch("/api/after-party", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const result = (await response.json()) as {
          ok?: boolean;
          error?: string;
          details?: PartyDetails;
        };
        if (cancelled) return;
        if (response.ok && result.ok) {
          setDetails(result.details ?? null);
          setState("unlocked");
        } else {
          setMessage(
            result.error ||
              "This private part of the evening is not included in your invitation.",
          );
          setState("denied");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessage(
            "The after-party details could not open just now. Please try your invitation link once more.",
          );
          setState("denied");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "checking") {
    return (
      <main className="after-party-coda after-party-coda--state">
        <div className="after-party-coda__state-copy">
          <p className="after-party-coda__eyebrow">Elaine &amp; Haykal</p>
          <span className="after-party-coda__flourish" aria-hidden="true">
            ❦
          </span>
          <h1>Preparing the evening&hellip;</h1>
        </div>
      </main>
    );
  }

  if (state === "denied") {
    return (
      <main className="after-party-coda after-party-coda--state">
        <div className="after-party-coda__state-copy">
          <p className="after-party-coda__eyebrow">Elaine &amp; Haykal</p>
          <span className="after-party-coda__flourish" aria-hidden="true">
            ❦
          </span>
          <h1>This page is resting quietly.</h1>
          <p>{message}</p>
          <a className="after-party-coda__return" href={returnHref}>
            Return to the invitation <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="after-party-coda">
      <a className="after-party-coda__back" href={returnHref}>
        <span aria-hidden="true">&larr;</span> Invitation
      </a>

      <section
        className="after-party-coda__hero"
        aria-labelledby="after-party-title"
      >
        <div className="after-party-coda__hero-copy">
          <p className="after-party-coda__eyebrow">After the last dance</p>
          <h1 id="after-party-title" className="after-party-coda__title">
            <span>The night</span>
            <em>continues</em>
          </h1>
          <span className="after-party-coda__flourish" aria-hidden="true">
            ❦
          </span>
          <p className="after-party-coda__intro">
            One more glass, a little more music, and a little longer together.
          </p>
          <a
            className="after-party-coda__details-link"
            href="#after-party-details"
          >
            The details <span aria-hidden="true">&darr;</span>
          </a>
        </div>
      </section>

      <section
        id="after-party-details"
        className="after-party-coda__details"
        aria-labelledby="after-party-details-title"
      >
        <div className="after-party-coda__details-copy">
          <p className="after-party-coda__eyebrow">For invited guests</p>
          <h2 id="after-party-details-title">After hours</h2>
          <dl>
            <div>
              <dt>When</dt>
              <dd>{details?.when}</dd>
            </div>
            <div>
              <dt>Where</dt>
              <dd>{details?.where}</dd>
            </div>
            <div>
              <dt>To wear</dt>
              <dd>{details?.dress}</dd>
            </div>
            <div>
              <dt>At the door</dt>
              <dd>{details?.entry}</dd>
            </div>
          </dl>
          <p className="after-party-coda__privacy">
            Please keep these details with you; this part of the evening is
            invitation only.
          </p>
          <a className="after-party-coda__return" href={returnHref}>
            Return to the invitation <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </section>
    </main>
  );
}
