"use client";

import { useEffect, useState } from "react";
import { Dreamscape } from "../Dreamscape";
import BubbleCursor from "../BubbleCursor";

type Seat = { name: string; table: string | null };

/**
 * /table?t=<token> — where a guest finds their seat.
 *
 * The page opens under a heavy mist. A tap clears it over 1200ms and the card
 * floats up from behind. The fog sits above the card so the card emerges from
 * it; neither ever locks the page.
 *
 * It reads the same invitation endpoint the RSVP uses, so no new backend
 * shape is introduced.
 */
export function TableReveal({ token }: { token?: string }) {
  const [seat, setSeat] = useState<Seat | null>(null);
  const [error, setError] = useState("");
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    if (!token) { setError("This page needs your personal link."); return; }
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(`/api/invite/${encodeURIComponent(token)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("We could not find that invitation.");
        const data = await response.json();
        if (cancelled) return;
        const guests: Array<{ name?: string; preferred_name?: string; table_name?: string | null }> = data.guests ?? [];
        const seated = guests.find((guest) => guest.table_name) ?? guests[0];
        setSeat({
          name: seated?.preferred_name || seated?.name || "friend",
          table: seated?.table_name ?? null,
        });
      } catch (caught) {
        if (!cancelled && (caught as Error).name !== "AbortError") setError("We could not find that invitation.");
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [token]);

  const ready = Boolean(seat) || Boolean(error);

  return (
    <main className={`table-reveal${cleared ? " is-cleared" : ""}`}>
      <Dreamscape />
      <BubbleCursor zIndex={95} />

      <section className="table-card" data-sky="dream-3" aria-live="polite">
        {error ? (
          <>
            <p className="table-welcome">A small hitch</p>
            <p className="table-room">{error}</p>
          </>
        ) : seat?.table ? (
          <>
            <p className="table-welcome">Welcome, {seat.name}</p>
            <p className="table-number">{seat.table}</p>
            <p className="table-room">The Grand Salon</p>
          </>
        ) : (
          <>
            <p className="table-welcome">Welcome, {seat?.name ?? ""}</p>
            <p className="table-number table-number--pending">Not yet seated</p>
            <p className="table-room">Your table will appear here closer to the day.</p>
          </>
        )}
      </section>

      <button
        type="button"
        className={`table-fog${cleared ? " is-cleared" : ""}`}
        onClick={() => { if (ready) setCleared(true); }}
        aria-label="Reveal your table"
        tabIndex={cleared ? -1 : 0}
      >
        <span>{ready ? "Tap to clear the mist and reveal your seat…" : "A moment…"}</span>
      </button>
    </main>
  );
}
