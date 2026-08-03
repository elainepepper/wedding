import { serverTimestamp, weddingRef } from "../../../../lib/firebase-admin";
import { rsvpDeadlinePassed } from "../../../../lib/rsvp-window";

type InvitePermission = { id: number; ceremony_invited: number; reception_invited: number; after_party_invited: number };
const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";

async function householdForToken(token: string) {
  const snapshot = await weddingRef.collection("households").where("invitation_token", "==", token).where("invitation_enabled", "==", true).limit(1).get();
  return snapshot.empty ? null : snapshot.docs[0];
}

// Only the fields the invitation experience needs ever leave the server.
// Internal notes, seating, categories and send-tracking stay private.
function publicGuest(guest: Record<string, unknown>) {
  return {
    id: guest.id,
    first_name: guest.first_name ?? "",
    last_name: guest.last_name ?? "",
    preferred_name: guest.preferred_name ?? null,
    rsvp_status: guest.rsvp_status ?? "Pending",
    ceremony_invited: guest.ceremony_invited ?? 0,
    reception_invited: guest.reception_invited ?? 0,
    after_party_invited: guest.after_party_invited ?? 0,
    after_party_attending: guest.after_party_attending ?? "Pending",
    meal_selection: guest.meal_selection ?? null,
    dietary_requirements: guest.dietary_requirements ?? null,
    allergies: guest.allergies ?? null,
    accessibility: guest.accessibility ?? null,
    transport_required: guest.transport_required ?? 0,
    accommodation_required: guest.accommodation_required ?? 0,
    travel_arrival: guest.travel_arrival ?? null,
    travel_departure: guest.travel_departure ?? null,
    accommodation_name: guest.accommodation_name ?? null,
    song_request: guest.song_request ?? null,
    wishes: guest.wishes ?? null,
    mobile: guest.mobile ?? null,
  };
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
  const afterPartyInvited = guests.some((guest) => Boolean(guest.after_party_invited));
  const events = eventSnapshot.docs.map((doc) => doc.data())
    // The private after-party must not exist at all for guests who are not
    // invited to it — it is never sent to the browser, not merely hidden.
    .filter((event) => afterPartyInvited || !/after[\s-]?party/i.test(String(event.name ?? "")))
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    .map((event) => ({ id: event.id, name: event.name ?? "", event_date: event.event_date ?? null, event_time: event.event_time ?? null, venue: event.venue ?? null, sort_order: event.sort_order ?? 0 }));
  const settings = settingsSnapshot.data() ?? {};
  return Response.json({
    household: { id: household.id, name: household.name, maxGuests: guests.length },
    guests: guests.map(publicGuest),
    events,
    settings: {
      rsvp_deadline: settings.rsvp_deadline ?? null,
      confirmation_message: settings.confirmation_message ?? null,
      music_url: settings.music_url ?? null,
      music_title: settings.music_title ?? null,
    },
    afterPartyInvited,
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
  const settingsBefore = (await weddingRef.get()).data() ?? {};
  if (rsvpDeadlinePassed(settingsBefore.rsvp_deadline)) {
    return Response.json({ error: "The RSVP window has now closed. Please message Elaine and Haykal directly and they will happily take care of you." }, { status: 403 });
  }
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
  const formId = process.env.FORMSPREE_FORM_ID || settingsBefore.formspree_form_id;
  if (formId) {
    try { await fetch(`https://formspree.io/f/${encodeURIComponent(formId)}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ household: household.name, mobile, attending: anyAttending ? "Yes" : "No", namedGuests: allowedDocs.length, message: "A new personalised wedding RSVP was submitted." }) }); } catch { /* Firestore remains authoritative. */ }
  }
  return Response.json({ ok: true });
}
