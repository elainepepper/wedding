import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { FINAL_SEATING_GUEST_COUNT, FINAL_SEATING_PLAN } from "../lib/final-seating-plan.ts";
import { FINAL_AFTER_PARTY_COUNT, FINAL_AFTER_PARTY_LIST } from "../lib/final-after-party-list.ts";

test("the finalized Grand Salon plan accounts for every confirmed place exactly once", () => {
  assert.equal(FINAL_SEATING_GUEST_COUNT, 155);
  assert.equal(FINAL_SEATING_PLAN.length, 14);
  assert.equal(new Set(FINAL_SEATING_PLAN.map((table) => table.key)).size, FINAL_SEATING_PLAN.length);
  for (const table of FINAL_SEATING_PLAN) {
    assert.ok(table.seats.length <= table.capacity, `${table.name} is over capacity`);
    assert.equal(new Set(table.seats.map((assignment) => assignment.seat)).size, table.seats.length, `${table.name} repeats a chair`);
    assert.ok(table.seats.every((assignment) => assignment.seat >= 1 && assignment.seat <= table.capacity), `${table.name} has an invalid chair`);
  }
});

test("all 155 PDF rows retain the visually verified table, seat, name, meal and safety data", () => {
  const rows = FINAL_SEATING_PLAN.flatMap((table) => table.seats.map((assignment) => [
    table.key,
    assignment.seat,
    assignment.label,
    assignment.meal,
    assignment.dietaryRequirements ?? "",
    assignment.allergies ?? "",
    assignment.accessibility ?? "",
  ].join("|"))).join("\n");
  assert.equal(createHash("sha256").update(rows).digest("hex"), "8833b272a1e3a580615e48aad8598f6222daa0c40053f8b9fefd36c51fe20316");
});

test("the finalized kitchen totals and safety notes match the supplied PDF", () => {
  const assignments = FINAL_SEATING_PLAN.flatMap((table) => table.seats);
  const totals = assignments.reduce((result, assignment) => {
    result[assignment.meal] = (result[assignment.meal] ?? 0) + 1;
    return result;
  }, {});
  assert.deepEqual(totals, { Lamb: 88, Salmon: 65, "Kids meal": 1, "No meal": 1 });
  assert.equal(assignments.find((assignment) => assignment.label === "Bakhtiar")?.allergies, undefined);
  assert.equal(assignments.find((assignment) => assignment.label === "Doris")?.allergies, "Honey allergy");
  assert.equal(assignments.find((assignment) => assignment.label === "Fatima")?.accessibility, "Baby chair required");
  assert.equal(assignments.find((assignment) => assignment.label === "Fatima")?.meal, "No meal");
  const table = (key) => FINAL_SEATING_PLAN.find((entry) => entry.key === key);
  assert.deepEqual(table("table-2")?.seats.map(({ label, meal }) => [label, meal]), [["Zilan", "Lamb"], ["Mrs Park", "Salmon"], ["Datuk Lee Jin Bok", "Lamb"], ["Datin Angie Teh", "Salmon"], ["Juliena", "Lamb"], ["Reza", "Lamb"], ["Juznida", "Lamb"], ["Julieza", "Lamb"]]);
  assert.deepEqual(table("elaine-viking")?.seats.slice(11, 14).map(({ label, meal }) => [label, meal]), [["Mirza", "Lamb"], ["Fatima", "No meal"], ["Alyn", "Lamb"]]);
  assert.deepEqual(table("table-10")?.seats.slice(8).map(({ label, meal }) => [label, meal]), [["Datuk Jerry Axton", "Lamb"], ["Datin Jerry Axton", "Salmon"]]);
  assert.deepEqual(table("table-11")?.seats.slice(4).map(({ label, meal }) => [label, meal]), [["Datin Vanessa", "Salmon"], ["Dato' Frank Koay", "Lamb"], ["Syed Wafa", "Lamb"], ["Ismail Ani Arope", "Lamb"]]);
});

test("ambiguous preferred names carry household hints", () => {
  const assignments = FINAL_SEATING_PLAN.flatMap((table) => table.seats);
  const labels = new Map();
  assignments.forEach((assignment) => labels.set(assignment.label, [...(labels.get(assignment.label) ?? []), assignment]));
  for (const [label, matches] of labels) {
    if (matches.length < 2) continue;
    assert.ok(matches.every((assignment) => assignment.household), `${label} needs a household hint`);
  }
});

test("the seating migration cannot overwrite invitation delivery or after-party access", () => {
  const migration = readFileSync(new URL("../lib/apply-final-wedding-data.ts", import.meta.url), "utf8");
  assert.doesNotMatch(migration, /invitation_sent\s*:/);
  assert.doesNotMatch(migration, /after_party_(?:eligible|invited)\s*:/);
});

test("the separate final after-party list keeps 59 unique identities and current seating references", () => {
  assert.equal(FINAL_AFTER_PARTY_COUNT, 59);
  const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  assert.equal(new Set(FINAL_AFTER_PARTY_LIST.map((guest) => `${normalize(guest.label)}:${normalize(guest.household ?? "")}`)).size, 59);
  const seating = new Set(FINAL_SEATING_PLAN.flatMap((table) => table.seats.map((guest) => `${table.key}:${guest.seat}`)));
  const seatedAfterPartyGuests = FINAL_AFTER_PARTY_LIST.filter((guest) => guest.tableKey !== "unseated");
  assert.ok(seatedAfterPartyGuests.every((guest) => seating.has(`${guest.tableKey}:${guest.seat}`)));
  for (const afterPartyGuest of seatedAfterPartyGuests) {
    const table = FINAL_SEATING_PLAN.find((entry) => entry.key === afterPartyGuest.tableKey);
    const seatedGuest = table?.seats.find((entry) => entry.seat === afterPartyGuest.seat);
    const afterPartyNames = [afterPartyGuest.label, ...(afterPartyGuest.aliases ?? [])].map(normalize);
    const seatingNames = [seatedGuest?.label ?? "", ...(seatedGuest?.aliases ?? [])].map(normalize);
    assert.ok(afterPartyNames.some((name) => seatingNames.includes(name)), `${afterPartyGuest.label} does not match ${afterPartyGuest.tableKey} seat ${afterPartyGuest.seat}`);
  }
  const counts = FINAL_AFTER_PARTY_LIST.reduce((result, guest) => {
    result[guest.tableKey] = (result[guest.tableKey] ?? 0) + 1;
    return result;
  }, {});
  assert.deepEqual(counts, { "elaine-viking": 21, "haykal-viking": 18, "table-3a": 6, "table-1": 7, unseated: 2, vip: 2, "table-8": 3 });
});
