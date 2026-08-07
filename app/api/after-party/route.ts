import { weddingRef } from "../../../lib/firebase-admin";

// Never serve a cached copy: the manager must see a change the instant it is
// made, and an invitation must reflect the latest reply.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Access to the private after-party chapter is decided purely by the guest
// database: a valid invitation token whose household includes at least one
// after-party-invited adult. There is no password — the invitation itself is
// the key. Details are editable from Guest Manager → Settings.
export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as { token?: unknown };
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  if (!token) return Response.json({ ok: false, error: "This private chapter opens only from a personal invitation link." }, { status: 401 });
  if (!/^[abcdefghjkmnpqrstuvwxyz23456789]{12}$/i.test(token)) {
    return Response.json({ ok: false, error: "This private chapter is not included in your invitation." }, { status: 403 });
  }
  // Firestore drops any document missing a field named in a where(), and an
  // "enabled" flag saved as 1 rather than true would never match either. Match
  // on the token alone and judge the rest in code.
  const households = await weddingRef.collection("households").where("invitation_token", "==", token).limit(1).get();
  if (households.empty) return Response.json({ ok: false, error: "This private chapter is not included in your invitation." }, { status: 403 });
  const householdData = households.docs[0].data();
  if (householdData.invitation_enabled === false || householdData.invitation_enabled === 0) {
    return Response.json({ ok: false, error: "This invitation link is no longer active." }, { status: 403 });
  }
  const householdGuests = await weddingRef.collection("guests").where("household_id", "==", Number(householdData.id)).get();
  const eligibleGuests = householdGuests.docs
    .map((doc) => doc.data())
    .filter((guest) => !Number(guest.archived ?? 0))
    .filter((guest) => Boolean(Number(guest.after_party_invited ?? 0)));
  if (!eligibleGuests.length) return Response.json({ ok: false, error: "This private chapter is not included in your invitation." }, { status: 403 });
  // The chapter unlocks with the follow-up link that carries the seat
  // allocation: until the couple assigns a table, it stays sealed even for
  // invited guests — the same rule the invitation page applies on screen.
  const anySeatAssigned = eligibleGuests.some((guest) => Number(guest.table_id ?? 0) > 0);
  if (!anySeatAssigned) return Response.json({ ok: false, error: "This chapter is still resting. It will open with the note that carries your table number." }, { status: 403 });
  const settings = (await weddingRef.get()).data() ?? {};
  return Response.json({
    ok: true,
    details: {
      when: settings.after_party_when ?? "After the final toast",
      where: settings.after_party_where ?? "Revealed at the reception",
      dress: settings.after_party_dress ?? "Come exactly as you are — the evening simply continues.",
      entry: settings.after_party_entry ?? "Give your name quietly at the door; you are already on the list.",
    },
  });
}
