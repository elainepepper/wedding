"use client";

import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Guest = {
  id: number; household_id: number | null; first_name: string; last_name: string; preferred_name: string | null;
  email: string | null; mobile: string | null; category: string; side: string; age_group: string;
  relationship: string | null;
  rsvp_status: string; ceremony_invited: number; ceremony_attending: number | null; reception_invited: number;
  reception_attending: number | null; after_party_eligible: number; after_party_invited: number;
  after_party_attending: string; meal_selection: string | null; dietary_requirements: string | null;
  allergies: string | null; child_meal: number; accessibility: string | null; transport_required: number;
  accommodation_required: number; table_id: number | null; seat_number: number | null; invitation_sent: number;
  invitation_sent_at: string | null; rsvp_submitted_at: string | null; internal_notes: string | null;
  household_name: string | null; invitation_slug: string | null; invitation_token: string | null;
  invitation_enabled: number; opened_at: string | null; last_activity_at: string | null; table_name: string | null;
  updated_at: string;
};

type Household = {
  id: number; name: string; email: string | null; mobile: string | null; max_guests: number; invitation_slug: string;
  invitation_token: string; invitation_enabled: number; opened_at: string | null; last_activity_at: string | null;
  guest_count: number; confirmed_count: number; declined_count: number; notes: string | null;
};

type SeatingTable = { id: number; name: string; shape: string; capacity: number; x: number; y: number; locked: number; notes: string | null; guest_count: number };
type Activity = { id: number; admin_name: string; action: string; detail: string; created_at: string };
type ManagerUser = { id: number; email: string; name: string; role: "owner" | "partner" | "planner"; active: number; created_at: string };
type Settings = Record<string, string | null> & { wedding_name: string; couple_names: string; wedding_date: string; rsvp_deadline: string; timezone: string };
type ManagerData = { guests: Guest[]; households: Household[]; tables: SeatingTable[]; activities: Activity[]; events: Array<Record<string, unknown>>; settings: Settings; managers: ManagerUser[]; admin: { displayName: string; email: string; role: "owner" | "partner" | "planner" } };
type Tab = "overview" | "guests" | "households" | "rsvps" | "seating" | "afterparty" | "imports" | "exports" | "settings";

const tabs: Array<{ id: Tab; label: string; glyph: string }> = [
  { id: "overview", label: "Overview", glyph: "◫" }, { id: "guests", label: "Guests", glyph: "♙" },
  { id: "households", label: "Households", glyph: "⌂" }, { id: "rsvps", label: "RSVPs", glyph: "✓" },
  { id: "seating", label: "Seating plan", glyph: "○" }, { id: "afterparty", label: "After-party", glyph: "✦" },
  { id: "imports", label: "Imports", glyph: "↓" }, { id: "exports", label: "Exports", glyph: "↑" },
  { id: "settings", label: "Settings", glyph: "◇" },
];

const displayName = (guest: Guest) => guest.preferred_name || `${guest.first_name} ${guest.last_name}`.trim();
const dateLabel = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Perth" }).format(new Date(`${value.replace(" ", "T")}Z`)) : "—";

