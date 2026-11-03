import assert from "node:assert/strict";
import test from "node:test";

import { FINAL_SEATING_GUEST_COUNT, FINAL_SEATING_PLAN } from "../lib/final-seating-plan.ts";
import { FINAL_AFTER_PARTY_COUNT, FINAL_AFTER_PARTY_LIST } from "../lib/final-after-party-list.ts";

test("the finalized Grand Salon plan accounts for every confirmed place exactly once", () => {
  assert.equal(FINAL_SEATING_GUEST_COUNT, 153);
  assert.equal(FINAL_SEATING_PLAN.length, 14);
  assert.equal(new Set(FINAL_SEATING_PLAN.map((table) => table.key)).size, FINAL_SEATING_PLAN.length);
  for (const table of FINAL_SEATING_PLAN) {
    assert.ok(table.seats.length <= table.capacity, `${table.name} is over capacity`);
    assert.equal(new Set(table.seats.map((assignment) => assignment.seat)).size, table.seats.length, `${table.name} repeats a chair`);
    assert.ok(table.seats.every((assignment) => assignment.seat >= 1 && assignment.seat <= table.capacity), `${table.name} has an invalid chair`);
  }
});

test("the finalized kitchen totals and safety notes match the supplied PDF", () => {
  const assignments = FINAL_SEATING_PLAN.flatMap((table) => table.seats);
  const totals = assignments.reduce((result, assignment) => {
    result[assignment.meal] = (result[assignment.meal] ?? 0) + 1;
    return result;
  }, {});
  assert.deepEqual(totals, { Lamb: 87, Salmon: 64, "Kids meal": 1, "No meal (baby)": 1 });
  assert.equal(assignments.find((assignment) => assignment.label === "Bakhtiar")?.allergies, "Slight shellfish allergy");
  assert.equal(assignments.find((assignment) => assignment.label === "Doris")?.allergies, "Honey allergy");
  assert.match(assignments.find((assignment) => assignment.label === "Fatima")?.dietaryRequirements ?? "", /No meal \(baby\).*High chair needed/);
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

test("the final After Hours list has 59 unique, seat-verified guests", () => {
  assert.equal(FINAL_AFTER_PARTY_COUNT, 59);
  assert.equal(new Set(FINAL_AFTER_PARTY_LIST.map((guest) => `${guest.tableKey}:${guest.seat}`)).size, 59);
  const seating = new Set(FINAL_SEATING_PLAN.flatMap((table) => table.seats.map((guest) => `${table.key}:${guest.seat}`)));
  assert.ok(FINAL_AFTER_PARTY_LIST.every((guest) => seating.has(`${guest.tableKey}:${guest.seat}`)));
  const counts = FINAL_AFTER_PARTY_LIST.reduce((result, guest) => {
    result[guest.tableKey] = (result[guest.tableKey] ?? 0) + 1;
    return result;
  }, {});
  assert.deepEqual(counts, { "elaine-viking": 23, "haykal-viking": 17, "table-3a": 6, "table-1": 7, vip: 2, "table-8": 4 });
});
