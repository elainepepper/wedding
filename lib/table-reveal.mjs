export const DEFAULT_TABLE_REVEAL_DATE = "2026-10-25";

/**
 * Guest seating stays private until midnight in Kuala Lumpur on the release
 * date. The manager can continue assigning tables before then without those
 * assignments leaking through a personalised invitation or table link.
 */
export function isTableRevealOpen(value, now = Date.now()) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))
    ? String(value)
    : DEFAULT_TABLE_REVEAL_DATE;
  return now >= Date.parse(`${date}T00:00:00+08:00`);
}