function downloadFile(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function csvValue(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function Status({ value }: { value: string }) {
  return <span className={`status status--${value.toLowerCase().replaceAll(" ", "-")}`}><i />{value}</span>;
}

export function ManagerApp({ initialAdminName, authToken, onSignOut }: { initialAdminName: string; authToken: string; onSignOut: () => void | Promise<void> }) {
  const [data, setData] = useState<ManagerData | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [groupFilter, setGroupFilter] = useState("All");
  const [selected, setSelected] = useState<number[]>([]);
  const [guestModal, setGuestModal] = useState<Guest | "new" | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const toastTimer = useRef<number | null>(null);

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/manager", { cache: "no-store", headers: { Authorization: `Bearer ${authToken}` } });
      const result = await response.json() as ManagerData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load the guest manager.");
      setData(result);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the guest manager.");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 3200);
  };

  const act = async (payload: Record<string, unknown>, success: string) => {
    const response = await fetch("/api/manager", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: JSON.stringify(payload) });
    const result = await response.json() as { error?: string; summary?: { added: number; updated: number; skipped: number; errors: string[] } };
    if (!response.ok) throw new Error(result.error || "The change could not be saved.");
    await load(true);
    notify(result.summary ? `${result.summary.added} added · ${result.summary.updated} updated · ${result.summary.skipped} skipped` : success);
    return result;
  };

  const stats = useMemo(() => {
    const guests = data?.guests ?? [];
    const confirmed = guests.filter((g) => g.rsvp_status === "Confirmed");
    return {
      total: guests.length, households: data?.households.length ?? 0, confirmed: confirmed.length,
      declined: guests.filter((g) => g.rsvp_status === "Declined").length,
      pending: guests.filter((g) => g.rsvp_status === "Pending").length,
      adults: guests.length,
      dietary: guests.filter((g) => g.dietary_requirements || g.allergies).length,
      afterParty: guests.filter((g) => g.after_party_attending === "Yes").length,
      transport: guests.filter((g) => g.transport_required).length,
      accommodation: guests.filter((g) => g.accommodation_required).length,
      tables: data?.tables.length ?? 0,
      unassigned: confirmed.filter((g) => !g.table_id).length,
      meals: confirmed.filter((g) => g.meal_selection).length,
    };
  }, [data]);

  const filteredGuests = useMemo(() => {
    const query = search.toLowerCase();
    return (data?.guests ?? []).filter((guest) => {
      const matchesSearch = !query || [displayName(guest), guest.mobile, guest.household_name].some((value) => value?.toLowerCase().includes(query));
      const matchesStatus = statusFilter === "All" || guest.rsvp_status === statusFilter;
      const matchesGroup = groupFilter === "All" || guest.category === groupFilter || guest.side === groupFilter || (groupFilter === "After-party" && !!guest.after_party_invited);
      return matchesSearch && matchesStatus && matchesGroup;
    });
  }, [data, search, statusFilter, groupFilter]);

  const jumpToGuests = (filter: string) => {
    setTab("guests");
    if (["Confirmed", "Declined", "Pending"].includes(filter)) setStatusFilter(filter); else setGroupFilter(filter);
  };

  if (loading) return <ManagerLoading />;
  if (error || !data) return <div className="manager-fatal"><span>✦</span><h1>We couldn’t open the guest book.</h1><p>{error}</p><button onClick={() => load()}>Try again</button></div>;

  return (
    <div className="manager-shell">
      <a className="skip-link" href="#manager-main">Skip to manager content</a>
      <aside className={`manager-sidebar${mobileNav ? " is-open" : ""}`}>
        <div className="manager-brand"><span>E <i>&amp;</i> H</span><small>Guest Manager</small></div>
        <nav aria-label="Guest manager">
          {tabs.map((item) => <button key={item.id} className={tab === item.id ? "is-active" : ""} onClick={() => { setTab(item.id); setMobileNav(false); }}><b>{item.glyph}</b><span>{item.label}</span>{item.id === "rsvps" && stats.pending ? <em>{stats.pending}</em> : null}</button>)}
        </nav>
        <div className="manager-profile"><div>{initialAdminName.slice(0, 1).toUpperCase()}</div><p><strong>{initialAdminName}</strong><span>Administrator</span></p><a href="/">View invitation ↗</a><button type="button" onClick={() => void onSignOut()}>Sign out</button></div>
      </aside>

      <main id="manager-main" className="manager-main">
        <header className="manager-topbar">
          <button className="mobile-menu" onClick={() => setMobileNav((value) => !value)} aria-label="Open navigation">☰</button>
          <div><p className="manager-kicker">Elaine &amp; Haykal · 7 November 2026</p><h1>{tabs.find((item) => item.id === tab)?.label}</h1></div>
          <div className="topbar-actions"><span><i /> All changes saved</span><button onClick={() => setGuestModal("new")}>＋ Add guest</button></div>
        </header>

        {tab === "overview" ? <Overview data={data} stats={stats} jump={jumpToGuests} setTab={setTab} /> : null}
        {tab === "guests" || tab === "rsvps" ? (
          <GuestList
            guests={filteredGuests} tables={data.tables} selected={selected} setSelected={setSelected}
            search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            groupFilter={groupFilter} setGroupFilter={setGroupFilter} edit={setGuestModal} act={act} rsvpMode={tab === "rsvps"}
          />
        ) : null}
        {tab === "households" ? <Households households={data.households} guests={data.guests} act={act} notify={notify} /> : null}
        {tab === "seating" ? <SeatingPlan guests={data.guests} tables={data.tables} act={act} /> : null}
        {tab === "afterparty" ? <AfterParty guests={data.guests} selected={selected} setSelected={setSelected} act={act} /> : null}
        {tab === "imports" ? <Imports act={act} /> : null}
        {tab === "exports" ? <Exports guests={data.guests} tables={data.tables} /> : null}
        {tab === "settings" ? <SettingsPanel settings={data.settings} managers={data.managers} adminRole={data.admin.role} activities={data.activities} act={act} /> : null}
      </main>

      {guestModal ? <GuestModal guest={guestModal} households={data.households} close={() => setGuestModal(null)} act={act} /> : null}
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
  return <div className="manager-page overview-page">
    <section className="welcome-strip"><div><p>Good evening</p><h2>Your celebration is taking shape.</h2><span>{stats.confirmed} of {stats.total} guests are confirmed · {stats.meals} meals selected</span></div><div className="countdown"><strong>98</strong><span>days to go</span></div></section>
    <section className="stat-grid">{cards.map(([label, value, note, filter]) => <button key={String(label)} onClick={() => jump(String(filter))}><span>{label}</span><strong>{value}</strong><small>{note}</small><i>↗</i></button>)}</section>
    <div className="overview-grid">
      <section className="manager-panel response-panel"><div className="panel-head"><div><p className="panel-kicker">Response pulse</p><h3>RSVP progress</h3></div><button onClick={() => setTab("rsvps")}>View RSVPs</button></div>
        <div className="response-ring" style={{ "--confirmed": `${stats.total ? (stats.confirmed / stats.total) * 100 : 0}%` } as React.CSSProperties}><div><strong>{Math.round(stats.total ? (stats.confirmed / stats.total) * 100 : 0)}%</strong><span>responded yes</span></div></div>
        <div className="legend"><p><i className="confirmed" />Confirmed <b>{stats.confirmed}</b></p><p><i className="pending" />Pending <b>{stats.pending}</b></p><p><i className="declined" />Declined <b>{stats.declined}</b></p></div>
      </section>
      <section className="manager-panel activity-panel"><div className="panel-head"><div><p className="panel-kicker">Latest notes</p><h3>Recent activity</h3></div></div><div className="activity-list">{data.activities.slice(0, 5).map((activity) => <div key={activity.id}><i>✦</i><p><strong>{activity.action}</strong><span>{activity.detail}</span></p><time>{dateLabel(activity.created_at)}</time></div>)}</div></section>
    </div>
  </div>;
}

function GuestList({ guests, tables, selected, setSelected, search, setSearch, statusFilter, setStatusFilter, groupFilter, setGroupFilter, edit, act, rsvpMode }: {
  guests: Guest[]; tables: SeatingTable[]; selected: number[]; setSelected: (ids: number[]) => void; search: string; setSearch: (value: string) => void;
  statusFilter: string; setStatusFilter: (value: string) => void; groupFilter: string; setGroupFilter: (value: string) => void;
  edit: (guest: Guest | "new") => void; act: (payload: Record<string, unknown>, success: string) => Promise<unknown>; rsvpMode: boolean;
}) {
  const allSelected = guests.length > 0 && guests.every((guest) => selected.includes(guest.id));
  return <div className="manager-page">
    {rsvpMode ? <section className="rsvp-banner"><div><span>Latest reply</span><h2>{guests.find((g) => g.rsvp_submitted_at)?.household_name ?? "The guest list"}</h2><p>Updated {dateLabel(guests.find((g) => g.rsvp_submitted_at)?.rsvp_submitted_at)}</p></div><strong>{guests.filter((g) => g.rsvp_status === "Confirmed").length}<small> attending</small></strong></section> : null}
    <section className="manager-panel guest-table-panel">
      <div className="table-toolbar"><label className="search-field"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone or household" /></label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by RSVP status"><option>All</option><option>Confirmed</option><option>Pending</option><option>Declined</option></select>
        <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} aria-label="Filter by guest group"><option>All</option><option>Bride</option><option>Groom</option><option>Shared</option><option>Family</option><option>Friends</option><option>Work</option><option>VIP</option><option>After-party</option></select>
      </div>
      {selected.length ? <div className="bulk-bar"><strong>{selected.length} selected</strong><button onClick={() => act({ action: "bulkUpdate", guestIds: selected, field: "rsvpStatus", value: "Confirmed" }, "Guests confirmed")}>Confirm</button><button onClick={() => act({ action: "bulkUpdate", guestIds: selected, field: "afterPartyInvited", value: true }, "After-party access enabled")}>Invite after-party</button><select defaultValue="" onChange={(event) => { if (event.target.value) void act({ action: "bulkUpdate", guestIds: selected, field: "tableId", value: Number(event.target.value) }, "Table assignments saved"); }}><option value="">Assign table…</option>{tables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}</select><button className="textual" onClick={() => setSelected([])}>Clear</button></div> : null}
      <div className="table-scroll"><table className="guest-table"><thead><tr><th><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : guests.map((guest) => guest.id))} aria-label="Select all visible guests" /></th><th>Guest</th><th>Household</th><th>Group</th><th>RSVP</th><th>Meal &amp; dietary</th><th>Table</th><th>Invitation</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
        {guests.map((guest) => <tr key={guest.id}><td><input type="checkbox" checked={selected.includes(guest.id)} onChange={() => setSelected(selected.includes(guest.id) ? selected.filter((id) => id !== guest.id) : [...selected, guest.id])} aria-label={`Select ${displayName(guest)}`} /></td><td><button className="guest-identity" onClick={() => edit(guest)}><span>{guest.preferred_name?.slice(0, 1) || guest.first_name.slice(0, 1)}{guest.last_name.slice(0, 1)}</span><p><strong>{displayName(guest)}</strong><small>{guest.email || guest.mobile || "No contact details"}</small></p></button></td><td>{guest.household_name ?? "—"}</td><td><span className="group-chip">{guest.side}</span><small className="muted-cell">{guest.category}</small></td><td><Status value={guest.rsvp_status} />{guest.rsvp_submitted_at ? <small className="muted-cell">{dateLabel(guest.rsvp_submitted_at)}</small> : null}</td><td><span>{guest.meal_selection || "Not selected"}</span>{guest.dietary_requirements || guest.allergies ? <small className="diet-note">◈ {guest.dietary_requirements || guest.allergies}</small> : null}</td><td>{guest.table_name ? <><span>{guest.table_name}</span><small className="muted-cell">Seat {guest.seat_number || "—"}</small></> : <span className="unassigned">Unassigned</span>}</td><td>{guest.invitation_sent ? <span className="sent-label">✓ Sent</span> : <span className="not-sent">Not sent</span>}{guest.opened_at ? <small className="muted-cell">Opened {dateLabel(guest.opened_at)}</small> : null}</td><td><button className="row-action" onClick={() => edit(guest)} aria-label={`Edit ${displayName(guest)}`}>•••</button></td></tr>)}
      </tbody></table>{!guests.length ? <div className="empty-state"><span>♡</span><h3>No guests found</h3><p>Try another search or filter.</p></div> : null}</div>
      <footer className="table-footer"><span>{guests.length} guests shown</span><span>Updates use Australia/Perth time</span></footer>
    </section>
  </div>;
}

