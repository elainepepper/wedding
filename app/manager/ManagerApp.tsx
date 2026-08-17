"use client";

import { rsvpDeadlineLabel } from "../../lib/rsvp-window";

import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Guest = {
  id: number; household_id: number | null; first_name: string; last_name: string; preferred_name: string | null;
  email: string | null; mobile: string | null; category: string; side: string; age_group: string;
  relationship: string | null;
  rsvp_status: string; ceremony_invited: number; ceremony_attending: number | null; reception_invited: number;
  reception_attending: number | null; after_party_eligible: number; after_party_invited: number;
  after_party_attending: string; after_party_rsvp_updated_at?: string | null; after_party_discovered_at?: string | null; meal_selection: string | null; dietary_requirements: string | null;
  allergies: string | null; child_meal: number; accessibility: string | null; transport_required: number;
  accommodation_required: number; table_id: number | null; seat_number: number | null; invitation_sent: number;
  invitation_sent_at: string | null; rsvp_submitted_at: string | null; internal_notes: string | null;
  wishes?: string | null; marriage_advice?: string | null; bed_preference?: string | null; room_nights?: number | null;
  travel_arrival?: string | null; travel_departure?: string | null; accommodation_name?: string | null;
  household_name: string | null; invitation_slug: string | null; invitation_token: string | null;
  invitation_enabled: number; opened_at: string | null; last_activity_at: string | null; table_name: string | null;
  updated_at: string;
};

type Household = {
  id: number; name: string; email: string | null; mobile: string | null; max_guests: number; invitation_slug: string;
  invitation_token: string; invitation_enabled: number; opened_at: string | null; last_activity_at: string | null; table_seen_at: string | null;
  guest_count: number; confirmed_count: number; declined_count: number; notes: string | null;
  side?: string | null;               // set by hand, or worked out from the guests
  invitation_sent?: number;           // the invitation as a whole has gone out
  archived?: number;
};

type SeatingTable = { id: number; name: string; shape: string; capacity: number; x: number; y: number; locked: number; notes: string | null; guest_count: number };
type Activity = { id: number; admin_name: string; action: string; detail: string; created_at: string };
type ManagerUser = { id: number; email: string; name: string; role: "owner" | "partner" | "planner"; active: number; created_at: string };
type Settings = Record<string, unknown> & {
  wedding_name: string; couple_names: string; wedding_date: string; rsvp_deadline: string; timezone: string; site_design?: unknown;
  website_url?: string | null; invitation_wording?: string | null; confirmation_message?: string | null; date_format?: string | null;
  cloudinary_cloud_name?: string | null; formspree_form_id?: string | null; music_url?: string | null; music_title?: string | null;
  after_hours_rsvp_deadline?: string | null; after_hours_location_revealed?: number | boolean; after_hours_venue?: string | null; after_hours_address?: string | null; after_hours_transport_note?: string | null; after_hours_music_url?: string | null;
};
type ArchivedHousehold = { id: number; name: string; archived_at: string | null; guest_count: number };
export type ManagerData = { guests: Guest[]; households: Household[]; tables: SeatingTable[]; activities: Activity[]; events: Array<Record<string, unknown>>; settings: Settings; managers: ManagerUser[]; archivedHouseholds?: ArchivedHousehold[]; admin: { displayName: string; email: string; role: "owner" | "partner" | "planner" } };
type Tab = "overview" | "guests" | "households" | "links" | "rsvps" | "seating" | "afterparty" | "wishes" | "imports" | "exports" | "settings" | "health" | "chase" | "dayof";
type ManagerTab = { id: Tab; label: string; index: string };

const navGroups: Array<{ label: string; items: ManagerTab[] }> = [
  { label: "Guest book", items: [
    { id: "overview", label: "Overview", index: "01" }, { id: "guests", label: "Guests", index: "02" },
    { id: "households", label: "Households", index: "03" }, { id: "rsvps", label: "RSVPs", index: "04" },
  ] },
  { label: "The celebration", items: [
    { id: "seating", label: "Seating plan", index: "05" }, { id: "afterparty", label: "After-party", index: "06" },
    { id: "wishes", label: "Wishes & advice", index: "07" }, { id: "chase", label: "Awaiting replies", index: "08" },
    { id: "dayof", label: "For the day", index: "09" },
  ] },
  { label: "Studio", items: [
    { id: "imports", label: "Imports", index: "10" }, { id: "exports", label: "Exports", index: "11" },
    { id: "health", label: "Health check", index: "12" }, { id: "settings", label: "Settings", index: "13" },
  ] },
];

const tabs = navGroups.flatMap((group) => group.items);

