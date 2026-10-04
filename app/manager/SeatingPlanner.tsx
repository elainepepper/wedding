"use client";

import { DragEvent, useMemo, useState } from "react";
import { createSeatingPlanPdf, savePdfOnDevice, type SeatingPdfTable } from "../../lib/simple-pdf";

export type SeatingGuest = {
  id: number;
  household_id: number | null;
  household_name: string | null;
  preferred_name: string | null;
  first_name: string;
  last_name: string;
  rsvp_status: string;
  table_id: number | null;
  seat_number: number | null;
  meal_selection: string | null;
  child_meal: number;
  dietary_requirements: string | null;
  allergies: string | null;
};

export type SeatingTableRecord = {
  id: number;
  name: string;
  shape: string;
  capacity: number;
  x: number;
  y: number;
  locked: number;
  notes: string | null;
  guest_count: number;
};

type ManagerAction = (payload: Record<string, unknown>, success: string) => Promise<unknown>;
type UndoAction = { label: string; restore: () => Promise<void> };
type AssignmentMode = "household" | "individual";

const TARGET_GUESTS = 150;
const VIKING_SEATS = 48;
const ROUND_POSITIONS = [
  { x: 22, y: 31 }, { x: 72, y: 31 }, { x: 84, y: 34 },
  { x: 22, y: 48 }, { x: 72, y: 49 }, { x: 84, y: 52 },
  { x: 22, y: 64 }, { x: 72, y: 66 }, { x: 84, y: 68 },
  { x: 22, y: 80 }, { x: 72, y: 82 }, { x: 84, y: 83 },
];

const guestName = (guest: SeatingGuest) => guest.preferred_name || `${guest.first_name || ""} ${guest.last_name || ""}`.trim() || "Unnamed guest";
const bySeat = (a: SeatingGuest, b: SeatingGuest) => Number(a.seat_number ?? 999) - Number(b.seat_number ?? 999) || guestName(a).localeCompare(guestName(b));
const dietaryNote = (guest: SeatingGuest) => [guest.dietary_requirements, guest.allergies].filter(Boolean).join(" · ");
const tableType = (table: SeatingTableRecord) => table.shape === "banquet" ? "Viking table" : table.shape === "round" ? "Round table" : "Feature table";

function tablePosition(table: SeatingTableRecord, index: number, tables: SeatingTableRecord[]) {
  const storedX = Number(table.x);
  const storedY = Number(table.y);
  const untouchedDefault = storedX === 50 && storedY === 50;
  if (!untouchedDefault && Number.isFinite(storedX) && Number.isFinite(storedY)) return { x: storedX, y: storedY };
  if (table.shape === "banquet") {
    const banquetIndex = tables.filter((item) => item.shape === "banquet").findIndex((item) => item.id === table.id);
    return { x: banquetIndex % 2 ? 60 : 40, y: 55 };
  }
  if (table.shape === "rectangular") return { x: 50, y: 23 };
  const roundIndex = tables.filter((item) => item.shape === "round").findIndex((item) => item.id === table.id);
  return ROUND_POSITIONS[Math.max(0, roundIndex) % ROUND_POSITIONS.length] ?? { x: 22 + (index % 4) * 20, y: 35 + Math.floor(index / 4) * 17 };
}

function groupGuests(guests: SeatingGuest[]) {
  const groups = new Map<string, SeatingGuest[]>();
  guests.forEach((guest) => {
    const key = guest.household_id == null ? `guest-${guest.id}` : `household-${guest.household_id}`;
    groups.set(key, [...(groups.get(key) ?? []), guest]);
  });
  return [...groups.values()];
}