function Households({ households, guests, act, notify }: { households: Household[]; guests: Guest[]; act: (payload: Record<string, unknown>, success: string) => Promise<unknown>; notify: (message: string) => void }) {
  const copyLink = async (household: Household, afterParty = false) => {
    const path = afterParty ? `/after-party?token=${household.invitation_token}` : `/invite/${household.invitation_token}`;
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    notify(afterParty ? "Private after-party link copied" : "Invitation link copied");
  };
  return <div className="manager-page"><div className="section-intro-row"><div><p className="panel-kicker">Shared invitations</p><h2>{households.length} households</h2><span>Couples, families and friends can reply together.</span></div></div><section className="household-grid">{households.map((household) => {
    const members = guests.filter((guest) => guest.household_id === household.id);
    const afterParty = members.some((guest) => guest.after_party_invited);
    return <article className="household-card" key={household.id}><header><div><span>{household.name.slice(0, 1)}</span><div><h3>{household.name}</h3><p>{household.guest_count} of {household.max_guests} guests</p></div></div><Status value={household.confirmed_count === household.guest_count ? "Confirmed" : household.declined_count === household.guest_count ? "Declined" : "Pending"} /></header><div className="member-stack">{members.map((guest) => <p key={guest.id}><i>{displayName(guest).slice(0, 1)}</i><span>{displayName(guest)}<small>{guest.age_group} · {guest.relationship || guest.category}</small></span><Status value={guest.rsvp_status} /></p>)}</div><dl><div><dt>Primary contact</dt><dd>{household.email || household.mobile || "Not supplied"}</dd></div><div><dt>Invitation</dt><dd>{household.opened_at ? `Opened ${dateLabel(household.opened_at)}` : "Not yet opened"}</dd></div></dl><footer><button onClick={() => copyLink(household)}>Copy invitation</button>{afterParty ? <button onClick={() => copyLink(household, true)}>Copy after-party</button> : null}<button className="icon-button" onClick={() => act({ action: "regenerateLink", householdId: household.id }, "A new secure link was created")} title="Regenerate secure link">↻</button><button className="icon-button" onClick={() => act({ action: "markInvitationSent", householdId: household.id }, "Invitation marked as sent")} title="Mark invitation sent">✓</button></footer></article>;
  })}</section></div>;
}

