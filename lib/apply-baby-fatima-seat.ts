import { serverTimestamp, weddingRef } from "./firebase-admin";

export const BABY_FATIMA_SEATING_VERSION = "2026-11-04-fatima-between-alyn-and-mirza";

const key = (value: unknown) => String(value ?? "")
  .trim()
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

let running: Promise<{ applied: boolean; version: string }> | null = null;

async function applyBabyFatimaSeat() {
  const root = await weddingRef.get();
  if (root.data()?.baby_fatima_seating_version === BABY_FATIMA_SEATING_VERSION) {
    return { applied: false, version: BABY_FATIMA_SEATING_VERSION };
  }

  const [guests, households, tables] = await Promise.all([
    weddingRef.collection("guests").get(),
    weddingRef.collection("households").get(),
    weddingRef.collection("tables").get(),
  ]);
  const mirzaHouseholds = households.docs.filter((doc) => key(doc.data().name) === "mirza faiz");
  if (mirzaHouseholds.length !== 1) throw new Error(`Baby Fatima seating stopped: Mirza Faiz household matched ${mirzaHouseholds.length} records.`);
  const householdId = Number(mirzaHouseholds[0].data().id);
  const householdGuests = guests.docs.filter((doc) => Number(doc.data().household_id) === householdId);
  const named = (name: string) => householdGuests.filter((doc) => {
    const data = doc.data();
    return key(data.preferred_name) === key(name) || key(`${data.first_name ?? ""} ${data.last_name ?? ""}`) === key(name);
  });
  const fatima = named("Fatima");
  const alyn = named("Alyn");
  const mirza = named("Mirza");
  if (fatima.length !== 1 || alyn.length !== 1 || mirza.length !== 1) {
    throw new Error(`Baby Fatima seating stopped: Fatima/Alyn/Mirza matches were ${fatima.length}/${alyn.length}/${mirza.length}.`);
  }
  const tableMatches = tables.docs.filter((doc) => doc.data().final_plan_key === "table-2" || key(doc.data().name).startsWith("table 2 haykal s family"));
  if (tableMatches.length !== 1) throw new Error(`Baby Fatima seating stopped: Table 2 matched ${tableMatches.length} records.`);
  const table = tableMatches[0];
  const tableId = Number(table.data().id);
  const batch = weddingRef.firestore.batch();
  batch.set(table.ref, {
    capacity: 11,
    notes: "Haykal's family · 10 dining chairs plus a baby chair between Alyn and Mirza",
    updated_at: serverTimestamp(),
  }, { merge: true });
  batch.set(alyn[0].ref, { table_id: tableId, seat_number: 9, updated_at: serverTimestamp() }, { merge: true });
  batch.set(fatima[0].ref, {
    rsvp_status: "Confirmed",
    table_id: tableId,
    seat_number: 10,
    child_meal: 1,
    accessibility: "Baby chair required",
    updated_at: serverTimestamp(),
  }, { merge: true });
  batch.set(mirza[0].ref, { table_id: tableId, seat_number: 11, updated_at: serverTimestamp() }, { merge: true });
  batch.set(weddingRef, {
    baby_fatima_seating_version: BABY_FATIMA_SEATING_VERSION,
    baby_fatima_seating_applied_at: serverTimestamp(),
    final_seating_guest_count: 155,
  }, { merge: true });
  batch.set(weddingRef.collection("activityLogs").doc(), {
    admin_name: "System",
    action: "Baby Fatima seating applied",
    record_type: "guest",
    record_id: String(fatima[0].data().id),
    detail: "Table 2 baby chair between Alyn and Mirza",
    created_at: serverTimestamp(),
  });
  await batch.commit();
  return { applied: true, version: BABY_FATIMA_SEATING_VERSION };
}

export function ensureBabyFatimaSeatApplied() {
  if (!running) {
    running = applyBabyFatimaSeat().catch((error) => {
      running = null;
      throw error;
    });
  }
  return running;
}