const displayName = (guest: Guest) => guest.preferred_name || `${guest.first_name ?? ""} ${guest.last_name ?? ""}`.trim() || "Unnamed guest";
// The wedding evening begins 6:00pm in Kuala Lumpur; fall back to the known date if settings are blank.
const daysUntilWedding = (weddingDate: string | null | undefined) => {
  const target = Date.parse(`${/^\d{4}-\d{2}-\d{2}$/.test(weddingDate || "") ? weddingDate : "2026-11-07"}T18:00:00+08:00`);
  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000));
};
const greetingForNow = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
};
const dateLabel = (value: string | null | undefined) => {
  if (!value) return "—";
  const text = value.replace(" ", "T");
  // Firestore hands back ISO strings that already carry a zone; only add one
  // when it is missing. An invalid date used to throw and blank the manager.
  const date = new Date(/(Z|[+-]\d\d:?\d\d)$/.test(text) ? text : `${text}Z`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Perth" }).format(date);
};
const dateTimeLabel = (value: string | null | undefined) => {
  if (!value) return "—";
  const text = value.replace(" ", "T");
  const date = new Date(/(Z|[+-]\d\d:?\d\d)$/.test(text) ? text : `${text}Z`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Australia/Perth" }).format(date);
};

function downloadFile(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function csvValue(value: unknown) {
  const text = value == null ? "" : String(value);
  // Guests type these fields themselves. Excel and Google Sheets treat a value
  // beginning with = + - @ (or a tab/return) as a formula rather than text, so
  // a dietary note could become live code in the chef's spreadsheet. A leading
  // apostrophe tells both programs "this is text" and is not shown in the cell.
  // A phone number is not a formula. Guarding "+" blindly put an apostrophe in
  // front of every mobile in the file, which both looked wrong to the venue and
  // made the export impossible to read back in through Imports.
  const looksLikePhone = /^\+[0-9][0-9\s()-]{6,}$/.test(text);
  const safe = !looksLikePhone && /^[=@\t\r]|^[+\-][^0-9]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function Status({ value }: { value: string | null | undefined }) {
  // Guests imported before a field existed carry no value for it at all —
  // reading one used to crash the whole page. An absent status reads Pending.
  const label = value || "Pending";
  return <span className={`status status--${label.toLowerCase().replaceAll(" ", "-")}`}><i />{label}</span>;
}

function householdRsvpStatus(household: Household) {
  const total = Number(household.guest_count) || 0;
  const confirmed = Number(household.confirmed_count) || 0;
  const declined = Number(household.declined_count) || 0;
  if (total > 0 && confirmed === total) return "Confirmed";
  if (total > 0 && declined === total) return "Declined";
  if (total > 0 && confirmed + declined === total) return "Replied";
  return "Pending";
}

async function readApiResponse<T>(response: Response): Promise<T & { error?: string }> {
  const body = await response.text();

  // The old message blamed FIREBASE_SERVICE_ACCOUNT_JSON for anything it could
  // not parse. If the manager loaded at all that key is fine, and the real
  // cause is almost always a request that took too long and was cut off.
  if (!body.trim() || body.trimStart().startsWith("<")) {
    if (response.status === 504 || response.status === 502 || response.status === 408) {
      throw new Error("That took too long and the server gave up part-way. Nothing further was saved. Try again — anything already brought in will be skipped.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("Your sign-in has expired. Reload the page and sign in again.");
    }
    if (response.status >= 500) {
      throw new Error(`The server stopped with an error (${response.status}). If it happens again, tell Claude the number.`);
    }
    throw new Error(`The server sent something unreadable (${response.status || "no status"}).`);
  }

  try {
    return JSON.parse(body) as T & { error?: string };
  } catch {
    throw new Error(`The server sent something unreadable (${response.status}): ${body.slice(0, 120)}`);
  }
}

export function ManagerApp({ initialAdminName, signedInEmail, authToken, onSignOut, demoData }: { initialAdminName: string; signedInEmail: string; authToken: string; onSignOut: () => void | Promise<void>; demoData?: ManagerData }) {
  const [data, setData] = useState<ManagerData | null>(demoData ?? null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error" | "preview">(demoData ? "preview" : "saved");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [groupFilter, setGroupFilter] = useState("All");
  const [selected, setSelected] = useState<number[]>([]);
  const [guestModal, setGuestModal] = useState<Guest | "new" | null>(null);
  // Set when "Add guest" is pressed on a household card, so the modal opens
  // with that invitation already chosen.
  const [newGuestHousehold, setNewGuestHousehold] = useState<number | null>(null);
  const [undo, setUndo] = useState<{ label: string; restore: () => Promise<void> } | null>(null);
  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 10000);
    return () => window.clearTimeout(timer);
  }, [undo]);
  const [mobileNav, setMobileNav] = useState(false);
  const toastTimer = useRef<number | null>(null);

  const load = async (quiet = false) => {
    // Demo mode: a fabricated guest list stands in for the database, so the
    // whole interface can be walked through without exposing a real guest.
    if (demoData) { setData(demoData); setLoading(false); return; }
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/manager?at=${Date.now()}`, { cache: "no-store", headers: { Authorization: `Bearer ${authToken}` } });
      const result = await readApiResponse<ManagerData>(response);
      if (!response.ok) throw new Error(result.error || "Unable to load the guest manager.");
      setData(result);
      setLoadError("");
    } catch (loadError) {
      setLoadError(loadError instanceof Error ? loadError.message : "Unable to load the guest manager.");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 3200);
  };

  // Every action goes through here, so this is the one place that can stop a
  // second press from creating a second record while the first is in flight.
  const inFlight = useRef(false);
  const act = async (payload: Record<string, unknown>, success: string) => {
    if (demoData) { notify("Preview only — nothing is saved here."); return; }
    if (inFlight.current) return;
    inFlight.current = true;
    setSaveState("saving");
    // Take the row off the screen at once. If the save fails the background
    // reload puts it straight back, and the error message explains why.
    if (payload.action === "deleteGuest" || payload.action === "archiveGuest") {
      const id = Number(payload.guestId);
      setData((current) => current ? { ...current, guests: current.guests.filter((guest) => guest.id !== id) } : current);
    }
    if (payload.action === "deleteHousehold") {
      const id = Number(payload.householdId);
      setData((current) => current ? {
        ...current,
        households: current.households.filter((household) => household.id !== id),
        guests: current.guests.filter((guest) => Number(guest.household_id) !== id),
      } : current);
    }
    try {
      const response = await fetch("/api/manager", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: JSON.stringify(payload) });
      const result = await readApiResponse<{ summary?: { added: number; updated: number; skipped: number; errors: string[] } }>(response);
      if (!response.ok) throw new Error(result.error || "The change could not be saved.");
      setSaveState("saved");
      notify(result.summary ? `${result.summary.added} added · ${result.summary.updated} updated · ${result.summary.skipped} skipped` : success);
      // The screen used to wait for a full reload of every guest, household,
      // table and activity before it would respond — several seconds on a
      // list this size. The change is already saved; refresh in the
      // background and let the interface answer immediately.
      void load(true);
      return result;
    } catch (failure) {
      // Most callers do not catch. Without this the failure was invisible:
      // the button simply did nothing and no one could tell why.
      const message = failure instanceof Error ? failure.message : "The change could not be saved.";
      setSaveState("error");
      notify(message);
      // Restore any row hidden optimistically before a failed archive/delete.
      // The editor stays open with its local inputs, while the authoritative
      // list is read back from the server.
      await load(true);
      // Resolve with a clear failure sentinel rather than rejecting. Most
      // manager actions are intentionally fire-and-forget button handlers;
      // rejecting here produced an unhandled promise in the browser even
      // though the toast and rollback had already handled the error.
      return null;
    } finally { inFlight.current = false; }
  };

  const stats = useMemo(() => {
    const guests = data?.guests ?? [];
    const confirmed = guests.filter((g) => g.rsvp_status === "Confirmed");
    const confirmedHouseholds = (predicate: (guest: Guest) => boolean) =>
      new Set(
        confirmed
          .filter(predicate)
          .map((guest) => guest.household_id ?? `guest-${guest.id}`),
      ).size;
    return {
      total: guests.length, households: data?.households.length ?? 0, confirmed: confirmed.length,
      declined: guests.filter((g) => g.rsvp_status === "Declined").length,
      pending: guests.filter((g) => g.rsvp_status === "Pending").length,
      adults: guests.filter((g) => g.age_group !== "Child").length,
      dietary: guests.filter((g) => g.dietary_requirements || g.allergies).length,
      afterParty: guests.filter((g) => g.after_party_attending === "Yes").length,
      // Travel and room answers are household questions. The API mirrors them
      // onto each named guest for backwards compatibility, so aggregate each
      // household once rather than reporting a couple as two room requests.
      transport: confirmedHouseholds((g) => Boolean(g.transport_required)),
      accommodation: confirmedHouseholds((g) => Boolean(g.accommodation_required)),
      tables: data?.tables.length ?? 0,
      unassigned: confirmed.filter((g) => !g.table_id).length,
      meals: confirmed.filter((g) => g.meal_selection || g.child_meal).length,
    };
  }, [data]);

  // Guests who look like the same person entered twice: an identical name,
  // or an identical mobile number. Surfaced through the group filter so the
  // couple can tick and delete them from the ordinary list.
  const duplicateIds = useMemo(() => {
    const byKey = new Map<string, number[]>();
    (data?.guests ?? []).forEach((guest) => {
      const name = `${(guest.first_name || "").trim()} ${(guest.last_name || "").trim()}`.toLowerCase().replace(/\s+/g, " ").trim();
      if (name) byKey.set(`name:${name}`, [...(byKey.get(`name:${name}`) ?? []), guest.id]);
      const mobile = (guest.mobile || "").replace(/\D/g, "");
      if (mobile.length >= 8) byKey.set(`mobile:${mobile}`, [...(byKey.get(`mobile:${mobile}`) ?? []), guest.id]);
    });
    const doubled = new Set<number>();
    byKey.forEach((ids) => { if (ids.length > 1) ids.forEach((id) => doubled.add(id)); });
    return doubled;
  }, [data]);

  const filteredGuests = useMemo(() => {
    const query = search.toLowerCase();
    const matches = (data?.guests ?? []).filter((guest) => {
      const matchesSearch = !query || [displayName(guest), guest.mobile, guest.household_name].some((value) => value?.toLowerCase().includes(query));
      const matchesStatus = statusFilter === "All" || guest.rsvp_status === statusFilter;
      const matchesGroup = groupFilter === "All" || guest.category === groupFilter || guest.side === groupFilter || (groupFilter === "After-party" && !!guest.after_party_invited) || (groupFilter === "Possible duplicates" && duplicateIds.has(guest.id));
      return matchesSearch && matchesStatus && matchesGroup;
    });
    // In the duplicates view, sort by name so each suspected pair sits together.
    if (groupFilter === "Possible duplicates") {
      matches.sort((a, b) => displayName(a).toLowerCase().localeCompare(displayName(b).toLowerCase()));
    }
    return matches;
  }, [data, search, statusFilter, groupFilter, duplicateIds]);

  const jumpToGuests = (filter: string) => {
    setTab("guests");
    if (["Confirmed", "Declined", "Pending"].includes(filter)) setStatusFilter(filter); else setGroupFilter(filter);
  };

  if (loading) return <ManagerLoading />;
  if (loadError || !data) return <div className="manager-fatal"><span>✦</span><h1>We couldn’t open the guest book.</h1><p>{loadError}</p>{signedInEmail ? <small>Currently signed in as <strong>{signedInEmail}</strong></small> : null}<div className="manager-fatal-actions"><button onClick={() => load()}>Try again</button><button className="secondary-button" onClick={() => void onSignOut()}>Sign out and choose another account</button></div></div>;

  return (
    <div className="manager-shell">
      <a className="skip-link" href="#manager-main">Skip to manager content</a>
      <aside className={`manager-sidebar${mobileNav ? " is-open" : ""}`}>
        <div className="manager-brand"><span>E <i>&amp;</i> H</span><small>Guest Manager</small></div>
        <nav aria-label="Guest manager">
          {navGroups.map((group) => <div className="manager-nav-group" key={group.label}>
            <p>{group.label}</p>
            {group.items.map((item) => <button key={item.id} className={tab === item.id ? "is-active" : ""} onClick={() => { setTab(item.id); setSelected([]); setMobileNav(false); }}><b>{item.index}</b><span>{item.label}</span>{item.id === "rsvps" && stats.pending ? <em>{stats.pending}</em> : null}</button>)}
          </div>)}
        </nav>
        <div className="manager-profile"><div>{initialAdminName.slice(0, 1).toUpperCase()}</div><p><strong>{initialAdminName}</strong><span>Administrator</span></p><a href="/">View invitation ↗</a><button type="button" onClick={() => void onSignOut()}>Sign out</button></div>
      </aside>

      <main id="manager-main" className="manager-main">
        <header className="manager-topbar">
          <button className="mobile-menu" onClick={() => setMobileNav((value) => !value)} aria-label="Open navigation">☰</button>
          <div><p className="manager-kicker">Elaine &amp; Haykal · 7 November 2026</p><h1>{tabs.find((item) => item.id === tab)?.label}</h1></div>
          <div className="topbar-actions"><span className={`save-state save-state--${saveState}`} aria-live="polite"><i />{saveState === "preview" ? "Preview mode" : saveState === "saving" ? "Saving changes" : saveState === "error" ? "Save needs attention" : "All changes saved"}</span><button onClick={() => setGuestModal("new")}>＋ Add guest</button></div>
        </header>

        {tab === "overview" ? <Overview data={data} stats={stats} jump={jumpToGuests} setTab={setTab} /> : null}
        {tab === "guests" || tab === "rsvps" ? (
          <GuestList
            guests={filteredGuests} tables={data.tables} selected={selected} setSelected={setSelected}
            search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            groupFilter={groupFilter} setGroupFilter={setGroupFilter} edit={setGuestModal} act={act} rsvpMode={tab === "rsvps"} adminRole={data.admin.role}
          />
        ) : null}
        {tab === "households" ? <Households replyBy={rsvpDeadlineLabel(data.settings.rsvp_deadline) ?? ""} households={data.households} guests={data.guests} archived={data.archivedHouseholds ?? []} adminRole={data.admin.role} act={act} notify={notify} setUndo={setUndo} edit={setGuestModal} addTo={(householdId) => { setNewGuestHousehold(householdId); setGuestModal("new"); }} /> : null}
        {tab === "seating" ? <SeatingPlan guests={data.guests} tables={data.tables} act={act} /> : null}
        {tab === "afterparty" ? <AfterParty guests={data.guests} selected={selected} setSelected={setSelected} act={act} /> : null}
        {tab === "wishes" ? <WishesAndAdvice guests={data.guests} /> : null}
        {tab === "imports" ? <Imports act={act} notify={notify} /> : null}
        {tab === "dayof" ? <ForTheDay guests={data.guests} tables={data.tables} /> : null}
        {tab === "chase" ? <Chasing households={data.households} guests={data.guests} settings={data.settings} act={act} notify={notify} /> : null}
        {tab === "health" ? <HealthCheck authToken={authToken} /> : null}
        {tab === "exports" ? <Exports guests={data.guests} tables={data.tables} /> : null}

        {tab === "settings" ? <SettingsPanel settings={data.settings} managers={data.managers} adminRole={data.admin.role} activities={data.activities} act={act} guests={data.guests} /> : null}
      </main>

      {undo ? <div className="undo-bar" role="status">
        <span>{undo.label}</span>
        <button type="button" onClick={async () => { const action = undo.restore; setUndo(null); await action(); notify("Restored"); }}>Undo</button>
      </div> : null}
      {guestModal ? <GuestModal guest={guestModal} households={data.households} allGuests={data.guests} setUndo={setUndo} presetHouseholdId={newGuestHousehold} close={() => { setGuestModal(null); setNewGuestHousehold(null); }} act={act} /> : null}
      {toast ? <div className="manager-toast" role="status"><span>✓</span>{toast}</div> : null}
    </div>
  );
}

function ManagerLoading() {
  return <div className="manager-loading" role="status"><div className="manager-brand"><span>E <i>&amp;</i> H</span><small>Guest Manager</small></div><p>Opening the guest book…</p><i /></div>;
}

function Overview({ data, stats, jump, setTab }: { data: ManagerData; stats: Record<string, number>; jump: (filter: string) => void; setTab: (tab: Tab) => void }) {
  const cards = [
    ["Total guests", stats.total, "All invited guests", "All"], ["Attending", stats.confirmed, "Confirmed places", "Confirmed"],
    ["Awaiting reply", stats.pending, "A gentle nudge", "Pending"], ["Declined", stats.declined, "Celebrating from afar", "Declined"],
    ["Dietary notes", stats.dietary, "Chef attention", "All"], ["After-party", stats.afterParty, "Night owls confirmed", "After-party"],
    ["Need a room", stats.accommodation, "Accommodation requests", "All"], ["Unassigned", stats.unassigned, "Confirmed without a table", "Confirmed"],
  ];
  const confirmedPercent = stats.total ? (stats.confirmed / stats.total) * 100 : 0;
  const pendingPercent = stats.total ? (stats.pending / stats.total) * 100 : 0;
  const declinedPercent = Math.max(0, 100 - confirmedPercent - pendingPercent);
  return <div className="manager-page overview-page">
    <section className="welcome-strip"><div><p>{greetingForNow()}</p><h2>Your celebration is taking shape.</h2><span>{stats.confirmed} of {stats.total} guests are confirmed · {stats.meals} meals selected</span></div><div className="countdown"><strong>{daysUntilWedding(data.settings.wedding_date)}</strong><span>days to go</span></div></section>
    <section className="stat-grid" aria-label="Guest overview">{cards.map(([label, value, note, filter], index) => <button key={String(label)} onClick={() => jump(String(filter))}><i>{String(index + 1).padStart(2, "0")}</i><span>{label}</span><strong>{value}</strong><small>{note}</small></button>)}</section>
    <div className="overview-grid">
      <section className="manager-panel response-panel"><div className="panel-head"><div><p className="panel-kicker">Response ledger</p><h3>RSVP progress</h3></div><button onClick={() => setTab("rsvps")}>View RSVPs</button></div>
        <div className="response-summary"><strong>{Math.round(confirmedPercent)}%</strong><span>attendance confirmed</span></div>
        <div className="response-meter" role="img" aria-label={`${stats.confirmed} confirmed, ${stats.pending} pending and ${stats.declined} declined`} style={{ "--confirmed": `${confirmedPercent}%`, "--pending": `${pendingPercent}%`, "--declined": `${declinedPercent}%` } as React.CSSProperties}><i className="confirmed" /><i className="pending" /><i className="declined" /></div>
        <div className="legend"><p><i className="confirmed" />Confirmed <b>{stats.confirmed}</b></p><p><i className="pending" />Pending <b>{stats.pending}</b></p><p><i className="declined" />Declined <b>{stats.declined}</b></p></div>
      </section>
      <section className="manager-panel activity-panel"><div className="panel-head"><div><p className="panel-kicker">Latest notes</p><h3>Recent activity</h3></div></div><div className="activity-list">{data.activities.slice(0, 5).map((activity) => <div key={activity.id}><i>✦</i><p><strong>{activity.action}</strong><span>{activity.detail}</span></p><time>{dateLabel(activity.created_at)}</time></div>)}</div></section>
    </div>
  </div>;
}

function GuestList({ guests, tables, selected, setSelected, search, setSearch, statusFilter, setStatusFilter, groupFilter, setGroupFilter, edit, act, rsvpMode, adminRole }: {
  guests: Guest[]; tables: SeatingTable[]; selected: number[]; setSelected: (ids: number[]) => void; search: string; setSearch: (value: string) => void;
  statusFilter: string; setStatusFilter: (value: string) => void; groupFilter: string; setGroupFilter: (value: string) => void;
  edit: (guest: Guest | "new") => void; act: (payload: Record<string, unknown>, success: string) => Promise<unknown>; rsvpMode: boolean;
  adminRole: "owner" | "partner" | "planner";
}) {
  // Sorting, the way the polished guest-list tools do it: click a column
  // heading to sort by it, click again to reverse; the same choices sit in
  // a Sort dropdown for phones, where table headings are awkward to tap.
  // "Latest activity" is the natural default — the list arrives from the
  // server newest-first, so it is simply the incoming order.
  const [sortKey, setSortKey] = useState<"recent" | "name" | "household" | "group" | "rsvp" | "table">("recent");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const chooseSort = (key: typeof sortKey) => {
    if (key === sortKey) setSortDir((dir) => (dir === 1 ? -1 : 1));
    else { setSortKey(key); setSortDir(1); }
  };
  const sortedGuests = useMemo(() => {
    const byName = (a: Guest, b: Guest) => displayName(a).toLowerCase().localeCompare(displayName(b).toLowerCase());
    const rsvpRank = (g: Guest) => (g.rsvp_status === "Confirmed" ? 0 : g.rsvp_status === "Pending" ? 1 : 2);
    const rows = [...guests];
    if (sortKey === "name") rows.sort(byName);
    if (sortKey === "household") rows.sort((a, b) => (a.household_name ?? "￿").localeCompare(b.household_name ?? "￿") || byName(a, b));
    if (sortKey === "group") rows.sort((a, b) => (a.side ?? "").localeCompare(b.side ?? "") || (a.category ?? "").localeCompare(b.category ?? "") || byName(a, b));
    if (sortKey === "rsvp") rows.sort((a, b) => rsvpRank(a) - rsvpRank(b) || byName(a, b));
    if (sortKey === "table") rows.sort((a, b) => (a.table_name ?? "￿").localeCompare(b.table_name ?? "￿") || Number(a.seat_number ?? 0) - Number(b.seat_number ?? 0) || byName(a, b));
    if (sortDir === -1) rows.reverse();
    return rows;
  }, [guests, sortKey, sortDir]);
  const arrow = (key: typeof sortKey) => (sortKey === key ? (sortDir === 1 ? " ↑" : " ↓") : "");
  const SortHead = ({ id, label }: { id: typeof sortKey; label: string }) => (
    <th aria-sort={sortKey === id ? (sortDir === 1 ? "ascending" : "descending") : undefined}>
      <button type="button" className={`sort-head${sortKey === id ? " is-sorted" : ""}`} onClick={() => chooseSort(id)}>{label}{arrow(id)}</button>
    </th>
  );
  const allSelected = sortedGuests.length > 0 && sortedGuests.every((guest) => selected.includes(guest.id));
  return <div className="manager-page">
    {rsvpMode ? <section className="rsvp-banner"><div><span>Latest reply</span><h2>{guests.find((g) => g.rsvp_submitted_at)?.household_name ?? "The guest list"}</h2><p>Updated {dateLabel(guests.find((g) => g.rsvp_submitted_at)?.rsvp_submitted_at)}</p></div><strong>{guests.filter((g) => g.rsvp_status === "Confirmed").length}<small> attending</small></strong></section> : null}
    <section className="manager-panel guest-table-panel">
      <div className="table-toolbar"><label className="search-field"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone or household" aria-label="Search guests" /></label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by RSVP status"><option>All</option><option>Confirmed</option><option>Pending</option><option>Declined</option></select>
        <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} aria-label="Filter by guest group"><option>All</option><option>Bride</option><option>Groom</option><option>Shared</option><option>Family</option><option>Friends</option><option>Work</option><option>VIP</option><option>After-party</option><option>Possible duplicates</option></select>
        <select value={`${sortKey}:${sortDir}`} onChange={(event) => { const [key, dir] = event.target.value.split(":"); setSortKey(key as typeof sortKey); setSortDir(Number(dir) as 1 | -1); }} aria-label="Sort guests">
          <option value="recent:1">Sort · Latest activity</option>
          <option value="recent:-1">Sort · Oldest activity</option>
          <option value="name:1">Sort · Name A–Z</option>
          <option value="name:-1">Sort · Name Z–A</option>
          <option value="household:1">Sort · Household</option>
          <option value="group:1">Sort · Group &amp; category</option>
          <option value="rsvp:1">Sort · RSVP status</option>
          <option value="table:1">Sort · Table</option>
        </select>
      </div>
      {selected.length ? <div className="bulk-bar"><strong>{selected.length} selected</strong><button className="bulk-delete" hidden={adminRole === "planner"} onClick={async () => {
        if (!window.confirm(`Remove ${selected.length} guest${selected.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
        const count = selected.length;
        for (const id of selected) {
          const result = await act({ action: "deleteGuest", guestId: id }, `${count} guest${count === 1 ? "" : "s"} removed`);
          if (!result) return;
        }
        setSelected([]);
      }}>Delete</button><button onClick={() => void act({ action: "bulkUpdate", guestIds: selected, field: "rsvpStatus", value: "Confirmed" }, "Guests confirmed")}>Confirm</button><button onClick={() => void act({ action: "bulkUpdate", guestIds: selected, field: "afterPartyInvited", value: true }, "After-party access enabled")}>Invite after-party</button><select defaultValue="" onChange={(event) => { if (event.target.value) void act({ action: "bulkUpdate", guestIds: selected, field: "tableId", value: Number(event.target.value) }, "Table assignments saved"); }}><option value="">Assign table…</option>{tables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}</select><button className="textual" onClick={() => setSelected([])}>Clear</button></div> : null}
      <div className="table-scroll"><table className="guest-table"><thead><tr><th><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : sortedGuests.map((guest) => guest.id))} aria-label="Select all visible guests" /></th><SortHead id="name" label="Guest" /><SortHead id="household" label="Household" /><SortHead id="group" label="Group" /><SortHead id="rsvp" label="RSVP" /><th>Meal &amp; dietary</th><SortHead id="table" label="Table" /><SortHead id="recent" label="Invitation" /><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
        {sortedGuests.map((guest) => <tr key={guest.id} className="is-openable"><td><input type="checkbox" checked={selected.includes(guest.id)} onChange={() => setSelected(selected.includes(guest.id) ? selected.filter((id) => id !== guest.id) : [...selected, guest.id])} aria-label={`Select ${displayName(guest)}`} /></td><td><button className="guest-identity" onClick={() => edit(guest)}><span>{guest.preferred_name?.slice(0, 1) || guest.first_name.slice(0, 1)}{guest.last_name.slice(0, 1)}</span><p><strong>{displayName(guest)}</strong><small>{guest.email || guest.mobile || "No contact details"}</small></p></button></td><td>{guest.household_name ?? "—"}</td><td><span className="group-chip">{guest.side}</span><small className="muted-cell">{guest.category}</small></td><td><Status value={guest.rsvp_status} />{guest.rsvp_submitted_at ? <small className="muted-cell">{dateLabel(guest.rsvp_submitted_at)}</small> : null}</td><td><span>{guest.child_meal ? "Children's meal" : guest.meal_selection || "Not selected"}</span>{guest.dietary_requirements || guest.allergies ? <small className="diet-note">◈ {guest.dietary_requirements || guest.allergies}</small> : null}</td><td>{guest.table_name ? <><span>{guest.table_name}</span><small className="muted-cell">Seat {guest.seat_number || "—"}</small></> : <span className="unassigned">Unassigned</span>}</td><td>{guest.invitation_sent ? <span className="sent-label">✓ Sent</span> : <span className="not-sent">Not sent</span>}{guest.opened_at ? <small className="muted-cell">Opened {dateLabel(guest.opened_at)}</small> : null}</td><td><button className="row-action" onClick={() => edit(guest)} aria-label={`Edit ${displayName(guest)}`}>•••</button></td></tr>)}
      </tbody></table>{!guests.length ? <div className="empty-state"><span>♡</span><h3>No guests found</h3><p>Try another search or filter.</p></div> : null}</div>
      <footer className="table-footer"><span>{guests.length} guests shown</span><span>Updates use Australia/Perth time</span></footer>
    </section>
  </div>;
}