function SeatingPlan({ guests, tables, act }: { guests: Guest[]; tables: SeatingTable[]; act: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  const [newTable, setNewTable] = useState(false);
  const confirmed = guests.filter((guest) => guest.rsvp_status === "Confirmed");
  const unassigned = confirmed.filter((guest) => !guest.table_id);
  const drop = (event: DragEvent, tableId: number | null) => { event.preventDefault(); const guestId = Number(event.dataTransfer.getData("text/guest-id")); if (guestId) void act({ action: "moveGuest", guestId, tableId }, tableId ? "Guest assigned to table" : "Guest returned to unassigned"); };
  return <div className="manager-page seating-page"><div className="section-intro-row"><div><p className="panel-kicker">Visual floor plan</p><h2>{tables.length} tables · {unassigned.length} unassigned</h2><span>Drag confirmed guests between the panel and tables.</span></div><button onClick={() => setNewTable(true)}>＋ Create table</button></div><div className="seating-layout"><aside className="unassigned-panel" onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, null)}><header><h3>Unassigned guests</h3><span>{unassigned.length}</span></header><label><span>⌕</span><input placeholder="Search unassigned" /></label><div>{unassigned.map((guest) => <GuestPill key={guest.id} guest={guest} />)}{!unassigned.length ? <p className="mini-empty">Every confirmed guest has a table. Beautiful.</p> : null}</div></aside><section className="floor-plan"><div className="floor-label"><span>Grand Hyatt · Ballroom</span><small>Stage</small></div>{tables.map((table) => {
    const seated = confirmed.filter((guest) => guest.table_id === table.id);
    return <article key={table.id} className={`floor-table floor-table--${table.shape}${seated.length >= table.capacity ? " is-full" : ""}`} style={{ left: `${table.x}%`, top: `${table.y}%` }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, table.id)}><div className="table-object"><span>{table.name}</span><strong>{seated.length}/{table.capacity}</strong></div><div className="table-guests">{seated.map((guest) => <GuestPill key={guest.id} guest={guest} compact />)}</div>{seated.length > table.capacity ? <em>Capacity exceeded</em> : null}</article>;
  })}</section></div>{newTable ? <NewTableModal close={() => setNewTable(false)} act={act} /> : null}</div>;
}

