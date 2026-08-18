import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => access(new URL(`../${path}`, import.meta.url));

test("renders the finished wedding invitation content", async () => {
  const [experience, layout, calendar, dreamscape] = await Promise.all([
    read("app/WeddingExperience.tsx"),
    read("app/layout.tsx"),
    read("public/elaine-haykal-wedding.ics"),
    read("app/Dreamscape.tsx"),
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
  // A long mobile chapter must keep its painted sky while the viewport is
  // anywhere inside its bounds, rather than fading to the plain fallback.
  assert.match(dreamscape, /middle < rect\.top/);
  assert.match(dreamscape, /middle > rect\.bottom/);
  assert.doesNotMatch(dreamscape, /Math\.abs\(centre - middle\)/);
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
  const [experience, route, invitationRoute, manager] = await Promise.all([
    read("app/after-party/AfterPartyExperience.tsx"),
    read("app/api/after-party/route.ts"),
    read("app/api/invite/[token]/route.ts"),
    read("app/manager/ManagerApp.tsx"),
  ]);
  assert.match(experience, /The formalities are over\./);
  assert.match(experience, /Now let&rsquo;s have some fun\./);
  assert.match(experience, /Private transmission/i);
  assert.match(experience, /south-sea-pearl\.png/);
  // Eligibility, reception attendance and the table-discovery lifecycle are
  // enforced server-side against the invitation token.
  assert.match(route, /after_party_eligible/);
  assert.match(route, /after_party_invited/);
  assert.match(route, /reception_attending/);
  assert.match(route, /table_id/);
  assert.match(route, /invitation_token/);
  assert.match(route, /invitation_enabled/);
  assert.match(route, /after_party_rsvp_updated_at/);
  assert.match(route, /after_party_discovered_at/);
  // The ordinary invitation omits the entire private capability for an
  // ineligible household instead of rendering and hiding it in CSS.
  assert.match(invitationRoute, /afterHoursGuestIds/);
  assert.match(
    invitationRoute,
    /\.\.\.\(afterPartyInvited \? \{ afterPartyInvited: true \} : \{\}\)/,
  );
  assert.match(manager, /afterHoursRsvpDeadline/);
  assert.match(manager, /afterHoursLocationRevealed/);
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

test("enforces the wedding planner's crew-only boundary", async () => {
  const [manager, route, health] = await Promise.all([
    read("app/manager/ManagerApp.tsx"),
    read("app/api/manager/route.ts"),
    read("app/api/manager/health/route.ts"),
  ]);
  assert.match(route, /PLANNER_ALLOWED_ACTIONS/);
  assert.match(route, /String\(guestDoc\.data\(\)\.category \?\? ""\) !== "Crew"/);
  assert.match(route, /field !== "tableId"/);
  assert.match(route, /invitation_token: null/);
  assert.match(route, /marriage_advice: null/);
  assert.match(manager, /plannerTabs/);
  assert.match(manager, /Add crew member/);
  assert.match(manager, /guest\.category === "Crew"/);
  assert.match(health, /admin\.role === "planner"/);
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
