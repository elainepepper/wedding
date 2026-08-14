# If this becomes a product: a multi-tenant schema

**Status: a design, not a change.** Nothing in this file is implemented. The
running site keeps its current single-wedding shape, which is correct for one
wedding and must not be disturbed before invitations go out.

## What is wrong with the shape we have

Today every record lives under one Firestore document, `weddings/elaine-haykal-2026`,
and the sub-events are hard-coded as boolean columns on each guest:
`ceremony_invited`, `reception_invited`, `after_party_invited`,
`after_party_attending`. Two consequences:

1. **Every new sub-event costs a schema change.** A rehearsal dinner means new
   columns, new API branches, new manager screens.
2. **There is no tenant boundary in the data itself.** Isolation comes from the
   single hard-coded document id. One mistaken query path and two weddings see
   each other's guests.

## The shape to move to

Relational, tenant-scoped, with sub-events as rows rather than columns. Written
as Prisma because it reads clearly; the same design maps to Postgres directly.

```prisma
model Account {                 // who pays
  id        String   @id @default(cuid())
  name      String
  plan      Plan     @default(FREE)
  createdAt DateTime @default(now())
  events    Event[]
  members   AccountMember[]
}

model AccountMember {           // owner / partner / planner, per account
  id        String   @id @default(cuid())
  accountId String
  userId    String                       // from your auth provider
  role      MemberRole
  account   Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  @@unique([accountId, userId])
}

model Event {                   // one wedding — the tenant boundary
  id          String   @id @default(cuid())
  accountId   String
  slug        String   @unique           // haykalelaine.com or a subdomain
  coupleNames String
  eventDate   DateTime
  timezone    String   @default("Asia/Kuala_Lumpur")
  settings    Json                       // wording, music, design, room block
  account     Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  households  Household[]
  guests      Guest[]
  subEvents   SubEvent[]
  tables      SeatingTable[]
  @@index([accountId])
}

model SubEvent {                // ceremony, reception, after-party, rehearsal…
  id          String   @id @default(cuid())
  eventId     String
  key         String                     // "reception", "after-party"
  name        String
  startsAt    DateTime?
  venue       String?
  isPrivate   Boolean  @default(false)   // never revealed unless invited
  unlockRule  UnlockRule @default(ALWAYS) // e.g. ON_TABLE_ASSIGNED
  sortOrder   Int      @default(0)
  event       Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  permissions GuestSubEventPermission[]
  @@unique([eventId, key])
}

model Household {               // one invitation link
  id         String   @id @default(cuid())
  eventId    String
  name       String
  token      String   @unique            // the personal link
  enabled    Boolean  @default(true)
  archivedAt DateTime?
  mobile     String?
  openedAt   DateTime?
  event      Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  guests     Guest[]
  @@index([eventId])
}

model Guest {
  id          String   @id @default(cuid())
  eventId     String
  householdId String
  firstName   String
  lastName    String?
  preferredName String?
  mobile      String?
  category    String?
  side        String?
  archivedAt  DateTime?
  tableId     String?
  seatNumber  Int?
  notes       String?                    // private to the couple
  event       Event     @relation(fields: [eventId], references: [id], onDelete: Cascade)
  household   Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  permissions GuestSubEventPermission[]
  @@index([eventId])
  @@index([householdId])
}

// The join table that replaces every hard-coded boolean.
model GuestSubEventPermission {
  id         String   @id @default(cuid())
  guestId    String
  subEventId String
  invited    Boolean  @default(false)
  response   Rsvp     @default(PENDING)
  respondedAt DateTime?
  mealChoice String?
  dietary    String?
  guest      Guest    @relation(fields: [guestId], references: [id], onDelete: Cascade)
  subEvent   SubEvent @relation(fields: [subEventId], references: [id], onDelete: Cascade)
  @@unique([guestId, subEventId])
  @@index([subEventId])
}

model SeatingTable {
  id       String  @id @default(cuid())
  eventId  String
  name     String
  capacity Int     @default(10)
  event    Event   @relation(fields: [eventId], references: [id], onDelete: Cascade)
  @@index([eventId])
}

enum Plan        { FREE PRO }
enum MemberRole  { OWNER PARTNER PLANNER }
enum Rsvp        { PENDING ATTENDING DECLINED }
enum UnlockRule  { ALWAYS ON_TABLE_ASSIGNED ON_RSVP_CONFIRMED }
```

## Why this shape

- **`eventId` on every row, not just the top one.** Cross-contamination becomes
  impossible to write accidentally: with Postgres row-level security enabled,
  `USING (event_id = current_setting('app.event_id'))` enforces it in the
  database, below any application mistake.
- **Sub-events are rows.** A rehearsal dinner, a tea ceremony or a second
  reception is a `SubEvent` row plus permission rows — no migration, no new
  columns, no new code. `unlockRule` generalises the rule we hard-coded for the
  after-party (it opens once a table is assigned).
- **Meal and dietary choices live on the permission, not the guest.** A guest
  can eat lamb at the reception and nothing at the rehearsal dinner.
- **Roles live on the account, not the event**, so a planner brought in once can
  be given several weddings without a second sign-in.

## Migrating, when the time comes

1. Stand the relational database up alongside Firestore; write to both.
2. Backfill: one `Event`, then households, guests, and one permission row per
   existing boolean (`reception_invited` → a permission on the `reception`
   sub-event).
3. Move reads over screen by screen, manager first, guest invitation last.
4. Retire the Firestore path once a full wedding cycle has run on the new one.

**Not before November.** The cost of this change is measured in weeks and the
risk lands on a day that cannot be moved.
