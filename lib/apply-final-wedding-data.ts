import { nextId, serverTimestamp, weddingRef } from "./firebase-admin";
import { FINAL_AFTER_PARTY_COUNT, FINAL_AFTER_PARTY_LIST } from "./final-after-party-list";
import { FINAL_SEATING_GUEST_COUNT, FINAL_SEATING_PLAN } from "./final-seating-plan";
import { canonicalRsvpStatus, isEnabledFlag } from "./rsvp-data.mjs";

const FINAL_DATA_VERSION = "2026-11-03-154-seats-59-after-hours";

const key = (value: unknown) => String(value ?? "")
  .trim()
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[‘’`]/g, "'")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

let running: Promise<{ applied: boolean; version: string }> | null = null;

async function applyFinalWeddingData() {
  const rootSnapshot = await weddingRef.get();
  if (rootSnapshot.data()?.final_data_version === FINAL_DATA_VERSION) {
    return { applied: false, version: FINAL_DATA_VERSION };
  }

  const [guestSnapshot, householdSnapshot, tableSnapshot] = await Promise.all([
    weddingRef.collection("guests").get(),
    weddingRef.collection("households").get(),
    weddingRef.collection("tables").get(),
  ]);
  const activeGuests = guestSnapshot.docs.filter((doc) => !isEnabledFlag(doc.data().archived));
  const activeReceptionGuests = activeGuests.filter((doc) => key(doc.data().category) !== "crew");
  const householdNames = new Map(householdSnapshot.docs.map((doc) => [Number(doc.data().id), String(doc.data().name ?? "")]));

  const matchGuest = (label: string, aliases: string[] = [], householdHintValue?: string) => {
    const acceptedNames = new Set([label, ...aliases].map(key).filter(Boolean));
    const householdHint = key(householdHintValue);
    return activeGuests.filter((doc) => {
      const data = doc.data();
      const preferred = key(data.preferred_name);
      const full = key(`${String(data.first_name ?? "")} ${String(data.last_name ?? "")}`);
      if (!acceptedNames.has(preferred) && !acceptedNames.has(full)) return false;
      if (!householdHint) return true;
      const household = key(householdNames.get(Number(data.household_id)) ?? "");
      return Boolean(household) && (household.includes(householdHint) || householdHint.includes(household));
    });
  };

  const seatingMatches: Array<{
    doc: (typeof activeGuests)[number];
    tableKey: string;
    assignment: (typeof FINAL_SEATING_PLAN)[number]["seats"][number];
  }> = [];
  const seatingGuestIds = new Set<number>();
  const seatingProblems: string[] = [];
  for (const table of FINAL_SEATING_PLAN) {
    for (const assignment of table.seats) {
      const candidates = matchGuest(assignment.label, assignment.aliases, assignment.household);
      const reference = `${table.name}, seat ${assignment.seat}: ${assignment.label}`;
      if (candidates.length !== 1) {
        seatingProblems.push(`${reference} (${candidates.length ? "ambiguous" : "not found"})`);
        continue;
      }
      const guestId = Number(candidates[0].data().id);
      if (seatingGuestIds.has(guestId)) {
        seatingProblems.push(`${reference} (guest appears twice)`);
        continue;
      }
      seatingGuestIds.add(guestId);
      seatingMatches.push({ doc: candidates[0], tableKey: table.key, assignment });
    }
  }

  const afterPartyGuestIds = new Set<number>();
  const afterPartyProblems: string[] = [];
  for (const assignment of FINAL_AFTER_PARTY_LIST) {
    const candidates = matchGuest(assignment.label, assignment.aliases, assignment.household);
    const reference = `${assignment.label} (${assignment.tableKey}, seat ${assignment.seat})`;
    if (candidates.length !== 1) {
      afterPartyProblems.push(`${reference} (${candidates.length ? "ambiguous" : "not found"})`);
      continue;
    }
    const guestId = Number(candidates[0].data().id);
    if (afterPartyGuestIds.has(guestId)) {
      afterPartyProblems.push(`${reference} (guest appears twice)`);
      continue;
    }
    afterPartyGuestIds.add(guestId);
  }

  if (seatingProblems.length || seatingMatches.length !== FINAL_SEATING_GUEST_COUNT) {
    throw new Error(`Final seating migration stopped: ${seatingProblems.slice(0, 8).join("; ") || `${seatingMatches.length}/${FINAL_SEATING_GUEST_COUNT} resolved`}`);
  }
  if (afterPartyProblems.length || afterPartyGuestIds.size !== FINAL_AFTER_PARTY_COUNT) {
    throw new Error(`Final After Hours migration stopped: ${afterPartyProblems.slice(0, 8).join("; ") || `${afterPartyGuestIds.size}/${FINAL_AFTER_PARTY_COUNT} resolved`}`);
  }

  const existingTables = tableSnapshot.docs;
  const tableDocs = new Map<string, (typeof existingTables)[number] | null>();
  const usedTableDocs = new Set<string>();
  for (const plan of FINAL_SEATING_PLAN) {
    const acceptedNames = new Set(plan.aliases.map(key));
    const matches = existingTables.filter((doc) => acceptedNames.has(key(doc.data().name)));
    if (matches.length > 1) throw new Error(`${plan.name} matches more than one existing table.`);
    const match = matches[0] ?? null;
    if (match && usedTableDocs.has(match.id)) throw new Error(`${plan.name} reuses an already matched table.`);
    if (match) usedTableDocs.add(match.id);
    tableDocs.set(plan.key, match);
  }

  const missingTableCount = [...tableDocs.values()].filter((doc) => !doc).length;
  const firstNewTableId = missingTableCount ? await nextId("tables", missingTableCount) : 0;
  let newTableOffset = 0;
  const tableIds = new Map<string, number>();
  for (const plan of FINAL_SEATING_PLAN) {
    const doc = tableDocs.get(plan.key);
    tableIds.set(plan.key, doc ? Number(doc.data().id) : firstNewTableId + newTableOffset++);
  }

  const seatingByGuestId = new Map(seatingMatches.map((match) => [Number(match.doc.data().id), match]));
  const batch = weddingRef.firestore.batch();
  for (const plan of FINAL_SEATING_PLAN) {
    const existing = tableDocs.get(plan.key);
    const id = tableIds.get(plan.key) as number;
    const ref = existing?.ref ?? weddingRef.collection("tables").doc(String(id));
    batch.set(ref, {
      id,
      final_plan_key: plan.key,
      name: plan.name,
      shape: plan.shape,
      capacity: plan.capacity,
      x: plan.x,
      y: plan.y,
      locked: plan.locked ? 1 : 0,
      notes: plan.notes,
      updated_at: serverTimestamp(),
      ...(existing ? {} : { created_at: serverTimestamp() }),
    }, { merge: true });
  }

  for (const doc of activeGuests) {
    const data = doc.data();
    const guestId = Number(data.id);
    const seating = seatingByGuestId.get(guestId);
    const afterPartyInvited = afterPartyGuestIds.has(guestId);
    const update: Record<string, unknown> = {
      after_party_eligible: afterPartyInvited ? 1 : 0,
      after_party_invited: afterPartyInvited ? 1 : 0,
      updated_at: serverTimestamp(),
    };
    if (seating) {
      update.rsvp_status = "Confirmed";
      update.table_id = tableIds.get(seating.tableKey);
      update.seat_number = seating.assignment.seat;
      update.meal_selection = seating.assignment.meal === "Lamb" || seating.assignment.meal === "Salmon" ? seating.assignment.meal : null;
      update.child_meal = seating.assignment.meal === "Kids meal" ? 1 : 0;
      update.dietary_requirements = seating.assignment.dietaryRequirements ?? null;
      update.allergies = seating.assignment.allergies ?? null;
      if (seating.assignment.accessibility) update.accessibility = seating.assignment.accessibility;
    } else if (activeReceptionGuests.includes(doc)) {
      update.table_id = null;
      update.seat_number = null;
      if (canonicalRsvpStatus(data.rsvp_status) === "Confirmed") update.rsvp_status = "Declined";
    }
    batch.set(doc.ref, update, { merge: true });
  }

  batch.set(weddingRef, {
    final_data_version: FINAL_DATA_VERSION,
    final_data_applied_at: serverTimestamp(),
    final_seating_guest_count: FINAL_SEATING_GUEST_COUNT,
    final_after_party_guest_count: FINAL_AFTER_PARTY_COUNT,
  }, { merge: true });
  const activityRef = weddingRef.collection("activityLogs").doc();
  batch.set(activityRef, {
    admin_name: "System",
    action: "Final wedding lists automatically applied",
    record_type: "wedding",
    record_id: FINAL_DATA_VERSION,
    detail: `${FINAL_SEATING_GUEST_COUNT} reception seats and ${FINAL_AFTER_PARTY_COUNT} After Hours guests`,
    created_at: serverTimestamp(),
  });
  await batch.commit();
  return { applied: true, version: FINAL_DATA_VERSION };
}

export function ensureFinalWeddingDataApplied() {
  if (!running) {
    running = applyFinalWeddingData().catch((error) => {
      running = null;
      throw error;
    });
  }
  return running;
}