function GuestPill({ guest, compact = false }: { guest: Guest; compact?: boolean }) {
  return <div className={`guest-pill${compact ? " is-compact" : ""}`} draggable onDragStart={(event) => { event.dataTransfer.setData("text/guest-id", String(guest.id)); event.dataTransfer.effectAllowed = "move"; }}><i>{displayName(guest).slice(0, 1)}</i><span>{displayName(guest)}{!compact ? <small>{guest.household_name}</small> : null}</span>{guest.dietary_requirements || guest.allergies ? <b title="Dietary note">◈</b> : null}</div>;
}

function AfterParty({ guests, selected, setSelected, act }: { guests: Guest[]; selected: number[]; setSelected: (ids: number[]) => void; act: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  const eligible = guests.filter((guest) => guest.after_party_eligible);
  return <div className="manager-page afterparty-manager"><section className="night-banner"><span>✦</span><div><p>Secret chapter</p><h2>After the last toast</h2><small>Only selected guests receive access. Everyone else sees nothing.</small></div><strong>{eligible.filter((g) => g.after_party_invited).length}<small> invited</small></strong></section><div className="afterparty-stats"><p><span>Invited</span><strong>{eligible.filter((g) => g.after_party_invited).length}</strong></p><p><span>Attending</span><strong>{eligible.filter((g) => g.after_party_attending === "Yes").length}</strong></p><p><span>Pending</span><strong>{eligible.filter((g) => g.after_party_attending === "Pending").length}</strong></p></div><section className="manager-panel"><div className="table-toolbar"><label className="search-field"><span>⌕</span><input placeholder="Search eligible guests" /></label>{selected.length ? <button onClick={() => act({ action: "bulkUpdate", guestIds: selected, field: "afterPartyInvited", value: true }, "Private access enabled")}>Invite {selected.length} guests</button> : null}</div><div className="afterparty-list">{eligible.map((guest) => <label key={guest.id}><input type="checkbox" checked={selected.includes(guest.id)} onChange={() => setSelected(selected.includes(guest.id) ? selected.filter((id) => id !== guest.id) : [...selected, guest.id])} /><i>{displayName(guest).slice(0, 1)}</i><span><strong>{displayName(guest)}</strong><small>{guest.household_name} · {guest.category}</small></span><Status value={guest.after_party_attending} /><button type="button" className={guest.after_party_invited ? "is-on" : ""} onClick={() => act({ action: "bulkUpdate", guestIds: [guest.id], field: "afterPartyInvited", value: !guest.after_party_invited }, guest.after_party_invited ? "After-party invitation removed" : "After-party invitation enabled")} aria-label={`Toggle after-party invitation for ${displayName(guest)}`}><span /></button></label>)}</div></section></div>;
}

function Imports({ act }: { act: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [fileName, setFileName] = useState("");
  const [duplicateMode, setDuplicateMode] = useState("skip");
  const parse = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result).replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
      const headers = (lines.shift() || "").split(",").map((header) => header.trim().toLowerCase());
      const keyMap: Record<string, string> = {
        "first name": "firstName", "last name": "lastName", "preferred name": "preferredName",
        household: "household", mobile: "mobile", "guest category": "category",
        "bride or groom side": "side", "rsvp status": "rsvpStatus", "ceremony invited": "ceremonyInvited",
        "reception invited": "receptionInvited", "after-party invited": "afterPartyInvited",
        "dietary requirements": "dietaryRequirements", allergies: "allergies", notes: "notes",
      };
      setRows(lines.slice(0, 2000).map((line) => {
        const values = line.match(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g)?.map((cell) => cell.replace(/,$/, "").replace(/^"|"$/g, "").replaceAll('""', '"')) ?? [];
        const row: Record<string, unknown> = {};
        headers.forEach((header, index) => { const key = keyMap[header]; if (key) row[key] = values[index] ?? ""; });
        return row;
      }));
      setFileName(file.name);
    };
    reader.readAsText(file);
  };
  const template = "First Name,Last Name,Preferred Name,Household,Mobile,Guest Category,Bride or Groom Side,RSVP Status,Ceremony Invited,Reception Invited,After-Party Invited,Dietary Requirements,Allergies,Table,Notes\n";
  return <div className="manager-page imports-page"><div className="section-intro-row"><div><p className="panel-kicker">Bring your list</p><h2>Import adult guests</h2><span>Use a CSV exported from Google Sheets. A mobile number with country code is required for every guest.</span></div><button className="secondary-button" onClick={() => downloadFile("elaine-haykal-guest-template.csv", template)}>Download template</button></div><section className="manager-panel import-panel"><label className="drop-zone"><input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) parse(file); }} /><span>↓</span><h3>{fileName || "Drop your guest list here"}</h3><p>CSV exported from Google Sheets · up to 2,000 rows</p><button type="button">Choose CSV file</button></label>{rows.length ? <div className="import-preview"><header><div><h3>Preview {rows.length} rows</h3><p>Review names, households and required mobile numbers.</p></div><select value={duplicateMode} onChange={(event) => setDuplicateMode(event.target.value)}><option value="skip">Skip duplicates</option><option value="update">Update duplicates</option></select></header><div className="table-scroll"><table><thead><tr><th>First name</th><th>Last name</th><th>Household</th><th>Mobile</th><th>Group</th><th>Status</th></tr></thead><tbody>{rows.slice(0, 8).map((row, index) => <tr key={index}><td>{String(row.firstName || "Missing")}</td><td>{String(row.lastName || "")}</td><td>{String(row.household || "")}</td><td>{String(row.mobile || "Required")}</td><td>{String(row.category || "Friends")}</td><td>{String(row.rsvpStatus || "Pending")}</td></tr>)}</tbody></table></div><footer><span>{rows.length > 8 ? `Showing first 8 of ${rows.length} rows` : `${rows.length} rows ready`}</span><button onClick={() => act({ action: "importGuests", rows, duplicateMode }, "Guest list imported")}>Confirm import</button></footer></div> : null}</section><section className="import-help"><article><span>01</span><h3>Export from Sheets</h3><p>File → Download → Comma-separated values.</p></article><article><span>02</span><h3>Check phone numbers</h3><p>Use international format, such as +60, +61 or +65.</p></article><article><span>03</span><h3>Check duplicates</h3><p>Skip or update matching mobile and name records.</p></article></section></div>;
}

