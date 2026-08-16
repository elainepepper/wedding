import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalAgeGroup,
  canonicalRsvpStatus,
  isChildAgeGroup,
  isEnabledFlag,
  isValidInternationalMobile,
  optionalInteger,
} from "../lib/rsvp-data.mjs";

test("canonicalises current and legacy RSVP values", () => {
  assert.equal(canonicalRsvpStatus("Confirmed"), "Confirmed");
  assert.equal(canonicalRsvpStatus("confirmed"), "Confirmed");
  assert.equal(canonicalRsvpStatus("yes"), "Confirmed");
  assert.equal(canonicalRsvpStatus("DECLINED"), "Declined");
  assert.equal(canonicalRsvpStatus("Unable to attend"), "Declined");
  assert.equal(canonicalRsvpStatus("pending"), "Pending");
  assert.equal(canonicalRsvpStatus("unexpected import value"), "Pending");
});

test("keeps named children in the same explicit age contract", () => {
  for (const value of ["Child", "child", "kid", "Infant", "baby"]) {
    assert.equal(isChildAgeGroup(value), true);
    assert.equal(canonicalAgeGroup(value), "Child");
  }
  assert.equal(isChildAgeGroup("Adult"), false);
  assert.equal(canonicalAgeGroup(undefined), "Adult");
});

test("accepts only normalised international mobile numbers", () => {
  assert.equal(isValidInternationalMobile("+60123456789"), true);
  assert.equal(isValidInternationalMobile("+61412345678"), true);
  assert.equal(isValidInternationalMobile("+60"), false);
  assert.equal(isValidInternationalMobile("0123456789"), false);
});

test("normalises imported boolean flags without treating string zero as true", () => {
  assert.equal(isEnabledFlag(true), true);
  assert.equal(isEnabledFlag(1), true);
  assert.equal(isEnabledFlag("1"), true);
  assert.equal(isEnabledFlag("true"), true);
  assert.equal(isEnabledFlag("0"), false);
  assert.equal(isEnabledFlag(false), false);
});

test("does not turn an empty optional id into a real zero id", () => {
  assert.equal(optionalInteger(null), null);
  assert.equal(optionalInteger(undefined), null);
  assert.equal(optionalInteger(""), null);
  assert.equal(optionalInteger(false), null);
  assert.equal(optionalInteger("12"), 12);
  assert.equal(optionalInteger(12), 12);
  assert.equal(optionalInteger("12.5"), null);
});
