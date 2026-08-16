import { assertFirebaseAdminConfigured, weddingRef } from "../../../../lib/firebase-admin";
import { requireAdmin } from "../../../../lib/manager-auth";
import { canonicalRsvpStatus, isChildAgeGroup, isEnabledFlag } from "../../../../lib/rsvp-data.mjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * A health check that runs against the real database.
 *
 * Every fault it looks for is one that has actually bitten this project: a
 * field saved in the wrong type so a query silently skips the record, an id
 * stored as a string where a number is expected, a household with no token so
 * its guests can never open their invitation. None of these show up as an
 * error anywhere — the guest simply sees the wrong thing.
 *
 * It only reads. It changes nothing.
 */
type Check = { name: string; ok: boolean; detail: string; affected?: string[] };

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return Response.json({ error: "Not signed in." }, { status: 401 });

  try {
    assertFirebaseAdminConfigured();
    const [householdSnap, guestSnap, tableSnap] = await Promise.all([
      weddingRef.collection("households").get(),
      weddingRef.collection("guests").get(),
      weddingRef.collection("tables").get(),
    ]);

    const households = householdSnap.docs.map((d) => d.data());
    const rawGuests: Array<Record<string, unknown>> = guestSnap.docs.map((d) => d.data() as Record<string, unknown>);
    const guests: Array<Record<string, unknown> & { rsvp_status: ReturnType<typeof canonicalRsvpStatus> }> = rawGuests.map((guest) => ({
      ...guest,
      rsvp_status: canonicalRsvpStatus(guest.rsvp_status),
    }));
    const tables = tableSnap.docs.map((d) => d.data());
    const name = (g: Record<string, unknown>) =>
      `${g.first_name ?? ""} ${g.last_name ?? ""}`.trim() || String(g.id ?? "?");

    const checks: Check[] = [];
    const add = (n: string, bad: string[], good: string, badly: string) =>
      checks.push({ name: n, ok: bad.length === 0, detail: bad.length ? `${bad.length} ${badly}` : good, affected: bad.slice(0, 12) });

    // 1. every household needs a token, or its guests can never get in
    add("Every household has an invitation link",
      households.filter((h) => !h.invitation_token).map((h) => String(h.name ?? h.id)),
      "all households have a token", "have no token — their guests cannot open the invitation");

    // 2. two households sharing a token would show each other's details
    const seen = new Map<string, number>();
    households.forEach((h) => { const t = String(h.invitation_token ?? ""); if (t) seen.set(t, (seen.get(t) ?? 0) + 1); });
    add("Invitation links are unique",
      [...seen.entries()].filter(([, n]) => n > 1).map(([t]) => t),
      "every link is unique", "links are shared by more than one household");

    // 3. the flag the invitation lookup reads
    add("Invitation links are switched on",
      households.filter((h) => h.invitation_enabled === false || h.invitation_enabled === 0)
        .map((h) => String(h.name ?? h.id)),
      "no household is switched off", "are switched off and will read as 'resting'");

    // 4. a guest whose household id does not match any household
    const householdIds = new Set(households.map((h) => String(h.id)));
    add("Every guest belongs to a household that exists",
      guests.filter((g) => !isEnabledFlag(g.archived) && !householdIds.has(String(g.household_id))).map(name),
      "every guest is attached correctly", "are attached to a household that no longer exists");

    // 5. a guest seated at a table that was deleted
    const tableIds = new Set(tables.map((t) => String(t.id)));
    add("Everyone seated is seated at a real table",
      guests.filter((g) => g.table_id != null && !tableIds.has(String(g.table_id))).map(name),
      "no one is stranded", "are seated at a table that no longer exists");

    // 6. tables holding more people than they seat
    add("No table is over capacity",
      tables.filter((t) => guests.filter((g) => String(g.table_id) === String(t.id) && g.rsvp_status === "Confirmed").length > Number(t.capacity ?? 0))
        .map((t) => String(t.name)),
      "every table fits its guests", "hold more guests than they have seats");

    // 7. numbers WhatsApp cannot dial
    add("Mobile numbers can be reached on WhatsApp",
      guests.filter((g) => g.mobile && !/^\+?[1-9]\d{7,}$/.test(String(g.mobile).replace(/[^0-9+]/g, "")))
        .map((g) => `${name(g)} (${g.mobile})`),
      "every saved number looks dialable", "numbers are missing a country code or are too short");

    // 8. guests who replied yes but gave no number
    add("Everyone attending left a contact number",
      guests.filter((g) => g.rsvp_status === "Confirmed" && !g.mobile).map(name),
      "everyone attending can be reached", "have accepted but left no number");

    // 9. guests attending with no meal chosen
    add("Everyone attending has chosen dinner",
      guests.filter((g) => g.rsvp_status === "Confirmed" && !isChildAgeGroup(g.age_group) && !isEnabledFlag(g.child_meal) && !g.meal_selection).map(name),
      "every meal is chosen", "have accepted but have not chosen a main course");

    // 10. ids stored as strings where the code compares numbers
    add("Ids are stored as numbers",
      guests.filter((g) => typeof g.household_id === "string" || typeof g.table_id === "string").map(name),
      "every id is a number", "have an id stored as text, which some lookups will miss");

    // 11. imported values such as "pending" render correctly now, but should
    // still be surfaced so the underlying database can be tidied deliberately.
    add("RSVP statuses use the canonical values",
      rawGuests.filter((g) => String(g.rsvp_status ?? "Pending") !== canonicalRsvpStatus(g.rsvp_status)).map(name),
      "every RSVP status is canonical", "statuses use legacy casing or wording");

    const failing = checks.filter((c) => !c.ok);
    return Response.json({
      ok: failing.length === 0,
      summary: failing.length ? `${failing.length} of ${checks.length} checks need attention` : `All ${checks.length} checks pass`,
      counts: { households: households.length, guests: guests.filter((g) => !isEnabledFlag(g.archived)).length, tables: tables.length },
      checks,
    });
  } catch {
    return Response.json({ error: "The health check could not run." }, { status: 500 });
  }
}
