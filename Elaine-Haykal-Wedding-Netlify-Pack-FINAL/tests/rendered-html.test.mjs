import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("builds the finished wedding invitation", async () => {
  const [experience, layout] = await Promise.all([
    readFile(new URL("../app/WeddingExperience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(experience, /Elaine &amp; Haykal/);
  assert.match(experience, /7 November 2026/);
  assert.match(experience, /Grand Hyatt/);
  assert.match(experience, /Skip the cinematic introduction/);
  assert.match(layout, /og-wedding\.png/);
  assert.doesNotMatch(`${experience}${layout}`, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
  await access(new URL("../dist/server/index.js", import.meta.url));
});

test("ships the private after-party gate", async () => {
  const [experience, route] = await Promise.all([
    readFile(new URL("../app/after-party/AfterPartyExperience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/after-party/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(experience, /A little secret/);
  assert.match(experience, /selected guests/i);
  assert.match(route, /after_party_invited = 1/);
  assert.match(route, /pepper/i);
});

test("includes the complete manager and security handoff", async () => {
  const manager = await readFile(new URL("../app/manager/ManagerApp.tsx", import.meta.url), "utf8");
  for (const section of ["Overview", "Guests", "Households", "RSVPs", "Seating plan", "After-party", "Imports", "Exports", "Settings"]) {
    assert.match(manager, new RegExp(section, "i"));
  }
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  assert.match(rules, /allow read, write: if false/);
  await access(new URL("../drizzle/0001_wedding_guest_manager.sql", import.meta.url));
  await access(new URL("../public/og-wedding.png", import.meta.url));
});
