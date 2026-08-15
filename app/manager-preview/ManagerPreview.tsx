"use client";

import "../manager/manager.css";
import { ManagerApp, type ManagerData } from "../manager/ManagerApp";

/*
 * The manager, running on a fictional guest list.
 *
 * This page exists so the interface can be inspected end to end — every tab,
 * every state — without a sign-in and without exposing a single real guest.
 * Every name, number and note below is invented. Nothing typed here is saved:
 * the app runs in demo mode, where every action answers with a toast and
 * writes nowhere.
 */

let nextId = 1;
const id = () => nextId++;

type DemoGuest = ManagerData["guests"][number];
type DemoHousehold = ManagerData["households"][number];

const NOW = "2026-08-10T09:00:00Z";

function guest(over: Partial<DemoGuest> & { first_name: string; last_name: string; household_id: number; household_name: string }): DemoGuest {
  return {
    id: id(),
    preferred_name: null,
    email: null,
    mobile: "+60 12 000 0000",
    category: "Friends",
    side: "Shared",
    age_group: "Adult",
    relationship: null,
    rsvp_status: "Pending",
    ceremony_invited: 1,
    ceremony_attending: null,
    reception_invited: 1,
    reception_attending: null,
    after_party_eligible: 0,
    after_party_invited: 0,
    after_party_attending: "Pending",
    meal_selection: null,
    dietary_requirements: null,
    allergies: null,
    child_meal: 0,
    accessibility: null,
    transport_required: 0,
    accommodation_required: 0,
    table_id: null,
    seat_number: null,
    invitation_sent: 0,
    invitation_sent_at: null,
    rsvp_submitted_at: null,
    internal_notes: null,
    wishes: null,
    marriage_advice: null,
    bed_preference: null,
    room_nights: null,
    invitation_slug: null,
    invitation_token: null,
    invitation_enabled: 1,
    opened_at: null,
    last_activity_at: null,
    table_name: null,
    updated_at: NOW,
    ...over,
  };
}

function household(over: Partial<DemoHousehold> & { id: number; name: string }): DemoHousehold {
  return {
    email: null,
    mobile: "+60 12 000 0000",
    max_guests: 2,
    invitation_slug: over.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    invitation_token: "preview-token",
    invitation_enabled: 1,
    opened_at: null,
    last_activity_at: null,
    table_seen_at: null,
    guest_count: 2,
    confirmed_count: 0,
    declined_count: 0,
    notes: null,
    ...over,
  };
}

const H = { rivera: 1, tan: 2, osman: 3, lee: 4, solo: 5 };

