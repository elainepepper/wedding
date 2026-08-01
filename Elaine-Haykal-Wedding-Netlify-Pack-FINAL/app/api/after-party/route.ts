import { weddingRef } from "../../../lib/firebase-admin";

export async function POST(request: Request) {
  const payload = await request.json() as { answer?: unknown; token?: unknown };
  const answer = typeof payload.answer === "string" ? payload.answer.trim().toLowerCase() : "";
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  if (answer !== "pepper") return Response.json({ ok: false }, { status: 401 });
  const households = await weddingRef.collection("households").where("invitation_token", "==", token).where("invitation_enabled", "==", true).limit(1).get();
  if (households.empty) return Response.json({ ok: false, error: "This private chapter is not included in your invitation." }, { status: 403 });
  const eligible = await weddingRef.collection("guests").where("household_id", "==", Number(households.docs[0].data().id)).where("after_party_invited", "==", 1).where("archived", "==", 0).limit(1).get();
  if (eligible.empty) return Response.json({ ok: false, error: "This private chapter is not included in your invitation." }, { status: 403 });
  return Response.json({ ok: true });
}
