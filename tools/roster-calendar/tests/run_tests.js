/**
 * Runs roster-ics.gs under Node against a fixture taken from a real workbook,
 * with the Apps Script globals stubbed out. Checks the parse and the window
 * boundaries, including what happens around a night shift.
 *
 *   python3 extract_fixture.py ../../../Tech_Roster.xlsx   # writes fixture.json
 *   TZ=Australia/Perth node run_tests.js
 *
 * The fixture holds real roster data, so it is gitignored - regenerate it
 * locally from your own copy of the workbook.
 */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const FIXTURE = path.join(__dirname, 'fixture.json');
if (!fs.existsSync(FIXTURE)) {
  console.error('fixture.json missing - run: python3 extract_fixture.py <workbook.xlsx>');
  process.exit(2);
}

const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'), (k, v) =>
  (v && typeof v === 'object' && v.__date) ? new Date(v.__date) : v);

// --- Apps Script stubs ------------------------------------------------------

function makeRange(sheet, r0, c0, nr, nc) {
  const cut = (grid) => grid.slice(r0 - 1, r0 - 1 + nr).map(row => row.slice(c0 - 1, c0 - 1 + nc));
  return {
    getValues: () => cut(sheet.values),
    getDisplayValues: () => cut(sheet.display),
    getBackgrounds: () => cut(sheet.backgrounds),
  };
}

const SpreadsheetApp = {
  openById: () => ({
    getSheets: () => Object.keys(fixture).map(name => {
      const s = fixture[name];
      return {
        getName: () => name,
        getLastRow: () => s.values.length,
        getMaxRows: () => s.values.length,
        getMaxColumns: () => s.values[0].length,
        getRange: (r, c, nr, nc) => makeRange(s, r, c, nr, nc),
      };
    }),
  }),
};

const Utilities = {
  formatDate(date, tz, pattern) {
    const zone = tz === 'UTC' ? 'UTC' : tz;
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hour12: false,
    }).formatToParts(date).map(p => [p.type, p.value]));
    const monthName = new Intl.DateTimeFormat('en-GB', { timeZone: zone, month: 'short' }).format(date);
    return pattern
      .replace("yyyyMMdd'T'HHmmss'Z'", `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}Z`)
      .replace('yyyyMMdd', `${parts.year}${parts.month}${parts.day}`)
      .replace('yyyy-MM-dd', `${parts.year}-${parts.month}-${parts.day}`)
      .replace('EEE dd MMM HH:mm', `${parts.weekday} ${parts.day} ${monthName} ${parts.hour}:${parts.minute}`)
      .replace('EEE dd MMM', `${parts.weekday} ${parts.day} ${monthName}`)
      .replace('HH:mm', `${parts.hour}:${parts.minute}`);
  },
};

const ctx = vm.createContext({
  SpreadsheetApp,
  Utilities,
  Session: { getScriptTimeZone: () => 'Australia/Perth' },
  Logger: { log: (m) => console.log(m) },
  ContentService: { MimeType: { ICAL: 'ical', TEXT: 'text' }, createTextOutput: (t) => ({ setMimeType: () => t }) },
  DriveApp: {},
  ScriptApp: {},
  console, Date, Math, Object, String, Number, RegExp, JSON, Array,
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'roster-ics.gs'), 'utf8'), ctx);

// --- helpers ---------------------------------------------------------------

const RealDate = Date;
function freezeNow(iso) {
  ctx.Date = class extends RealDate {
    constructor(...a) { if (a.length === 0) super(iso); else super(...a); }
    static now() { return new RealDate(iso).getTime(); }
  };
}

const uidOf = (e) => (e.marker ? 'window-end-' : '') + ctx.ymd(e.date) + '-' +
                     ctx.CONFIG.PERSON.toLowerCase() + '@roster';

let failures = 0;
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
}

// --- tests -----------------------------------------------------------------

// Time ranges typed into cells override the fill colour.
check('parse "8-5"', ctx.parseTimeRange('8-5'), { start: [8, 0], end: [17, 0] });
check('parse "2-10"', ctx.parseTimeRange('2-10'), { start: [14, 0], end: [22, 0] });
check('parse "9.30-2"', ctx.parseTimeRange('9.30-2'), { start: [9, 30], end: [14, 0] });
check('parse "12.30-9.30"', ctx.parseTimeRange('12.30-9.30'), { start: [12, 30], end: [21, 30] });
check('parse "DOD" is not a range', ctx.parseTimeRange('DOD'), null);

// Every colour in the person's rows should be mapped; an unmapped one means
// the roster grew a shift type the script does not know about.
freezeNow('2026-01-01T09:00:00+08:00');
const unmapped = {};
ctx.readRoster().forEach((d) => {
  if (d.colour && !ctx.SHIFTS[d.colour] && !ctx.NON_SHIFTS[d.colour] &&
      !ctx.TEXT_ENTRIES[d.text.toLowerCase()] && !ctx.parseTimeRange(d.text)) {
    unmapped[d.colour] = (unmapped[d.colour] || 0) + 1;
  }
});
check('no unmapped colours', unmapped, {});

// Nothing before today, and a night shift belongs to both days it touches.
// In the fixture, 16 Aug 2026 is a night (21:30 -> 08:00) and 24-25 Aug are days.
[
  ['2026-08-17T06:00:00+08:00', '20260816', true, 'night still running'],
  ['2026-08-17T10:00:00+08:00', '20260816', true, 'night ended this morning'],
  ['2026-08-18T09:00:00+08:00', '20260816', false, 'night was two days ago'],
  ['2026-08-25T09:00:00+08:00', '20260824', false, "yesterday's day shift dropped"],
  ['2026-08-25T09:00:00+08:00', '20260825', true, "today's day shift kept"],
].forEach(([iso, day, want, label]) => {
  freezeNow(iso);
  const uid = day + '-' + ctx.CONFIG.PERSON.toLowerCase() + '@roster';
  check(label, ctx.buildEvents().some((e) => uidOf(e) === uid), want);
});

// The feed stops where the roster stops being accurate.
freezeNow('2026-08-25T09:00:00+08:00');
const events = ctx.buildEvents();
const days = events.map((e) => ctx.ymd(e.date)).sort();
check('starts no earlier than today', days[0] >= '20260825', true);
check('ends at VALID_TO', days[days.length - 1] <= ctx.CONFIG.VALID_TO.replace(/-/g, ''), true);
check('has an end-of-roster marker', events.some((e) => e.marker), true);

// The feed itself should be well-formed.
const ics = ctx.toIcs(events);
check('VEVENT count matches', (ics.match(/BEGIN:VEVENT/g) || []).length, events.length);
check('calendar is closed', /END:VCALENDAR\r\n$/.test(ics), true);
check('CRLF line endings', !/[^\r]\n/.test(ics), true);
check('no line over 75 octets', ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75), true);
check('unique UIDs', new Set(events.map(uidOf)).size, events.length);

console.log(failures ? `\n${failures} test(s) FAILED` : '\nall tests passed');
process.exit(failures ? 1 : 0);