function Exports({ guests, tables }: { guests: Guest[]; tables: SeatingTable[] }) {
  const [filter, setFilter] = useState("Confirmed");
  const exportRows = guests.filter((guest) => filter === "All" || guest.rsvp_status === filter);
  const exportCsv = (preset: "venue" | "chef" | "afterparty" | "complete") => {
    const maps = {
      venue: [["Guest", (g: Guest) => displayName(g)], ["Household", (g: Guest) => g.household_name], ["RSVP", (g: Guest) => g.rsvp_status], ["Ceremony", (g: Guest) => g.ceremony_attending], ["Reception", (g: Guest) => g.reception_attending], ["Table", (g: Guest) => g.table_name], ["Seat", (g: Guest) => g.seat_number], ["Accessibility", (g: Guest) => g.accessibility], ["Transport", (g: Guest) => g.transport_required ? "Yes" : "No"]],
      chef: [["Guest", (g: Guest) => displayName(g)], ["Table", (g: Guest) => g.table_name], ["Meal", (g: Guest) => g.meal_selection], ["Dietary", (g: Guest) => g.dietary_requirements], ["Allergies", (g: Guest) => g.allergies]],
      afterparty: [["Guest", (g: Guest) => displayName(g)], ["Household", (g: Guest) => g.household_name], ["Invited", (g: Guest) => g.after_party_invited ? "Yes" : "No"], ["RSVP", (g: Guest) => g.after_party_attending], ["Table", (g: Guest) => g.table_name], ["Mobile", (g: Guest) => g.mobile]],
      complete: [["ID", (g: Guest) => g.id], ["Guest", (g: Guest) => displayName(g)], ["Household", (g: Guest) => g.household_name], ["Mobile", (g: Guest) => g.mobile], ["Category", (g: Guest) => g.category], ["Side", (g: Guest) => g.side], ["RSVP", (g: Guest) => g.rsvp_status], ["Meal", (g: Guest) => g.meal_selection], ["Dietary", (g: Guest) => g.dietary_requirements], ["Allergies", (g: Guest) => g.allergies], ["Table", (g: Guest) => g.table_name], ["Seat", (g: Guest) => g.seat_number], ["Internal notes", (g: Guest) => g.internal_notes]],
    } as const;
    const columns = maps[preset]; const content = [`Report,${csvValue(`${preset[0].toUpperCase()}${preset.slice(1)} export`)}`, `Export date,${csvValue(new Date().toLocaleString("en-AU", { timeZone: "Australia/Perth" }))}`, `Wedding,${csvValue("Elaine & Haykal")}`, `Applied filter,${csvValue(filter)}`, "", columns.map(([label]) => csvValue(label)).join(","), ...exportRows.filter((g) => preset !== "afterparty" || g.after_party_invited).map((guest) => columns.map(([, getter]) => csvValue(getter(guest) as unknown)).join(","))].join("\r\n");
    downloadFile(`elaine-haykal-${preset}-${new Date().toISOString().slice(0, 10)}.csv`, content);
  };
  const presets = [{ id: "venue", title: "Venue pack", note: "Attendance, seating, access and transport", glyph: "⌂" }, { id: "chef", title: "Chef & catering", note: "Meals, dietary needs and allergies", glyph: "◇" }, { id: "afterparty", title: "After-party list", note: "Private invitations and late-night RSVPs", glyph: "✦" }, { id: "complete", title: "Complete guest archive", note: "All administrator guest fields", glyph: "▦" }] as const;
  return <div className="manager-page"><div className="section-intro-row"><div><p className="panel-kicker">Reports</p><h2>Export centre</h2><span>Purpose-built files with private fields excluded where appropriate.</span></div><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option><option>Confirmed</option><option>Pending</option><option>Declined</option></select></div><section className="export-grid">{presets.map((preset) => <article key={preset.id}><span>{preset.glyph}</span><h3>{preset.title}</h3><p>{preset.note}</p><dl><div><dt>Guests</dt><dd>{preset.id === "afterparty" ? exportRows.filter((g) => g.after_party_invited).length : exportRows.length}</dd></div>{preset.id === "venue" ? <div><dt>Tables</dt><dd>{tables.length}</dd></div> : null}</dl><button onClick={() => exportCsv(preset.id)}>Download CSV <i>↓</i></button></article>)}</section></div>;
}

