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

function SeatDots({ table, guests }: { table: SeatingTableRecord; guests: SeatingGuest[] }) {
  const capacity = Math.min(table.capacity, table.shape === "banquet" ? 24 : 10);
  const occupied = new Set(guests.map((guest) => Number(guest.seat_number)).filter(Boolean));
  if (table.shape === "banquet") {
    return <>{Array.from({ length: capacity }, (_, index) => {
      const side = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 2);
      const rows = Math.ceil(capacity / 2);
      return <i key={index} className={occupied.has(index + 1) ? "is-occupied" : ""} style={{ left: `${50 + side * 48}%`, top: `${8 + row * (84 / Math.max(1, rows - 1))}%` }} />;
    })}</>;
  }
  return <>{Array.from({ length: capacity }, (_, index) => {
    const angle = -Math.PI / 2 + (index / capacity) * Math.PI * 2;
    return <i key={index} className={occupied.has(index + 1) ? "is-occupied" : ""} style={{ left: `${50 + Math.cos(angle) * 48}%`, top: `${50 + Math.sin(angle) * 48}%` }} />;
  })}</>;
}

function GrandSalonDrawing() {
  return <svg className="salon-plan-art" viewBox="0 0 1000 620" aria-hidden="true">
    <path className="salon-outline" d="M88 118 Q500 5 912 118 L912 486 Q500 605 88 486 Z" />
    <path className="salon-upper-wall" d="M105 135 Q500 36 895 135" />
    <rect className="salon-stage" x="405" y="72" width="190" height="58" rx="4" />
    <text x="500" y="91" textAnchor="middle">LED SCREEN</text>
    <text x="500" y="111" textAnchor="middle">24FT × 12FT</text>
    <rect className="salon-aisle" x="462" y="151" width="76" height="318" />
    <line x1="500" x2="500" y1="160" y2="455" />
    <text className="salon-aisle-label" x="522" y="322" transform="rotate(-90 522 322)">28FT CEREMONIAL AISLE</text>
    <rect className="salon-dance" x="398" y="447" width="204" height="82" rx="3" />
    <text x="500" y="487" textAnchor="middle">12FT DANCE FLOOR</text>
    <path className="salon-registration" d="M738 525 l98 -15 12 32 -98 18 z" />
    <text x="794" y="548" textAnchor="middle" transform="rotate(-9 794 548)">REGISTRATION</text>
    <path className="salon-door" d="M875 175 h82 v115 h-82" />
    <path className="salon-door" d="M875 300 h82 v115 h-82" />
    <text x="915" y="232" textAnchor="middle">SERVICE</text>
    <text x="915" y="356" textAnchor="middle">SERVICE</text>
    <text className="salon-room-label" x="500" y="585" textAnchor="middle">GRAND SALON · NOT TO SCALE</text>
  </svg>;
}

