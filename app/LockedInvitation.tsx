"use client";

/**
 * What someone sees without a personal link.
 *
 * It deliberately says nothing about the wedding — no date, no venue, no
 * schedule. Only that invitations are personal, and how to reach the couple
 * if a link has gone astray.
 */
export function LockedInvitation() {
  return (
    <main className="locked-invitation">
      <div className="locked-card">
        <p className="locked-mark" aria-hidden="true">✦</p>
        <h1>By invitation</h1>
        <p>
          Every invitation carries its own private link. Open the one sent to you
          and everything will be waiting.
        </p>
        <p className="locked-help">
          If your link has gone astray, message Elaine or Haykal and they will send it again.
        </p>
      </div>
    </main>
  );
}
