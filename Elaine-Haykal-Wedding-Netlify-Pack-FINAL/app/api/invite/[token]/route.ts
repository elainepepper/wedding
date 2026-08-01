import { serverTimestamp, weddingRef } from "../../../../lib/firebase-admin";

type InvitePermission = { id: number; ceremony_invited: number; reception_invited: number; after_party_invited: number };
const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";

async function householdForToken(token: string) {
  const snapshot = await weddingRef.collection("households").where("invitation_token", "==", token).where("invitation_enabled", "==", true).limit(1).get();
  return snapshot.empty ? null : snapshot.docs[0];
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const householdDoc = await householdForToken(token);
  if (!householdDoc) return Response.json({ error: "This invitation link is no longer available." }, { status: 404 });
  const household = householdDoc.data();
  await householdDoc.ref.set({ opened_at: household.opened_at || serverTimestamp(), last_activity_at: serverTimestamp() }, { merge: true });
  const [guestSnapshot, eventSnapshot, settingsSnapshot] = await Promise.all([
    weddingRef.collection("guests").where("household_id", "==", Number(household.id)).where("archived", "==", 0).get(),
    weddingRef.collection("events").where("is_enabled", "==", 1).get(),
    weddingRef.get(),
  ]);
  const guests = guestSnapshot.docs.map((doc) => doc.data()).filter((guest) => guest.age_group === "Adult").sort((a, b) => Number(a.id) - Number(b.id));
  const events = eventSnapshot.docs.map((doc) => doc.data()).sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  const settings = settingsSnapshot.data() ?? {};
  return Response.json({
    household: { id: household.id, name: household.name, maxGuests: guests.length },
    guests,
    events,
    settings,
    afterPartyInvited: guests.some((guest) => Boolean(guest.after_party_invited)),
  });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const householdDoc = await householdForToken(token);
  if (!householdDoc) return Response.json({ error: "This invitation link is no longer available." }, { status: 404 });
  const household = householdDoc.data();
  const payload = await request.json() as { guests?: unknown; mobile?: unknown };
  const mobile = clean(payload.mobile, 60);
  const responses = Array.isArray(payload.guests) ? payload.guests.slice(0, 30) as Array<Record<string, unknown>> : [];
  if (!/^\+[0-9]{8,15}$/.test(mobile)) return Response.json({ error: "A valid mobile number with country code is required." }, { status: 400 });
  const allowedSnapshot = await weddingRef.collection("guests").where("household_id", "==", Number(household.id)).where("archived", "==", 0).get();
  const allowedDocs = allowedSnapshot.docs.filter((doc) => doc.data().age_group === "Adult");
  const allowedById = new Map<number, { doc: FirebaseFirestore.QueryDocumentSnapshot; permission: InvitePermission }>(allowedDocs.map((doc) => [Number(doc.data().id), { doc, permission: doc.data() as InvitePermission }]));
  const responseIds = new Set(responses.map((guest) => Number(guest.id)));
  if (!responses.length || responses.length !== allowedDocs.length || responseIds.size !== allowedDocs.length || responses.some((guest) => !allowedById.has(Number(guest.id)))) {
    return Response.json({ error: "Your response includes a guest outside this invitation." }, { status: 403 });
  }
  const batch = weddingRef.firestore.batch();
  let anyAttending = false;
  for (const response of responses) {
    const allowed = allowedById.get(Number(response.id))!;
    const permission = allowed.permission;
    const status = response.rsvpStatus === "Confirmed" ? "Confirmed" : response.rsvpStatus === "Declined" ? "Declined" : "Pending";
    const meal = response.mealSelection === "Lamb" || response.mealSelection === "Salmon" ? response.mealSelection : null;
    if (status === "Confirmed" && permission.reception_invited && !meal) return Response.json({ error: "Please choose lamb or salmon for every attending guest." }, { status: 400 });
    anyAttending ||= status === "Confirmed";
    batch.set(allowed.doc.ref, {
      rsvp_status: status,
      ceremony_attending: permission.ceremony_invited ? Number(status === "Confirmed" && response.ceremonyAttending !== false) : null,
      reception_attending: permission.reception_invited ? Number(status === "Confirmed" && response.receptionAttending !== false) : null,
      after_party_attending: permission.after_party_invited && (response.afterPartyAttending === "Yes" || response.afterPartyAttending === "No") ? response.afterPartyAttending : "Pending",
      meal_selection: meal,
      dietary_requirements: clean(response.dietaryRequirements, 800) || null,
      allergies: clean(response.allergies, 800) || null,
      accessibility: clean(response.accessibility, 800) || null,
      transport_required: response.transportRequired ? 1 : 0,
      accommodation_required: response.accommodationRequired ? 1 : 0,
      travel_arrival: clean(response.travelArrival, 20) || null,
      travel_departure: clean(response.travelDeparture, 20) || null,
      accommodation_name: clean(response.accommodationName, 240) || null,
      song_request: clean(response.songRequest, 240) || null,
      wishes: clean(response.wishes, 1500) || null,
      mobile,
      rsvp_submitted_at: serverTimestamp(), updated_at: serverTimestamp(),
    }, { merge: true });
  }
  batch.set(householdDoc.ref, { mobile, max_guests: allowedDocs.length, last_activity_at: serverTimestamp(), updated_at: serverTimestamp() }, { merge: true });
  const activity = weddingRef.collection("activityLogs").doc();
  batch.set(activity, { admin_name: "Guest RSVP", action: "RSVP updated", record_type: "household", record_id: String(household.id), detail: `${household.name} ${anyAttending ? "submitted attendance details" : "declined the invitation"}`, created_at: serverTimestamp() });
  await batch.commit();
  const settings = (await weddingRef.get()).data() ?? {};
  const formId = process.env.FORMSPREE_FORM_ID || settings.formspree_form_id;
  if (formId) {
    try { await fetch(`https://formspree.io/f/${encodeURIComponent(formId)}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ household: household.name, mobile, attending: anyAttending ? "Yes" : "No", namedGuests: allowedDocs.length, message: "A new personalised wedding RSVP was submitted." }) }); } catch { /* Firestore remains authoritative. */ }
  }
  return Response.json({ ok: true });
}
