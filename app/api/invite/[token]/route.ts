import { serverTimestamp, weddingRef } from "../../../../lib/firebase-admin";
import {
  canonicalAgeGroup,
  canonicalRsvpStatus,
  isChildAgeGroup,
  isEnabledFlag,
  isValidInternationalMobile,
} from "../../../../lib/rsvp-data.mjs";
import { rsvpDeadlinePassed } from "../../../../lib/rsvp-window";

// Never serve a cached copy: the manager must see a change the instant it is
// made, and an invitation must reflect the latest reply.
export const dynamic = "force-dynamic";
export const revalidate = 0;

type InvitePermission = {
  id: number;
  ceremony_invited: number;
  reception_invited: number;
  after_party_invited: number;
  age_group?: unknown;
  child_meal?: unknown;
};
const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";

async function householdForToken(token: string) {
  // Match on the token alone. Firestore silently drops any document missing a
  // field named in a where(), and a flag saved as 1 rather than true would
  // never match either — either case would tell a real guest that their
  // invitation is "resting". The flag is judged here instead, where a missing
  // value can be read as enabled.
  const snapshot = await weddingRef.collection("households").where("invitation_token", "==", token).limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  const enabled = doc.data().invitation_enabled;
  const enabledText = String(enabled ?? "").trim().toLowerCase();
  if (enabled === false || enabled === 0 || enabledText === "false" || enabledText === "0") return null;
  // An archived invitation is set aside: its link stops opening, exactly as a
  // deleted one would, but the record survives so it can be restored.
  if (isEnabledFlag(doc.data().archived)) return null;
  return doc;
}

// Only the fields the invitation experience needs ever leave the server.
// Internal notes, seating, categories and send-tracking stay private.
function publicGuest(guest: Record<string, unknown>) {
  return {
    id: guest.id,
    first_name: guest.first_name ?? "",
    last_name: guest.last_name ?? "",
    preferred_name: guest.preferred_name ?? null,
    rsvp_status: canonicalRsvpStatus(guest.rsvp_status),
    age_group: canonicalAgeGroup(guest.age_group),
    child_meal: isChildAgeGroup(guest.age_group) || isEnabledFlag(guest.child_meal) ? 1 : 0,
    ceremony_invited: isEnabledFlag(guest.ceremony_invited) ? 1 : 0,
    reception_invited: isEnabledFlag(guest.reception_invited) ? 1 : 0,
    after_party_invited: isEnabledFlag(guest.after_party_invited) ? 1 : 0,
    after_party_attending: guest.after_party_attending ?? "Pending",
    meal_selection: guest.meal_selection ?? null,
    dietary_requirements: guest.dietary_requirements ?? null,
    allergies: guest.allergies ?? null,
    accessibility: guest.accessibility ?? null,
    transport_required: isEnabledFlag(guest.transport_required) ? 1 : 0,
    accommodation_required: isEnabledFlag(guest.accommodation_required) ? 1 : 0,
    travel_arrival: guest.travel_arrival ?? null,
    travel_departure: guest.travel_departure ?? null,
    accommodation_name: guest.accommodation_name ?? null,
    bed_preference: guest.bed_preference ?? null,
    table_name: guest.table_name ?? null,
    room_nights: typeof guest.room_nights === "number" ? guest.room_nights : null,
    wishes: guest.wishes ?? null,
    marriage_advice: guest.marriage_advice ?? null,
    mobile: guest.mobile ?? null,
    has_submitted: Boolean(guest.rsvp_submitted_at),
  };
}

