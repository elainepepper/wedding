# Roster → iOS calendar

Puts Elaine's shifts from the shared Tech Roster spreadsheet into the iPhone
Calendar app, and keeps them there: the calendar re-reads the sheet on a
schedule, so when the boss changes a shift the phone follows within the hour.
Nothing to re-export, nothing to re-import.

There are two pieces:

| File | What it is |
| --- | --- |
| `roster-ics.gs` | Google Apps Script. Reads the live sheet and serves it as a calendar feed. **This is the auto-updating one.** |
| `xlsx_to_ics.py` | Offline converter for a downloaded `.xlsx`. One-off snapshot, does not update. Handy for a quick import or for checking the mapping. |
| `appsscript.json` | Optional project manifest (time zone, scopes, web-app access). Only needed if you deploy with `clasp`; setting the time zone in Project Settings does the same job. |

## How the roster is read

The roster grid stores the **shift time in the cell's fill colour** — the
legend lives at `AJ3:AJ9` on a year tab. The text inside a cell is hours
worked or a note, not the shift. (This is why a plain CSV export of the sheet
can't drive the calendar: CSV throws the colours away. The script reads the
sheet through the Sheets API, which keeps them.)

| Colour | Shift | Calendar entry |
| --- | --- | --- |
| Light blue `#95b3d7` | 8am – 4pm | timed event |
| Yellow `#ffd966` | 8.30am – 4.30pm | timed event |
| Mint `#90dcbf` | 8am – 5pm | timed event |
| Green `#00b050` | 9am – 5pm | timed event |
| Orange `#ff9900` | 2pm – 10pm | timed event |
| Blue `#3366ff` | 4pm – midnight | timed event |
| Purple `#7030a0` | 9.30pm – 8am (night) | timed event, ends next morning |
| Dark orange `#c65911` | 1pm – 9pm | timed event |
| Dark grey `#434343` | Annual leave | all-day |
| Light grey `#cccccc` | RDO / day in lieu | all-day |
| Red `#ff0000` | Sick day | all-day |
| `PHol` / `PHoE` text | Public holiday | all-day |
| `DOD` text, or blank | Day off | skipped |
| Anything else with a colour | unknown | all-day “Rostered – check the sheet”, with the colour code in the notes |

Two of these were inferred rather than read off the legend: dark orange is
`1-9` typed into the cells (1pm – 9pm), and dark grey is the colour used on the
`A/L` cells. If a cell spells out its own range (`8-5`, `2-10`, `9.30-2`), that
text wins over the colour.

To change any of this, edit the `SHIFTS` / `NON_SHIFTS` tables at the top of
`roster-ics.gs` and redeploy.

## What range it publishes

**The calendar starts at today.** Past shifts aren't carried in the feed, and
because a subscribed calendar mirrors whatever the feed currently says, each
day's shifts drop off the phone once the day is over — the calendar is a
forward view of the roster, not a work history. (If you'd rather keep the last
few weeks visible, set `DAYS_BACK` to e.g. `30`.)

One exception: a night shift that started yesterday and ran into this morning
stays on today's calendar, since it's part of today. It disappears tomorrow.

The roster is only accurate to **March 2027**, so that's where the feed stops. The year tabs run well past
March 2027, but those later months are a draft pattern rather than a real
roster, and syncing them would put shifts on the phone that nobody has
committed to. `VALID_FROM` and `VALID_TO` in `CONFIG` enforce the limit; the
rolling `DAYS_BACK` / `DAYS_AHEAD` window is applied on top, so the feed shows
whichever range is narrower.

**When the boss publishes further ahead, raise `VALID_TO`** and redeploy
(*Deploy → Manage deployments → edit → New version* — the URL doesn't change,
so the phone needs no changes). Until then the calendar carries an all-day
“Roster feed ends here” marker on 31 March 2027, so an empty April reads as
*not published yet* rather than *the sync is broken*. Running `preview` also
warns once fewer than 60 days of roster remain.

## Setup (about 10 minutes, once)

You need view access to the roster spreadsheet — no edit rights required, and
nothing about the boss's sheet changes.

