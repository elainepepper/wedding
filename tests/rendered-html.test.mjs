import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => access(new URL(`../${path}`, import.meta.url));

test("renders the finished wedding invitation content", async () => {
  const [experience, layout, calendar] = await Promise.all([
    read("app/WeddingExperience.tsx"),
    read("app/layout.tsx"),
    read("public/elaine-haykal-wedding.ics"),
  ]);
  assert.match(experience, /Elaine &amp; Haykal/);
  assert.match(experience, /7 November 2026/);
  assert.match(experience, /Grand Hyatt/);
  assert.match(experience, /Skip our story and go to the RSVP/);
  assert.match(experience, /Village Park/);
  assert.match(experience, /Super Kitchen Chilli Pan Mee/);
  assert.match(experience, /href="\/elaine-haykal-wedding\.ics"/);
  assert.match(calendar, /DTSTART:20261107T100000Z/);
  assert.match(calendar, /The Grand Salon\\, Grand Hyatt Kuala Lumpur/);
  assert.match(layout, /og-wedding\.png/);
  // The release-candidate presentation keeps RSVP progression singular and
  // disclosure controls separate from the persisted meal answer.
  assert.match(experience, /className="meal-details-toggle"/);
  assert.match(experience, /aria-expanded=\{detailsOpen\}/);
  assert.match(experience, /className="meal-select-button"/);
  assert.match(experience, /className="hotel-disclosure-toggle"/);
  assert.match(experience, /className="hotel-distance-link"/);
  assert.doesNotMatch(
    experience,
    /className="chapter-continue reply-continue"/,
  );
  assert.doesNotMatch(experience, /scene-art scene-art--pearl/);
  // Opening iOS native form controls must not also start audio: Safari closes
  // the date sheet if media playback steals the same user activation.
  assert.match(experience, /input, select, textarea, label/);
  // Selecting an arrival date must leave the native picker step mounted.
  // Only the explicit Continue action may confirm and advance the step.
  assert.match(experience, /arrivalStepConfirmed/);
  assert.match(experience, /disabled=\{!rsvp\.arrivalDate\}/);
  assert.match(experience, /setArrivalStepConfirmed\(true\)/);
  const confirmationIndex = experience.indexOf('id="confirmation"');
  const recapIndex = experience.indexOf(
    "<EveningRecap guests={guestResponses} />",
  );
  assert.ok(confirmationIndex >= 0 && recapIndex > confirmationIndex);
  // No leftover build-scaffolding markers.
  assert.doesNotMatch(
    `${experience}${layout}`,
    /codex-preview|Your site is taking shape|react-loading-skeleton/i,
  );
});

test("uses the exact required meal wording", async () => {
  const experience = await read("app/WeddingExperience.tsx");
  assert.match(experience, /Seared Alaskan salmon with Peruvian asparagus/);
  assert.match(experience, /Almond dukkha-crusted lamb with potato pav/);
});

test("ships the private, server-enforced after-party gate", async () => {
  const [experience, route] = await Promise.all([
    read("app/after-party/AfterPartyExperience.tsx"),
    read("app/api/after-party/route.ts"),
  ]);
  assert.match(experience, /For invited guests/);
  assert.match(experience, /invitation only/i);
  assert.match(experience, /invitation itself is the key/i);
  // Eligibility is enforced server-side against the invitation token.
  assert.match(route, /after_party_invited/);
  assert.match(route, /invitation_token/);
  assert.match(route, /invitation_enabled/);
});

test("includes the complete manager and locked-down Firestore rules", async () => {
  const manager = await read("app/manager/ManagerApp.tsx");
  for (const section of [
    "Overview",
    "Guests",
    "Households",
    "RSVPs",
    "Seating plan",
    "After-party",
    "Imports",
    "Exports",
    "Settings",
  ]) {
    assert.match(manager, new RegExp(section, "i"));
  }
  const rules = await read("firestore.rules");
  assert.match(rules, /allow read, write: if false/);
  await exists("public/og-wedding.png");
  await exists("firestore.indexes.json");
});

test("keeps the full-screen invitation menu keyboard-contained", async () => {
  const menu = await read("app/SiteMenu.tsx");
  assert.match(menu, /aria-controls="invitation-site-menu"/);
  assert.match(menu, /aria-label="Invitation sections"/);
  assert.match(menu, /tabIndex=\{open \? 0 : -1\}/);
  assert.match(menu, /querySelector<HTMLElement>\("a, button"\)/);
  assert.match(menu, /document\.activeElement === last/);
});

test("does not leak secrets into the repository", async () => {
  const env = await read(".env.example");
  // The service-account JSON and Cloudinary secret must never be filled in here.
  assert.match(env, /^FIREBASE_SERVICE_ACCOUNT_JSON=\s*$/m);
  assert.match(env, /^CLOUDINARY_API_SECRET=\s*$/m);
  const privateKeyMarker = new RegExp(["BEGIN", "PRIVATE", "KEY"].join(" "));
  assert.doesNotMatch(env, privateKeyMarker);
});