// The guest names travel inside the link itself, so a link pasted into the
// wrong WhatsApp chat is obvious at a glance to both sides.
/**
 * A personal link: haykalelaine.com/i/<token>/<their-name>
 *
 * The token comes first because it is the part that matters; the name follows
 * so the link reads as clearly theirs in a WhatsApp message. Only the token is
 * ever read, so an edited or missing name changes nothing.
 */
function nameSlug(names?: string) {
  return (names || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 4)                 // keeps it short when a household has several names
    .join("-");
}

function inviteLink(origin: string, token: string | null, names?: string) {
  if (!token) return "";                     // no token, no link — never /i/null
  const slug = nameSlug(names);
  return slug ? `${origin}/i/${token}/${slug}` : `${origin}/i/${token}`;
}
// wa.me opens WhatsApp with the message already written. If we hold a mobile
// number it opens that chat directly; otherwise WhatsApp asks who to send to.
function waLink(mobile: string | null, message: string) {
  let digits = (mobile || "").replace(/[^0-9]/g, "");
  // WhatsApp needs a country code and no leading zero. A number saved in local
  // form ("012...") would otherwise open a chat with nobody.
  if (digits.startsWith("0")) digits = `60${digits.replace(/^0+/, "")}`;
  return digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;   // no number: compose and pick a contact
}
function tableMessage(names: string, tables: string, link: string) {
  return `Dear ${names},\n\nElaine and Haykal have assigned your seat for 7 November — you are at ${tables}.\n\nYou can see it on your invitation here:\n${link}\n\nWith love,\nElaine & Haykal`;
}
function nudgeMessage(names: string, link: string, deadline: string) {
  return `Hello ${names},\n\nJust a gentle nudge — we are gathering final numbers for our wedding on 7 November${deadline ? `, and replies close on ${deadline}` : ""}. If you have a moment, your invitation is here:\n\n${link}\n\nWith love,\nElaine & Haykal`;
}

// The reply-by date travels with the invitation itself, so nobody has to be
// chased for a date they were never told. It comes from Settings, so changing
// it there changes every message from then on.
function invitationMessage(names: string, link: string, replyBy = "") {
  return `Dear ${names},\n\nElaine and Haykal would love you to join them on 7 November 2026 at the Grand Hyatt Kuala Lumpur.\n\nYour personal invitation, with the RSVP, is here:\n${link}\n${replyBy ? `\nKindly reply by ${replyBy}.\n` : ""}\nWith love,\nElaine & Haykal`;
}

/**
 * Sending, one invitation at a time.
 *
 * The list view is for auditing; this is for the evening you actually send.
 * The pile holds only invitations that have not gone out, split into Elaine's,
 * Haykal's and shared, so the two of you can work through your own without
 * treading on each other. Each card carries everything needed to send — the
 * names, the number, the link, and a warning if something is missing — and
 * "Sent" takes it off the pile.
 *
 * Deliberately buttons rather than a swipe-to-send gesture: marking an
 * invitation sent is a state change, and a mis-swipe on a stranger's card is
 * a real cost. A left/right drag still moves between cards on a phone.
 */
