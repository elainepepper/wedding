import { assertFirebaseAdminConfigured, nextId, plainDoc, randomToken, serverTimestamp, weddingRef } from "../../../lib/firebase-admin";
import { requireAdmin } from "../../../lib/manager-auth";
import { normaliseSiteDesign } from "../../../lib/site-design";

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
      weddingRef.collection("events").where("is_enabled", "==", 1).get(),
      weddingRef.collection("activityLogs").orderBy("created_at", "desc").limit(30).get(),
      weddingRef.get(),
      weddingRef.collection("admins").where("active", "==", true).get(),
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
    const managers = [{ id: 0, email: ownerEmail, name: "Wedding owner", role: "owner", active: 1, created_at: null }, ...managerSnapshot.docs.map(plainDoc)];
    return Response.json({
      admin: { displayName: admin.displayName, email: admin.email, role: admin.role },
      guests,
      households: householdRows,
      tables: tableRows,
      events: eventSnapshot.docs.map(plainDoc).sort((a, b) => Number(a.sort_order) - Number(b.sort_order)),
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
      if (!/^\+[0-9][0-9\s()-]{7,20}$/.test(mobile)) return Response.json({ error: "A mobile number with country code is required." }, { status: 400 });
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
      if ("mobile" in payload && !/^\+[0-9][0-9\s()-]{7,20}$/.test(clean(payload.mobile, 60))) return Response.json({ error: "A mobile number with country code is required." }, { status: 400 });
      const fields: Record<string, string> = { firstName: "first_name", lastName: "last_name", preferredName: "preferred_name", mobile: "mobile", category: "category", side: "side", rsvpStatus: "rsvp_status", mealSelection: "meal_selection", dietaryRequirements: "dietary_requirements", allergies: "allergies", accessibility: "accessibility", internalNotes: "internal_notes", afterPartyAttending: "after_party_attending", accommodationName: "accommodation_name" };
      const update: Record<string, unknown> = { age_group: "Adult", updated_at: serverTimestamp() };
      Object.entries(fields).forEach(([key, field]) => { if (key in payload) update[field] = clean(payload[key], key === "internalNotes" ? 1500 : 800) || null; });
      const booleans: Record<string, string> = { ceremonyInvited: "ceremony_invited", receptionInvited: "reception_invited", afterPartyEligible: "after_party_eligible", afterPartyInvited: "after_party_invited", transportRequired: "transport_required", accommodationRequired: "accommodation_required" };
      Object.entries(booleans).forEach(([key, field]) => { if (key in payload) update[field] = payload[key] ? 1 : 0; });
      await guestDoc.ref.set(update, { merge: true });
      await addActivity(admin.displayName, "Guest edited", "guest", guestId, "Guest details updated");
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
      const fieldMap: Record<string, string> = { category: "category", side: "side", rsvpStatus: "rsvp_status", tableId: "table_id", afterPartyEligible: "after_party_eligible", afterPartyInvited: "after_party_invited" };
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
      await weddingRef.collection("tables").doc(String(id)).set({ id, name, shape: ["round", "rectangular", "banquet"].includes(clean(payload.shape, 30)) ? clean(payload.shape, 30) : "round", capacity: Math.max(2, Math.min(30, integer(payload.capacity) ?? 10)), x: Number(payload.x) || 50, y: Number(payload.y) || 50, locked: 0, notes: null, created_at: serverTimestamp(), updated_at: serverTimestamp() });
      await addActivity(admin.displayName, "Table created", "table", id, name);
      return Response.json({ ok: true });
    }

    if (action === "moveGuest") {
      const guestId = integer(payload.guestId);
      const tableId = integer(payload.tableId);
      const guestDoc = guestId ? await docById("guests", guestId) : null;
      if (!guestId || !guestDoc) return Response.json({ error: "Guest not found." }, { status: 404 });
      if (tableId) {
        const tableDoc = await docById("tables", tableId);
        if (!tableDoc) return Response.json({ error: "Table not found." }, { status: 404 });
        const seated = await weddingRef.collection("guests").where("table_id", "==", tableId).where("archived", "==", 0).get();
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
      if (action === "regenerateLink") await householdDoc.ref.set({ invitation_token: randomToken(), invitation_enabled: true, updated_at: serverTimestamp() }, { merge: true });
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
      await weddingRef.set({ wedding_name: clean(payload.weddingName, 180) || "Elaine & Haykal", couple_names: clean(payload.coupleNames, 180) || "Elaine and Haykal", wedding_date: clean(payload.weddingDate, 20) || "2026-11-07", rsvp_deadline: clean(payload.rsvpDeadline, 20) || "2026-09-30", website_url: clean(payload.websiteUrl, 300) || null, invitation_wording: clean(payload.invitationWording, 1000) || null, confirmation_message: clean(payload.confirmationMessage, 1000) || null, timezone: clean(payload.timezone, 80) || "Australia/Perth", date_format: clean(payload.dateFormat, 40) || "D MMMM YYYY", formspree_form_id: clean(payload.formspreeFormId, 180) || null, cloudinary_cloud_name: clean(payload.cloudinaryCloudName, 180) || null, music_url: clean(payload.musicUrl, 600) || null, music_title: clean(payload.musicTitle, 180) || null, after_party_when: clean(payload.afterPartyWhen, 200) || null, after_party_where: clean(payload.afterPartyWhere, 300) || null, after_party_dress: clean(payload.afterPartyDress, 300) || null, after_party_entry: clean(payload.afterPartyEntry, 300) || null, updated_at: serverTimestamp() }, { merge: true });
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
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const firstName = clean(row.firstName, 100), lastName = clean(row.lastName, 100), mobile = clean(row.mobile, 60);
        if (!firstName) { errors.push(`Row ${index + 1}: missing first name`); continue; }
        // A mobile is welcome but not required: guests give one themselves
        // when they reply, and a list exported from a spreadsheet rarely has
        // every number filled in.
        if (mobile && !/^\+[0-9][0-9\s()-]{7,20}$/.test(mobile)) { errors.push(`Row ${index + 1}: ${firstName || "guest"} has a number that is missing its country code`); continue; }
        // match on the number when there is one, otherwise on the name
        const byMobile = mobile
          ? await weddingRef.collection("guests").where("mobile", "==", mobile).limit(1).get()
          : await weddingRef.collection("guests").where("first_name", "==", firstName).where("last_name", "==", lastName).limit(1).get();
        const existing = !byMobile.empty ? byMobile.docs[0] : (await weddingRef.collection("guests").where("first_name", "==", firstName).where("last_name", "==", lastName).where("archived", "==", 0).limit(1).get()).docs[0];
        if (existing && duplicateMode === "skip") { skipped += 1; continue; }
        const shared = { preferred_name: clean(row.preferredName, 100) || null, mobile: mobile || null, category: clean(row.category, 80) || "Friends", side: clean(row.side, 40) || "Shared", age_group: "Adult", internal_notes: clean(row.notes, 1500) || null, updated_at: serverTimestamp() };
        if (existing) { await existing.ref.set(shared, { merge: true }); updated += 1; continue; }
        const householdName = clean(row.household, 180) || `${firstName} ${lastName}`.trim();
        const householdMatch = await weddingRef.collection("households").where("name", "==", householdName).limit(1).get();
        let householdId: number;
        if (householdMatch.empty) { householdId = await nextId("households"); await weddingRef.collection("households").doc(String(householdId)).set({ id: householdId, name: householdName, mobile: mobile || null, max_guests: 1, invitation_slug: householdName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80), invitation_token: randomToken(), invitation_enabled: true, created_at: serverTimestamp(), updated_at: serverTimestamp() }); } else householdId = Number(householdMatch.docs[0].data().id);
        const guestId = await nextId("guests");
        await weddingRef.collection("guests").doc(String(guestId)).set({ id: guestId, household_id: householdId, first_name: firstName, last_name: lastName, ...shared, relationship: null, rsvp_status: clean(row.rsvpStatus, 30) || "Pending", ceremony_invited: row.ceremonyInvited === false ? 0 : 1, reception_invited: row.receptionInvited === false ? 0 : 1, after_party_eligible: row.afterPartyInvited ? 1 : 0, after_party_invited: row.afterPartyInvited ? 1 : 0, after_party_attending: "Pending", archived: 0, created_at: serverTimestamp() });
        added += 1;
      }
      await addActivity(admin.displayName, "Guest list imported", "import", null, `${added} added, ${updated} updated, ${skipped} skipped`);
      return Response.json({ ok: true, summary: { added, updated, skipped, errors } });
    }

    return Response.json({ error: "Unknown manager action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The change could not be saved." }, { status: 500 });
  }
}
