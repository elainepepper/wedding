import { weddingRef } from "../../../lib/firebase-admin";

// Access to the private after-party chapter is decided purely by the guest
// database: a valid invitation token whose household includes at least one
// after-party-invited adult. There is no password — the invitation itself is
// the key. Details are editable from Guest Manager → Settings.
export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as { token?: unknown };
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  if (!token) return Response.json({ ok: false, error: "This private chapter opens only from a personal invitation link." }, { status: 401 });
  const households = await weddingRef.collection("households").where("invitation_token", "==", token).where("invitation_enabled", "==", true).limit(1).get();
  if (households.empty) return Response.json({ ok: false, error: "This private chapter is not included in your invitation." }, { status: 403 });
  const eligible = await weddingRef.collection("guests").where("household_id", "==", Number(households.docs[0].data().id)).where("after_party_invited", "==", 1).where("archived", "==", 0).limit(1).get();
  if (eligible.empty) return Response.json({ ok: false, error: "This private chapter is not included in your invitation." }, { status: 403 });
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
