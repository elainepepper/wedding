# Elaine & Haykal — final masterpack

This is the complete site, checked end to end: every route, the full RSVP
journey, and the artwork, films and photographs — nothing else is needed.
It was verified on emulated iPhone, Android phone, iPad and desktop
(108 of 108 checks passed), plus the build, type and content test suites.

## To deploy

GitHub → your `wedding` repository → **Add file → Upload files** → drag in
**everything in this folder** (`app`, `lib`, `public`, `tests`, `.github`,
and the loose files — including `netlify.toml`) → commit. Netlify builds and
publishes on its own.

Do **not** upload `.env.local`, `.next`, or `node_modules`.

Netlify must have these environment variables (Site settings → Environment):
`NEXT_PUBLIC_FIREBASE_*` (six values), `FIREBASE_SERVICE_ACCOUNT_JSON`,
`WEDDING_OWNER_EMAIL`, and optionally `FORMSPREE_FORM_ID` and
`CLOUDINARY_API_SECRET`. They are listed in `.env.example`. Never put the
service-account JSON in the repository.

## To run it on your own computer

Copy `.env.example` to `.env.local` and fill it in, then:

    pnpm install
    pnpm build
    pnpm start

Without `.env.local` the invitation preview still works
(`localhost:3000/invitation-preview`); the manager shows a card telling you
which settings it needs instead of an error.

## What was fixed in this final pass

1. **Guests never see a technical error again.** If the server was cut off
   mid-reply (a timeout, a maintenance page), the invitation and the RSVP
   *save* button both showed a raw browser message — *"Failed to execute
   'json' on 'Response'"*. Both now explain gently and invite the guest to
   try again; nothing is lost.
2. **Only one background film plays at a time.** All three dream films used
   to decode at once, invisible or not — heavy on phone batteries and enough
   to make long visits unstable. The hidden films now wait, paused, until
   their painting is on show.
3. **The manager can no longer crash to a blank page.** If the Firebase web
   settings are missing or wrong, `/manager` used to die as a 500 before it
   could explain. It now shows a card saying exactly what to add.
4. **Music/design settings can't block the invitation.** If the database is
   briefly unreachable, the site quietly uses its built-in design instead of
   failing the page.
5. **All artwork restored and complete.** The scene drawings, decorations,
   the three dream paintings (desktop + phone sizes), the three films and
   the gallery photographs are all in `public/wedding/` — earlier packs were
   missing them, which left the site plain and the archway empty.
6. **`netlify.toml` included.** Without it Netlify serves the site as flat
   files and every page 404s — this was the cause of a previous outage.

## Checking it yourself later

- `pnpm test` — content and privacy checks (5 tests).
- `pnpm typecheck` — the TypeScript check.
- `node tests/local-device-run.mjs` — the full phone/tablet/desktop
  walk-through against a locally running site (needs
  `pnpm exec playwright install chromium` once).
- Once live: the manager's **Health check** tab, and
  `tests/walk-the-journey.mjs` with a real invitation link.

## The import trouble, for the record

The old *"Check FIREBASE_SERVICE_ACCOUNT_JSON"* message during guest imports
was misleading: the real cause was hundreds of database round-trips hitting
the hosting time limit. Imports now read the guest list once, write everyone
in batches, and report progress ("Importing… 80 of 155"), so even a slow
connection finishes, and a failure says how far it got.

## After uploading
1. Guests → tick every duplicate → **Delete**. Or Households → **Select all**
   → *Delete invitations* to start clean.
2. Imports → your CSV → **Confirm import**, duplicates on **Skip**.
   It should run through in one pass.
3. **Health check → Run** — you should see 155 guests in 120 invitations.
