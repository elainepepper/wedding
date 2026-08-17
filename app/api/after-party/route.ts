import { serverTimestamp, weddingRef } from "../../../lib/firebase-admin";
import { canonicalRsvpStatus, isEnabledFlag } from "../../../lib/rsvp-data.mjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TOKEN_PATTERN = /^[abcdefghjkmnpqrstuvwxyz23456789]{12}$/i;
const noStore = { "Cache-Control": "private, no-store, max-age=0" };
const denied = () =>
  Response.json(
    { ok: false, error: "This invitation link is no longer available." },
    { status: 404, headers: noStore },
  );

async function privateInvitation(token: string) {
  if (!TOKEN_PATTERN.test(token)) return null;
  const households = await weddingRef
    .collection("households")
    .where("invitation_token", "==", token)
    .limit(1)
    .get();
  if (households.empty) return null;
  const householdDoc = households.docs[0];
  const household = householdDoc.data();
  if (
    household.invitation_enabled === false ||
    household.invitation_enabled === 0 ||
    isEnabledFlag(household.archived)
  )
    return null;

  const snapshot = await weddingRef
    .collection("guests")
    .where("household_id", "in", [Number(household.id), String(household.id)])
    .get();
  const guests = snapshot.docs.filter((doc) => {
    const guest = doc.data();
    return (
      !isEnabledFlag(guest.archived) &&
      isEnabledFlag(guest.after_party_eligible) &&
      isEnabledFlag(guest.after_party_invited) &&
      canonicalRsvpStatus(guest.rsvp_status) === "Confirmed" &&
      isEnabledFlag(guest.reception_attending) &&
      Number(guest.table_id ?? 0) > 0
    );
  });
  if (!guests.length) return null;
  return { householdDoc, guests };
}

function publicSettings(settings: Record<string, unknown>) {
  const locationRevealed = isEnabledFlag(
    settings.after_hours_location_revealed,
  );
  const venue = String(settings.after_hours_venue ?? "").trim();
  const address = String(settings.after_hours_address ?? "").trim();
  return {
    deadline: String(settings.after_hours_rsvp_deadline ?? "2026-10-15"),
    musicUrl: String(settings.after_hours_music_url ?? "").trim() || null,
    location:
      locationRevealed && venue
        ? {
            revealed: true,
            venue,
            address: address || null,
            transportNote:
              String(settings.after_hours_transport_note ?? "").trim() || null,
          }
        : { revealed: false },
  };
}

async function handlePost(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as {
    token?: unknown;
    action?: unknown;
    responses?: unknown;
  };
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  const invitation = await privateInvitation(token);
  if (!invitation) return denied();

  const settings = (await weddingRef.get()).data() ?? {};
  if (payload.action === "respond") {
    const deadline = String(settings.after_hours_rsvp_deadline ?? "2026-10-15");
    if (/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      const closesAt = Date.parse(`${deadline}T23:59:59+08:00`);
      if (Number.isFinite(closesAt) && Date.now() > closesAt) {
        return Response.json(
          { ok: false, error: "The After Hours reply window has now closed." },
          { status: 403, headers: noStore },
        );
      }
    }
    const responses = Array.isArray(payload.responses)
      ? (payload.responses as Array<Record<string, unknown>>).slice(0, 30)
      : [];
    const allowed = new Map(
      invitation.guests.map((doc) => [Number(doc.data().id), doc]),
    );
    const ids = new Set(responses.map((response) => Number(response.id)));
    if (
      responses.length !== allowed.size ||
      ids.size !== allowed.size ||
      responses.some((response) => !allowed.has(Number(response.id)))
    ) {
      return Response.json(
        { ok: false, error: "That response could not be verified." },
        { status: 403, headers: noStore },
      );
    }
    const batch = weddingRef.firestore.batch();
    for (const response of responses) {
      const attending =
        response.attending === "Yes"
          ? "Yes"
          : response.attending === "No"
            ? "No"
            : null;
      if (!attending) {
        return Response.json(
          { ok: false, error: "Please reply for each invited guest." },
          { status: 400, headers: noStore },
        );
      }
      batch.set(
        allowed.get(Number(response.id))!.ref,
        {
          after_party_attending: attending,
          after_party_rsvp_updated_at: serverTimestamp(),
          after_party_discovered_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        },
        { merge: true },
      );
    }
    batch.set(
      invitation.householdDoc.ref,
      { last_activity_at: serverTimestamp(), updated_at: serverTimestamp() },
      { merge: true },
    );
    await batch.commit();
  } else {
    const batch = weddingRef.firestore.batch();
    invitation.guests.forEach((doc) => {
      if (!doc.data().after_party_discovered_at)
        batch.set(
          doc.ref,
          { after_party_discovered_at: serverTimestamp() },
          { merge: true },
        );
    });
    await batch.commit();
  }

  return Response.json(
    {
      ok: true,
      guests: invitation.guests.map((doc) => {
        const guest = doc.data();
        return {
          id: Number(guest.id),
          name:
            String(guest.preferred_name ?? "").trim() ||
            `${String(guest.first_name ?? "")} ${String(guest.last_name ?? "")}`.trim(),
          attending:
            guest.after_party_attending === "Yes" ||
            guest.after_party_attending === "No"
              ? guest.after_party_attending
              : "Pending",
        };
      }),
      settings: publicSettings(settings),
    },
    { headers: noStore },
  );
}

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (error) {
    console.error("After Hours request failed", error);
    return Response.json(
      {
        ok: false,
        error: "This invitation could not be opened just now. Please try again.",
      },
      { status: 503, headers: noStore },
    );
  }
}
