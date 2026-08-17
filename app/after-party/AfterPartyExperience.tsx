"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { musicElement } from "../music";

type PartyGuest = {
  id: number;
  name: string;
  attending: "Yes" | "No" | "Pending";
};
type PartySettings = {
  deadline: string;
  musicUrl: string | null;
  location:
    | { revealed: false }
    | {
        revealed: true;
        venue: string;
        address: string | null;
        transportNote: string | null;
      };
};

const previewGuests: PartyGuest[] = [
  { id: -1, name: "Your name", attending: "Pending" },
];
const deadlineLabel = (value: string | undefined) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "15 October 2026";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
};

export function AfterPartyExperience() {
  const [state, setState] = useState<"checking" | "door" | "inside" | "denied">(
    "checking",
  );
  const [guests, setGuests] = useState<PartyGuest[]>([]);
  const [settings, setSettings] = useState<PartySettings | null>(null);
  const [responses, setResponses] = useState<Record<number, "Yes" | "No">>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [returnHref, setReturnHref] = useState("/");
  const [token, setToken] = useState("");
  const [entering, setEntering] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const preview = useMemo(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("preview") === "1",
    [],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextToken = params.get("token")?.trim() || "";
    const requestedReturn = params.get("returnTo") || "";
    setToken(nextToken);
    setReturnHref(
      params.get("preview") === "1"
        ? "/preview"
        : requestedReturn.startsWith("/i/")
          ? requestedReturn
          : nextToken
            ? `/i/${encodeURIComponent(nextToken)}`
            : "/",
    );
    if (params.get("preview") === "1") {
      setGuests(previewGuests);
      setSettings({
        deadline: "2026-10-15",
        musicUrl: null,
        location: { revealed: false },
      });
      setState("door");
      return;
    }

    let cancelled = false;
    fetch("/api/after-party", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: nextToken }),
    })
      .then(async (response) => {
        const result = (await response.json()) as {
          ok?: boolean;
          guests?: PartyGuest[];
          settings?: PartySettings;
        };
        if (cancelled) return;
        if (!response.ok || !result.ok || !result.guests?.length) {
          setState("denied");
          return;
        }
        setGuests(result.guests);
        setSettings(result.settings ?? null);
        setResponses(
          result.guests.reduce<Record<number, "Yes" | "No">>(
            (current, guest) => {
              if (guest.attending === "Yes" || guest.attending === "No")
                current[guest.id] = guest.attending;
              return current;
            },
            {},
          ),
        );
        setState("door");
      })
      .catch(() => {
        if (!cancelled) setState("denied");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enter = () => {
    if (entering) return;
    setEntering(true);
    if (settings?.musicUrl) {
      const audio = musicElement();
      const wanted = new URL(settings.musicUrl, window.location.origin).href;
      if (audio.src !== wanted) audio.src = wanted;
      audio.volume = 0.18;
      audio.loop = true;
      audio.play().catch(() => undefined);
      audioRef.current = audio;
    }
    window.setTimeout(() => setState("inside"), 1450);
  };

  const submit = async () => {
    if (saving || guests.some((guest) => !responses[guest.id])) return;
    setSaving(true);
    setError("");
    try {
      if (!preview) {
        const response = await fetch("/api/after-party", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            action: "respond",
            responses: guests.map((guest) => ({
              id: guest.id,
              attending: responses[guest.id],
            })),
          }),
        });
        const result = (await response.json()) as {
          ok?: boolean;
          error?: string;
        };
        if (!response.ok || !result.ok)
          throw new Error(result.error || "Your reply could not be saved.");
      }
      setSaved(true);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Your reply could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    [],
  );

  if (state === "checking")
    return (
      <main
        data-experience="after-hours"
        className="ah-state"
        aria-busy="true"
      />
    );

  if (state === "denied")
    return (
      <main data-experience="after-hours" className="ah-state">
        <p>E+H</p>
        <h1>This page is resting quietly.</h1>
        <a href={returnHref}>Return to invitation</a>
      </main>
    );

  if (state === "door")
    return (
      <main
        data-experience="after-hours"
        className={`ah-door${entering ? " is-entering" : ""}`}
      >
        <div className="ah-door__arch" aria-hidden="true" />
        <div className="ah-door__shadow" aria-hidden="true" />
        <div className="ah-door__copy">
          <p>One more invitation is waiting for you.</p>
          <button
            type="button"
            onClick={enter}
            disabled={entering}
            aria-label="Open the hidden invitation"
          >
            <img src="/wedding/after-hours/south-sea-pearl.png" alt="" />
            <span>Open the doorway</span>
          </button>
        </div>
        <div className="ah-door__pink-light" aria-hidden="true" />
      </main>
    );

  return (
    <main data-experience="after-hours" className="ah-world">
      <a className="ah-return" href={returnHref}>
        Return to invitation
      </a>
      <div className="ah-grain" aria-hidden="true" />
      <section className="ah-threshold" aria-label="After Hours introduction">
        <p className="ah-transmission">Private transmission</p>
        <div className="ah-liquid" aria-hidden="true" />
        <p className="ah-threshold__formal">The formalities are over.</p>
        <p className="ah-threshold__fun">Now let&rsquo;s have some fun.</p>
      </section>
      <section className="ah-title-scene" aria-labelledby="after-hours-title">
        <p>E+H / After Hours</p>
        <h1 id="after-hours-title">
          <span>After</span>
          <span>Hours</span>
        </h1>
        <div className="ah-shadow-pass" aria-hidden="true" />
      </section>
      <section className="ah-details">
        <p className="ah-kicker">After Hours</p>
        <div className="ah-location">
          <h2>Location</h2>
          {settings?.location.revealed ? (
            <>
              <strong>{settings.location.venue}</strong>
              {settings.location.address ? (
                <address>{settings.location.address}</address>
              ) : null}
              {settings.location.transportNote ? (
                <p>{settings.location.transportNote}</p>
              ) : null}
            </>
          ) : (
            <p>Revealed closer to the night.</p>
          )}
        </div>
        <div className="ah-rsvp">
          <p className="ah-kicker">Your reply</p>
          <h2>Will you stay?</h2>
          {guests.map((guest) => (
            <fieldset key={guest.id}>
              <legend>{guest.name}</legend>
              <button
                type="button"
                className={responses[guest.id] === "Yes" ? "is-selected" : ""}
                onClick={() =>
                  setResponses((current) => ({ ...current, [guest.id]: "Yes" }))
                }
              >
                I&rsquo;ll be there
              </button>
              <button
                type="button"
                className={responses[guest.id] === "No" ? "is-selected" : ""}
                onClick={() =>
                  setResponses((current) => ({ ...current, [guest.id]: "No" }))
                }
              >
                Not this time
              </button>
            </fieldset>
          ))}
          <p className="ah-deadline">
            Reply by {deadlineLabel(settings?.deadline)}.
          </p>
          {error ? (
            <p className="ah-error" role="alert">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p className="ah-saved" role="status">
              Your After Hours reply is saved.
            </p>
          ) : (
            <button
              className="ah-submit"
              type="button"
              disabled={saving || guests.some((guest) => !responses[guest.id])}
              onClick={submit}
            >
              {saving ? "Saving…" : "Send reply"}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
