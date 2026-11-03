import assert from "node:assert/strict";
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

test("the finalized kitchen totals and safety notes match the supplied CSV", () => {
  const assignments = FINAL_SEATING_PLAN.flatMap((table) => table.seats);
  const totals = assignments.reduce((result, assignment) => {
    result[assignment.meal] = (result[assignment.meal] ?? 0) + 1;
    return result;
  }, {});
  assert.deepEqual(totals, { Lamb: 88, Salmon: 65, "Kids meal": 2 });
  assert.equal(assignments.find((assignment) => assignment.label === "Bakhtiar")?.allergies, undefined);
  assert.equal(assignments.find((assignment) => assignment.label === "Doris")?.allergies, "Honey allergy");
  assert.equal(assignments.find((assignment) => assignment.label === "Fatima")?.accessibility, "Baby chair required");
  const table = (key) => FINAL_SEATING_PLAN.find((entry) => entry.key === key);
  assert.deepEqual(table("table-2")?.seats.slice(8).map(({ label, meal }) => [label, meal]), [["Alyn", "Lamb"], ["Fatima", "Kids meal"], ["Mirza", "Lamb"]]);
  assert.deepEqual(table("table-10")?.seats.slice(8).map(({ label, meal }) => [label, meal]), [["Datuk Jerry Axton", "Lamb"], ["Datin Jerry Axton", "Salmon"]]);
  assert.deepEqual(table("table-11")?.seats.slice(4).map(({ label, meal }) => [label, meal]), [["Datin Angie Teh", "Salmon"], ["Datuk Lee Jin Bok", "Lamb"], ["Syed Wafa", "Lamb"], ["Ismail Ani Arope", "Lamb"]]);
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
  const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  for (const afterPartyGuest of FINAL_AFTER_PARTY_LIST) {
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
  assert.deepEqual(counts, { "elaine-viking": 23, "haykal-viking": 17, "table-3a": 6, "table-1": 7, vip: 2, "table-8": 4 });
});