const demoData: ManagerData = {
  guests: [
    guest({ first_name: "Amelia", last_name: "Rivera", household_id: H.rivera, household_name: "Amelia & Marco", rsvp_status: "Confirmed", meal_selection: "Salmon", invitation_sent: 1, rsvp_submitted_at: "2026-08-08T13:22:00Z", wishes: "May every year be softer than the last.", table_id: 1, table_name: "Table One", after_party_invited: 1, after_party_attending: "Yes" }),
    guest({ first_name: "Marco", last_name: "Rivera", household_id: H.rivera, household_name: "Amelia & Marco", rsvp_status: "Confirmed", meal_selection: "Lamb", dietary_requirements: "No shellfish", invitation_sent: 1, rsvp_submitted_at: "2026-08-08T13:22:00Z", table_id: 1, table_name: "Table One", after_party_invited: 1 }),
    guest({ first_name: "Mr", last_name: "Tan", household_id: H.tan, household_name: "Mr & Mrs Tan", category: "Family", side: "Bride", invitation_sent: 1 }),
    guest({ first_name: "Mrs", last_name: "Tan", household_id: H.tan, household_name: "Mr & Mrs Tan", category: "Family", side: "Bride", invitation_sent: 1 }),
    guest({ first_name: "Dato", last_name: "Osman", household_id: H.osman, household_name: "Dato & Datin Osman", category: "Family", side: "Groom", rsvp_status: "Confirmed", meal_selection: "Lamb", invitation_sent: 1, rsvp_submitted_at: "2026-08-09T10:05:00Z", marriage_advice: "Never keep score." }),
    guest({ first_name: "Datin", last_name: "Osman", household_id: H.osman, household_name: "Dato & Datin Osman", category: "Family", side: "Groom", rsvp_status: "Confirmed", meal_selection: "Salmon", allergies: "Peanuts", invitation_sent: 1, rsvp_submitted_at: "2026-08-09T10:05:00Z" }),
    guest({ first_name: "Grace", last_name: "Lee", household_id: H.lee, household_name: "Grace Lee", rsvp_status: "Declined", invitation_sent: 1, rsvp_submitted_at: "2026-08-07T20:41:00Z" }),
    guest({ first_name: "Imran", last_name: "Hakim", household_id: H.solo, household_name: "Imran Hakim", category: "Colleagues", accommodation_required: 1, bed_preference: "King", room_nights: 2 }),
  ],
  households: [
    household({ id: H.rivera, name: "Amelia & Marco", confirmed_count: 2, invitation_sent: 1, opened_at: "2026-08-08T13:20:00Z", last_activity_at: "2026-08-08T13:22:00Z" }),
    household({ id: H.tan, name: "Mr & Mrs Tan", invitation_sent: 1, opened_at: "2026-08-09T08:00:00Z" }),
    household({ id: H.osman, name: "Dato & Datin Osman", confirmed_count: 2, invitation_sent: 1, opened_at: "2026-08-09T10:00:00Z", last_activity_at: "2026-08-09T10:05:00Z" }),
    household({ id: H.lee, name: "Grace Lee", max_guests: 1, guest_count: 1, declined_count: 1, invitation_sent: 1 }),
    household({ id: H.solo, name: "Imran Hakim", max_guests: 1, guest_count: 1 }),
  ],
  tables: [
    { id: 1, name: "Table One", shape: "round", capacity: 10, x: 30, y: 40, locked: 0, notes: null, guest_count: 2 },
    { id: 2, name: "Table Two", shape: "round", capacity: 10, x: 65, y: 40, locked: 0, notes: null, guest_count: 0 },
  ],
  activities: [
    { id: 1, admin_name: "Guest RSVP", action: "RSVP updated", detail: "Dato & Datin Osman submitted attendance details", created_at: "2026-08-09T10:05:00Z" },
    { id: 2, admin_name: "Guest RSVP", action: "RSVP updated", detail: "Amelia & Marco submitted attendance details", created_at: "2026-08-08T13:22:00Z" },
    { id: 3, admin_name: "Elaine", action: "Guest added", detail: "Imran Hakim", created_at: "2026-08-06T15:00:00Z" },
  ],
  events: [],
  settings: {
    wedding_name: "Elaine & Haykal",
    couple_names: "Elaine & Haykal",
    wedding_date: "2026-11-07",
    rsvp_deadline: "2026-09-15",
    timezone: "Asia/Kuala_Lumpur",
    website_url: "https://haykalelaine.com",
    room_block_size: 15,
  },
  managers: [
    { id: 1, email: "preview@example.com", name: "Preview", role: "owner", active: 1, created_at: NOW },
  ],
  admin: { displayName: "Preview", email: "preview@example.com", role: "planner" },
};

export function ManagerPreview() {
  return (
    <>
      <p style={{ margin: 0, padding: ".55rem 1rem", background: "#9B3160", color: "#fff", font: "600 .72rem/1.4 Inter, sans-serif", letterSpacing: ".06em", textAlign: "center" }}>
        PREVIEW — a fictional guest list for demonstration. Nothing here is real, and nothing can be saved.
      </p>
      <ManagerApp
        initialAdminName="Preview"
        signedInEmail="preview@example.com"
        authToken=""
        onSignOut={() => undefined}
        demoData={demoData}
      />
    </>
  );
}
