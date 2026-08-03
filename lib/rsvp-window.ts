// The RSVP window stays open until the end of the deadline day in Kuala
// Lumpur (UTC+8), so an Australian guest replying on the evening of the
// deadline is never turned away early.
export function rsvpDeadlinePassed(deadline: unknown, now = Date.now()) {
  if (typeof deadline !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return false;
  const closesAt = Date.parse(`${deadline}T23:59:59+08:00`);
  return Number.isFinite(closesAt) && now > closesAt;
}

export function rsvpDeadlineLabel(deadline: unknown) {
  if (typeof deadline !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return null;
  const parsed = new Date(`${deadline}T12:00:00+08:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kuala_Lumpur" }).format(parsed);
}