function SendDeck({ households, guests, replyBy, act, notify, edit, addTo }: {
  households: Household[]; guests: Guest[]; replyBy: string;
  act: (payload: Record<string, unknown>, success: string) => Promise<unknown>;
  notify: (message: string) => void;
  edit: (guest: Guest | "new") => void;
  addTo: (householdId: number) => void;
}) {
  const [side, setSide] = useState<"Bride" | "Groom" | "Shared">("Bride");
  const [index, setIndex] = useState(0);
  const [showSent, setShowSent] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const membersOf = (household: Household) => guests.filter((guest) => Number(guest.household_id) === Number(household.id));
  // Whose card is it? An explicit choice wins; otherwise the guests decide,
  // and anything mixed or unmarked belongs to the shared pile.
  const sideOf = (household: Household) => {
    if (household.side === "Bride" || household.side === "Groom" || household.side === "Shared") return household.side;
    const sides = new Set(membersOf(household).map((guest) => guest.side).filter(Boolean));
    if (sides.size === 1) {
      const only = [...sides][0];
      if (only === "Bride" || only === "Groom") return only;
    }
    return "Shared";
  };
  // Sending is a fact about the invitation. Read it from the household
  // first so one with no guests listed can still leave the pile.
  const isSent = (household: Household) => Boolean(household.invitation_sent) || membersOf(household).some((guest) => guest.invitation_sent);

  const inSide = households.filter((household) => sideOf(household) === side);
  const pile = inSide.filter((household) => !isSent(household));
  const sent = inSide.filter(isSent);
  const counts = {
    Bride: households.filter((h) => sideOf(h) === "Bride" && !isSent(h)).length,
    Groom: households.filter((h) => sideOf(h) === "Groom" && !isSent(h)).length,
    Shared: households.filter((h) => sideOf(h) === "Shared" && !isSent(h)).length,
  };
  const position = Math.min(index, Math.max(0, pile.length - 1));
  const current = pile[position];
  const step = (by: number) => setIndex(() => {
    if (!pile.length) return 0;
    return (position + by + pile.length) % pile.length;
  });

  const names = current ? membersOf(current).map(displayName).join(" & ") || current.name : "";
  const link = current ? inviteLink(typeof window === "undefined" ? "https://haykalelaine.com" : window.location.origin, current.invitation_token, names) : "";
  const message = current ? invitationMessage(names, link, replyBy) : "";

  // What is missing that would embarrass us after the invitation has gone.
  const problems = (household: Household) => {
    const members = membersOf(household);
    const list: string[] = [];
    if (!members.length) list.push("No guests on this invitation");
    if (!household.mobile && !members.some((guest) => guest.mobile)) list.push("No phone number — WhatsApp cannot open a chat");
    if (!household.invitation_token) list.push("No invitation link");
    const unnamed = members.filter((guest) => !`${guest.first_name ?? ""}${guest.last_name ?? ""}`.trim());
    if (unnamed.length) list.push(`${unnamed.length} guest${unnamed.length === 1 ? "" : "s"} without a name`);
    return list;
  };

  const share = async () => {
    // The OS share sheet — the only route into Instagram, and it also offers
    // WhatsApp, Messenger, Mail and everything else the phone has.
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (!nav.share) { await navigator.clipboard.writeText(message); notify("Message copied — paste it wherever you like"); return; }
    try { await nav.share({ title: "Elaine & Haykal", text: message }); }
    catch { /* the sheet was dismissed; nothing to report */ }
  };

  const markSent = async (household: Household) => {
    const result = await act({ action: "markInvitationSent", householdId: household.id }, `${household.name} marked as sent`);
    if (!result) return;
    setIndex((value) => (pile.length <= 1 ? 0 : value % (pile.length - 1)));
  };

  return <div className="send-deck">
    <div className="deck-tabs" role="tablist">
      {(["Bride", "Groom", "Shared"] as const).map((option) => (
        <button key={option} type="button" role="tab" aria-selected={side === option}
          className={side === option ? "is-active" : ""}
          onClick={() => { setSide(option); setIndex(0); setShowSent(false); }}>
          {option === "Bride" ? "Elaine’s" : option === "Groom" ? "Haykal’s" : "Shared"}
          <em>{counts[option]}</em>
        </button>
      ))}
    </div>

    {!pile.length ? <div className="deck-done">
      <span aria-hidden="true">✦</span>
      <h3>{sent.length ? "Every invitation on this list has been sent" : "Nothing waiting here"}</h3>
      <p>{sent.length ? `${sent.length} sent. They move to the list below, where you can undo one if you sent it by mistake.` : "No households on this list yet."}</p>
    </div> : current ? <article
      className="deck-card"
      onTouchStart={(event) => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
      onTouchEnd={(event) => {
        // A flick sideways moves through the pile; nothing is ever saved by a
        // gesture, so a stray swipe costs nothing.
        if (!touch.current) return;
        const dx = event.changedTouches[0].clientX - touch.current.x;
        const dy = Math.abs(event.changedTouches[0].clientY - touch.current.y);
        if (Math.abs(dx) > 60 && dy < 60) step(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      <header>
        <div><p className="deck-position">{position + 1} of {pile.length}</p><h3>{current.name}</h3></div>
        <Status value={householdRsvpStatus(current)} />
      </header>

      {problems(current).length ? <ul className="deck-warnings">
        {problems(current).map((problem) => <li key={problem}>⚠️ {problem}</li>)}
      </ul> : null}

      <dl className="deck-facts">
        <div><dt>Sending to</dt><dd>{current.mobile || membersOf(current).find((guest) => guest.mobile)?.mobile || "— no number —"}</dd></div>
        <div><dt>Guests</dt><dd>{membersOf(current).length}</dd></div>
      </dl>

      <div className="deck-members">
        {membersOf(current).map((guest) => <button type="button" key={guest.id} className="member-row" onClick={() => edit(guest)} title={`Edit ${displayName(guest)}`}>
          <i>{displayName(guest).slice(0, 1)}</i>
          <span>{displayName(guest)}<small>{guest.mobile || "no number"} · {guest.category || "—"}</small></span>
          <em className="deck-edit">Edit</em>
        </button>)}
        <button type="button" className="member-add" onClick={() => addTo(current.id)}>＋ Add a guest to this invitation</button>
      </div>

      <div className="deck-share">
        <a className="wa-button" href={waLink(current.mobile, message)} target="_blank" rel="noreferrer">WhatsApp</a>
        <button type="button" onClick={share}>Share…</button>
        <button type="button" onClick={async () => { await navigator.clipboard.writeText(link); notify("Invitation link copied"); }}>Copy link</button>
        <a className="deck-messenger" href={`fb-messenger://share/?link=${encodeURIComponent(link)}`}>Messenger</a>
      </div>

      <div className="deck-actions">
        <button type="button" className="deck-skip" onClick={() => step(-1)}>← Back</button>
        <button type="button" className="deck-sent" onClick={() => void markSent(current)}>✓ Sent — next</button>
        <button type="button" className="deck-skip" onClick={() => step(1)}>Skip →</button>
      </div>
      <div className="deck-side-move">
        <span>Move to</span>
        {(["Bride", "Groom", "Shared"] as const).filter((option) => option !== side).map((option) => (
          <button key={option} type="button" onClick={() => void act({ action: "setHouseholdSide", householdId: current.id, side: option }, `Moved to ${option === "Bride" ? "Elaine’s" : option === "Groom" ? "Haykal’s" : "the shared"} list`)}>
            {option === "Bride" ? "Elaine’s" : option === "Groom" ? "Haykal’s" : "Shared"}
          </button>
        ))}
      </div>
    </article> : null}

    {sent.length ? <div className="deck-sent-log">
      <button type="button" className="archived-toggle" onClick={() => setShowSent((value) => !value)} aria-expanded={showSent}>
        {showSent ? "▾" : "▸"} Recently sent · {sent.length}
      </button>
      {showSent ? <div className="archived-list">
        {sent.slice(0, 40).map((household) => <div key={household.id} className="archived-row">
          <span><strong>{household.name}</strong><small>{membersOf(household).map(displayName).join(" & ")}</small></span>
          <button type="button" onClick={() => void act({ action: "markInvitationUnsent", householdId: household.id }, `${household.name} put back on the pile`)}>Undo</button>
        </div>)}
      </div> : null}
    </div> : null}
  </div>;
}

function Households({ households, guests, archived, adminRole, replyBy, act, notify , setUndo, edit, addTo }: { households: Household[]; guests: Guest[]; archived: ArchivedHousehold[]; adminRole: "owner" | "partner" | "planner"; replyBy: string; act: (payload: Record<string, unknown>, success: string) => Promise<unknown>; notify: (message: string) => void ; setUndo: (u: { label: string; restore: () => Promise<void> } | null) => void; edit: (guest: Guest | "new") => void; addTo: (householdId: number) => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [householdSearch, setHouseholdSearch] = useState("");
  const [progress, setProgress] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  // With a hundred invitations on screen, everything open at once is a wall.
  // Each card shows its name, its state and how many guests; opening one
  // reveals the people and the actions. Searching opens what it finds.
  const [openCards, setOpenCards] = useState<number[]>([]);
  const toggleCard = (id: number) => setOpenCards((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  // Two ways to look at the same invitations: the list for checking over, the
  // deck for the evening you send them.
  const [mode, setMode] = useState<"list" | "send" | "links">("list");
  const toggle = (id: number) => setPicked((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  // Marking a batch as sent, the evening you actually send them.
  const markPickedSent = async () => {
    const chosen = households.filter((household) => picked.includes(household.id));
    let done = 0;
    try {
      for (const household of chosen) {
        const result = await act({ action: "markInvitationSent", householdId: household.id }, "");
        if (!result) throw new Error("The remaining invitations were not changed.");
        done += 1;
        setProgress(`Marking sent… ${done} of ${chosen.length}`);
      }
      notify(`${chosen.length} invitation${chosen.length === 1 ? "" : "s"} marked as sent`);
    } catch (failure) {
      notify(`Stopped after ${done} of ${chosen.length}. ${failure instanceof Error ? failure.message : ""}`);
    } finally {
      setProgress("");
      setPicked([]);
    }
  };
  const archivePicked = async () => {
    const chosen = households.filter((household) => picked.includes(household.id));
    const count = chosen.reduce((total, household) => total + guests.filter((g) => Number(g.household_id) === Number(household.id)).length, 0);
    if (!window.confirm(`Archive ${chosen.length} invitation${chosen.length === 1 ? "" : "s"} and ${count} guest${count === 1 ? "" : "s"}? Their links stop working, and you can restore them at any time from “Archived”.`)) return;
    let archivedCount = 0;
    try {
      for (const household of chosen) {
        const result = await act({ action: "archiveHousehold", householdId: household.id }, "");
        if (!result) throw new Error("The remaining invitations were not changed.");
        archivedCount += 1;
        setProgress(`Archiving… ${archivedCount} of ${chosen.length}`);
      }
      notify(`${chosen.length} invitation${chosen.length === 1 ? "" : "s"} archived — restore them any time`);
    } catch (failure) {
      notify(`Stopped after ${archivedCount} of ${chosen.length}. ${failure instanceof Error ? failure.message : ""}`);
    } finally {
      setProgress("");
      setPicked([]);
    }
  };
  const removePicked = async () => {
    const chosen = households.filter((household) => picked.includes(household.id));
    const count = chosen.reduce((total, household) => total + guests.filter((g) => Number(g.household_id) === Number(household.id)).length, 0);
    if (!window.confirm(`Permanently delete ${chosen.length} invitation${chosen.length === 1 ? "" : "s"} and ${count} guest${count === 1 ? "" : "s"}? Nothing can bring them back. Archive instead if you are unsure.`)) return;
    // Deleting 120 invitations one after another can outlast the hosting
    // timeout, so progress is reported and a failure says how far it reached
    // rather than leaving you guessing.
    let done = 0;
    try {
      for (const household of chosen) {
        const result = await act({ action: "deleteHousehold", householdId: household.id }, "");
        if (!result) throw new Error("The remaining invitations were not changed.");
        done += 1;
        setProgress(`Deleting… ${done} of ${chosen.length}`);
      }
      notify(`${chosen.length} invitation${chosen.length === 1 ? "" : "s"} deleted`);
    } catch (failure) {
      notify(`Stopped after ${done} of ${chosen.length}. ${failure instanceof Error ? failure.message : ""}`);
    } finally {
      setProgress("");
      setPicked([]);
    }
  };
  const copyLink = async (household: Household, afterParty = false) => {
    const link = afterParty
      ? `${window.location.origin}/after-party?token=${household.invitation_token}`
      : inviteLink(window.location.origin, household.invitation_token, household.name);
    await navigator.clipboard.writeText(link);
    notify(afterParty ? "Private after-party link copied" : "Invitation link copied");
  };
  // Search reaches both the invitation's name and everyone on it, and the
  // grid groups by where each invitation stands: replied, sent and waiting,
  // or not yet sent — so a scan shows exactly what still needs doing.
  const query = householdSearch.trim().toLowerCase();
  const visible = households.filter((household) => {
    if (!query) return true;
    if (String(household.name ?? "").toLowerCase().includes(query)) return true;
    return guests.some((guest) => Number(guest.household_id) === Number(household.id) && (displayName(guest).toLowerCase().includes(query) || (guest.mobile ?? "").includes(query)));
  });
  const stateOf = (household: Household) => {
    const members = guests.filter((guest) => Number(guest.household_id) === Number(household.id));
    if (members.some((guest) => guest.rsvp_status === "Confirmed" || guest.rsvp_status === "Declined")) return "replied";
    if (household.invitation_sent || members.some((guest) => guest.invitation_sent)) return "sent";
    return "unsent";
  };
  const groups = [
    { id: "unsent", title: "Not yet sent", rows: visible.filter((h) => stateOf(h) === "unsent") },
    { id: "sent", title: "Invitation sent — awaiting reply", rows: visible.filter((h) => stateOf(h) === "sent") },
    { id: "replied", title: "Replied", rows: visible.filter((h) => stateOf(h) === "replied") },
  ].filter((group) => group.rows.length);
  return <div className="manager-page"><div className="section-intro-row"><div><p className="panel-kicker">Shared invitations</p><h2>{households.length} households</h2><span>A household is one invitation link, shared by everyone on it. A couple is one household with two people; a single guest is a household of one.</span></div></div>
    <div className="mode-switch" role="tablist">
      <button type="button" role="tab" aria-selected={mode === "list"} className={mode === "list" ? "is-active" : ""} onClick={() => setMode("list")}>The list</button>
      <button type="button" role="tab" aria-selected={mode === "send"} className={mode === "send" ? "is-active" : ""} onClick={() => setMode("send")}>Send mode</button>
      <button type="button" role="tab" aria-selected={mode === "links"} className={mode === "links" ? "is-active" : ""} onClick={() => setMode("links")}>All links</button>
    </div>
    {mode === "send" ? <SendDeck households={households} guests={guests} replyBy={replyBy} act={act} notify={notify} edit={edit} addTo={addTo} />
      : mode === "links" ? <InvitationLinks households={households} guests={guests} replyBy={replyBy} notify={notify} act={act} /> : <>
    <div className="household-tools">
      <label className="search-field"><span>⌕</span><input value={householdSearch} onChange={(event) => setHouseholdSearch(event.target.value)} placeholder="Search households or guests" aria-label="Search households" /></label>
      <label className="select-all">
        <input
          type="checkbox"
          checked={picked.length > 0 && picked.length === households.length}
          ref={(box) => { if (box) box.indeterminate = picked.length > 0 && picked.length < households.length; }}
          onChange={() => setPicked(picked.length === households.length ? [] : households.map((household) => household.id))}
        />
        <span>{picked.length === households.length && households.length ? "Deselect all" : `Select all ${households.length}`}</span>
      </label>
      {progress ? <span className="picked-count">{progress}</span> : picked.length ? <span className="picked-count">{picked.length} selected</span> : null}
    </div>
    {picked.length ? <div className="bulk-bar"><strong>{picked.length} selected</strong>
      <button type="button" onClick={() => setPicked([])}>Clear</button>
      <button type="button" onClick={markPickedSent}>✓ Mark as sent</button>
      {adminRole !== "planner" ? <button type="button" onClick={archivePicked}>Archive</button> : null}
      {adminRole !== "planner" ? <button type="button" className="bulk-delete" onClick={removePicked}>Delete permanently</button> : null}
    </div> : null}
    <div className="household-legend" aria-hidden="true"><span className="legend-replied">Replied</span><span className="legend-sent">Invitation sent · awaiting reply</span><span className="legend-unsent">Not yet sent</span></div>
    {!groups.length ? <div className="empty-state"><span>♡</span><h3>No households found</h3><p>Try another search.</p></div> : null}
    {archived.length ? <div className="archived-block">
      <button type="button" className="archived-toggle" onClick={() => setShowArchived((value) => !value)} aria-expanded={showArchived}>
        {showArchived ? "▾" : "▸"} Archived · {archived.length}
      </button>
      {showArchived ? <div className="archived-list">
        <p className="import-help">Archived invitations keep every detail and reply. Their links do not open until they are restored.</p>
        {archived.map((household) => <div key={household.id} className="archived-row">
          <span><strong>{household.name}</strong><small>{household.guest_count} guest{household.guest_count === 1 ? "" : "s"}{household.archived_at ? ` · archived ${dateLabel(household.archived_at)}` : ""}</small></span>
          <button type="button" onClick={() => void act({ action: "restoreHousehold", householdId: household.id }, `${household.name} restored`)}>Restore</button>
          {adminRole !== "planner" ? <button type="button" className="danger-link" onClick={() => {
            if (!window.confirm(`Permanently delete ${household.name} and its guests? Nothing can bring them back.`)) return;
            void act({ action: "deleteHousehold", householdId: household.id }, "Permanently deleted");
          }}>Delete permanently</button> : null}
        </div>)}
      </div> : null}
    </div> : null}
    {groups.map((group) => <div key={group.id} className="household-group"><h3 className={`household-group-title is-${group.id}`}>{group.title} · {group.rows.length}</h3>
    <section className="household-grid">{group.rows.map((household) => {
    const members = guests.filter((guest) => Number(guest.household_id) === Number(household.id));
    const afterParty = members.some((guest) => guest.after_party_invited);
    // Each card wears its state: someone has replied, or the invitation has
    // gone out and waits, or it has not been sent at all.
    const replied = members.some((guest) => guest.rsvp_status === "Confirmed" || guest.rsvp_status === "Declined");
    const sent = Boolean(household.invitation_sent) || members.some((guest) => guest.invitation_sent);
    const stateClass = replied ? " is-replied" : sent ? " is-sent" : " is-unsent";
    // A search opens whatever it finds, so results are never hidden.
    const open = openCards.includes(household.id) || Boolean(query);
    return <article className={`household-card${stateClass}${picked.includes(household.id) ? " is-picked" : ""}${open ? " is-open" : ""}`} key={household.id}>
      <label className="household-pick"><input type="checkbox" checked={picked.includes(household.id)} onChange={() => toggle(household.id)} aria-label={`Select ${household.name}`} /><span>Select</span></label>
      <header><button type="button" className="household-summary" onClick={() => toggleCard(household.id)} aria-expanded={open}><span className="household-caret" aria-hidden="true">{open ? "▾" : "▸"}</span><span className="household-initial">{household.name.slice(0, 1)}</span><span className="household-heading"><strong>{household.name}</strong><small>{household.guest_count} guest{household.guest_count === 1 ? "" : "s"}</small></span></button><Status value={householdRsvpStatus(household)} /></header>
      {/* Sending never needs the card opened: the three things you actually
          do — WhatsApp it, copy the link, note that it has gone — sit on the
          face of every card, closed or open. */}
      <div className="household-quick">
        {/* Opening WhatsApp is not the same as having sent the invitation —
            a message can always be closed unsent, so the tick stays a
            deliberate press rather than a side effect of looking. */}
        <a className="wa-button" href={waLink(household.mobile, invitationMessage(members.map(displayName).join(" & ") || household.name, inviteLink(typeof window === "undefined" ? "https://haykalelaine.com" : window.location.origin, household.invitation_token, members.map(displayName).join(" & ") || household.name), replyBy))} target="_blank" rel="noreferrer">WhatsApp</a>
        <button type="button" onClick={() => copyLink(household)}>Copy link</button>
        {sent
          ? <button type="button" className="quick-sent" title="Put this invitation back on the pile" onClick={() => void act({ action: "markInvitationUnsent", householdId: household.id }, `${household.name} put back on the pile`)}>✓ Sent</button>
          : <button type="button" className="quick-mark" onClick={() => void act({ action: "markInvitationSent", householdId: household.id }, "Invitation marked as sent")}>Mark sent</button>}
      </div>
      {open ? <><div className="household-actions"><button type="button" className="danger-link" onClick={() => {
        const members = guests.filter((g) => g.household_id === household.id);
        const warning = members.length
          ? `Archive ${household.name} and its ${members.length} guest${members.length === 1 ? "" : "s"}? Their invitation link stops working, and you can restore them at any time.`
          : `Archive ${household.name}? You can restore it at any time.`;
        if (!window.confirm(warning)) return;
        // Archiving keeps everything — the same link, the same replies — so
        // undo is simply putting it back, not rebuilding it from pieces.
        void act({ action: "archiveHousehold", householdId: household.id }, "Household archived").then((result) => {
          if (!result) return;
          setUndo({
            label: `${household.name} archived — undo puts them back exactly as they were`,
            restore: async () => { await act({ action: "restoreHousehold", householdId: household.id }, "Household restored"); },
          });
        });
      }} hidden={adminRole === "planner"}>Archive household</button></div><div className="member-stack">{members.map((guest) => <button type="button" className="member-row" key={guest.id} onClick={() => edit(guest)} title={`Edit ${displayName(guest)}`}><i>{displayName(guest).slice(0, 1)}</i><span>{displayName(guest)}<small>{guest.age_group} · {guest.relationship || guest.category}</small></span><Status value={guest.rsvp_status} /></button>)}<button type="button" className="member-add" onClick={() => addTo(household.id)}>＋ Add a guest to this invitation</button></div><dl><div><dt>Primary contact</dt><dd>{household.email || household.mobile || "Not supplied"}</dd></div><div><dt>Invitation</dt><dd>{household.opened_at ? `Opened ${dateLabel(household.opened_at)}` : "Not yet opened"}</dd></div><div><dt>Reply</dt><dd>{members.some((guest) => guest.rsvp_submitted_at) ? `Replied ${dateLabel(members.map((guest) => guest.rsvp_submitted_at).filter(Boolean).sort().pop() as string)}` : "No reply yet"}</dd></div><div><dt>Table</dt><dd>{!members.some((guest) => guest.table_name) ? "Not assigned" : household.table_seen_at ? `Seen ${dateLabel(household.table_seen_at)}` : "Not seen yet"}</dd></div></dl><footer><button onClick={() => copyLink(household)}>Copy invitation</button><a className="wa-button" href={waLink(household.mobile, invitationMessage(members.map(displayName).join(" & ") || household.name, inviteLink(typeof window === "undefined" ? "https://haykalelaine.com" : window.location.origin, household.invitation_token, members.map(displayName).join(" & ") || household.name), replyBy))} target="_blank" rel="noreferrer">WhatsApp</a>{members.some((guest) => guest.table_name) ? <a className="wa-button wa-button--table" href={waLink(household.mobile, tableMessage(members.map(displayName).join(" & ") || household.name, [...new Set(members.map((guest) => guest.table_name).filter(Boolean))].join(" and "), inviteLink(typeof window === "undefined" ? "https://haykalelaine.com" : window.location.origin, household.invitation_token, members.map(displayName).join(" & ") || household.name)))} target="_blank" rel="noreferrer">Send table</a> : null}{afterParty ? <button onClick={() => copyLink(household, true)}>Copy after-party</button> : null}<button className="icon-button" onClick={() => void act({ action: "regenerateLink", householdId: household.id }, "A new secure link was created")} title="Regenerate secure link">↻</button><button className="icon-button" onClick={() => void act({ action: "markInvitationSent", householdId: household.id }, "Invitation marked as sent")} title="Mark invitation sent">✓</button></footer></> : null}</article>;
  })}</section></div>)}</>}</div>;
}

function InvitationLinks({ households, guests, replyBy, notify, act }: { households: Household[]; guests: Guest[]; replyBy: string; notify: (message: string) => void; act: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  const [selectedId, setSelectedId] = useState<number | null>(households[0]?.id ?? null);
  const selected = households.find((household) => household.id === selectedId) ?? households[0] ?? null;
  const members = selected ? guests.filter((guest) => guest.household_id === selected.id) : [];
  const memberNames = members.map(displayName).join(" & ");
  const origin = typeof window === "undefined" ? "https://haykalelaine.com" : window.location.origin;
  const invitationUrl = selected ? inviteLink(origin, selected.invitation_token, memberNames || selected.name) : "";
  const copy = async () => {
    if (!invitationUrl || !selected) return;
    // Names travel with the link so pasting into the wrong chat is obvious.
    await navigator.clipboard.writeText(`${memberNames || selected.name} — ${invitationUrl}`);
    notify(`Link copied with names: ${memberNames || selected.name}`);
  };
  const copyAll = async () => {
    const lines = households.map((household) => {
      const names = guests.filter((guest) => guest.household_id === household.id).map(displayName).join(" & ") || household.name;
      return `${names} — ${inviteLink(origin, household.invitation_token, names)}`;
    });
    await navigator.clipboard.writeText(lines.join("\n"));
    notify(`${lines.length} labelled links copied — one per household`);
  };
  // Lives inside the Households page now, so it does not repeat that wrapper.
  return <div className="invitation-links-page">
    <div className="section-intro-row"><div><p className="panel-kicker">Private invitations</p><h2>Personal link generator</h2><span>Preview each guest journey, then copy its secure link for WhatsApp or text.</span></div><a className="secondary-button" href="/invitation-preview" target="_blank" rel="noreferrer">Preview every page ↗</a></div>
    <section className="manager-panel link-table-panel">
      <div className="table-scroll">
        <table className="guest-table link-table">
          <thead><tr><th>Household</th><th>Who it is for</th><th>Sent</th><th>Link</th><th>Send</th></tr></thead>
          <tbody>
            {households
              // Ids can arrive as text or number depending on how the record was
              // written, so compare them as numbers — a strict match hid
              // households that did have guests, and kept ones that did not.
              .filter((household) => guests.some((guest) => Number(guest.household_id) === Number(household.id)))
              .map((household) => {
              const people = guests.filter((guest) => Number(guest.household_id) === Number(household.id));
              const names = people.map(displayName).join(" & ") || household.name;
              const link = inviteLink(origin, household.invitation_token, household.name);
              return (
                <tr key={household.id}>
                  <td><strong>{household.name}</strong></td>
                  <td>{names}</td>
                  <td className="sent-cell">{people.some((guest) => guest.invitation_sent_at)
                    ? <span className="is-sent">Sent {dateLabel(people.find((guest) => guest.invitation_sent_at)?.invitation_sent_at)}</span>
                    // The server marks a whole invitation at once and needs the
                    // household — sending a guest id returned "Household not
                    // found", so this button never actually recorded anything.
                    : <button type="button" className="mark-sent" onClick={() => void act({ action: "markInvitationSent", householdId: household.id }, "Marked as sent")}>Mark sent</button>}</td>
                  <td className="link-cell"><span>{link}</span></td>
                  <td className="link-actions">
                    <button type="button" onClick={async () => { await navigator.clipboard.writeText(link); notify("Link copied"); }}>Copy</button>
                    <button type="button" onClick={async () => { await navigator.clipboard.writeText(invitationMessage(names, link, replyBy)); notify("Message copied"); }}>Copy message</button>
                    <a href={waLink(household.mobile, invitationMessage(names, link, replyBy))} target="_blank" rel="noreferrer"
                      onClick={() => { void act({ action: "markInvitationSent", householdId: household.id }, "Marked as sent"); }}>WhatsApp</a>
                    <a href={`${link}`} target="_blank" rel="noreferrer">Preview</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!households.length ? <p className="empty-note">Add a guest and a household with its own link appears here.</p> : null}
    </section>
  </div>;
}

function SeatingPlan({ guests, tables, act }: { guests: Guest[]; tables: SeatingTable[]; act: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  const [name, setName] = useState("");
  const [shape, setShape] = useState("round");
  const [capacity, setCapacity] = useState(10);
  const [search, setSearch] = useState("");

  const confirmed = guests.filter((guest) => guest.rsvp_status === "Confirmed");
  const unseated = confirmed.filter((guest) => !guest.table_id);
  const matches = (guest: Guest) =>
    !search ||
    displayName(guest).toLowerCase().includes(search.toLowerCase()) ||
    (guest.household_name ?? "").toLowerCase().includes(search.toLowerCase());

  // the three kinds of table actually being used on the night
  const presets = [
    { label: "Round table", shape: "round", capacity: 10 },
    { label: "Viking table (48)", shape: "banquet", capacity: 48 },
    { label: "VIP table", shape: "rectangular", capacity: 12 },
  ];

  const addTable = async (preset?: { label: string; shape: string; capacity: number }) => {
    const chosen = preset ?? { label: name.trim(), shape, capacity };
    const finalName = preset
      ? `${preset.label.replace(/ \(\d+\)$/, "")} ${tables.filter((table) => table.shape === preset.shape).length + 1}`
      : name.trim();
    if (!finalName) return;
    const result = await act({ action: "createTable", name: finalName, shape: chosen.shape, capacity: chosen.capacity }, `${finalName} added`);
    if (!result) return;
    setName("");
  };

  return <div className="manager-page seating-page">
    <div className="section-intro-row">
      <div>
        <p className="panel-kicker">Seating</p>
        <h2>{tables.length} tables · {unseated.length} still to seat</h2>
        <span>Make a table, then put people at it. Everyone who has accepted appears below.</span>
      </div>
    </div>

    <section className="manager-panel seating-new">
      <h3>Add a table</h3>
      <div className="seating-presets">
        {presets.map((preset) => (
          <button type="button" key={preset.label} onClick={() => addTable(preset)}>
            ＋ {preset.label}
          </button>
        ))}
      </div>
      <div className="seating-custom">
        <label><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Top table" /></label>
        <label><span>Shape</span><select value={shape} onChange={(event) => setShape(event.target.value)}>
          <option value="round">Round</option>
          <option value="banquet">Long / Viking</option>
          <option value="rectangular">Rectangular</option>
        </select></label>
        <label><span>Seats</span><input type="number" min={1} max={200} value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></label>
        <button type="button" onClick={() => addTable()} disabled={!name.trim()}>Add table</button>
      </div>
    </section>

    {tables.map((table) => {
      const seated = confirmed.filter((guest) => guest.table_id === table.id);
      return (
        <section className="manager-panel seating-table" key={table.id}>
          <header>
            <div>
              <h3>{table.name}</h3>
              <p>{seated.length} of {table.capacity} seats · {table.shape === "banquet" ? "long table" : table.shape}</p>
            </div>
            <div className="seating-table-actions">
              <button type="button" onClick={async () => {
                const next = window.prompt("Rename this table", table.name);
                if (next && next.trim()) await act({ action: "editTable", tableId: table.id, name: next.trim() }, "Table renamed");
              }}>Rename</button>
              <button type="button" onClick={async () => {
                const next = window.prompt("How many seats?", String(table.capacity));
                if (next && Number(next) > 0) await act({ action: "editTable", tableId: table.id, capacity: Number(next) }, "Seats updated");
              }}>Seats</button>
              <button type="button" className="danger-link" onClick={async () => {
                if (!window.confirm(`Remove ${table.name}? Anyone seated there goes back to the unseated list.`)) return;
                await act({ action: "deleteTable", tableId: table.id }, `${table.name} removed`);
              }}>Remove</button>
            </div>
          </header>
          {seated.length ? (
            <ol className="seating-list">
              {seated.map((guest) => (
                <li key={guest.id}>
                  <span>{displayName(guest)}<small>{guest.household_name}</small></span>
                  <button type="button" onClick={() => void act({ action: "moveGuest", guestId: guest.id, tableId: null }, "Guest unseated")}>Remove</button>
                </li>
              ))}
            </ol>
          ) : <p className="empty-note">No one seated here yet.</p>}
        </section>
      );
    })}

    <section className="manager-panel seating-unseated">
      <header>
        <div><h3>Still to seat · {unseated.length}</h3><p>Only guests who have accepted appear here.</p></div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" aria-label="Search unseated guests" />
      </header>
      {unseated.filter(matches).length ? (
        <ol className="seating-list">
          {unseated.filter(matches).map((guest) => (
            <li key={guest.id}>
              <span>{displayName(guest)}<small>{guest.household_name}</small></span>
              <select
                value=""
                onChange={(event) => { if (event.target.value) void act({ action: "moveGuest", guestId: guest.id, tableId: Number(event.target.value) }, `${displayName(guest)} seated`); }}
                aria-label={`Seat ${displayName(guest)}`}
              >
                <option value="">Seat at…</option>
                {tables.map((table) => {
                  const taken = confirmed.filter((seat) => seat.table_id === table.id).length;
                  return <option key={table.id} value={table.id} disabled={taken >= table.capacity}>
                    {table.name} ({taken}/{table.capacity}){taken >= table.capacity ? " — full" : ""}
                  </option>;
                })}
              </select>
            </li>
          ))}
        </ol>
      ) : <p className="empty-note">{unseated.length ? "No one matches that search." : "Everyone who has accepted has a seat."}</p>}
    </section>
  </div>;
}

function GuestPill({ guest, compact = false }: { guest: Guest; compact?: boolean }) {
  return <div className={`guest-pill${compact ? " is-compact" : ""}`} draggable onDragStart={(event) => { event.dataTransfer.setData("text/guest-id", String(guest.id)); event.dataTransfer.effectAllowed = "move"; }}><i>{displayName(guest).slice(0, 1)}</i><span>{displayName(guest)}{!compact ? <small>{guest.household_name}</small> : null}</span>{guest.dietary_requirements || guest.allergies ? <b title="Dietary note">◈</b> : null}</div>;
}

function AfterParty({ guests, selected, setSelected, act }: { guests: Guest[]; selected: number[]; setSelected: (ids: number[]) => void; act: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  const [partySearch, setPartySearch] = useState("");
  // A guest can only be offered the after-party once they have actually
  // said yes to the wedding itself — offering it earlier means access could
  // be granted to someone who later declines. Anyone already invited stays
  // visible regardless, so a change of heart can still be un-invited here.
  const allEligible = guests.filter((guest) => guest.rsvp_status === "Confirmed" || guest.after_party_invited);
  // The counts describe the after-party, not the wedding. Reading them from
  // every guest made "pending" mean "everyone who has not said yes to a party
  // they were never asked to" — 122 pending against 70 invited. Only invited
  // guests are counted now, so the three figures add up to the invited total.
  const invited = guests.filter((guest) => guest.after_party_invited);
  const attending = invited.filter((guest) => guest.after_party_attending === "Yes").length;
  const declined = invited.filter((guest) => guest.after_party_attending === "No").length;
  const awaiting = invited.length - attending - declined;
  const eligible = allEligible.filter((guest) => !partySearch || displayName(guest).toLowerCase().includes(partySearch.toLowerCase()) || guest.household_name?.toLowerCase().includes(partySearch.toLowerCase()));
  return <div className="manager-page afterparty-manager"><section className="night-banner"><span>✦</span><div><p>Secret chapter</p><h2>After the last toast</h2><small>Only selected guests receive access. Everyone else sees nothing.</small></div><strong>{invited.length}<small> invited</small></strong></section><div className="afterparty-stats"><p><span>Invited</span><strong>{invited.length}</strong></p><p><span>Attending</span><strong>{attending}</strong></p><p><span>Awaiting reply</span><strong>{awaiting}</strong></p><p><span>Cannot come</span><strong>{declined}</strong></p></div><section className="manager-panel"><div className="table-toolbar"><label className="search-field"><span>⌕</span><input value={partySearch} onChange={(event) => setPartySearch(event.target.value)} placeholder="Search eligible guests" aria-label="Search eligible guests" /></label>{selected.length ? <button onClick={() => void act({ action: "bulkUpdate", guestIds: selected, field: "afterPartyInvited", value: true }, "Private access enabled")}>Invite {selected.length} guests</button> : null}</div><div className="afterparty-list">{eligible.length === 0 ? <p className="empty-note">{partySearch ? "No confirmed guests match that search." : "No one has confirmed their RSVP yet — guests appear here to be invited as soon as they say yes."}</p> : null}{eligible.map((guest) => <label key={guest.id}><input type="checkbox" checked={selected.includes(guest.id)} onChange={() => setSelected(selected.includes(guest.id) ? selected.filter((id) => id !== guest.id) : [...selected, guest.id])} /><i>{displayName(guest).slice(0, 1)}</i><span><strong>{displayName(guest)}</strong><small>{guest.household_name} · {guest.category}</small></span>{guest.after_party_invited ? <Status value={guest.after_party_attending} /> : <span className="muted-cell">Not invited</span>}<button type="button" role="switch" aria-checked={Boolean(guest.after_party_invited)} className={`party-switch${guest.after_party_invited ? " is-on" : ""}`} onClick={() => void act({ action: "bulkUpdate", guestIds: [guest.id], field: "afterPartyInvited", value: !guest.after_party_invited }, guest.after_party_invited ? "After-party invitation removed" : "After-party invitation enabled")} aria-label={`After-party invitation for ${displayName(guest)}`}><span className="party-switch-track"><i /></span><b>{guest.after_party_invited ? "Invited" : "Off"}</b></button></label>)}</div></section></div>;
}

function Imports({ act, notify }: { act: (payload: Record<string, unknown>, success: string) => Promise<unknown>; notify: (message: string) => void }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [fileName, setFileName] = useState("");
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(0);
  const [duplicateMode, setDuplicateMode] = useState("skip");
  const parse = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result).replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
      // Exported sheets often carry a title or a blank row above the headings,
      // so look for the line that actually names the columns.
      const headerIndex = lines.findIndex((line) => /(^|,)\s*"?(first name|name)"?\s*(,|$)/i.test(line));
      const headerLine = lines.splice(0, Math.max(0, headerIndex) + 1).pop() || "";
      const headers = headerLine.split(",").map((header) => header.trim().toLowerCase().replace(/^"|"$/g, ""));
      const keyMap: Record<string, string> = {
        "first name": "firstName", "last name": "lastName", "preferred name": "preferredName",
        household: "household", mobile: "mobile", phone: "mobile", "phone number": "mobile",
        "mobile number": "mobile", "contact number": "mobile", partner: "partner", table: "table",
        name: "fullName", "full name": "fullName", email: "email", "guest category": "category",
        "bride or groom side": "side", "rsvp status": "rsvpStatus", "ceremony invited": "ceremonyInvited",
        "reception invited": "receptionInvited", "after-party invited": "afterPartyInvited",
        "dietary requirements": "dietaryRequirements", allergies: "allergies", notes: "notes",
      };
      const parsed = lines.slice(0, 2000).map((line) => {
        const values = line.match(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g)?.map((cell) => cell.replace(/,$/, "").replace(/^"|"$/g, "").replaceAll('""', '"')) ?? [];
        const row: Record<string, unknown> = {};
        headers.forEach((header, index) => { const key = keyMap[header]; if (key) row[key] = values[index] ?? ""; });
        // "Mr & Mrs Tan" — or "Dato & Datin Tan", a common Malaysian pairing —
        // is two guests sharing one household, so each gets their own meal
        // and their own line in the reply.
        const couple = typeof row.fullName === "string"
          ? row.fullName.trim().match(/^(Datuk|Dato|Mr|Datin|Mrs|Miss|Ms)\.?\s*(?:&|and|\+)\s*(Datuk|Dato|Mr|Datin|Mrs|Miss|Ms)\.?\s+(.+)$/i)
          : null;
        if (couple) {
          const [, title1, title2, surnameRaw] = couple;
          const surname = surnameRaw.trim();
          row.firstName = title1;
          row.lastName = surname;
          row.household = row.household || `${title1} & ${title2} ${surname}`;
          row.partnerRow = { firstName: title2, lastName: surname, household: row.household };
        }
        if (!row.firstName && typeof row.fullName === "string" && row.fullName.trim()) {
          const parts = row.fullName.trim().split(/\s+/);
          row.firstName = parts.shift();
          row.lastName = parts.join(" ");
        }
        if (!row.household && row.firstName) row.household = `${row.firstName}${row.lastName ? " " + row.lastName : ""} Household`;
        return row;
      }).flatMap((row) => {
        // a "Mr & Mrs" row becomes the two people it describes
        const partner = row.partnerRow as Record<string, unknown> | undefined;
        if (!partner) return [row];
        const first = { ...row };
        delete first.partnerRow;
        return [first, { ...first, ...partner }];
      });

      const usable = parsed.filter((row) => String(row.firstName || "").trim());
      if (!usable.length) {
        setRows([]);
        setImportError(
          headerIndex < 0
            ? "I could not find the column headings. The first row should name the columns — at least “Name” or “First Name”. Open the template above to compare."
            : "The file was read, but no guest names were found in it. Check there is a Name or First Name column with names beneath it."
        );
        return;
      }
      if (usable.length < parsed.length) {
        setImportError(`${parsed.length - usable.length} row${parsed.length - usable.length === 1 ? "" : "s"} had no name and will be skipped.`);
      }
      setRows(usable);
      setFileName(file.name);
    };
    reader.readAsText(file);
  };
  const template = "First Name,Last Name,Preferred Name,Household,Mobile,Guest Category,Bride or Groom Side,RSVP Status,Ceremony Invited,Reception Invited,After-Party Invited,Dietary Requirements,Allergies,Table,Notes\n";
  return <div className="manager-page imports-page"><div className="section-intro-row"><div><p className="panel-kicker">Bring your list</p><h2>Import guests</h2><span>Use a CSV exported from Google Sheets. A single Name column is fine, and mobile numbers can be added later.</span></div><button className="secondary-button" onClick={() => downloadFile("elaine-haykal-guest-template.csv", template)}>Download template</button></div><section className="manager-panel import-panel"><label className="drop-zone"><input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain,text/comma-separated-values,application/csv,application/vnd.ms-excel,.xlsx,.xls,*/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (/\.(xlsx|xls|numbers)$/i.test(file.name)) { setFileName(""); setImportError("That is a spreadsheet, not a CSV. In Excel or Google Sheets choose File → Save as (or Download) → CSV, then drop that file here."); return; } setImportError(""); parse(file); }} /><span>↓</span><h3>{fileName || "Drop your guest list here"}</h3><p>CSV only · Excel files need saving as CSV first · a mobile number is optional · up to 2,000 rows</p><span className="drop-zone-button">Choose CSV file</span></label>{importError ? <p className="form-error" role="alert">{importError}</p> : null}{rows.length ? <div className="import-preview"><header><div><h3>Preview {rows.length} rows</h3><p>Review names, households and required mobile numbers.</p></div><select value={duplicateMode} onChange={(event) => setDuplicateMode(event.target.value)}><option value="skip">Skip duplicates</option><option value="update">Update duplicates</option></select></header><div className="table-scroll"><table><thead><tr><th>First name</th><th>Last name</th><th>Household</th><th>Mobile</th><th>Group</th><th>Status</th></tr></thead><tbody>{rows.slice(0, 8).map((row, index) => <tr key={index}><td>{String(row.firstName || "Missing")}</td><td>{String(row.lastName || "")}</td><td>{String(row.household || "")}</td><td>{String(row.mobile || "—")}</td><td>{String(row.category || "Friends")}</td><td>{String(row.rsvpStatus || "Pending")}</td></tr>)}</tbody></table></div><footer><span>{importing ? `Importing… ${importDone} of ${rows.length}` : rows.length > 8 ? `Showing first 8 of ${rows.length} rows` : `${rows.length} rows ready`}</span><button disabled={importing} onClick={async () => {
      // Sent in small batches. One request carrying 155 guests makes hundreds
      // of database round-trips and is cut off by the hosting timeout partway
      // through — which writes some guests, fails, and writes them again on
      // the next attempt. That is what produced the repeats.
      setImporting(true); setImportDone(0); setImportError("");
      // The server now reads the existing list once per request and writes in
      // one batch, so larger chunks are both safe and fewer round trips.
      const size = 40;
      let added = 0, updated = 0, skipped = 0;
      try {
        for (let start = 0; start < rows.length; start += size) {
          const batch = rows.slice(start, start + size);
          const result = await act({ action: "importGuests", rows: batch, duplicateMode }, "") as { summary?: { added: number; updated: number; skipped: number } } | null;
          if (!result) throw new Error("The remaining rows were not imported.");
          if (result?.summary) { added += result.summary.added; updated += result.summary.updated; skipped += result.summary.skipped; }
          setImportDone(Math.min(start + size, rows.length));
        }
        notify(`${added} added · ${updated} updated · ${skipped} skipped`);
        setRows([]);
      } catch (failure) {
        setImportError(`Stopped after ${added + updated + skipped} of ${rows.length}. ${failure instanceof Error ? failure.message : ""} Leave duplicates on “Skip” and press Confirm again — those already brought in will not be repeated.`);
      } finally { setImporting(false); }
    }}>{importing ? "Importing…" : "Confirm import"}</button></footer></div> : null}</section><section className="import-help"><article><span>01</span><h3>Export from Sheets</h3><p>File → Download → Comma-separated values.</p></article><article><span>02</span><h3>Check phone numbers</h3><p>Use international format, such as +60, +61 or +65.</p></article><article><span>03</span><h3>Only know them as a couple?</h3><p>Write two rows sharing one Household: “Mr” and “Mrs”, both with the surname. They each get their own meal choice, and the invitation reads “Mr &amp; Mrs Tan”.</p></article></section></div>;
}

function WishesAndAdvice({ guests }: { guests: Guest[] }) {
  const named = (guest: Guest) => guest.preferred_name || `${guest.first_name} ${guest.last_name}`.trim();
  const wishes = guests.filter((guest) => (guest.wishes || "").trim());
  const advice = guests.filter((guest) => (guest.marriage_advice || "").trim());
  const rooms = [...new Map(
    guests
      .filter((guest) => guest.rsvp_status === "Confirmed")
      .filter((guest) => guest.accommodation_required || (guest.bed_preference || "").trim() || guest.room_nights)
      .map((guest) => [guest.household_id ?? `guest-${guest.id}`, guest]),
  ).values()];
  const copyAll = (items: Guest[], field: "wishes" | "marriage_advice") => {
    const text = items.map((guest) => `${named(guest)}\n${(guest[field] || "").trim()}`).join("\n\n");
    navigator.clipboard.writeText(text).catch(() => undefined);
  };
  return <>
    <div className="panel-head">
      <div><p className="panel-kicker">Shared on the night</p><h3>Warm wishes ({wishes.length})</h3></div>
      {wishes.length ? <button className="secondary-button" onClick={() => copyAll(wishes, "wishes")}>Copy all</button> : null}
    </div>
    {wishes.length
      ? <div className="wish-list">{wishes.map((guest) => <blockquote key={`wish-${guest.id}`}><p>{guest.wishes}</p><cite>{named(guest)}<time>{dateTimeLabel(guest.rsvp_submitted_at)}</time></cite></blockquote>)}</div>
      : <p className="empty-note">No wishes have been left yet.</p>}

    <div className="panel-head">
      <div><p className="panel-kicker">Private — only the two of you</p><h3>Marriage advice ({advice.length})</h3></div>
      {advice.length ? <button className="secondary-button" onClick={() => copyAll(advice, "marriage_advice")}>Copy all</button> : null}
    </div>
    {advice.length
      ? <div className="wish-list wish-list--private">{advice.map((guest) => <blockquote key={`advice-${guest.id}`}><p>{guest.marriage_advice}</p><cite>{named(guest)}<time>{dateTimeLabel(guest.rsvp_submitted_at)}</time></cite></blockquote>)}</div>
      : <p className="empty-note">No advice has been left yet.</p>}

    <div className="panel-head"><div><p className="panel-kicker">Grand Hyatt</p><h3>Room requests ({rooms.length})</h3></div></div>
    {rooms.length
      ? <div className="wish-list">{rooms.map((guest) => <blockquote key={`room-${guest.household_id ?? guest.id}`}><p>{guest.bed_preference === "Twin" ? "Two singles" : guest.bed_preference === "King" ? "One king" : "Bed not stated"}{guest.room_nights ? ` · ${guest.room_nights} night${guest.room_nights > 1 ? "s" : ""}` : ""}</p><cite>{guest.household_name || named(guest)}</cite></blockquote>)}</div>
      : <p className="empty-note">No rooms have been requested yet.</p>}
  </>;
}

function Exports({ guests, tables }: { guests: Guest[]; tables: SeatingTable[] }) {
  const [filter, setFilter] = useState("Confirmed");
  const exportRows = guests.filter((guest) => filter === "All" || guest.rsvp_status === filter);
  const exportCsv = (preset: "venue" | "chef" | "afterparty" | "complete") => {
    const maps = {
      venue: [["Guest", (g: Guest) => displayName(g)], ["Household", (g: Guest) => g.household_name], ["RSVP", (g: Guest) => g.rsvp_status], ["Ceremony", (g: Guest) => g.ceremony_attending], ["Reception", (g: Guest) => g.reception_attending], ["Table", (g: Guest) => g.table_name], ["Seat", (g: Guest) => g.seat_number], ["Accessibility", (g: Guest) => g.accessibility], ["Transport", (g: Guest) => g.transport_required ? "Yes" : "No"]],
      chef: [["Guest", (g: Guest) => displayName(g)], ["Table", (g: Guest) => g.table_name], ["Meal", (g: Guest) => g.meal_selection], ["Dietary", (g: Guest) => g.dietary_requirements], ["Allergies", (g: Guest) => g.allergies]],
      afterparty: [["Guest", (g: Guest) => displayName(g)], ["Household", (g: Guest) => g.household_name], ["Invited", (g: Guest) => g.after_party_invited ? "Yes" : "No"], ["RSVP", (g: Guest) => g.after_party_attending], ["Table", (g: Guest) => g.table_name], ["Mobile", (g: Guest) => g.mobile]],
      complete: [["ID", (g: Guest) => g.id], ["Guest", (g: Guest) => displayName(g)], ["Household", (g: Guest) => g.household_name], ["Age group", (g: Guest) => g.age_group], ["Mobile", (g: Guest) => g.mobile], ["Category", (g: Guest) => g.category], ["Side", (g: Guest) => g.side], ["RSVP", (g: Guest) => g.rsvp_status], ["Meal", (g: Guest) => g.child_meal ? "Children's meal" : g.meal_selection], ["Dietary", (g: Guest) => g.dietary_requirements], ["Allergies", (g: Guest) => g.allergies], ["Accessibility", (g: Guest) => g.accessibility], ["Travelling to Kuala Lumpur", (g: Guest) => g.transport_required ? "Yes" : "No"], ["Grand Hyatt room", (g: Guest) => g.accommodation_required ? "Yes" : "No"], ["Arrival", (g: Guest) => g.travel_arrival], ["Departure", (g: Guest) => g.travel_departure], ["Accommodation", (g: Guest) => g.accommodation_name], ["Bed", (g: Guest) => g.bed_preference], ["Room nights", (g: Guest) => g.room_nights], ["Guest-book message", (g: Guest) => g.wishes], ["Private note", (g: Guest) => g.marriage_advice], ["Table", (g: Guest) => g.table_name], ["Seat", (g: Guest) => g.seat_number], ["Internal notes", (g: Guest) => g.internal_notes]],
    } as const;
    const columns = maps[preset]; const content = [`Report,${csvValue(`${preset[0].toUpperCase()}${preset.slice(1)} export`)}`, `Export date,${csvValue(new Date().toLocaleString("en-AU", { timeZone: "Australia/Perth" }))}`, `Wedding,${csvValue("Elaine & Haykal")}`, `Applied filter,${csvValue(filter)}`, "", columns.map(([label]) => csvValue(label)).join(","), ...exportRows.filter((g) => preset !== "afterparty" || g.after_party_invited).map((guest) => columns.map(([, getter]) => csvValue(getter(guest) as unknown)).join(","))].join("\r\n");
    downloadFile(`elaine-haykal-${preset}-${new Date().toISOString().slice(0, 10)}.csv`, content);
  };
  const presets = [{ id: "venue", title: "Venue pack", note: "Attendance, seating, access and transport", glyph: "⌂" }, { id: "chef", title: "Chef & catering", note: "Meals, dietary needs and allergies", glyph: "◇" }, { id: "afterparty", title: "After-party list", note: "Private invitations and late-night RSVPs", glyph: "✦" }, { id: "complete", title: "Complete guest archive", note: "All administrator guest fields", glyph: "▦" }] as const;
  return <div className="manager-page"><div className="section-intro-row"><div><p className="panel-kicker">Reports</p><h2>Export centre</h2><span>Purpose-built files with private fields excluded where appropriate.</span></div><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option><option>Confirmed</option><option>Pending</option><option>Declined</option></select></div><section className="export-grid">{presets.map((preset) => <article key={preset.id}><span>{preset.glyph}</span><h3>{preset.title}</h3><p>{preset.note}</p><dl><div><dt>Guests</dt><dd>{preset.id === "afterparty" ? exportRows.filter((g) => g.after_party_invited).length : exportRows.length}</dd></div>{preset.id === "venue" ? <div><dt>Tables</dt><dd>{tables.length}</dd></div> : null}</dl><button onClick={() => exportCsv(preset.id)}>Download CSV <i>↓</i></button></article>)}</section></div>;
}

function SettingsPanel({ settings, managers, adminRole, activities, act, guests }: {
  settings: Settings;
  managers: ManagerUser[];
  adminRole: "owner" | "partner" | "planner";
  activities: Activity[];
  act: (payload: Record<string, unknown>, success: string) => Promise<unknown>;
  guests: Guest[];
}) {
  // How many households have asked for a room so far — the same count the
  // invitation uses to decide whether the offer is still open.
  const roomsRequested = new Set(guests.filter((guest) => guest.accommodation_required).map((guest) => Number(guest.household_id))).size;
  const [form, setForm] = useState({
    weddingName: settings.wedding_name,
    coupleNames: settings.couple_names,
    weddingDate: settings.wedding_date,
    rsvpDeadline: settings.rsvp_deadline,
    websiteUrl: settings.website_url || "",
    invitationWording: settings.invitation_wording || "",
    confirmationMessage: settings.confirmation_message || "",
    timezone: settings.timezone,
    dateFormat: settings.date_format || "D MMMM YYYY",
    cloudinaryCloudName: settings.cloudinary_cloud_name || "",
    formspreeFormId: settings.formspree_form_id || "",
    musicUrl: settings.music_url || "",
    musicTitle: settings.music_title || "",
    afterPartyWhen: (settings.after_party_when as string) || "",
    afterPartyWhere: (settings.after_party_where as string) || "",
    afterPartyDress: (settings.after_party_dress as string) || "",
    afterPartyEntry: (settings.after_party_entry as string) || "",
    afterHoursRsvpDeadline: (settings.after_hours_rsvp_deadline as string) || "2026-10-15",
    afterHoursLocationRevealed:
      settings.after_hours_location_revealed === true ||
      Number(settings.after_hours_location_revealed) === 1,
    afterHoursVenue: (settings.after_hours_venue as string) || "",
    afterHoursAddress: (settings.after_hours_address as string) || "",
    afterHoursTransportNote: (settings.after_hours_transport_note as string) || "",
    afterHoursMusicUrl: (settings.after_hours_music_url as string) || "",
    roomBlockSize: String(settings.room_block_size ?? 15),
  });
  const [managerForm, setManagerForm] = useState({ name: "", email: "", role: "partner" as "partner" | "planner" });
  return <div className="manager-page settings-page">
    <form className="manager-panel settings-form" onSubmit={(event) => { event.preventDefault(); void act({ action: "saveSettings", ...form }, "Wedding settings saved"); }}>
      <div className="panel-head"><div><p className="panel-kicker">Wedding details</p><h3>Invitation settings</h3></div><button type="submit">Save changes</button></div>
      <div className="settings-grid">
        <label><span>Wedding name</span><input value={form.weddingName} onChange={(event) => setForm({ ...form, weddingName: event.target.value })} /></label>
        <label><span>Couple names</span><input value={form.coupleNames} onChange={(event) => setForm({ ...form, coupleNames: event.target.value })} /></label>
        <label><span>Wedding date</span><input type="date" value={form.weddingDate} onChange={(event) => setForm({ ...form, weddingDate: event.target.value })} /></label>
        <label><span>RSVP deadline</span><input type="date" value={form.rsvpDeadline} onChange={(event) => setForm({ ...form, rsvpDeadline: event.target.value })} /></label>
        <label><span>Time zone</span><select value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })}><option>Australia/Perth</option><option>Asia/Kuala_Lumpur</option></select></label>
        <label><span>Date format</span><select value={form.dateFormat} onChange={(event) => setForm({ ...form, dateFormat: event.target.value })}><option>D MMMM YYYY</option><option>DD/MM/YYYY</option></select></label>
        <label className="wide"><span>Website URL</span><input value={form.websiteUrl} onChange={(event) => setForm({ ...form, websiteUrl: event.target.value })} placeholder="https://…" /></label>
        <label className="wide"><span>Default invitation wording</span><textarea value={form.invitationWording} onChange={(event) => setForm({ ...form, invitationWording: event.target.value })} rows={3} /></label>
        <label className="wide"><span>Confirmation message</span><textarea value={form.confirmationMessage} onChange={(event) => setForm({ ...form, confirmationMessage: event.target.value })} rows={3} /></label>
        <label><span>Music title</span><input value={form.musicTitle} onChange={(event) => setForm({ ...form, musicTitle: event.target.value })} placeholder="Our wedding soundtrack" /></label>
        <label><span>Music file URL</span><input type="url" value={form.musicUrl} onChange={(event) => setForm({ ...form, musicUrl: event.target.value })} placeholder="Cloudinary MP3 delivery URL" /></label>
        <label><span>Cloudinary cloud name</span><input value={form.cloudinaryCloudName} onChange={(event) => setForm({ ...form, cloudinaryCloudName: event.target.value })} placeholder="Optional" /></label>
        <label><span>Formspree form ID</span><input value={form.formspreeFormId} onChange={(event) => setForm({ ...form, formspreeFormId: event.target.value })} placeholder="Optional" /></label>
        <label><span>Rooms held at the Grand Hyatt</span><input type="number" min={0} max={999} value={form.roomBlockSize} onChange={(event) => setForm({ ...form, roomBlockSize: event.target.value })} placeholder="15" /><small className="field-hint">{roomsRequested} requested so far. Once this many households have asked, the offer closes itself and later guests are shown the nearby hotels instead. Set to 0 for no limit.</small></label>
      </div>
      <div className="panel-head"><div><p className="panel-kicker">The private chapter</p><h3>After-party details</h3></div></div>
      <div className="settings-grid">
        <label><span>RSVP deadline</span><input type="date" value={form.afterHoursRsvpDeadline} onChange={(event) => setForm({ ...form, afterHoursRsvpDeadline: event.target.value })} /></label>
        <Toggle label="Reveal location" value={form.afterHoursLocationRevealed} set={(value) => setForm({ ...form, afterHoursLocationRevealed: value })} />
        <label><span>Venue name</span><input value={form.afterHoursVenue} onChange={(event) => setForm({ ...form, afterHoursVenue: event.target.value })} placeholder="Leave empty while hidden" /></label>
        <label><span>Address</span><input value={form.afterHoursAddress} onChange={(event) => setForm({ ...form, afterHoursAddress: event.target.value })} placeholder="Leave empty while hidden" /></label>
        <label className="wide"><span>Transport note</span><input value={form.afterHoursTransportNote} onChange={(event) => setForm({ ...form, afterHoursTransportNote: event.target.value })} placeholder="Optional" /></label>
        <label className="wide"><span>After Hours music URL</span><input type="url" value={form.afterHoursMusicUrl} onChange={(event) => setForm({ ...form, afterHoursMusicUrl: event.target.value })} placeholder="Optional audio asset" /></label>
      </div>
      <p className="security-note"><span>✦</span><strong>Invitation-key access</strong> These details appear only to guests whose invitation includes the after-party. Everyone else never sees the page exists.</p>
      <p className="security-note"><span>◇</span><strong>Music is consent-based</strong> Add an MP3 delivery URL here. Guests choose whether to play it; audio never autoplays.</p>
    </form>
    {adminRole !== "planner" ? <section className="manager-panel fresh-start-panel">
      <div className="panel-head"><div><p className="panel-kicker">Before the real send</p><h3>Fresh start</h3></div></div>
      <p className="access-copy">Returns every guest to <strong>Pending</strong> and <strong>not sent</strong>, clears all after-party access, and marks every link unopened — while keeping everything you have typed exactly as it is: names, numbers, households, categories, meals, dietary notes, tables and internal notes. Use this once, just before the invitations truly go out.</p>
      <button type="button" className="danger-button" onClick={() => {
        if (!window.confirm("Return EVERY guest to Pending and not sent, and clear all after-party access? Guest details themselves are kept.")) return;
        if (!window.confirm("This rewrites the status of the whole guest list and cannot be undone. Continue?")) return;
        void act({ action: "prepareForSending" }, "Fresh start complete — everyone is Pending and unsent");
      }}>Reset statuses for sending</button>
    </section> : null}
    <section className="manager-panel access-panel">
      <div className="panel-head"><div><p className="panel-kicker">Trusted team</p><h3>Guest manager access</h3></div></div>
      <p className="access-copy">Give your partner or wedding planner their own sign-in. Each person uses their own account and actions are recorded.</p>
      {adminRole === "owner" ? <form className="access-form" onSubmit={(event) => {
        event.preventDefault();
        void act({ action: "addManager", ...managerForm }, "Manager access granted").then((result) => {
          if (result) setManagerForm({ name: "", email: "", role: "partner" });
        });
      }}>
        <label><span>Name</span><input required value={managerForm.name} onChange={(event) => setManagerForm({ ...managerForm, name: event.target.value })} /></label>
        <label><span>Account email</span><input required type="email" value={managerForm.email} onChange={(event) => setManagerForm({ ...managerForm, email: event.target.value })} /></label>
        <label><span>Access role</span><select value={managerForm.role} onChange={(event) => setManagerForm({ ...managerForm, role: event.target.value as "partner" | "planner" })}><option value="partner">Partner</option><option value="planner">Wedding planner</option></select></label>
        <button type="submit">Grant access</button>
      </form> : <p className="security-note"><span>◇</span><strong>Owner controlled</strong> Only the owner can add or remove manager accounts.</p>}
      <div className="manager-access-list">{managers.map((manager) => <div key={manager.id}><span>{manager.name.slice(0, 1).toUpperCase()}</span><p><strong>{manager.name}</strong><small>{manager.email} · {manager.role}</small></p>{manager.role !== "owner" && adminRole === "owner" ? <button type="button" className="danger-link" onClick={() => { if (window.confirm(`Remove guest manager access for ${manager.name}?`)) void act({ action: "removeManager", managerId: manager.id }, "Manager access removed"); }}>Remove</button> : <em>Owner</em>}</div>)}</div>
    </section>
    <section className="manager-panel audit-panel"><div className="panel-head"><div><p className="panel-kicker">Accountability</p><h3>Activity log</h3></div></div>{activities.map((activity) => <div key={activity.id}><span>✦</span><p><strong>{activity.action}</strong><small>{activity.detail} · {activity.admin_name}</small></p><time>{dateLabel(activity.created_at)}</time></div>)}</section>
  </div>;
}

function GuestModal({ guest, households, close, act, allGuests, setUndo, presetHouseholdId }: { guest: Guest | "new"; households: Household[]; allGuests?: Guest[]; setUndo?: (u: { label: string; restore: () => Promise<void> } | null) => void; presetHouseholdId?: number | null; close: () => void; act: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  const isNew = guest === "new";
  const current = isNew ? null : guest;
  const [form, setForm] = useState({
    firstName: current?.first_name || "", lastName: current?.last_name || "", preferredName: current?.preferred_name || "", mobile: current?.mobile || "",
    householdId: current?.household_id ? String(current.household_id) : presetHouseholdId ? String(presetHouseholdId) : "", householdName: "",
    category: current?.category || "Friends", side: current?.side || "Shared", ageGroup: current?.age_group === "Child" ? "Child" : "Adult", childMeal: current ? !!current.child_meal : false,
    rsvpStatus: current?.rsvp_status || "Pending", mealSelection: current?.meal_selection || "",
    dietaryRequirements: current?.dietary_requirements || "", allergies: current?.allergies || "", accessibility: current?.accessibility || "", internalNotes: current?.internal_notes || "",
    travelArrival: current?.travel_arrival || "", travelDeparture: current?.travel_departure || "", accommodationName: current?.accommodation_name || "",
    bedPreference: current?.bed_preference || "", roomNights: current?.room_nights ? String(current.room_nights) : "",
    wishes: current?.wishes || "", marriageAdvice: current?.marriage_advice || "",
    ceremonyInvited: current ? !!current.ceremony_invited : true, receptionInvited: current ? !!current.reception_invited : true,
    afterPartyEligible: current ? !!current.after_party_eligible : false, afterPartyInvited: current ? !!current.after_party_invited : false,
    transportRequired: current ? !!current.transport_required : false, accommodationRequired: current ? !!current.accommodation_required : false,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;          // a second press must not make a second guest
    setSaving(true);
    setSaveError("");
    try {
      const result = await act({ action: isNew ? "addGuest" : "editGuest", guestId: current?.id, ...form, householdId: form.householdId ? Number(form.householdId) : null }, isNew ? "Guest added" : "Guest updated");
      if (!result) {
        setSaveError("The guest could not be saved. Your changes are still here; please try again.");
        return;
      }
      close();
    } catch (error) {
      // Without this the failure was silent: the button simply did nothing.
      setSaveError(error instanceof Error ? error.message : "The guest could not be saved.");
    } finally { setSaving(false); }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><form className="guest-modal" onSubmit={submit}>
    <header><div><p className="panel-kicker">{isNew ? "New invitation" : current?.household_name}</p><h2>{isNew ? "Add a guest" : displayName(current!)}</h2></div><button type="button" onClick={close} aria-label="Close">×</button></header>
    <div className="modal-body">
      <section><h3>Identity &amp; phone</h3><div className="modal-grid">
        <label><span>First name *</span><input required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label>
        <label><span>Last name</span><input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label>
        <label><span>Preferred name</span><input value={form.preferredName} onChange={(event) => setForm({ ...form, preferredName: event.target.value })} /></label>
        <label><span>Guest age group</span><select value={form.ageGroup} onChange={(event) => setForm({ ...form, ageGroup: event.target.value, childMeal: event.target.value === "Child" })}><option>Adult</option><option>Child</option></select></label>
        <label><span>Mobile with country code</span><input type="tel" pattern="\+[0-9][0-9\s()\-]{7,20}" value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} placeholder="+60 12 345 6789" /></label>
        <label><span>Invitation household</span><select value={form.householdId} onChange={(event) => setForm({ ...form, householdId: event.target.value })}><option value="">Create a new invitation just for them</option>{households.map((household) => {
          const members = (allGuests ?? []).filter((g) => g.household_id === household.id && g.id !== current?.id).map(displayName).join(" & ");
          return <option key={household.id} value={household.id}>{household.name}{members ? ` — with ${members}` : " — no one else"}</option>;
        })}</select></label>
        {!form.householdId ? <label className="wide"><span>Name this invitation</span><input value={form.householdName} onChange={(event) => setForm({ ...form, householdName: event.target.value })} /></label> : null}
      </div><p className="security-note"><span>◇</span><strong>Named invitation</strong> Only the people listed in this household can RSVP.</p></section>
      <section><h3>Invitation &amp; RSVP</h3><div className="modal-grid">
        <label><span>Guest category</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Family</option><option>Friends</option><option>Work</option><option>VIP</option></select></label>
        <label><span>Side</span><select value={form.side} onChange={(event) => setForm({ ...form, side: event.target.value })}><option>Bride</option><option>Groom</option><option>Shared</option></select></label>
        <label><span>RSVP status</span><select value={form.rsvpStatus} onChange={(event) => setForm({ ...form, rsvpStatus: event.target.value })}><option>Pending</option><option>Confirmed</option><option>Declined</option></select></label>
        <label><span>Meal selection</span><select value={form.mealSelection} onChange={(event) => setForm({ ...form, mealSelection: event.target.value })}><option value="">Not selected</option><option value="Lamb">Almond dukkha-crusted lamb</option><option value="Salmon">Seared Alaskan salmon</option></select></label>
      </div><div className="toggle-grid">{form.ageGroup === "Child" ? <Toggle label="Children's meal" value={form.childMeal} set={(value) => setForm({ ...form, childMeal: value })} /> : null}<Toggle label="Ceremony invited" value={form.ceremonyInvited} set={(value) => setForm({ ...form, ceremonyInvited: value })} /><Toggle label="Reception invited" value={form.receptionInvited} set={(value) => setForm({ ...form, receptionInvited: value })} /><Toggle label="After-party eligible" value={form.afterPartyEligible} set={(value) => setForm({ ...form, afterPartyEligible: value })} /><Toggle label="After-party invited" value={form.afterPartyInvited} set={(value) => setForm({ ...form, afterPartyInvited: value })} /><Toggle label="Travelling to Kuala Lumpur" value={form.transportRequired} set={(value) => setForm({ ...form, transportRequired: value })} /><Toggle label="Requested Grand Hyatt room" value={form.accommodationRequired} set={(value) => setForm({ ...form, accommodationRequired: value })} /></div></section>
      <section><h3>Travel &amp; accommodation</h3><div className="modal-grid">
        <label><span>Arrival date</span><input type="date" value={form.travelArrival} onChange={(event) => setForm({ ...form, travelArrival: event.target.value })} /></label>
        <label><span>Departure date</span><input type="date" value={form.travelDeparture} onChange={(event) => setForm({ ...form, travelDeparture: event.target.value })} /></label>
        <label className="wide"><span>Accommodation name</span><input value={form.accommodationName} onChange={(event) => setForm({ ...form, accommodationName: event.target.value })} /></label>
        <label><span>Bed preference</span><select value={form.bedPreference} onChange={(event) => setForm({ ...form, bedPreference: event.target.value })}><option value="">Not supplied</option><option>King</option><option>Twin</option></select></label>
        <label><span>Room nights</span><select value={form.roomNights} onChange={(event) => setForm({ ...form, roomNights: event.target.value })}><option value="">Not supplied</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>
      </div></section>
      <section><h3>Care notes &amp; messages</h3><div className="modal-grid"><label><span>Dietary requirements</span><textarea value={form.dietaryRequirements} onChange={(event) => setForm({ ...form, dietaryRequirements: event.target.value })} /></label><label><span>Allergies</span><textarea value={form.allergies} onChange={(event) => setForm({ ...form, allergies: event.target.value })} /></label><label className="wide"><span>Accessibility requirements</span><textarea value={form.accessibility} onChange={(event) => setForm({ ...form, accessibility: event.target.value })} /></label><label className="wide"><span>Guest-book message</span><textarea value={form.wishes} onChange={(event) => setForm({ ...form, wishes: event.target.value })} /></label><label className="wide"><span>Private note for Elaine &amp; Haykal</span><textarea value={form.marriageAdvice} onChange={(event) => setForm({ ...form, marriageAdvice: event.target.value })} /></label><label className="wide"><span>Internal notes · administrators only</span><textarea value={form.internalNotes} onChange={(event) => setForm({ ...form, internalNotes: event.target.value })} /></label></div></section>
    </div>
    <footer>{saveError ? <p className="form-error" role="alert">{saveError}</p> : null}{!isNew ? <div><button className="danger-link" type="button" onClick={() => {
        if (!window.confirm(`Archive ${displayName(current!)}? They will be hidden from your lists.`)) return;
        const id = current!.id;
        void act({ action: "archiveGuest", guestId: id }, "Guest archived").then((result) => {
          if (!result) return;
          setUndo?.({ label: `${displayName(current!)} archived`, restore: async () => { await act({ action: "restoreGuest", guestId: id }, "Guest restored"); } });
          close();
        });
      }}>Archive guest</button><button className="danger-link" type="button" onClick={() => { if (window.confirm(`Permanently delete ${displayName(current!)}? This cannot be undone.`)) void act({ action: "deleteGuest", guestId: current!.id }, "Guest deleted").then((result) => { if (result) close(); }); }}>Delete</button></div> : <span />}<div><button type="button" className="secondary-button" onClick={close}>Cancel</button><button type="submit" disabled={saving}>{saving ? (isNew ? "Adding…" : "Saving…") : (isNew ? "Add guest" : "Save guest")}</button></div></footer>
  </form></div>;
}

function Toggle({ label, value, set }: { label: string; value: boolean; set: (value: boolean) => void }) { return <label className="toggle-row"><span>{label}</span><button type="button" className={value ? "is-on" : ""} onClick={() => set(!value)} role="switch" aria-checked={value}><i /></button></label>; }

function NewTableModal({ close, act }: { close: () => void; act: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  const [name, setName] = useState(""); const [shape, setShape] = useState("round"); const [capacity, setCapacity] = useState(10);
  return <div className="modal-backdrop"><form className="small-modal" onSubmit={async (event) => { event.preventDefault(); const result = await act({ action: "createTable", name, shape, capacity, x: 50, y: 50 }, "Table created"); if (result) close(); }}><header><h2>Create a table</h2><button type="button" onClick={close} aria-label="Close">×</button></header><label><span>Table name</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Moonlight" /></label><label><span>Shape</span><select value={shape} onChange={(event) => setShape(event.target.value)}><option value="round">Round</option><option value="rectangular">Rectangular</option><option value="banquet">Long banquet</option></select></label><label><span>Capacity</span><input type="number" min="2" max="30" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></label><footer><button type="button" className="secondary-button" onClick={close}>Cancel</button><button type="submit">Create table</button></footer></form></div>;
}


/**
 * Runs the health check against the live database and reads back what it
 * found. It only reads — nothing here changes any guest's details.
 */
function HealthCheck({ authToken }: { authToken: string }) {
  const [result, setResult] = useState<{ ok: boolean; summary: string; counts?: Record<string, number>; checks: Array<{ name: string; ok: boolean; detail: string; affected?: string[] }> } | null>(null);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState("");

  const run = async () => {
    setRunning(true); setFailed("");
    try {
      const response = await fetch(`/api/manager/health?at=${Date.now()}`, { cache: "no-store", headers: { Authorization: `Bearer ${authToken}` } });
      const data = await readApiResponse<{ ok: boolean; summary: string; counts?: Record<string, number>; checks: Array<{ name: string; ok: boolean; detail: string; affected?: string[] }> }>(response);
      if (!response.ok) throw new Error(data.error || "The health check could not run.");
      setResult(data);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "The health check could not run.");
    } finally { setRunning(false); }
  };

  return <div className="manager-page">
    <div className="section-intro-row">
      <div>
        <p className="panel-kicker">Before you send</p>
        <h2>Health check</h2>
        <span>Checks against your real guest list, looking for the quiet faults that never show an error — a link that cannot open, a guest attached to nothing, a number WhatsApp cannot dial.</span>
      </div>
      <button className="primary" onClick={run} disabled={running}>{running ? "Checking…" : "Run the check"}</button>
    </div>
    {failed ? <section className="manager-panel"><p className="import-help">{failed}</p></section> : null}
    {result ? <section className="manager-panel">
      <h3 className={result.ok ? "health-pass" : "health-fail"}>{result.summary}</h3>
      {result.counts ? <p className="import-help">{result.counts.guests} guests · {result.counts.households} households · {result.counts.tables} tables</p> : null}
      <ul className="health-list">
        {result.checks.map((check) => <li key={check.name} className={check.ok ? "is-pass" : "is-fail"}>
          <span>{check.ok ? "✓" : "!"}</span>
          <div>
            <strong>{check.name}</strong>
            <p>{check.detail}</p>
            {check.affected && check.affected.length ? <p className="health-affected">{check.affected.join(" · ")}</p> : null}
          </div>
        </li>)}
      </ul>
    </section> : null}
  </div>;
}


/**
 * Everyone who has not replied yet, with a message ready to send them.
 * Households are shown rather than individual guests, because one invitation
 * covers everyone on it.
 */
function Chasing({ households, guests, settings, act, notify }: {
  households: Household[]; guests: Guest[]; settings: Settings;
  act: (payload: Record<string, unknown>, success: string) => Promise<unknown>;
  notify: (message: string) => void;
}) {
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const deadline = settings?.rsvp_deadline ? dateLabel(settings.rsvp_deadline) : "";

  const waiting = households
    .map((household) => ({
      household,
      members: guests.filter((guest) => Number(guest.household_id) === Number(household.id)),
    }))
    .filter(({ members }) => members.length > 0 && members.every((guest) => guest.rsvp_status === "Pending"));

  const partly = households
    .map((household) => ({
      household,
      members: guests.filter((guest) => Number(guest.household_id) === Number(household.id)),
    }))
    .filter(({ members }) => members.length > 1
      && members.some((guest) => guest.rsvp_status === "Pending")
      && members.some((guest) => guest.rsvp_status !== "Pending"));

  const card = (entry: { household: Household; members: Guest[] }, partial: boolean) => {
    const names = entry.members.map(displayName).join(" & ");
    const link = inviteLink(origin, entry.household.invitation_token, entry.household.name);
    const sent = entry.members.some((guest) => guest.invitation_sent_at);
    return (
      <article className="chase-card" key={entry.household.id}>
        <div>
          <strong>{entry.household.name}</strong>
          <p>{names}</p>
          <p className="chase-meta">
            {sent ? `Invitation sent ${dateLabel(entry.members.find((g) => g.invitation_sent_at)?.invitation_sent_at)}` : "Invitation not yet sent"}
            {partial ? " · some of them have replied" : ""}
          </p>
        </div>
        <div className="chase-actions">
          <button type="button" onClick={async () => { await navigator.clipboard.writeText(nudgeMessage(names, link, deadline)); notify("Nudge copied"); }}>Copy nudge</button>
          <a href={waLink(entry.household.mobile, nudgeMessage(names, link, deadline))} target="_blank" rel="noreferrer">WhatsApp</a>
        </div>
      </article>
    );
  };

  return <div className="manager-page">
    <div className="section-intro-row">
      <div>
        <p className="panel-kicker">Still to hear from</p>
        <h2>{waiting.length} awaiting a reply</h2>
        <span>{deadline ? `Replies close on ${deadline}. ` : ""}Each nudge is written for that household and carries their own link.</span>
      </div>
    </div>
    {waiting.length ? <section className="manager-panel"><h3>No reply at all</h3><div className="chase-list">{waiting.map((entry) => card(entry, false))}</div></section> : <section className="manager-panel"><p className="import-help">Everyone has replied. Nothing to chase.</p></section>}
    {(() => {
      const replied = guests
        .filter((guest) => guest.rsvp_submitted_at)
        .sort((a, b) => String(b.rsvp_submitted_at).localeCompare(String(a.rsvp_submitted_at)))
        .slice(0, 12);
      return replied.length ? <section className="manager-panel">
        <h3>Lately replied</h3>
        <ol className="reply-timeline">{replied.map((guest) => <li key={guest.id}>
          <span>{displayName(guest)}<small>{guest.household_name}</small></span>
          <em className={guest.rsvp_status === "Confirmed" ? "is-yes" : "is-no"}>{guest.rsvp_status === "Confirmed" ? "Coming" : "Cannot"}</em>
          <time>{dateLabel(guest.rsvp_submitted_at)}</time>
        </li>)}</ol>
      </section> : null;
    })()}
    {partly.length ? <section className="manager-panel"><h3>Partly replied · {partly.length}</h3><p className="import-help">Someone on the invitation has answered and someone has not.</p><div className="chase-list">{partly.map((entry) => card(entry, true))}</div></section> : null}
  </div>;
}


/**
 * The three things needed in the last fortnight: what the kitchen must know,
 * cards for the tables, and a headcount for the hotel. All printable.
 */
function ForTheDay({ guests, tables }: { guests: Guest[]; tables: SeatingTable[] }) {
  const coming = guests.filter((guest) => guest.rsvp_status === "Confirmed");
  const withNeeds = coming.filter((guest) => guest.dietary_requirements || guest.allergies);
  const meals = coming.reduce<Record<string, number>>((tally, guest) => {
    const meal = guest.meal_selection || "Not chosen";
    tally[meal] = (tally[meal] ?? 0) + 1;
    return tally;
  }, {});

  const printPart = (part: string) => {
    document.body.dataset.printing = part;
    window.print();
    window.setTimeout(() => { delete document.body.dataset.printing; }, 500);
  };

  return <div className="manager-page dayof-page">
    <div className="section-intro-row">
      <div>
        <p className="panel-kicker">The last fortnight</p>
        <h2>For the day</h2>
        <span>{coming.length} coming · {withNeeds.length} with something the kitchen must know · {tables.length} tables</span>
      </div>
    </div>

    <section className="manager-panel" id="print-headcount">
      <header className="dayof-head"><h3>Headcount for the Grand Hyatt</h3><button type="button" onClick={() => printPart("headcount")}>Print</button></header>
      <ul className="tally">
        <li><strong>{coming.length}</strong><span>attending</span></li>
        {Object.entries(meals).map(([meal, count]) => <li key={meal}><strong>{count}</strong><span>{meal}</span></li>)}
        <li><strong>{withNeeds.length}</strong><span>dietary notes</span></li>
      </ul>
    </section>

    <section className="manager-panel" id="print-dietary">
      <header className="dayof-head"><h3>Dietary requirements &amp; allergies</h3><button type="button" onClick={() => printPart("dietary")}>Print for the kitchen</button></header>
      {withNeeds.length ? <div className="table-scroll"><table className="guest-table">
        <thead><tr><th>Guest</th><th>Table</th><th>Main course</th><th>Requirement</th><th>Allergies</th></tr></thead>
        <tbody>{withNeeds.map((guest) => <tr key={guest.id}>
          <td><strong>{displayName(guest)}</strong></td>
          <td>{guest.table_name || "—"}</td>
          <td>{guest.meal_selection || "—"}</td>
          <td>{guest.dietary_requirements || "—"}</td>
          <td>{guest.allergies || "—"}</td>
        </tr>)}</tbody>
      </table></div> : <p className="import-help">No dietary requirements yet.</p>}
    </section>

    <section className="manager-panel" id="print-cards">
      <header className="dayof-head"><h3>Place cards</h3><button type="button" onClick={() => printPart("cards")}>Print place cards</button></header>
      {coming.some((guest) => guest.table_id) ? <div className="place-cards">
        {coming.filter((guest) => guest.table_id).map((guest) => <article key={guest.id}>
          <p className="place-name">{displayName(guest)}</p>
          <p className="place-table">{guest.table_name}</p>
          <p className="place-venue">The Grand Salon</p>
        </article>)}
      </div> : <p className="import-help">Seat your guests first, under Seating.</p>}
    </section>
  </div>;
}