1. Go to [script.google.com](https://script.google.com) → **New project**.
2. Delete the sample code, paste in all of `roster-ics.gs`, and save.
3. **Project Settings** (gear icon, left) → set the time zone to
   **Australia/Perth**. This matters: shift times are built in the project's
   time zone.
4. Check `CONFIG` at the top of the file. `SPREADSHEET_ID` is already set to
   the roster's ID and `PERSON` to `Elaine` — the name must match column A of
   the grid exactly.
5. In the editor, pick the `preview` function and press **Run**. Google will
   ask for permission to read your spreadsheets — approve it (it's your own
   script; the "unverified app" warning is normal, use *Advanced → Go to
   project*).
6. Read the log it prints: how many shifts it found, the next 20, and any
   unmapped colours. This is the moment to check a week you know by heart.
7. **Deploy → New deployment → Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
   - Deploy, then copy the web app URL (ends in `/exec`).

   "Anyone" means anyone holding that unguessable URL can read the feed — it's
   the standard setup for calendar subscriptions, but treat the URL like a
   password and don't post it anywhere public.

Open the URL in a browser once: it should download a `.ics` file. Add
`?debug=1` to the end to see the readable summary instead.

## Subscribe on the iPhone

Settings → **Apps** → **Calendar** → **Calendar Accounts** → **Add Account** →
**Other** → **Add Subscribed Calendar** → paste the URL → **Next** → **Save**.

(On older iOS: Settings → Calendar → Accounts → Add Account → Other.)

Then set how often it refreshes: Settings → Apps → Calendar → Calendar
Accounts → **Fetch New Data** → pick the subscribed calendar → **Every hour**.
Hourly is the most frequent iOS offers for subscribed calendars.

On a Mac the same URL works: Calendar → File → New Calendar Subscription.

A subscribed calendar is read-only on the phone — edits belong in the
spreadsheet, which is what keeps the two in step. To stop, delete the
subscribed calendar; to change what's synced, edit `CONFIG` and redeploy
(**Deploy → Manage deployments → edit → New version**, which keeps the same
URL, so the phone needs no changes).

## If your workplace blocks "Anyone" web apps

Some Google Workspace accounts don't allow anonymous access to a web app. In
that case publish to a Drive file instead:

1. Run `publishToDrive` once from the editor. It logs a URL like
   `https://drive.google.com/uc?export=download&id=…`.
2. Run `installHourlyRefresh` once. The file is then rewritten every hour.
3. Subscribe to that URL on the phone, exactly as above.

## Options in `CONFIG`

| Setting | Default | Effect |
| --- | --- | --- |
| `PERSON` | `Elaine` | Which row of the grid to read. |
| `TIMEZONE` | `Australia/Perth` | Must match the project time zone. |
| `DAYS_BACK` / `DAYS_AHEAD` | 0 / 400 | Rolling window. `0` back = starts today. |
| `KEEP_OVERNIGHT_INTO_TODAY` | `true` | Keep last night's shift if it ran into this morning. |
| `VALID_FROM` / `VALID_TO` | 2026-01-01 / 2027-03-31 | Hard limits on the trusted span — see below. |
| `SHOW_WINDOW_END_MARKER` | `true` | All-day marker on the last published day. |
| `INCLUDE_LEAVE` | `true` | All-day entries for leave, RDOs, public holidays. |
| `INCLUDE_DAYS_OFF` | `false` | All-day entries for ordinary `DOD` days off too. |
| `TITLE_PREFIX` | `Work: ` | Prefix on shift titles. |

## The offline converter

For a one-off import with no setup — a snapshot that will *not* follow later
changes to the roster:

```bash
pip install openpyxl
python3 xlsx_to_ics.py Tech_Roster.xlsx --person Elaine --out elaine.ics
```

Like the feed, it runs from today to 31 March 2027 by default. Options:
`--from` / `--to` to change that (a date, `today`, or `''` for no limit),
`--years 2026,2027` to limit which tabs are read, `--no-leave` for shifts only.

## Tests

`tests/run_tests.js` runs the Apps Script under Node with the Google globals
stubbed, against a fixture taken from a real workbook. It covers the time-range
parsing, the window boundaries around a night shift, the Jan 2026 – Mar 2027
limit, and the shape of the generated iCalendar — plus a check that **every
colour in your rows is mapped**, which is how you find out the roster has grown
a shift type the script doesn't know about.

```bash
cd tests
python3 extract_fixture.py ~/Downloads/Tech_Roster.xlsx   # writes fixture.json
TZ=Australia/Perth node run_tests.js
```

The fixture holds real roster data for the whole department, so it's gitignored
— regenerate it locally. Worth re-running after editing `SHIFTS`/`NON_SHIFTS`,
or when the boss publishes a new stretch of roster.
Email the `.ics` to yourself and open it on the phone to import.

## What the script assumes about the sheet

It re-detects the layout on every read, so ordinary edits are fine, but these
are the assumptions:

- Year tabs are named as four digits (`2026`, `2027`). Other tabs are ignored.
- Each month grid starts with a row of day numbers `1, 2, 3 …` in column B
  onwards, with weekday abbreviations in the row directly beneath.
- The month name appears in the few rows above that day-number row.
- Names are in column A, one row per person, below the weekday row.
- Only columns A–AF are read, which keeps the shift-swap and pattern tables
  further right from being mistaken for roster data.

If the boss restructures the grid, run `preview` again — it will show what the
script now thinks the roster says.
