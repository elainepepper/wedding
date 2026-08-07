import { assertFirebaseAdminConfigured, nextId, plainDoc, randomToken, serverTimestamp, weddingRef } from "../../../lib/firebase-admin";
import { requireAdmin } from "../../../lib/manager-auth";
import { normaliseSiteDesign } from "../../../lib/site-design";

// Never serve a cached copy: the manager must see a change the instant it is
// made, and an invitation must reflect the latest reply.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
const integer = (value: unknown) => Number.isInteger(Number(value)) ? Number(value) : null;
const ids = (value: unknown) => Array.isArray(value) ? value.map(integer).filter((item): item is number => item !== null) : [];

async function docById(collection: string, id: number) {
  const snapshot = await weddingRef.collection(collection).where("id", "==", id).limit(1).get();
  return snapshot.empty ? null : snapshot.docs[0];
}

async function addActivity(adminName: string, action: string, recordType: string, recordId: string | number | null, detail: string) {
  await weddingRef.collection("activityLogs").add({ admin_name: adminName, action, record_type: recordType, record_id: recordId == null ? null : String(recordId), detail, created_at: serverTimestamp() });
}

export async function GET(request: Request) {
  try {
    assertFirebaseAdminConfigured();
    const admin = await requireAdmin(request);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const [guestSnapshot, householdSnapshot, tableSnapshot, eventSnapshot, activitySnapshot, settingsSnapshot, managerSnapshot] = await Promise.all([
      // No "where" on archived: Firestore drops documents missing the field,
      // which silently hid imported guests from the manager as well.
      weddingRef.collection("guests").get(),
      weddingRef.collection("households").get(),
      weddingRef.collection("tables").get(),
      weddingRef.collection("events").get(),   // enabled is judged in code: a where() drops records missing the field
      weddingRef.collection("activityLogs").orderBy("created_at", "desc").limit(30).get(),
      weddingRef.get(),
      weddingRef.collection("admins").get(),   // active is judged below: a record saving 1 rather than true would be dropped by a where()
    ]);
    const households = householdSnapshot.docs.map(plainDoc);
    const tables = tableSnapshot.docs.map(plainDoc);
    const householdById = new Map(households.map((item) => [Number(item.id), item]));
    const tableById = new Map(tables.map((item) => [Number(item.id), item]));
    const guests: Array<Record<string, unknown>> = guestSnapshot.docs.map(plainDoc)
      .filter((item) => !Number(item.archived ?? 0))
      .filter((item) => !/^(child|infant|baby|kid)$/i.test(String(item.age_group ?? "Adult").trim()))
      .map((guest): Record<string, unknown> => {
      const household = householdById.get(Number(guest.household_id));
      const table = tableById.get(Number(guest.table_id));
      return { ...guest, household_name: household?.name ?? null, invitation_slug: household?.invitation_slug ?? null, invitation_token: household?.invitation_token ?? null, invitation_enabled: household?.invitation_enabled ?? 0, opened_at: household?.opened_at ?? null, last_activity_at: household?.last_activity_at ?? null, table_seen_at: household?.table_seen_at ?? null, table_name: table?.name ?? null };
    }).sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")));
    const householdRows: Array<Record<string, unknown>> = households.map((household): Record<string, unknown> => {
      const members = guests.filter((guest) => Number(guest.household_id) === Number(household.id));
      return { ...household, guest_count: members.length, max_guests: members.length, confirmed_count: members.filter((guest) => guest.rsvp_status === "Confirmed").length, declined_count: members.filter((guest) => guest.rsvp_status === "Declined").length };
    }).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const tableRows: Array<Record<string, unknown>> = tables.map((table): Record<string, unknown> => ({ ...table, guest_count: guests.filter((guest) => guest.rsvp_status === "Confirmed" && Number(guest.table_id) === Number(table.id)).length })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const ownerEmail = (process.env.WEDDING_OWNER_EMAIL || "haykalelaine@gmail.com").toLowerCase();
    const managers = [
      { id: 0, email: ownerEmail, name: "Wedding owner", role: "owner", active: 1, created_at: null },
      // the flag is read here rather than in the query, so a record storing 1
      // or omitting the field is still shown
      ...managerSnapshot.docs.map(plainDoc).filter((entry) => {
        const flag = (entry as { active?: unknown }).active;
        return !(flag === false || flag === 0 || flag === "false");
      }),
    ];
    return Response.json({
      admin: { displayName: admin.displayName, email: admin.email, role: admin.role },
      guests,
      households: householdRows,
      tables: tableRows,
      events: eventSnapshot.docs.map(plainDoc).filter((event) => Number((event as { is_enabled?: unknown }).is_enabled ?? 1) !== 0).sort((a, b) => Number(a.sort_order) - Number(b.sort_order)),
      activities: activitySnapshot.docs.map(plainDoc),
      settings: settingsSnapshot.data() ?? {},
      managers,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The Guest Manager server could not start." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertFirebaseAdminConfigured();
    const admin = await requireAdmin(request);
    if (!admin) return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
    const payload = await request.json() as Record<string, unknown>;
    const action = clean(payload.action, 60);
    if (action === "addGuest") {
      const firstName = clean(payload.firstName, 100);
      const lastName = clean(payload.lastName, 100);
      const mobile = clean(payload.mobile, 60);
      if (!firstName) return Response.json({ error: "First name is required." }, { status: 400 });
      // A number is welcome but not required — the import allows guests without
      // one, and a guest gives their own when they reply. Only the shape is checked.
      if (mobile && !/^\+[0-9][0-9\s()-]{7,20}$/.test(mobile)) {
        return Response.json({ error: "That mobile number needs its country code, like +60 12 345 6789." }, { status: 400 });
      }
      let householdId = integer(payload.householdId);
      if (!householdId) {
        householdId = await nextId("households");
        const householdName = clean(payload.householdName, 180) || `${firstName} ${lastName}`.trim();
        await weddingRef.collection("households").doc(String(householdId)).set({ id: householdId, name: householdName, mobile: mobile || null, max_guests: 1, invitation_slug: householdName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80), invitation_token: randomToken(), invitation_enabled: true, opened_at: null, last_activity_at: null, created_at: serverTimestamp(), updated_at: serverTimestamp() });
      }
      const guestId = await nextId("guests");
      await weddingRef.collection("guests").doc(String(guestId)).set({ id: guestId, household_id: householdId, first_name: firstName, last_name: lastName, preferred_name: clean(payload.preferredName, 100) || null, mobile, category: clean(payload.category, 80) || "Friends", side: clean(payload.side, 40) || "Shared", age_group: "Adult", relationship: null, rsvp_status: clean(payload.rsvpStatus, 30) || "Pending", ceremony_invited: payload.ceremonyInvited === false ? 0 : 1, ceremony_attending: null, reception_invited: payload.receptionInvited === false ? 0 : 1, reception_attending: null, after_party_eligible: payload.afterPartyEligible ? 1 : 0, after_party_invited: payload.afterPartyInvited ? 1 : 0, after_party_attending: "Pending", meal_selection: null, dietary_requirements: clean(payload.dietaryRequirements, 800) || null, allergies: clean(payload.allergies, 800) || null, accessibility: clean(payload.accessibility, 800) || null, transport_required: payload.transportRequired ? 1 : 0, accommodation_required: payload.accommodationRequired ? 1 : 0, table_id: null, seat_number: null, invitation_sent: 0, internal_notes: clean(payload.internalNotes, 1500) || null, archived: 0, created_at: serverTimestamp(), updated_at: serverTimestamp() });
      await addActivity(admin.displayName, "Guest added", "guest", guestId, `${firstName} ${lastName}`.trim());
      return Response.json({ ok: true });
    }

    if (action === "editGuest") {
      const guestId = integer(payload.guestId);
      if (!guestId) return Response.json({ error: "Guest not found." }, { status: 400 });
      const guestDoc = await docById("guests", guestId);
      if (!guestDoc) return Response.json({ error: "Guest not found." }, { status: 404 });
      const editMobile = clean(payload.mobile, 60);
      if ("mobile" in payload && editMobile && !/^\+[0-9][0-9\s()-]{7,20}$/.test(editMobile)) {
        return Response.json({ error: "That mobile number needs its country code, like +60 12 345 6789." }, { status: 400 });
      }
      const fields: Record<string, string> = { firstName: "first_name", lastName: "last_name", preferredName: "preferred_name", mobile: "mobile", category: "category", side: "side", rsvpStatus: "rsvp_status", mealSelection: "meal_selection", dietaryRequirements: "dietary_requirements", allergies: "allergies", accessibility: "accessibility", internalNotes: "internal_notes", afterPartyAttending: "after_party_attending", accommodationName: "accommodation_name" };
      const update: Record<string, unknown> = { age_group: "Adult", updated_at: serverTimestamp() };
      Object.entries(fields).forEach(([key, field]) => { if (key in payload) update[field] = clean(payload[key], key === "internalNotes" ? 1500 : 800) || null; });
      const booleans: Record<string, string> = { ceremonyInvited: "ceremony_invited", receptionInvited: "reception_invited", afterPartyEligible: "after_party_eligible", afterPartyInvited: "after_party_invited", transportRequired: "transport_required", accommodationRequired: "accommodation_required" };
      Object.entries(booleans).forEach(([key, field]) => { if (key in payload) update[field] = payload[key] ? 1 : 0; });
      // Moving a guest to another invitation — this was never handled, so
      // changing the household in the form appeared to save and did nothing.
      if ("householdId" in payload) {
        let householdId = integer(payload.householdId);
        if (!householdId) {
          // "Create new household" — give them an invitation of their own
          householdId = await nextId("households");
          const first = clean(payload.firstName, 100) || String(guestDoc.data().first_name ?? "");
          const last = clean(payload.lastName, 100) || String(guestDoc.data().last_name ?? "");
          const householdName = clean(payload.householdName, 180) || `${first} ${last}`.trim() || "New invitation";
          await weddingRef.collection("households").doc(String(householdId)).set({
            id: householdId, name: householdName, mobile: editMobile || null, max_guests: 1,
            invitation_token: randomToken(), invitation_enabled: true, archived: 0,
            created_at: serverTimestamp(), updated_at: serverTimestamp(),
          }, { merge: true });
        }
        update.household_id = householdId;
      }

      await guestDoc.ref.set(update, { merge: true });
      await addActivity(admin.displayName, "Guest edited", "guest", guestId, "Guest details updated");
      return Response.json({ ok: true });
    }

    // Restoring an archived guest — what makes an "undo" possible after a
    // deletion, so one mis-tap does not cost a family their invitation.
    if (action === "restoreGuest") {
      const guestId = integer(payload.guestId);
      const guestDoc = guestId ? await docById("guests", guestId) : null;
      if (!guestDoc) return Response.json({ error: "Guest not found." }, { status: 404 });
      await guestDoc.ref.set({ archived: 0, updated_at: serverTimestamp() }, { merge: true });
      await addActivity(admin.displayName, "Guest restored", "guest", guestId as number, "Brought back from the archive");
      return Response.json({ ok: true });
    }

    if (action === "archiveGuest" || action === "deleteGuest") {
      const guestId = integer(payload.guestId);
      const guestDoc = guestId ? await docById("guests", guestId) : null;
      if (!guestId || !guestDoc) return Response.json({ error: "Guest not found." }, { status: 404 });
      if (action === "archiveGuest") await guestDoc.ref.set({ archived: 1, updated_at: serverTimestamp() }, { merge: true }); else await guestDoc.ref.delete();
      await addActivity(admin.displayName, action === "archiveGuest" ? "Guest archived" : "Guest deleted", "guest", guestId, action === "archiveGuest" ? "Guest moved to archive" : "Guest permanently removed");
      return Response.json({ ok: true });
    }

    if (action === "bulkUpdate") {
      const guestIds = ids(payload.guestIds);
      const fieldMap: Record<string, string> = { category: "category", side: "side", rsvpStatus: "rsvp_status", tableId: "table_id", afterPartyEligible: "after_party_eligible", afterPartyInvited: "after_party_invited" , finalMessageSentAt: "final_message_sent_at" };
      const field = clean(payload.field, 50);
      const targetField = fieldMap[field];
      if (!guestIds.length || !targetField) return Response.json({ error: "Choose guests and a valid update." }, { status: 400 });
      let value: unknown = payload.value;
      if (field === "tableId") value = integer(value);
      if (field === "afterPartyEligible" || field === "afterPartyInvited") value = value ? 1 : 0;
      const batch = weddingRef.firestore.batch();
      for (const guestId of guestIds) { const doc = await docById("guests", guestId); if (doc) batch.set(doc.ref, { [targetField]: value ?? null, updated_at: serverTimestamp() }, { merge: true }); }
      await batch.commit();
      await addActivity(admin.displayName, "Guests bulk edited", "guest", guestIds.join(","), `${field} updated for ${guestIds.length} guests`);
      return Response.json({ ok: true });
    }

    if (action === "createTable") {
      const name = clean(payload.name, 100);
      if (!name) return Response.json({ error: "Table name is required." }, { status: 400 });
      const id = await nextId("tables");
      await weddingRef.collection("tables").doc(String(id)).set({ id, name, shape: ["round", "rectangular", "banquet"].includes(clean(payload.shape, 30)) ? clean(payload.shape, 30) : "round", capacity: Math.max(1, Math.min(200, integer(payload.capacity) ?? 10)), x: Number(payload.x) || 50, y: Number(payload.y) || 50, locked: 0, notes: null, created_at: serverTimestamp(), updated_at: serverTimestamp() });
      await addActivity(admin.displayName, "Table created", "table", id, name);
      return Response.json({ ok: true });
    }

    if (action === "deleteHousehold") {
      const householdId = integer(payload.householdId);
      const householdDoc = householdId ? await docById("households", householdId) : null;
      if (!householdDoc) return Response.json({ error: "Household not found." }, { status: 404 });
      // Everyone on the invitation goes with it — a household without guests
      // is meaningless, and a guest without a household can never be reached.
      const members = await weddingRef.collection("guests")
        .where("household_id", "in", [Number(householdId), String(householdId)]).get();
      await Promise.all(members.docs.map((doc) => doc.ref.delete()));
      await householdDoc.ref.delete();
      await addActivity(admin.displayName, "Household removed", "household", householdId as number,
        `${String(householdDoc.data().name ?? "")} and ${members.size} guest${members.size === 1 ? "" : "s"}`);
      return Response.json({ ok: true, removedGuests: members.size });
    }

    if (action === "editTable") {
      const tableId = integer(payload.tableId);
      const tableDoc = tableId ? await docById("tables", tableId) : null;
      if (!tableDoc) return Response.json({ error: "Table not found." }, { status: 404 });
      const patch: Record<string, unknown> = { updated_at: serverTimestamp() };
      const name = clean(payload.name, 100);
      if (name) patch.name = name;
      if (payload.capacity !== undefined) patch.capacity = Math.max(1, Math.min(200, integer(payload.capacity) ?? 10));
      if (payload.shape !== undefined) patch.shape = ["round", "rectangular", "banquet"].includes(clean(payload.shape, 30)) ? clean(payload.shape, 30) : "round";
      await tableDoc.ref.set(patch, { merge: true });
      await addActivity(admin.displayName, "Table updated", "table", tableId as number, name || "");
      return Response.json({ ok: true });
    }

    if (action === "deleteTable") {
      const tableId = integer(payload.tableId);
      const tableDoc = tableId ? await docById("tables", tableId) : null;
      if (!tableDoc) return Response.json({ error: "Table not found." }, { status: 404 });
      // anyone seated there is returned to the unseated list rather than orphaned
      // the guests query elsewhere accepts a number or a string id, so this one
      // must too, or deleting a table would strand whoever was seated at it
      const seated = await weddingRef.collection("guests").where("table_id", "in", [Number(tableId), String(tableId)]).get();
      await Promise.all(seated.docs.map((doc) => doc.ref.set({ table_id: null, updated_at: serverTimestamp() }, { merge: true })));
      await tableDoc.ref.delete();
      await addActivity(admin.displayName, "Table removed", "table", tableId as number, String(tableDoc.data().name ?? ""));
      return Response.json({ ok: true, unseated: seated.size });
    }

    if (action === "moveGuest") {
      const guestId = integer(payload.guestId);
      const tableId = integer(payload.tableId);
      const guestDoc = guestId ? await docById("guests", guestId) : null;
      if (!guestId || !guestDoc) return Response.json({ error: "Guest not found." }, { status: 404 });
      if (tableId) {
        const tableDoc = await docById("tables", tableId);
        if (!tableDoc) return Response.json({ error: "Table not found." }, { status: 404 });
        // no "archived" in the query: Firestore drops records missing the field,
        // which would leave those guests pointing at a table that no longer exists
        const seated = await weddingRef.collection("guests").where("table_id", "in", [Number(tableId), String(tableId)]).get();
        if (seated.docs.filter((doc) => Number(doc.data().id) !== guestId).length >= Number(tableDoc.data().capacity)) return Response.json({ error: "That table is already at capacity." }, { status: 409 });
      }
      await guestDoc.ref.set({ table_id: tableId, seat_number: integer(payload.seatNumber), updated_at: serverTimestamp() }, { merge: true });
      await addActivity(admin.displayName, "Guest moved to table", "guest", guestId, tableId ? `Assigned to table ${tableId}` : "Returned to unassigned guests");
      return Response.json({ ok: true });
    }

    if (action === "regenerateLink" || action === "markInvitationSent") {
      const householdId = integer(payload.householdId);
      const householdDoc = householdId ? await docById("households", householdId) : null;
      if (!householdId || !householdDoc) return Response.json({ error: "Household not found." }, { status: 404 });
      if (action === "regenerateLink") await householdDoc.ref.set({
        invitation_token: randomToken(), invitation_enabled: true,
        // regenerating after the deadline is the couple's way of letting this
        // one household reply late — the invite API checks this timestamp
        rsvp_reopened_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }, { merge: true });
      else {
        const members = await weddingRef.collection("guests").where("household_id", "==", householdId).get();
        const batch = weddingRef.firestore.batch();
        members.docs.forEach((doc) => batch.set(doc.ref, { invitation_sent: 1, invitation_sent_at: serverTimestamp(), updated_at: serverTimestamp() }, { merge: true }));
        await batch.commit();
      }
      await addActivity(admin.displayName, action === "regenerateLink" ? "Invitation link regenerated" : "Invitation marked sent", "household", householdId, "Invitation status updated");
      return Response.json({ ok: true });
    }

    if (action === "saveWebsiteDesign") {
      const siteDesign = normaliseSiteDesign(payload.siteDesign);
      await weddingRef.set({ site_design: siteDesign, updated_at: serverTimestamp() }, { merge: true });
      await addActivity(admin.displayName, "Website design published", "settings", "elaine-haykal-2026", `${siteDesign.decorations.length} editable illustrations saved`);
      return Response.json({ ok: true });
    }

    if (action === "saveSettings") {
      await weddingRef.set({ wedding_name: clean(payload.weddingName, 180) || "Elaine & Haykal", couple_names: clean(payload.coupleNames, 180) || "Elaine and Haykal", wedding_date: clean(payload.weddingDate, 20) || "2026-11-07", rsvp_deadline: clean(payload.rsvpDeadline, 20) || "2026-09-15", website_url: clean(payload.websiteUrl, 300) || null, invitation_wording: clean(payload.invitationWording, 1000) || null, confirmation_message: clean(payload.confirmationMessage, 1000) || null, timezone: clean(payload.timezone, 80) || "Australia/Perth", date_format: clean(payload.dateFormat, 40) || "D MMMM YYYY", formspree_form_id: clean(payload.formspreeFormId, 180) || null, cloudinary_cloud_name: clean(payload.cloudinaryCloudName, 180) || null, music_url: clean(payload.musicUrl, 600) || null, music_title: clean(payload.musicTitle, 180) || null, after_party_when: clean(payload.afterPartyWhen, 200) || null, after_party_where: clean(payload.afterPartyWhere, 300) || null, after_party_dress: clean(payload.afterPartyDress, 300) || null, after_party_entry: clean(payload.afterPartyEntry, 300) || null, updated_at: serverTimestamp() }, { merge: true });
      await addActivity(admin.displayName, "Wedding settings updated", "settings", "elaine-haykal-2026", "Settings saved");
      return Response.json({ ok: true });
    }

    if (action === "addManager") {
      if (admin.role !== "owner") return Response.json({ error: "Only the owner can manage dashboard access." }, { status: 403 });
      const email = clean(payload.email, 180).toLowerCase();
      const name = clean(payload.name, 120) || email.split("@")[0] || "Manager";
      const role = payload.role === "partner" || payload.role === "planner" ? payload.role : null;
      if (!email.includes("@") || !role) return Response.json({ error: "Add a valid account email and choose partner or planner." }, { status: 400 });
      const existing = await weddingRef.collection("admins").where("email", "==", email).limit(1).get();
      const id = existing.empty ? await nextId("admins") : Number(existing.docs[0].data().id);
      const ref = existing.empty ? weddingRef.collection("admins").doc(String(id)) : existing.docs[0].ref;
      await ref.set({ id, email, name, role, active: true, updated_at: serverTimestamp(), ...(existing.empty ? { created_at: serverTimestamp() } : {}) }, { merge: true });
      await addActivity(admin.displayName, "Manager access granted", "manager", email, `${name} added as ${role}`);
      return Response.json({ ok: true });
    }

    if (action === "removeManager") {
      if (admin.role !== "owner") return Response.json({ error: "Only the owner can manage dashboard access." }, { status: 403 });
      const managerId = integer(payload.managerId);
      const managerDoc = managerId ? await docById("admins", managerId) : null;
      if (!managerId || !managerDoc) return Response.json({ error: "Manager not found." }, { status: 404 });
      await managerDoc.ref.set({ active: false, updated_at: serverTimestamp() }, { merge: true });
      await addActivity(admin.displayName, "Manager access removed", "manager", managerDoc.data().email, `${managerDoc.data().name} no longer has access`);
      return Response.json({ ok: true });
    }

    if (action === "importGuests") {
      const rows = Array.isArray(payload.rows) ? payload.rows.slice(0, 2000) as Array<Record<string, unknown>> : [];
      const duplicateMode = clean(payload.duplicateMode, 20) || "skip";
      let added = 0, updated = 0, skipped = 0;
      const errors: string[] = [];

      // Read the existing guests and households once. The previous version made
      // five database round-trips per row — hundreds for a full list — which is
      // slow enough to be cut off partway. A cut-off import that is retried is
      // exactly how names end up repeated.
      const [guestSnap, householdSnap] = await Promise.all([
        weddingRef.collection("guests").get(),
        weddingRef.collection("households").get(),
      ]);

      const seenByMobile = new Map<string, { ref: FirebaseFirestore.DocumentReference }>();
      const seenByName = new Map<string, { ref: FirebaseFirestore.DocumentReference }>();
      guestSnap.docs.forEach((doc) => {
        const guest = doc.data();
        if (Number(guest.archived ?? 0)) return;
        if (guest.mobile) seenByMobile.set(String(guest.mobile), { ref: doc.ref });
        seenByName.set(`${String(guest.first_name ?? "").toLowerCase()}|${String(guest.last_name ?? "").toLowerCase()}`, { ref: doc.ref });
      });
      const householdByName = new Map<string, number>();
      householdSnap.docs.forEach((doc) => householdByName.set(String(doc.data().name ?? "").toLowerCase(), Number(doc.data().id)));

      let nextGuestId = await nextId("guests", Math.max(1, rows.length));
      let nextHouseholdId = await nextId("households", Math.max(1, rows.length));

      const writes: Array<() => void> = [];
      let batch = weddingRef.firestore.batch();
      let pending = 0;

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const firstName = clean(row.firstName, 100);
        const lastName = clean(row.lastName, 100);
        const mobile = clean(row.mobile, 60);
        if (!firstName) { errors.push(`Row ${index + 1}: a first name is needed`); continue; }
        if (mobile && !/^\+[0-9][0-9\s()-]{7,20}$/.test(mobile)) {
          errors.push(`Row ${index + 1}: ${firstName} has a number missing its country code`);
          continue;
        }

        const nameKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}`;
        const existing = (mobile ? seenByMobile.get(mobile) : undefined) ?? seenByName.get(nameKey);

        const shared = {
          preferred_name: clean(row.preferredName, 100) || null,
          mobile: mobile || null,
          category: clean(row.category, 80) || "Friends",
          side: clean(row.side, 40) || "Shared",
          age_group: "Adult",
          rsvp_status: clean(row.rsvpStatus, 40) || "Pending",
          dietary_requirements: clean(row.dietaryRequirements, 400) || null,
          allergies: clean(row.allergies, 400) || null,
          internal_notes: clean(row.notes, 800) || null,
          archived: 0,
          updated_at: serverTimestamp(),
        };

        if (existing) {
          if (duplicateMode === "skip") { skipped += 1; continue; }
          batch.set(existing.ref, shared, { merge: true });
          pending += 1; updated += 1;
        } else {
          const householdName = clean(row.household, 180) || `${firstName} ${lastName}`.trim();
          let householdId: number | undefined = householdByName.get(householdName.toLowerCase());
          if (!householdId) {
            const newHouseholdId = nextHouseholdId;
            householdId = newHouseholdId;
            nextHouseholdId += 1;
            householdByName.set(householdName.toLowerCase(), newHouseholdId);
            batch.set(weddingRef.collection("households").doc(String(newHouseholdId)), {
              id: newHouseholdId, name: householdName, mobile: mobile || null, max_guests: 1,
              invitation_token: randomToken(), invitation_enabled: true, archived: 0,
              created_at: serverTimestamp(), updated_at: serverTimestamp(),
            }, { merge: true });
            pending += 1;
          }
          const guestId = nextGuestId;
          nextGuestId += 1;
          const guestRef = weddingRef.collection("guests").doc(String(guestId));
          batch.set(guestRef, {
            id: guestId, household_id: Number(householdId), first_name: firstName, last_name: lastName,
            ceremony_invited: 0, reception_invited: 1, after_party_eligible: 0, after_party_invited: 0,
            created_at: serverTimestamp(), ...shared,
          }, { merge: true });
          pending += 1; added += 1;
          // remember it, so the same name twice in one file is caught too
          seenByName.set(nameKey, { ref: guestRef });
          if (mobile) seenByMobile.set(mobile, { ref: guestRef });
        }

        if (pending >= 400) {                 // Firestore allows 500 per batch
          await batch.commit();
          batch = weddingRef.firestore.batch();
          pending = 0;
        }
      }

      if (pending) await batch.commit();
      void writes;
      await addActivity(admin.displayName, "Guest list imported", "import", null, `${added} added, ${updated} updated, ${skipped} skipped`);
      return Response.json({ ok: true, summary: { added, updated, skipped, errors } });
    }

    return Response.json({ error: "Unknown manager action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The change could not be saved." }, { status: 500 });
  }
}
