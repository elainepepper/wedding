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

/**
 * Keep the traditional order used on the invitation when a household contains
 * a titled couple: husband first, wife second. Other family members follow in
 * their existing database order.
 * @param {{ id?: unknown, first_name?: unknown, last_name?: unknown, preferred_name?: unknown }} guest
 */
function invitationTitleRank(guest) {
  const name = `${guest.first_name ?? ""} ${guest.last_name ?? ""} ${guest.preferred_name ?? ""}`
    .trim()
    .toLowerCase();
  if (/(?:^|\s)(?:mr\.?|datuk|dato['’]?)(?:\s|$)/i.test(name)) return 0;
  if (/(?:^|\s)(?:mrs\.?|datin)(?:\s|$)/i.test(name)) return 1;
  return 2;
}

/**
 * Comparator for members of one invitation household.
 * @param {{ id?: unknown, first_name?: unknown, last_name?: unknown, preferred_name?: unknown }} a
 * @param {{ id?: unknown, first_name?: unknown, last_name?: unknown, preferred_name?: unknown }} b
 */
export function compareInvitationGuests(a, b) {
  const titleDifference = invitationTitleRank(a) - invitationTitleRank(b);
  if (titleDifference) return titleDifference;
  return Number(a.id ?? 0) - Number(b.id ?? 0);
}
