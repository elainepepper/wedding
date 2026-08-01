import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!raw) throw new Error("Set FIREBASE_SERVICE_ACCOUNT_JSON before running the seed.");
const serviceAccount = JSON.parse(raw.replace(/\r?\n/g, "\\n"));
const app = initializeApp({ credential: cert(serviceAccount), projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
const db = getFirestore(app);
const wedding = db.collection("weddings").doc("elaine-haykal-2026");
const now = FieldValue.serverTimestamp();

await wedding.set({ wedding_name: "Elaine & Haykal", couple_names: "Elaine and Haykal", wedding_date: "2026-11-07", rsvp_deadline: "2026-09-30", invitation_wording: "Together with their families, Elaine and Haykal invite you to their wedding reception.", confirmation_message: "Your place is saved. We cannot wait to celebrate with you.", timezone: "Australia/Perth", date_format: "D MMMM YYYY", venue: "The Grand Salon, Grand Hyatt Kuala Lumpur", music_url: null, music_title: null, created_at: now, updated_at: now }, { merge: true });

const households = [
  { id: 1, name: "Sarah & Michael", mobile: "+60125550142", max_guests: 2, invitation_slug: "sarah-and-michael", invitation_token: "8f14e45fceea167a5a36dedd4bea2543", invitation_enabled: true },
  { id: 2, name: "Aunty Farah", mobile: "+60123450001", max_guests: 1, invitation_slug: "aunty-farah", invitation_token: "45c48cce2e2d7fbdea1afc51c7c6ad26", invitation_enabled: true },
];
const guests = [
  { id: 1, household_id: 1, first_name: "Sarah", last_name: "Rahman", preferred_name: "Sarah", mobile: "+60125550142", category: "Family", side: "Bride", relationship: "Primary contact", rsvp_status: "Pending", after_party_eligible: 1, after_party_invited: 1 },
  { id: 2, household_id: 1, first_name: "Michael", last_name: "Rahman", preferred_name: "Michael", mobile: "+60125550142", category: "Family", side: "Bride", relationship: "Partner", rsvp_status: "Pending", after_party_eligible: 1, after_party_invited: 1 },
  { id: 3, household_id: 2, first_name: "Farah", last_name: "Aziz", preferred_name: "Aunty Farah", mobile: "+60123450001", category: "VIP", side: "Bride", relationship: "Primary contact", rsvp_status: "Pending", after_party_eligible: 0, after_party_invited: 0 },
];

const batch = db.batch();
households.forEach((household) => batch.set(wedding.collection("households").doc(String(household.id)), { ...household, opened_at: null, last_activity_at: null, created_at: now, updated_at: now }, { merge: true }));
guests.forEach((guest) => batch.set(wedding.collection("guests").doc(String(guest.id)), { ...guest, age_group: "Adult", archived: 0, ceremony_invited: 1, ceremony_attending: null, reception_invited: 1, reception_attending: null, after_party_attending: "Pending", meal_selection: null, dietary_requirements: null, allergies: null, accessibility: null, transport_required: 0, accommodation_required: 0, table_id: null, seat_number: null, invitation_sent: 0, created_at: now, updated_at: now }, { merge: true }));
batch.set(wedding.collection("events").doc("reception"), { id: 1, name: "Wedding reception", event_date: "2026-11-07", event_time: "18:30", venue: "The Grand Salon, Grand Hyatt Kuala Lumpur", rsvp_deadline: "2026-09-30", is_enabled: 1, sort_order: 1 }, { merge: true });
batch.set(wedding.collection("events").doc("after-party"), { id: 2, name: "Secret after-party", event_date: "2026-11-08", event_time: "00:15", venue: "Revealed at the reception", rsvp_deadline: "2026-09-30", is_enabled: 1, sort_order: 2 }, { merge: true });
batch.set(wedding.collection("tables").doc("1"), { id: 1, name: "Moonlight", shape: "round", capacity: 10, x: 28, y: 35, locked: 0, notes: "Bride family", created_at: now, updated_at: now }, { merge: true });
batch.set(wedding.collection("counters").doc("guests"), { value: 3 }, { merge: true });
batch.set(wedding.collection("counters").doc("households"), { value: 2 }, { merge: true });
batch.set(wedding.collection("counters").doc("tables"), { value: 1 }, { merge: true });
batch.set(wedding.collection("counters").doc("admins"), { value: 0 }, { merge: true });
await batch.commit();
console.log("Firebase wedding data seeded. Replace sample guests before sharing links.");
