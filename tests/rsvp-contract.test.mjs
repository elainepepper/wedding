import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the invitation and manager share the hardened RSVP contract", async () => {
  const [inviteRoute, experience, managerRoute, managerApp] = await Promise.all([
    read("app/api/invite/[token]/route.ts"),
    read("app/WeddingExperience.tsx"),
    read("app/api/manager/route.ts"),
    read("app/manager/ManagerApp.tsx"),
  ]);

  assert.match(inviteRoute, /anyConfirmedResponse && !isValidInternationalMobile/);
  assert.match(inviteRoute, /last_rsvp_submission_id/);
  assert.match(inviteRoute, /marriage_advice: guest\.marriage_advice/);
  assert.match(inviteRoute, /has_submitted/);
  assert.match(inviteRoute, /afterPartyInvited = guests\.some\(\(guest\) => isEnabledFlag/);
  assert.doesNotMatch(inviteRoute, /filter\(\(guest\) => !\/\^\(child\|infant/);

  assert.match(experience, /submissionInFlight\.current/);
  assert.match(experience, /submissionId: submissionId\.current/);
  assert.match(experience, /transportRequired:\s*\n?\s*guest\.rsvpStatus === "Confirmed" && rsvp\.flyingIn === true/);
  assert.match(experience, /Children&rsquo;s meal/);
  assert.match(experience, /value=\{rsvp\.advice\}/);
  assert.match(experience, /wishes: guest\.wishes/);
  assert.match(inviteRoute, /marriage_advice: Number\(response\.id\) === firstResponseId/);

  assert.match(managerRoute, /canonicalRsvpStatus/);
  assert.match(managerRoute, /age_group: ageGroup/);
  assert.match(managerRoute, /travel_arrival/);
  assert.match(managerRoute, /marriage_advice/);
  assert.match(managerApp, /Travelling to Kuala Lumpur/);
  assert.match(managerApp, /Private note for Elaine &amp; Haykal/);
  assert.match(managerApp, /confirmed \+ declined === total\) return "Replied"/);
  assert.match(managerApp, /aria-label="Search guests"/);
  assert.doesNotMatch(managerApp, /throw failure/);
});

test("private API responses are explicitly non-cacheable", async () => {
  const [inviteRoute, managerRoute] = await Promise.all([
    read("app/api/invite/[token]/route.ts"),
    read("app/api/manager/route.ts"),
  ]);
  assert.match(inviteRoute, /Cache-Control.*private, no-store/);
  assert.match(managerRoute, /Cache-Control.*private, no-store/);
});