export function SeatingPlanner({ guests, tables, act, setUndo }: { guests: SeatingGuest[]; tables: SeatingTableRecord[]; act: ManagerAction; setUndo: (undo: UndoAction | null) => void }) {
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"map" | "list">("map");
  const confirmed = useMemo(() => guests.filter((guest) => guest.rsvp_status === "Confirmed"), [guests]);
  const selectedTable = tables.find((table) => table.id === selectedTableId) ?? null;
  const seated = confirmed.filter((guest) => guest.table_id);
  const unseated = confirmed.filter((guest) => !guest.table_id);
  const totalCapacity = tables.reduce((sum, table) => sum + Number(table.capacity || 0), 0);
  const vikingCapacity = tables.filter((table) => table.shape === "banquet").reduce((sum, table) => sum + Number(table.capacity || 0), 0);
  const roundTables = tables.filter((table) => table.shape === "round");

  const tableGuests = (tableId: number) => confirmed.filter((guest) => Number(guest.table_id) === Number(tableId)).sort(bySeat);
  const tableById = (tableId: number | null) => tables.find((table) => Number(table.id) === Number(tableId)) ?? null;
  const firstFreeSeat = (table: SeatingTableRecord) => {
    const occupied = new Set(tableGuests(table.id).map((guest) => Number(guest.seat_number)).filter(Boolean));
    return Array.from({ length: table.capacity }, (_, index) => index + 1).find((seat) => !occupied.has(seat)) ?? table.capacity + 1;
  };

  const groupedUnseated = useMemo(() => {
    const groups = new Map<string, SeatingGuest[]>();
    unseated.filter((guest) => {
      const query = search.trim().toLowerCase();
      return !query || guestName(guest).toLowerCase().includes(query) || (guest.household_name || "").toLowerCase().includes(query);
    }).forEach((guest) => {
      const key = guest.household_id == null ? `guest-${guest.id}` : `household-${guest.household_id}`;
      groups.set(key, [...(groups.get(key) ?? []), guest]);
    });
    return [...groups.values()];
  }, [unseated, search]);

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
    if (peersElsewhere.length && !window.confirm(`${guestName(guest)} will be seated separately from ${peersElsewhere.map(guestName).join(" and ")}. Continue?`)) return;
    const overCapacity = atTable.filter((person) => person.id !== guest.id).length >= table.capacity || seat > table.capacity;
    if (overCapacity && !window.confirm(`${table.name} is already at its planned capacity of ${table.capacity}. Add this guest anyway?`)) return;
    const swap = Boolean(occupant);
    if (occupant && !window.confirm(`Seat ${seat} belongs to ${guestName(occupant)}. Swap their seats?`)) return;
    const result = await act({ action: "moveGuest", guestId: guest.id, tableId: table.id, seatNumber: seat, allowOverCapacity: overCapacity, swap }, `${guestName(guest)} moved to ${table.name}, seat ${seat}`);
    if (result) {
      setSelectedSeat(null);
      setUndo({
        label: `${guestName(guest)} moved to ${table.name}`,
        restore: async () => {
          await act({ action: "restoreSeating", assignments: [
            { guestId: guest.id, tableId: previousTableId, seatNumber: previousSeat },
            ...(occupant ? [{ guestId: occupant.id, tableId: table.id, seatNumber: seat }] : []),
          ] }, "Previous seats restored");
        },
      });
    }
  };

  const unseatGuest = async (guest: SeatingGuest) => {
    const previousTableId = guest.table_id;
    const previousSeat = guest.seat_number;
    const result = await act({ action: "moveGuest", guestId: guest.id, tableId: null }, `${guestName(guest)} returned to unseated guests`);
    if (!result) return;
    setUndo({
      label: `${guestName(guest)} returned to unseated guests`,
      restore: async () => {
        await act({ action: "restoreSeating", assignments: [{ guestId: guest.id, tableId: previousTableId, seatNumber: previousSeat }] }, "Previous seat restored");
      },
    });
  };

  const seatHousehold = async (group: SeatingGuest[], table: SeatingTableRecord) => {
    const householdId = group[0]?.household_id;
    if (!householdId) return assignGuest(group[0], table, selectedSeat ?? firstFreeSeat(table));
    const members = confirmed.filter((guest) => Number(guest.household_id) === Number(householdId));
    const otherGuests = tableGuests(table.id).filter((guest) => Number(guest.household_id) !== Number(householdId));
    const overCapacity = otherGuests.length + members.length > table.capacity;
    if (overCapacity && !window.confirm(`${members.length} people from ${group[0].household_name || "this household"} will put ${table.name} over capacity. Seat them together anyway?`)) return;
    const previousAssignments = members.map((guest) => ({ guestId: guest.id, tableId: guest.table_id, seatNumber: guest.seat_number }));
    const result = await act({ action: "seatHousehold", householdId, tableId: table.id, allowOverCapacity: overCapacity }, `${members.length} household guests seated together at ${table.name}`);
    if (result) {
      setUndo({
        label: `${members.length} household guests seated at ${table.name}`,
        restore: async () => {
          await act({ action: "restoreSeating", assignments: previousAssignments }, "Previous household seats restored");
        },
      });
    }
  };

  const dropOnPlan = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const tableId = Number(event.dataTransfer.getData("application/x-table-id"));
    if (!tableId) return;
    const table = tableById(tableId);
    if (!table || table.shape !== "round" || table.locked) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(6, Math.min(94, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.max(8, Math.min(92, ((event.clientY - bounds.top) / bounds.height) * 100));
    await act({ action: "editTable", tableId, x, y }, `${table.name} position saved`);
  };

  const pdfTables: SeatingPdfTable[] = tables.map((table, index) => {
    const position = tablePosition(table, index, tables);
    return {
      name: table.name,
      shape: table.shape,
      capacity: table.capacity,
      x: position.x,
      y: position.y,
      guests: tableGuests(table.id).map((guest) => ({
        name: guestName(guest),
        seat: guest.seat_number,
        meal: guest.child_meal ? "Children's meal" : guest.meal_selection,
        dietary: [guest.dietary_requirements, guest.allergies].filter(Boolean).join(" · ") || null,
      })),
    };
  });

  const saveHotelPdf = async () => savePdfOnDevice("elaine-haykal-grand-salon-seating.pdf", createSeatingPlanPdf({
    title: "Grand Salon seating plan",
    subtitle: "Hotel copy · tables, seats, meals and dietary requirements",
    tables: pdfTables,
  }));
  const saveGuestPdf = async () => savePdfOnDevice("elaine-haykal-guest-seating-chart.pdf", createSeatingPlanPdf({
    title: "Guest seating chart",
    subtitle: "Names and assigned tables only",
    tables: pdfTables,
    guestSafe: true,
  }));

  return <div className="manager-page seating-planner-page">
    <div className="section-intro-row seating-intro">
      <div><p className="panel-kicker">Grand Salon</p><h2>Arrange the room</h2><span>Seat households together, then fine-tune individual chairs. Every change saves immediately.</span></div>
      <div className="seating-view-toggle" aria-label="Seating view"><button type="button" className={view === "map" ? "is-active" : ""} onClick={() => setView("map")}>Floor plan</button><button type="button" className={view === "list" ? "is-active" : ""} onClick={() => setView("list")}>Table list</button></div>
    </div>

    <section className="seating-summary" aria-label="Seating summary">
      <article><span>Reception plan</span><strong>{TARGET_GUESTS}</strong><small>people</small></article>
      <article><span>Viking tables</span><strong>{vikingCapacity}</strong><small>of {VIKING_SEATS} places</small></article>
      <article><span>Seated</span><strong>{seated.length}</strong><small>{unseated.length} confirmed still to seat</small></article>
      <article className={totalCapacity < TARGET_GUESTS ? "needs-attention" : ""}><span>Total places</span><strong>{totalCapacity}</strong><small>{totalCapacity >= TARGET_GUESTS ? `${totalCapacity - TARGET_GUESTS} spare` : `${TARGET_GUESTS - totalCapacity} short`}</small></article>
    </section>

    <section className="manager-panel seating-setup-bar">
      <div><strong>Room setup</strong><span>Round tables hold up to 10. Viking tables hold 24 each and stay fixed beside the aisle.</span></div>
      <button type="button" onClick={() => void addRoundTable()}>＋ Round table</button>
      {tables.filter((table) => table.shape === "banquet").length < 2 ? <button type="button" className="secondary-button" onClick={() => void addVikingTables()}>Add two Viking tables</button> : null}
      <button type="button" className="secondary-button" onClick={() => void saveHotelPdf()}>Hotel PDF ↓</button>
      <button type="button" className="secondary-button" onClick={() => void saveGuestPdf()}>Guest chart ↓</button>
    </section>

    <div className={`seating-workspace seating-workspace--${view}`}>
      <aside className="manager-panel seating-guest-bank">
        <header><div><p className="panel-kicker">Confirmed guests</p><h3>Still to seat</h3></div><strong>{unseated.length}</strong></header>
        <label className="seating-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search guests or household" aria-label="Search unseated guests" /></label>
        <div className="seating-household-list">
          {groupedUnseated.map((group) => <article key={group[0].household_id ?? `guest-${group[0].id}`} className="seating-household-card">
            <header><div><strong>{group[0].household_name || guestName(group[0])}</strong><small>{group.length > 1 ? `${group.length} confirmed guests` : "One confirmed guest"}</small></div>{group.length > 1 ? <span>Together</span> : null}</header>
            {group.map((guest) => <button key={guest.id} type="button" draggable onDragStart={(event) => { event.dataTransfer.setData("application/x-guest-id", String(guest.id)); event.dataTransfer.effectAllowed = "move"; }} onClick={() => {
              if (!selectedTable) return;
              void assignGuest(guest, selectedTable, selectedSeat ?? firstFreeSeat(selectedTable));
            }} disabled={!selectedTable}><i>{guestName(guest).slice(0, 1)}</i><span>{guestName(guest)}<small>{selectedTable ? `Assign to ${selectedTable.name}${selectedSeat ? ` · seat ${selectedSeat}` : ""}` : "Select a table first"}</small></span></button>)}
            {group.length > 1 && selectedTable ? <button type="button" className="seat-together-button" onClick={() => void seatHousehold(group, selectedTable)}>Seat household together at {selectedTable.name}</button> : null}
          </article>)}
          {!groupedUnseated.length ? <p className="empty-note">{unseated.length ? "No guests match that search." : "Every confirmed guest has a table."}</p> : null}
        </div>
      </aside>

      {view === "map" ? <section className="seating-map-panel">
        <div className="salon-canvas" onDragOver={(event) => event.preventDefault()} onDrop={(event) => void dropOnPlan(event)}>
          <GrandSalonDrawing />
          {tables.map((table, index) => {
            const position = tablePosition(table, index, tables);
            const people = tableGuests(table.id);
            return <button type="button" key={table.id} draggable={table.shape === "round" && !table.locked} onDragStart={(event) => { event.dataTransfer.setData("application/x-table-id", String(table.id)); event.dataTransfer.effectAllowed = "move"; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
              event.stopPropagation();
              const guest = confirmed.find((person) => person.id === Number(event.dataTransfer.getData("application/x-guest-id")));
              if (guest) void assignGuest(guest, table);
            }} className={`salon-table salon-table--${table.shape}${selectedTableId === table.id ? " is-selected" : ""}${people.length > table.capacity ? " is-over" : people.length === table.capacity ? " is-full" : ""}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} onClick={() => { setSelectedTableId(table.id); setSelectedSeat(null); }} aria-label={`${table.name}, ${people.length} of ${table.capacity} seats${table.shape === "round" && !table.locked ? ", draggable" : ""}`}>
              <span className="salon-table-seats"><SeatDots table={table} guests={people} /></span>
              <strong>{table.name}</strong><small>{people.length}/{table.capacity}</small>
            </button>;
          })}
          {!tables.length ? <div className="salon-empty"><strong>Start with the room setup above</strong><span>Add the two Viking tables, then add as many round tables as you need.</span></div> : null}
        </div>
        <p className="seating-map-help">On desktop, drag unlocked round tables to refine the room. On phone, select a table and use the position controls below.</p>
      </section> : <section className="seating-table-list" aria-label="Table list">
        {tables.map((table) => { const people = tableGuests(table.id); return <button type="button" key={table.id} className={selectedTableId === table.id ? "is-selected" : ""} onClick={() => { setSelectedTableId(table.id); setSelectedSeat(null); }}><span><strong>{table.name}</strong><small>{table.shape === "banquet" ? "Viking table" : table.shape === "round" ? "Round table" : "Feature table"}</small></span><b>{people.length}/{table.capacity}</b><i style={{ width: `${Math.min(100, people.length / Math.max(1, table.capacity) * 100)}%` }} /></button>; })}
      </section>}
    </div>

    {selectedTable ? <section className="manager-panel seating-table-editor" aria-labelledby="selected-table-title">
      <header><div><p className="panel-kicker">Selected table</p><h3 id="selected-table-title">{selectedTable.name}</h3><span>{tableGuests(selectedTable.id).length} of {selectedTable.capacity} places</span></div><button type="button" aria-label="Close selected table" onClick={() => { setSelectedTableId(null); setSelectedSeat(null); }}>×</button></header>
      <div className="seating-table-tools">
        <label><span>Table name</span><input defaultValue={selectedTable.name} key={`${selectedTable.id}-${selectedTable.name}`} onBlur={(event) => { const name = event.target.value.trim(); if (name && name !== selectedTable.name) void act({ action: "editTable", tableId: selectedTable.id, name }, "Table renamed"); }} /></label>
        <div className="seating-capacity"><span>Places</span><button type="button" aria-label="Remove one place" onClick={() => { const next = Math.max(1, selectedTable.capacity - 1); if (tableGuests(selectedTable.id).length > next && !window.confirm(`${selectedTable.name} currently has more guests than ${next} places. Reduce it anyway?`)) return; void act({ action: "editTable", tableId: selectedTable.id, capacity: next }, "Table capacity updated"); }}>−</button><strong>{selectedTable.capacity}</strong><button type="button" aria-label="Add one place" disabled={selectedTable.shape === "round" && selectedTable.capacity >= 10} onClick={() => void act({ action: "editTable", tableId: selectedTable.id, capacity: selectedTable.capacity + 1 }, "Table capacity updated")}>＋</button></div>
        {selectedTable.shape === "round" ? (() => { const position = tablePosition(selectedTable, tables.findIndex((table) => table.id === selectedTable.id), tables); return <div className="seating-position-controls"><span>Position</span><button type="button" aria-label="Move table left" onClick={() => void act({ action: "editTable", tableId: selectedTable.id, x: position.x - 3 }, "Table moved")}>←</button><button type="button" aria-label="Move table up" onClick={() => void act({ action: "editTable", tableId: selectedTable.id, y: position.y - 3 }, "Table moved")}>↑</button><button type="button" aria-label="Move table down" onClick={() => void act({ action: "editTable", tableId: selectedTable.id, y: position.y + 3 }, "Table moved")}>↓</button><button type="button" aria-label="Move table right" onClick={() => void act({ action: "editTable", tableId: selectedTable.id, x: position.x + 3 }, "Table moved")}>→</button></div>; })() : <p className="seating-fixed-note">Viking tables stay fixed beside the aisle.</p>}
        <button type="button" className="danger-link seating-remove-table" onClick={() => { if (!window.confirm(`Remove ${selectedTable.name}? Its guests will return to the unseated list.`)) return; void act({ action: "deleteTable", tableId: selectedTable.id }, `${selectedTable.name} removed`); setSelectedTableId(null); }}>Remove table</button>
      </div>

      <div className="seating-seat-grid" aria-label={`Seats at ${selectedTable.name}`}>
        {Array.from({ length: Math.max(selectedTable.capacity, ...tableGuests(selectedTable.id).map((guest) => Number(guest.seat_number) || 0)) }, (_, index) => index + 1).map((seat) => {
          const occupant = tableGuests(selectedTable.id).find((guest) => Number(guest.seat_number) === seat);
          return <button type="button" key={seat} className={`${occupant ? "is-occupied" : "is-empty"}${selectedSeat === seat ? " is-selected" : ""}${seat > selectedTable.capacity ? " is-extra" : ""}`} onClick={() => setSelectedSeat(occupant ? null : seat)}><b>{seat}</b>{occupant ? <span>{guestName(occupant)}<small>{occupant.household_name}</small></span> : <span>Available</span>}</button>;
        })}
      </div>

      {selectedSeat ? <div className="seating-seat-prompt" role="status"><strong>Seat {selectedSeat} selected</strong><span>Choose a guest from “Still to seat” above.</span><button type="button" onClick={() => setSelectedSeat(null)}>Cancel</button></div> : null}

      {tableGuests(selectedTable.id).length ? <div className="seating-roster"><header><span>Guest</span><span>Move to table</span><span>Seat</span><span /></header>{tableGuests(selectedTable.id).map((guest) => <div key={guest.id}><span><strong>{guestName(guest)}</strong><small>{guest.household_name}</small></span><select value={guest.table_id ?? ""} onChange={(event) => { const next = tableById(Number(event.target.value)); if (next) void assignGuest(guest, next); }} aria-label={`Move ${guestName(guest)} to another table`}>{tables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}</select><select value={guest.seat_number ?? ""} onChange={(event) => void assignGuest(guest, selectedTable, Number(event.target.value))} aria-label={`Change seat for ${guestName(guest)}`}>{Array.from({ length: Math.max(selectedTable.capacity, tableGuests(selectedTable.id).length) }, (_, index) => index + 1).map((seat) => { const occupant = tableGuests(selectedTable.id).find((person) => Number(person.seat_number) === seat && person.id !== guest.id); return <option key={seat} value={seat}>{seat}{occupant ? ` · ${guestName(occupant)}` : ""}</option>; })}</select><button type="button" onClick={() => void unseatGuest(guest)}>Unseat</button></div>)}</div> : <p className="empty-note">No one is seated here yet. Select an available chair, then choose a guest.</p>}
    </section> : null}
  </div>;
}