// The couple hold a limited block of rooms at the Grand Hyatt. Once that many
// households have asked for one, the offer closes itself and later guests are
// shown the nearby hotels instead of being promised a room that is not there.
// A household that already asked always keeps its own request editable, and a
// block size of 0 (or blank) means no limit at all.
async function roomBlockState(settings: Record<string, unknown>, householdId: number) {
  const size = Number(settings.room_block_size ?? 0);
  if (!Number.isFinite(size) || size <= 0) return { size: 0, taken: 0, full: false };
  // Loose matching: a flag imported as "1" or true must both count.
  const requested = await weddingRef.collection("guests").where("accommodation_required", "in", [1, true, "1"]).get();
  // A room only counts while someone is actually coming to use it. Guests who
  // were archived, or who later declined, must give their room back — without
  // this the block filled up with people who were no longer attending and real
  // guests were told the last room had gone while rooms sat empty.
  const live = requested.docs
    .map((doc) => doc.data())
    .filter((guest) => !isEnabledFlag(guest.archived))
    .filter((guest) => canonicalRsvpStatus(guest.rsvp_status) !== "Declined");
  const households = new Set(live.map((guest) => Number(guest.household_id)));
  const mine = households.has(householdId);
  const taken = households.size;
  return { size, taken, full: taken >= size && !mine };
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[abcdefghjkmnpqrstuvwxyz23456789]{12}$/i.test(token)) {
    return Response.json({ error: "This invitation link is no longer available." }, { status: 404 });
  }
  const householdDoc = await householdForToken(token);
  if (!householdDoc) return Response.json({ error: "This invitation link is no longer available." }, { status: 404 });
  const household = householdDoc.data();
  await householdDoc.ref.set({ opened_at: household.opened_at || serverTimestamp(), last_activity_at: serverTimestamp() }, { merge: true });
  const [guestSnapshot, eventSnapshot, settingsSnapshot] = await Promise.all([
    // household_id and archived are matched loosely on purpose. A Firestore
    // "where" clause silently excludes any document that lacks the field, and
    // an imported guest whose household_id is stored as text would never match
    // a numeric comparison. Either case returned an empty guest list, which
    // left the RSVP page impossible to complete.
    weddingRef.collection("guests").where("household_id", "in", [Number(household.id), String(household.id)]).get(),
    weddingRef.collection("events").where("is_enabled", "==", 1).get(),
    weddingRef.get(),
  ]);
  const guests = guestSnapshot.docs.map((doc) => doc.data())
    // Every named person on the household invitation is returned, including
    // children. Age changes which dinner question applies; it must never make
    // an invited person disappear from their own household.
    .filter((guest) => !isEnabledFlag(guest.archived))
    .sort((a, b) => Number(a.id) - Number(b.id));
  // The seating plan lives in its own collection; guests only ever learn the
  // name of their own table, and only once it has been assigned.
  const tableIds = [...new Set(guests.map((guest) => Number(guest.table_id)).filter((id) => Number.isFinite(id) && id > 0))];
  const tableNames = new Map<number, string>();
  if (tableIds.length) {
    const tableDocs = await Promise.all(tableIds.slice(0, 30).map((id) => weddingRef.collection("tables").doc(String(id)).get()));
    tableDocs.forEach((doc) => { if (doc.exists) tableNames.set(Number(doc.data()?.id), String(doc.data()?.name ?? "")); });
  }
  guests.forEach((guest) => { guest.table_name = tableNames.get(Number(guest.table_id)) ?? null; });
  const afterPartyInvited = guests.some((guest) => isEnabledFlag(guest.after_party_invited));
  const events = eventSnapshot.docs.map((doc) => doc.data())
    // The private after-party must not exist at all for guests who are not
    // invited to it — it is never sent to the browser, not merely hidden.
    .filter((event) => afterPartyInvited || !/after[\s-]?party/i.test(String(event.name ?? "")))
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    .map((event) => ({ id: event.id, name: event.name ?? "", event_date: event.event_date ?? null, event_time: event.event_time ?? null, venue: event.venue ?? null, sort_order: event.sort_order ?? 0 }));
  const settings = settingsSnapshot.data() ?? {};
  const roomBlock = await roomBlockState(settings, Number(household.id));
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
    roomBlock,
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[abcdefghjkmnpqrstuvwxyz23456789]{12}$/i.test(token)) {
    return Response.json({ error: "This invitation link is no longer available." }, { status: 404 });
  }
  const householdDoc = await householdForToken(token);
  if (!householdDoc) return Response.json({ error: "This invitation link is no longer available." }, { status: 404 });
  const household = householdDoc.data();
  let payload: { guests?: unknown; mobile?: unknown; action?: unknown; submissionId?: unknown };
  try {
    payload = await request.json() as typeof payload;
  } catch {
    return Response.json({ error: "This RSVP request could not be read. Please try again." }, { status: 400 });
  }
  // Recorded when the table panel is actually shown to a guest, so the couple
  // can see who still does not know where they are sitting.
  if (payload.action === "tableSeen") {
    await householdDoc.ref.set({ table_seen_at: serverTimestamp(), last_activity_at: serverTimestamp() }, { merge: true });
    return Response.json({ ok: true });
  }
  const mobile = clean(payload.mobile, 60);
  const submissionId = clean(payload.submissionId, 80);
  if (submissionId && !/^[a-z0-9_-]{8,80}$/i.test(submissionId)) {
    return Response.json({ error: "This RSVP request could not be verified. Please try again." }, { status: 400 });
  }
  if (submissionId && household.last_rsvp_submission_id === submissionId) {
    return Response.json({ ok: true, duplicate: true });
  }
  const responses = Array.isArray(payload.guests) ? payload.guests.slice(0, 30) as Array<Record<string, unknown>> : [];
  const anyConfirmedResponse = responses.some((response) => canonicalRsvpStatus(response.rsvpStatus) === "Confirmed");
  if (anyConfirmedResponse && !isValidInternationalMobile(mobile)) {
    return Response.json({ error: "A valid mobile number with country code is required." }, { status: 400 });
  }
  const settingsBefore = (await weddingRef.get()).data() ?? {};
  if (rsvpDeadlinePassed(settingsBefore.rsvp_deadline)) {
    return Response.json({ error: "The RSVP window has now closed. Please message Elaine and Haykal directly and they will happily take care of you." }, { status: 403 });
  }
  // A page opened before the last room went could still ask for one. Judge the
  // block here too, where the answer cannot be out of date.
  const wantsRoom = responses.some((response) => response.accommodationRequired);
  if (wantsRoom) {
    const block = await roomBlockState(settingsBefore, Number(household.id));
    if (block.full) {
      return Response.json({ error: "The last of our rooms at the Grand Hyatt has just been taken. Please reload this page — a few good places within a short walk are waiting there for you." }, { status: 409 });
    }
  }
  const allowedSnapshot = await weddingRef.collection("guests").where("household_id", "in", [Number(household.id), String(household.id)]).get();
  const allowedDocs = allowedSnapshot.docs
    .filter((doc) => !isEnabledFlag(doc.data().archived));
  const allowedById = new Map<number, { doc: FirebaseFirestore.QueryDocumentSnapshot; permission: InvitePermission }>(allowedDocs.map((doc) => [Number(doc.data().id), { doc, permission: doc.data() as InvitePermission }]));
  const responseIds = new Set(responses.map((guest) => Number(guest.id)));
  if (!responses.length || responses.length !== allowedDocs.length || responseIds.size !== allowedDocs.length || responses.some((guest) => !allowedById.has(Number(guest.id)))) {
    return Response.json({ error: "Your response includes a guest outside this invitation." }, { status: 403 });
  }
  const batch = weddingRef.firestore.batch();
  let anyAttending = false;
  const firstResponseId = Math.min(...allowedDocs.map((doc) => Number(doc.data().id)));
  for (const response of responses) {
    const allowed = allowedById.get(Number(response.id))!;
    const permission = allowed.permission;
    const status = canonicalRsvpStatus(response.rsvpStatus);
    const child = isChildAgeGroup(permission.age_group) || isEnabledFlag(permission.child_meal);
    const ceremonyInvited = isEnabledFlag(permission.ceremony_invited);
    const receptionInvited = isEnabledFlag(permission.reception_invited);
    const afterPartyInvitedForGuest = isEnabledFlag(permission.after_party_invited);
    const meal = response.mealSelection === "Lamb" || response.mealSelection === "Salmon" ? response.mealSelection : null;
    if (status === "Confirmed" && receptionInvited && !child && !meal) return Response.json({ error: "Please choose lamb or salmon for every attending guest." }, { status: 400 });
    anyAttending ||= status === "Confirmed";
    const guestUpdate: Record<string, unknown> = {
      rsvp_status: status,
      ceremony_attending: ceremonyInvited ? Number(status === "Confirmed" && response.ceremonyAttending !== false) : null,
      reception_attending: receptionInvited ? Number(status === "Confirmed" && response.receptionAttending !== false) : null,
      after_party_attending: afterPartyInvitedForGuest && (response.afterPartyAttending === "Yes" || response.afterPartyAttending === "No") ? response.afterPartyAttending : "Pending",
      meal_selection: child ? null : meal,
      dietary_requirements: clean(response.dietaryRequirements, 800) || null,
      allergies: clean(response.allergies, 800) || null,
      accessibility: clean(response.accessibility, 800) || null,
      transport_required: status === "Confirmed" && response.transportRequired ? 1 : 0,
      accommodation_required: response.accommodationRequired ? 1 : 0,
      travel_arrival: clean(response.travelArrival, 20) || null,
      travel_departure: clean(response.travelDeparture, 20) || null,
      accommodation_name: clean(response.accommodationName, 240) || null,
      bed_preference: response.bedPreference === "King" || response.bedPreference === "Twin" ? response.bedPreference : null,
      room_nights: [1, 2, 3].includes(Number(response.roomNights)) ? Number(response.roomNights) : null,
      // The current invitation exposes one message field and labels it private.
      // Store it only as private advice, including for an all-declined household.
      marriage_advice: Number(response.id) === firstResponseId ? clean(response.advice, 1500) || null : null,
      wishes: Number(response.id) === firstResponseId ? clean(response.wishes, 1500) || null : null,
      rsvp_submitted_at: serverTimestamp(), updated_at: serverTimestamp(),
    };
    // A decline does not require a number. Never overwrite a number already
    // held for the household with an empty placeholder such as "+60".
    if (mobile) guestUpdate.mobile = mobile;
    batch.set(allowed.doc.ref, guestUpdate, { merge: true });
  }
  const householdUpdate: Record<string, unknown> = {
    max_guests: allowedDocs.length,
    last_activity_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    ...(submissionId ? { last_rsvp_submission_id: submissionId } : {}),
  };
  if (mobile) householdUpdate.mobile = mobile;
  batch.set(householdDoc.ref, householdUpdate, { merge: true });
  // A deterministic document id makes a retried request idempotent even if a
  // network interruption hides the first successful response from the guest.
  const activity = submissionId
    ? weddingRef.collection("activityLogs").doc(`rsvp-${household.id}-${submissionId}`)
    : weddingRef.collection("activityLogs").doc();
  batch.set(activity, { admin_name: "Guest RSVP", action: "RSVP updated", record_type: "household", record_id: String(household.id), detail: `${household.name} ${anyAttending ? "submitted attendance details" : "declined the invitation"}`, created_at: serverTimestamp() });
  await batch.commit();
  const formId = process.env.FORMSPREE_FORM_ID || settingsBefore.formspree_form_id;
  if (formId) {
    try { await fetch(`https://formspree.io/f/${encodeURIComponent(formId)}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ household: household.name, mobile, attending: anyAttending ? "Yes" : "No", namedGuests: allowedDocs.length, message: "A new personalised wedding RSVP was submitted." }) }); } catch { /* Firestore remains authoritative. */ }
  }
  return Response.json({ ok: true });
}