function SettingsPanel({ settings, managers, adminRole, activities, act }: {
  settings: Settings;
  managers: ManagerUser[];
  adminRole: "owner" | "partner" | "planner";
  activities: Activity[];
  act: (payload: Record<string, unknown>, success: string) => Promise<unknown>;
}) {
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
      </div>
      <p className="security-note"><span>◇</span><strong>Music is consent-based</strong> Add an MP3 delivery URL here. Guests choose whether to play it; audio never autoplays.</p>
    </form>
    <section className="manager-panel access-panel">
      <div className="panel-head"><div><p className="panel-kicker">Trusted team</p><h3>Guest manager access</h3></div></div>
      <p className="access-copy">Give your partner or wedding planner their own sign-in. Each person uses their own account and actions are recorded.</p>
      {adminRole === "owner" ? <form className="access-form" onSubmit={(event) => {
        event.preventDefault();
        void act({ action: "addManager", ...managerForm }, "Manager access granted").then(() => setManagerForm({ name: "", email: "", role: "partner" }));
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

function GuestModal({ guest, households, close, act }: { guest: Guest | "new"; households: Household[]; close: () => void; act: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  const isNew = guest === "new";
  const current = isNew ? null : guest;
  const [form, setForm] = useState({ firstName: current?.first_name || "", lastName: current?.last_name || "", preferredName: current?.preferred_name || "", mobile: current?.mobile || "+60 ", householdId: current?.household_id || "", householdName: "", category: current?.category || "Friends", side: current?.side || "Shared", rsvpStatus: current?.rsvp_status || "Pending", mealSelection: current?.meal_selection || "", dietaryRequirements: current?.dietary_requirements || "", allergies: current?.allergies || "", accessibility: current?.accessibility || "", internalNotes: current?.internal_notes || "", ceremonyInvited: current ? !!current.ceremony_invited : true, receptionInvited: current ? !!current.reception_invited : true, afterPartyEligible: current ? !!current.after_party_eligible : false, afterPartyInvited: current ? !!current.after_party_invited : false, transportRequired: current ? !!current.transport_required : false, accommodationRequired: current ? !!current.accommodation_required : false });
  const submit = async (event: FormEvent) => { event.preventDefault(); await act({ action: isNew ? "addGuest" : "editGuest", guestId: current?.id, ...form, householdId: form.householdId ? Number(form.householdId) : null }, isNew ? "Guest added" : "Guest updated"); close(); };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><form className="guest-modal" onSubmit={submit}>
    <header><div><p className="panel-kicker">{isNew ? "New invitation" : current?.household_name}</p><h2>{isNew ? "Add an adult guest" : displayName(current!)}</h2></div><button type="button" onClick={close} aria-label="Close">×</button></header>
    <div className="modal-body">
      <section><h3>Identity &amp; phone</h3><div className="modal-grid">
        <label><span>First name *</span><input required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label>
        <label><span>Last name</span><input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label>
        <label><span>Preferred name</span><input value={form.preferredName} onChange={(event) => setForm({ ...form, preferredName: event.target.value })} /></label>
        <label><span>Mobile with country code *</span><input required type="tel" pattern="\+[0-9][0-9\s()\-]{7,20}" value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} placeholder="+60 12 345 6789" /></label>
        {isNew ? <label><span>Invitation household</span><select value={form.householdId} onChange={(event) => setForm({ ...form, householdId: event.target.value })}><option value="">Create new household</option>{households.map((household) => <option key={household.id} value={household.id}>{household.name}</option>)}</select></label> : null}
        {isNew && !form.householdId ? <label className="wide"><span>New household name</span><input value={form.householdName} onChange={(event) => setForm({ ...form, householdName: event.target.value })} /></label> : null}
      </div><p className="security-note"><span>◇</span><strong>Adults-only invitation</strong> Only named guests in this household can RSVP; there are no children or plus-ones.</p></section>
      <section><h3>Invitation &amp; RSVP</h3><div className="modal-grid">
        <label><span>Guest category</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Family</option><option>Friends</option><option>Work</option><option>VIP</option></select></label>
        <label><span>Side</span><select value={form.side} onChange={(event) => setForm({ ...form, side: event.target.value })}><option>Bride</option><option>Groom</option><option>Shared</option></select></label>
        <label><span>RSVP status</span><select value={form.rsvpStatus} onChange={(event) => setForm({ ...form, rsvpStatus: event.target.value })}><option>Pending</option><option>Confirmed</option><option>Declined</option></select></label>
        <label><span>Meal selection</span><select value={form.mealSelection} onChange={(event) => setForm({ ...form, mealSelection: event.target.value })}><option value="">Not selected</option><option value="Lamb">Almond dukkha-crusted lamb</option><option value="Salmon">Seared Alaskan salmon</option></select></label>
      </div><div className="toggle-grid"><Toggle label="Ceremony invited" value={form.ceremonyInvited} set={(value) => setForm({ ...form, ceremonyInvited: value })} /><Toggle label="Reception invited" value={form.receptionInvited} set={(value) => setForm({ ...form, receptionInvited: value })} /><Toggle label="After-party eligible" value={form.afterPartyEligible} set={(value) => setForm({ ...form, afterPartyEligible: value })} /><Toggle label="After-party invited" value={form.afterPartyInvited} set={(value) => setForm({ ...form, afterPartyInvited: value })} /><Toggle label="Needs transport" value={form.transportRequired} set={(value) => setForm({ ...form, transportRequired: value })} /><Toggle label="Needs accommodation" value={form.accommodationRequired} set={(value) => setForm({ ...form, accommodationRequired: value })} /></div></section>
      <section><h3>Care notes</h3><div className="modal-grid"><label><span>Dietary requirements</span><textarea value={form.dietaryRequirements} onChange={(event) => setForm({ ...form, dietaryRequirements: event.target.value })} /></label><label><span>Allergies</span><textarea value={form.allergies} onChange={(event) => setForm({ ...form, allergies: event.target.value })} /></label><label className="wide"><span>Accessibility requirements</span><textarea value={form.accessibility} onChange={(event) => setForm({ ...form, accessibility: event.target.value })} /></label><label className="wide"><span>Internal notes · administrators only</span><textarea value={form.internalNotes} onChange={(event) => setForm({ ...form, internalNotes: event.target.value })} /></label></div></section>
    </div>
    <footer>{!isNew ? <div><button className="danger-link" type="button" onClick={() => { if (window.confirm(`Archive ${displayName(current!)}?`)) void act({ action: "archiveGuest", guestId: current!.id }, "Guest archived").then(close); }}>Archive guest</button><button className="danger-link" type="button" onClick={() => { if (window.confirm(`Permanently delete ${displayName(current!)}? This cannot be undone.`)) void act({ action: "deleteGuest", guestId: current!.id }, "Guest deleted").then(close); }}>Delete</button></div> : <span />}<div><button type="button" className="secondary-button" onClick={close}>Cancel</button><button type="submit">{isNew ? "Add guest" : "Save guest"}</button></div></footer>
  </form></div>;
}

function Toggle({ label, value, set }: { label: string; value: boolean; set: (value: boolean) => void }) { return <label className="toggle-row"><span>{label}</span><button type="button" className={value ? "is-on" : ""} onClick={() => set(!value)} role="switch" aria-checked={value}><i /></button></label>; }

function NewTableModal({ close, act }: { close: () => void; act: (payload: Record<string, unknown>, success: string) => Promise<unknown> }) {
  const [name, setName] = useState(""); const [shape, setShape] = useState("round"); const [capacity, setCapacity] = useState(10);
  return <div className="modal-backdrop"><form className="small-modal" onSubmit={async (event) => { event.preventDefault(); await act({ action: "createTable", name, shape, capacity, x: 50, y: 50 }, "Table created"); close(); }}><header><h2>Create a table</h2><button type="button" onClick={close}>×</button></header><label><span>Table name</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Moonlight" /></label><label><span>Shape</span><select value={shape} onChange={(event) => setShape(event.target.value)}><option value="round">Round</option><option value="rectangular">Rectangular</option><option value="banquet">Long banquet</option></select></label><label><span>Capacity</span><input type="number" min="2" max="30" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></label><footer><button type="button" className="secondary-button" onClick={close}>Cancel</button><button type="submit">Create table</button></footer></form></div>;
}
