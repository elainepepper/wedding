import assert from "node:assert/strict";
import test from "node:test";

import { FINAL_SEATING_GUEST_COUNT, FINAL_SEATING_PLAN } from "../lib/final-seating-plan.ts";

test("the finalized Grand Salon plan accounts for every confirmed place exactly once", () => {
  assert.equal(FINAL_SEATING_GUEST_COUNT, 149);
  assert.equal(FINAL_SEATING_PLAN.length, 14);
  assert.equal(new Set(FINAL_SEATING_PLAN.map((table) => table.key)).size, FINAL_SEATING_PLAN.length);
  for (const table of FINAL_SEATING_PLAN) {
    assert.ok(table.seats.length <= table.capacity, `${table.name} is over capacity`);
    assert.equal(new Set(table.seats.map((assignment) => assignment.seat)).size, table.seats.length, `${table.name} repeats a chair`);
    assert.ok(table.seats.every((assignment) => assignment.seat >= 1 && assignment.seat <= table.capacity), `${table.name} has an invalid chair`);
  }
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