function GrandSalonDrawing() {
  return <svg className="salon-plan-art" viewBox="0 0 1000 620" aria-hidden="true">
    <path className="salon-outline" d="M88 118 Q500 5 912 118 L912 486 Q500 605 88 486 Z" />
    <rect className="salon-stage" x="405" y="72" width="190" height="58" rx="4" />
    <text x="500" y="105" textAnchor="middle">STAGE</text>
    <rect className="salon-aisle" x="462" y="151" width="76" height="318" />
    <text className="salon-aisle-label" x="522" y="322" transform="rotate(-90 522 322)">AISLE</text>
    <rect className="salon-dance" x="398" y="447" width="204" height="82" rx="3" />
    <text x="500" y="491" textAnchor="middle">DANCE FLOOR</text>
  </svg>;
}

export function SeatingPlanner({ guests, tables, act, setUndo }: { guests: SeatingGuest[]; tables: SeatingTableRecord[]; act: ManagerAction; setUndo: (undo: UndoAction | null) => void }) {
  const [view, setView] = useState<"list" | "map">("list");
  const [expandedTableId, setExpandedTableId] = useState<number | null>(tables[0]?.id ?? null);
  const [assignmentTableId, setAssignmentTableId] = useState<number | null>(null);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("household");
  const [arrangeTableId, setArrangeTableId] = useState<number | null>(null);
  const [pickedGuestId, setPickedGuestId] = useState<number | null>(null);
  const [moveHouseholdId, setMoveHouseholdId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [editRoom, setEditRoom] = useState(false);

  const confirmed = useMemo(() => guests.filter((guest) => guest.rsvp_status === "Confirmed"), [guests]);
  const seated = confirmed.filter((guest) => guest.table_id);
  const unseated = confirmed.filter((guest) => !guest.table_id);
  const totalCapacity = tables.reduce((sum, table) => sum + Number(table.capacity || 0), 0);
  const vikingCapacity = tables.filter((table) => table.shape === "banquet").reduce((sum, table) => sum + Number(table.capacity || 0), 0);
  const roundTables = tables.filter((table) => table.shape === "round");
  const orderedTables = useMemo(() => [...tables].sort((a, b) => {
    if (a.shape === "banquet" && b.shape !== "banquet") return -1;
    if (b.shape === "banquet" && a.shape !== "banquet") return 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  }), [tables]);

  const tableGuests = (tableId: number) => confirmed.filter((guest) => Number(guest.table_id) === Number(tableId)).sort(bySeat);
  const tableById = (tableId: number | null) => tables.find((table) => Number(table.id) === Number(tableId)) ?? null;
  const firstFreeSeat = (table: SeatingTableRecord) => {
    const occupied = new Set(tableGuests(table.id).map((guest) => Number(guest.seat_number)).filter(Boolean));
    return Array.from({ length: table.capacity }, (_, index) => index + 1).find((seat) => !occupied.has(seat)) ?? table.capacity + 1;
  };

  const assignmentGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    return groupGuests(confirmed.filter((guest) => !query || guestName(guest).toLowerCase().includes(query) || (guest.household_name || "").toLowerCase().includes(query)));
  }, [confirmed, search]);

  const addRoundTable = async () => {
    const position = ROUND_POSITIONS[roundTables.length % ROUND_POSITIONS.length];
    const numbers = new Set(roundTables.map((table) => Number(table.name.match(/\d+/)?.[0])).filter(Boolean));
    let number = 1;
    while (numbers.has(number)) number += 1;
    await act({ action: "createTable", name: `Table ${number}`, shape: "round", capacity: 10, x: position.x, y: position.y }, `Table ${number} added`);
  };

  const addVikingTables = async () => {
    const current = tables.filter((table) => table.shape === "banquet");
    if (current.length >= 2) return;
    for (let index = current.length; index < 2; index += 1) {
      await act({ action: "createTable", name: `Viking ${index === 0 ? "Left" : "Right"}`, shape: "banquet", capacity: 24, x: index === 0 ? 40 : 60, y: 55, locked: true }, `Viking ${index === 0 ? "Left" : "Right"} added`);
    }
  };

  const assignGuest = async (guest: SeatingGuest, table: SeatingTableRecord, seat = firstFreeSeat(table)) => {
    const previousTableId = guest.table_id;
    const previousSeat = guest.seat_number;
    const atTable = tableGuests(table.id);
    const occupant = atTable.find((person) => Number(person.seat_number) === Number(seat) && person.id !== guest.id);
    const peersElsewhere = confirmed.filter((person) => person.id !== guest.id && person.household_id != null && Number(person.household_id) === Number(guest.household_id) && person.table_id && Number(person.table_id) !== Number(table.id));
    if (peersElsewhere.length && !window.confirm(`${guestName(guest)} will be seated separately from ${peersElsewhere.map(guestName).join(" and ")}. Continue?`)) return false;
    const overCapacity = atTable.filter((person) => person.id !== guest.id).length >= table.capacity || seat > table.capacity;
    if (overCapacity && !window.confirm(`${table.name} is already at its planned capacity of ${table.capacity}. Add this guest anyway?`)) return false;
    if (occupant && !window.confirm(`Seat ${seat} belongs to ${guestName(occupant)}. Swap their seats?`)) return false;
    const result = await act({ action: "moveGuest", guestId: guest.id, tableId: table.id, seatNumber: seat, allowOverCapacity: overCapacity, swap: Boolean(occupant) }, `${guestName(guest)} moved to ${table.name}, seat ${seat}`);
    if (!result) return false;
    setPickedGuestId(null);
    setUndo({ label: `${guestName(guest)} moved to ${table.name}`, restore: async () => {
      await act({ action: "restoreSeating", assignments: [
        { guestId: guest.id, tableId: previousTableId, seatNumber: previousSeat },
        ...(occupant ? [{ guestId: occupant.id, tableId: table.id, seatNumber: seat }] : []),
      ] }, "Previous seats restored");
    } });
    return true;
  };

  const unseatGuest = async (guest: SeatingGuest) => {
    const previousTableId = guest.table_id;
    const previousSeat = guest.seat_number;
    const result = await act({ action: "moveGuest", guestId: guest.id, tableId: null }, `${guestName(guest)} returned to unseated guests`);
    if (!result) return;
    setUndo({ label: `${guestName(guest)} returned to unseated guests`, restore: async () => {
      await act({ action: "restoreSeating", assignments: [{ guestId: guest.id, tableId: previousTableId, seatNumber: previousSeat }] }, "Previous seat restored");
    } });
  };

  const seatHousehold = async (group: SeatingGuest[], table: SeatingTableRecord) => {
    const householdId = group[0]?.household_id;
    if (!householdId) return assignGuest(group[0], table);
    const members = confirmed.filter((guest) => Number(guest.household_id) === Number(householdId));
    const otherGuests = tableGuests(table.id).filter((guest) => Number(guest.household_id) !== Number(householdId));
    const overCapacity = otherGuests.length + members.length > table.capacity;
    if (overCapacity && !window.confirm(`${members.length} people from ${group[0].household_name || "this household"} will put ${table.name} over capacity. Seat them together anyway?`)) return false;
    const previousAssignments = members.map((guest) => ({ guestId: guest.id, tableId: guest.table_id, seatNumber: guest.seat_number }));
    const result = await act({ action: "seatHousehold", householdId, tableId: table.id, allowOverCapacity: overCapacity }, `${members.length} household guests seated together at ${table.name}`);
    if (!result) return false;
    setUndo({ label: `${members.length} household guests seated at ${table.name}`, restore: async () => {
      await act({ action: "restoreSeating", assignments: previousAssignments }, "Previous household seats restored");
    } });
    return true;
  };

  const dropOnPlan = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!editRoom) return;
    const tableId = Number(event.dataTransfer.getData("application/x-table-id"));
    const table = tableById(tableId);
    if (!table || table.shape !== "round" || table.locked) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(6, Math.min(94, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.max(8, Math.min(92, ((event.clientY - bounds.top) / bounds.height) * 100));
    await act({ action: "editTable", tableId, x, y }, `${table.name} position saved`);
  };

  const pdfTables: SeatingPdfTable[] = tables.map((table, index) => {
    const position = tablePosition(table, index, tables);
    return { name: table.name, shape: table.shape, capacity: table.capacity, x: position.x, y: position.y, guests: tableGuests(table.id).map((guest) => ({ name: guestName(guest), seat: guest.seat_number, meal: guest.child_meal ? "Children's meal" : guest.meal_selection, dietary: dietaryNote(guest) || null })) };
  });
  const saveHotelPdf = async () => savePdfOnDevice("elaine-haykal-grand-salon-seating.pdf", createSeatingPlanPdf({ title: "Grand Salon seating plan", subtitle: "Hotel copy · tables, seats, meals and dietary requirements", tables: pdfTables }));
  const saveGuestPdf = async () => savePdfOnDevice("elaine-haykal-guest-seating-chart.pdf", createSeatingPlanPdf({ title: "Guest seating chart", subtitle: "Names and assigned tables only", tables: pdfTables, guestSafe: true }));
  const assignmentTable = tableById(assignmentTableId);
  const arrangeTable = tableById(arrangeTableId);
  const pickedGuest = confirmed.find((guest) => guest.id === pickedGuestId) ?? null;
  const openAssignment = (tableId: number, mode: AssignmentMode) => { setAssignmentTableId(tableId); setAssignmentMode(mode); setSearch(""); };

  return <div className="manager-page seating-planner-page seating-planner-v2">
    <div className="section-intro-row seating-intro">
      <div><p className="panel-kicker">Grand Salon</p><h2>Seating plan</h2><span>Start with tables and households. Arrange individual chairs only when you need to.</span></div>
      <div className="seating-view-toggle" aria-label="Seating view"><button type="button" className={view === "list" ? "is-active" : ""} onClick={() => setView("list")}>Tables</button><button type="button" className={view === "map" ? "is-active" : ""} onClick={() => setView("map")}>Room map</button></div>
    </div>

    <section className="seating-status-strip" aria-label="Seating summary">
      <div><strong>{seated.length}</strong><span>seated</span></div><div><strong>{unseated.length}</strong><span>still to seat</span></div><div><strong>{totalCapacity}</strong><span>places planned</span></div><div><strong>{vikingCapacity}</strong><span>of {VIKING_SEATS} Viking places</span></div><small>{TARGET_GUESTS} guests expected</small>
    </section>
    <div className="seating-command-row"><button type="button" className={editRoom ? "is-active" : ""} onClick={() => setEditRoom((current) => !current)}>{editRoom ? "Done editing room" : "Edit room"}</button><div><button type="button" onClick={() => void saveHotelPdf()}>Hotel PDF ↓</button><button type="button" onClick={() => void saveGuestPdf()}>Guest chart ↓</button></div></div>
    {editRoom ? <section className="manager-panel seating-room-editor" aria-label="Room setup controls"><div><strong>Room setup</strong><span>Add, remove or reposition tables. Round tables hold up to 10 guests.</span></div><button type="button" onClick={() => void addRoundTable()}>＋ Round table</button>{tables.filter((table) => table.shape === "banquet").length < 2 ? <button type="button" onClick={() => void addVikingTables()}>Add two Viking tables</button> : null}</section> : null}

    {view === "list" ? <section className="seating-table-directory" aria-label="Reception tables">{orderedTables.map((table) => {
      const people = tableGuests(table.id);
      const households = groupGuests(people);
      const dietaryCount = people.filter((guest) => dietaryNote(guest)).length;
      const expanded = expandedTableId === table.id;
      return <article key={table.id} className={`seating-directory-row${expanded ? " is-expanded" : ""}${people.length > table.capacity ? " is-over" : ""}`}>
        <button type="button" className="seating-directory-summary" aria-expanded={expanded} onClick={() => setExpandedTableId(expanded ? null : table.id)}><span><strong>{table.name}</strong><small>{tableType(table)}</small></span><span className="seating-directory-meta"><b>{people.length}/{table.capacity}</b><small>{households.length} household{households.length === 1 ? "" : "s"}</small></span>{dietaryCount ? <em>{dietaryCount} dietary</em> : <em className="is-clear">No dietary alerts</em>}<i aria-hidden="true">{expanded ? "−" : "+"}</i></button>
        <span className="seating-directory-progress" style={{ width: `${Math.min(100, people.length / Math.max(1, table.capacity) * 100)}%` }} />
        {expanded ? <div className="seating-directory-detail">
          <div className="seating-directory-actions"><button type="button" onClick={() => openAssignment(table.id, "household")}>＋ Household</button><button type="button" onClick={() => openAssignment(table.id, "individual")}>＋ Individual</button><button type="button" onClick={() => { setArrangeTableId(table.id); setPickedGuestId(null); }}>Arrange chairs</button></div>
          {households.length ? <div className="seating-directory-households">{households.map((group) => {
            const householdId = group[0].household_id;
            const isMoving = householdId != null && moveHouseholdId === householdId;
            return <section key={householdId ?? `guest-${group[0].id}`}><header><div><strong>{group[0].household_name || guestName(group[0])}</strong><small>{group.length} guest{group.length === 1 ? "" : "s"}</small></div>{householdId != null && group.length > 1 ? <button type="button" onClick={() => setMoveHouseholdId(isMoving ? null : householdId)}>{isMoving ? "Cancel" : "Move household"}</button> : null}</header>
              {isMoving ? <label className="seating-household-move"><span>Move everyone to</span><select defaultValue="" onChange={(event) => { const destination = tableById(Number(event.target.value)); if (destination) void seatHousehold(group, destination).then((saved) => { if (saved) setMoveHouseholdId(null); }); }}><option value="">Choose table…</option>{orderedTables.filter((item) => item.id !== table.id).map((item) => <option key={item.id} value={item.id}>{item.name} · {tableGuests(item.id).length}/{item.capacity}</option>)}</select></label> : null}
              <div className="seating-directory-guests">{group.map((guest) => <div key={guest.id}><span className="seating-guest-seat">{guest.seat_number ?? "—"}</span><span><strong>{guestName(guest)}</strong><small>{guest.child_meal ? "Children's meal" : guest.meal_selection || "Meal not chosen"}{dietaryNote(guest) ? ` · ${dietaryNote(guest)}` : ""}</small></span><label><span>Move</span><select value={guest.table_id ?? ""} onChange={(event) => { const destination = tableById(Number(event.target.value)); if (destination) void assignGuest(guest, destination); }}>{orderedTables.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="button" onClick={() => void unseatGuest(guest)}>Unseat</button></div>)}</div>
            </section>;
          })}</div> : <p className="seating-empty-table">No guests are seated here yet.</p>}
          {editRoom ? <div className="seating-inline-room-controls"><label><span>Table name</span><input defaultValue={table.name} key={`${table.id}-${table.name}`} onBlur={(event) => { const name = event.target.value.trim(); if (name && name !== table.name) void act({ action: "editTable", tableId: table.id, name }, "Table renamed"); }} /></label><div><span>Places</span><button type="button" onClick={() => { const next = Math.max(1, table.capacity - 1); if (people.length > next && !window.confirm(`${table.name} has more guests than ${next} places. Reduce it anyway?`)) return; void act({ action: "editTable", tableId: table.id, capacity: next }, "Table capacity updated"); }}>−</button><strong>{table.capacity}</strong><button type="button" disabled={table.shape === "round" && table.capacity >= 10} onClick={() => void act({ action: "editTable", tableId: table.id, capacity: table.capacity + 1 }, "Table capacity updated")}>＋</button></div><button type="button" className="danger-link" onClick={() => { if (!window.confirm(`Remove ${table.name}? Its guests will return to the unseated list.`)) return; void act({ action: "deleteTable", tableId: table.id }, `${table.name} removed`); setExpandedTableId(null); }}>Remove table</button></div> : null}
        </div> : null}
      </article>;
    })}{!tables.length ? <div className="seating-empty-directory"><strong>No tables yet</strong><span>Use Edit room to add the Viking and round tables.</span></div> : null}</section> : <section className="seating-overview-panel">
      <div className={`salon-canvas salon-canvas--overview${editRoom ? " is-editing" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => void dropOnPlan(event)}><GrandSalonDrawing />{tables.map((table, index) => { const position = tablePosition(table, index, tables); const people = tableGuests(table.id); return <button type="button" key={table.id} draggable={editRoom && table.shape === "round" && !table.locked} onDragStart={(event) => { event.dataTransfer.setData("application/x-table-id", String(table.id)); event.dataTransfer.effectAllowed = "move"; }} className={`salon-table salon-table--${table.shape}${people.length > table.capacity ? " is-over" : ""}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} onClick={() => { setExpandedTableId(table.id); setView("list"); }} aria-label={`${table.name}, ${people.length} of ${table.capacity} seats`}><strong>{table.name}</strong><small>{people.length}/{table.capacity}</small></button>; })}</div>
      <p className="seating-map-help">Tap a table to open its guest list.{editRoom ? " On desktop, drag round tables to reposition them." : " Turn on Edit room to change the layout."}</p>
      {editRoom ? <div className="seating-map-nudges">{orderedTables.filter((table) => table.shape === "round").map((table) => { const position = tablePosition(table, tables.findIndex((item) => item.id === table.id), tables); return <div key={table.id}><strong>{table.name}</strong><span><button type="button" aria-label={`Move ${table.name} left`} onClick={() => void act({ action: "editTable", tableId: table.id, x: position.x - 3 }, "Table moved")}>←</button><button type="button" aria-label={`Move ${table.name} up`} onClick={() => void act({ action: "editTable", tableId: table.id, y: position.y - 3 }, "Table moved")}>↑</button><button type="button" aria-label={`Move ${table.name} down`} onClick={() => void act({ action: "editTable", tableId: table.id, y: position.y + 3 }, "Table moved")}>↓</button><button type="button" aria-label={`Move ${table.name} right`} onClick={() => void act({ action: "editTable", tableId: table.id, x: position.x + 3 }, "Table moved")}>→</button></span></div>; })}</div> : null}
    </section>}

    {assignmentTable ? <div className="seating-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setAssignmentTableId(null); }}><section className="seating-assignment-sheet" role="dialog" aria-modal="true" aria-labelledby="assignment-title"><header><div><p className="panel-kicker">Assign to {assignmentTable.name}</p><h3 id="assignment-title">Choose who to seat</h3></div><button type="button" aria-label="Close assignment panel" onClick={() => setAssignmentTableId(null)}>×</button></header><div className="seating-assignment-tabs"><button type="button" className={assignmentMode === "household" ? "is-active" : ""} onClick={() => setAssignmentMode("household")}>Households</button><button type="button" className={assignmentMode === "individual" ? "is-active" : ""} onClick={() => setAssignmentMode("individual")}>Individuals</button></div><label className="seating-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search guests or household" aria-label="Search guests to assign" /></label><div className="seating-assignment-results">
      {assignmentMode === "household" ? assignmentGroups.map((group) => { const allHere = group.every((guest) => Number(guest.table_id) === assignmentTable.id); return <article key={group[0].household_id ?? `guest-${group[0].id}`}><span><strong>{group[0].household_name || guestName(group[0])}</strong><small>{group.map((guest) => `${guestName(guest)}${guest.table_id ? ` · ${tableById(guest.table_id)?.name || "seated"}` : " · unseated"}`).join(" | ")}</small></span><button type="button" disabled={allHere} onClick={() => void seatHousehold(group, assignmentTable)}>{allHere ? "Already here" : `Seat ${group.length > 1 ? "together" : "guest"}`}</button></article>; }) : assignmentGroups.flat().map((guest) => <article key={guest.id}><span><strong>{guestName(guest)}</strong><small>{guest.household_name || "Individual invitation"}{guest.table_id ? ` · ${tableById(guest.table_id)?.name || "Seated"}` : " · Unseated"}</small></span><button type="button" disabled={Number(guest.table_id) === assignmentTable.id} onClick={() => void assignGuest(guest, assignmentTable)}>{Number(guest.table_id) === assignmentTable.id ? "Already here" : "Add"}</button></article>)}
    </div></section></div> : null}

    {arrangeTable ? <div className="seating-sheet-backdrop seating-chair-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setArrangeTableId(null); }}><section className="seating-chair-sheet" role="dialog" aria-modal="true" aria-labelledby="chair-title"><header><div><p className="panel-kicker">{arrangeTable.name}</p><h3 id="chair-title">Arrange chairs</h3><span>On phone, choose a guest and then a chair. On desktop, you may drag a guest directly onto a chair.</span></div><button type="button" aria-label="Close chair arranger" onClick={() => { setArrangeTableId(null); setPickedGuestId(null); }}>×</button></header><div className={`seating-chair-layout seating-chair-layout--${arrangeTable.shape}`}><div className="seating-chair-table"><strong>{arrangeTable.name}</strong><small>{tableGuests(arrangeTable.id).length}/{arrangeTable.capacity}</small></div>
      {Array.from({ length: Math.max(arrangeTable.capacity, ...tableGuests(arrangeTable.id).map((guest) => Number(guest.seat_number) || 0)) }, (_, index) => index + 1).map((seat, index, allSeats) => { const occupant = tableGuests(arrangeTable.id).find((guest) => Number(guest.seat_number) === seat); const angle = -Math.PI / 2 + (index / allSeats.length) * Math.PI * 2; const style = arrangeTable.shape === "banquet" ? { gridColumn: index % 2 === 0 ? 1 : 3, gridRow: Math.floor(index / 2) + 1 } : { left: `${50 + Math.cos(angle) * 42}%`, top: `${50 + Math.sin(angle) * 42}%` }; return <button type="button" key={seat} style={style} draggable={Boolean(occupant)} onDragStart={(event) => { if (occupant) event.dataTransfer.setData("application/x-guest-id", String(occupant.id)); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const guest = confirmed.find((person) => person.id === Number(event.dataTransfer.getData("application/x-guest-id"))); if (guest) void assignGuest(guest, arrangeTable, seat); }} className={`${occupant ? "is-occupied" : "is-empty"}${pickedGuestId === occupant?.id ? " is-picked" : ""}`} onClick={() => { if (pickedGuest) void assignGuest(pickedGuest, arrangeTable, seat); else if (occupant) setPickedGuestId(occupant.id); }}><b>{seat}</b><span>{occupant ? guestName(occupant) : "Available"}</span></button>; })}
    </div><div className="seating-chair-guests"><strong>{pickedGuest ? `${guestName(pickedGuest)} selected — choose a chair` : "Choose a guest"}</strong><div>{tableGuests(arrangeTable.id).map((guest) => <button type="button" key={guest.id} draggable onDragStart={(event) => event.dataTransfer.setData("application/x-guest-id", String(guest.id))} className={pickedGuestId === guest.id ? "is-selected" : ""} onClick={() => setPickedGuestId(pickedGuestId === guest.id ? null : guest.id)}><b>{guest.seat_number ?? "—"}</b><span>{guestName(guest)}</span></button>)}</div></div></section></div> : null}
  </div>;
}
