/** @typedef {"Pending" | "Confirmed" | "Declined"} RsvpStatus */

/**
 * Imported guest lists have historically contained the same RSVP states with
 * different casing (and, in a few older exports, plain yes/no wording). Keep
 * one canonical contract at every server boundary so counts and forms cannot
 * silently lose those guests.
 * @param {unknown} value
 * @returns {RsvpStatus}
 */
export function canonicalRsvpStatus(value) {
  const normalised = String(value ?? "").trim().toLowerCase();
  if (["confirmed", "attending", "accepted", "yes"].includes(normalised)) {
    return "Confirmed";
  }
  if (["declined", "not attending", "unable to attend", "no"].includes(normalised)) {
    return "Declined";
  }
  return "Pending";
}

/** @param {unknown} value */
export function isChildAgeGroup(value) {
  return /^(child|infant|baby|kid)$/i.test(String(value ?? "").trim());
}

/** @param {unknown} value */
export function canonicalAgeGroup(value) {
  return isChildAgeGroup(value) ? "Child" : "Adult";
}

/** @param {unknown} value */
export function isEnabledFlag(value) {
  return value === true || value === 1 || String(value ?? "").trim().toLowerCase() === "true" || String(value ?? "").trim() === "1";
}

/** @param {unknown} value */
export function isValidInternationalMobile(value) {
  return /^\+[0-9]{8,15}$/.test(String(value ?? "").trim());
}

/**
 * Parse an optional integer without turning an empty form value into zero.
 * JavaScript's Number(null) and Number("") both equal 0, which previously
 * left an invalid table id behind when a Manager unseated a guest.
 * @param {unknown} value
 * @returns {number | null}
 */
export function optionalInteger(value) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}
