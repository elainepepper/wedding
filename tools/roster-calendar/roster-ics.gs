/**
 * Tech Roster -> iOS calendar feed.
 *
 * Reads the live roster spreadsheet, pulls out one person's row from every
 * month grid, and serves it as an iCalendar feed that iOS can subscribe to.
 * Because it reads the sheet on every request, the calendar follows whatever
 * the roster says right now - no re-export when the boss changes a shift.
 *
 * The roster stores the shift *time* in the cell's fill colour (legend at
 * AJ3:AJ9 of a year tab). Cell text is hours worked / notes, so colour is the
 * source of truth and text is only used when it spells out a time range.
 *
 * Setup: see README.md in this folder.
 */

var CONFIG = {
  // From the sheet URL: docs.google.com/spreadsheets/d/<THIS PART>/edit
  SPREADSHEET_ID: '1cR6KaoTluea95X8KY7dMMSW91f7cJKslFqhexkdvack',

  // Must match the name in column A of the roster grid.
  PERSON: 'Elaine',

  TIMEZONE: 'Australia/Perth',

  // How much of the roster to publish, relative to today.
  DAYS_BACK: 30,
  DAYS_AHEAD: 400,

  // All-day entries for annual leave, RDOs and public holidays.
  INCLUDE_LEAVE: true,

  // Plain days off (DOD) as all-day entries. Usually just noise.
  INCLUDE_DAYS_OFF: false,

  // Prefix on every event title, so roster events are easy to spot.
  TITLE_PREFIX: 'Work: ',

  CALENDAR_NAME: 'Work Roster',

  // Filename used by publishToDrive() (the fallback publishing mode).
  DRIVE_FILE_NAME: 'roster.ics'
};

/**
 * Fill colour -> shift, taken from the legend on the year tab.
 * Times are [hour, minute]; an end time at or before the start rolls over to
 * the next morning (night shift).
 */
var SHIFTS = {
  '#95b3d7': { label: '8am - 4pm',          start: [8, 0],   end: [16, 0] },
  '#ffd966': { label: '8.30am - 4.30pm',    start: [8, 30],  end: [16, 30] },
  '#90dcbf': { label: '8am - 5pm',          start: [8, 0],   end: [17, 0] },
  '#00b050': { label: '9am - 5pm',          start: [9, 0],   end: [17, 0] },
  '#ff9900': { label: '2pm - 10pm',         start: [14, 0],  end: [22, 0] },
  '#3366ff': { label: '4pm - midnight',     start: [16, 0],  end: [0, 0] },
  '#7030a0': { label: 'Night 9.30pm - 8am', start: [21, 30], end: [8, 0] },
  '#c65911': { label: '1pm - 9pm',          start: [13, 0],  end: [21, 0] }
};

/** Fill colour -> all-day entry (a non-working day, not a shift). */
var NON_SHIFTS = {
  '#434343': 'Annual leave',
  '#cccccc': 'RDO / day in lieu'
};

/** Cell text -> all-day entry, for days with no meaningful fill colour. */
var TEXT_ENTRIES = {
  'phol': 'Public holiday',
  'phoe': 'Public holiday',
  'a/l': 'Annual leave',
  'al': 'Annual leave',
  'sick': 'Sick leave'
};

var MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
              'august', 'september', 'october', 'november', 'december'];
var WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
var DAY_COLUMNS = 32; // A plus 31 day columns; keeps us clear of side tables

// ---------------------------------------------------------------- web app --

/** Serves the calendar feed. Add ?debug=1 for a readable summary instead. */
function doGet(e) {
  var debug = e && e.parameter && e.parameter.debug;
  var events = buildEvents();
  if (debug) {
    return ContentService
        .createTextOutput(debugReport(events))
        .setMimeType(ContentService.MimeType.TEXT);
  }
  return ContentService
      .createTextOutput(toIcs(events))
      .setMimeType(ContentService.MimeType.ICAL);
}

// ------------------------------------------------------------ sheet -> data --

/** Reads every year tab and returns this person's roster days in the window. */
function readRoster() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var today = new Date();
  var from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - CONFIG.DAYS_BACK);
  var to = new Date(today.getFullYear(), today.getMonth(), today.getDate() + CONFIG.DAYS_AHEAD);

  var days = [];
  ss.getSheets().forEach(function (sheet) {
    var name = sheet.getName().trim();
    if (!/^\d{4}$/.test(name)) return;
    var year = Number(name);
    if (year < from.getFullYear() || year > to.getFullYear()) return;
    readYearTab(sheet, year).forEach(function (day) {
      if (day.date >= from && day.date <= to) days.push(day);
    });
  });

  days.sort(function (a, b) { return a.date - b.date; });
  return days;
}

function readYearTab(sheet, year) {
  var rows = Math.min(sheet.getLastRow(), sheet.getMaxRows());
  var cols = Math.min(DAY_COLUMNS, sheet.getMaxColumns());
  if (rows < 3) return [];

  var range = sheet.getRange(1, 1, rows, cols);
  var values = range.getValues();
  var display = range.getDisplayValues();
  var colours = range.getBackgrounds();

  var out = [];
  var blocks = findBlocks(values);
  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    var nextRow = (i + 1 < blocks.length) ? blocks[i + 1].row : values.length;
    var personRow = findPersonRow(values, block.row + 2, nextRow);
    if (personRow < 0) continue;

    for (var c = 1; c < cols; c++) {
      var day = values[block.row][c];
      if (typeof day !== 'number' || day < 1 || day > 31) continue;

      var colour = normaliseColour(colours[personRow][c]);
      var isDate = Object.prototype.toString.call(values[personRow][c]) === '[object Date]';
      var text = isDate ? '' : String(display[personRow][c] || '').trim();
      if (!colour && (text === '' || text.toUpperCase() === 'DOD')) continue;

      var date = new Date(year + block.yearOffset, block.month, day);
      if (date.getDate() !== day) continue; // e.g. 31 in a 30-day month
      out.push({ date: date, colour: colour, text: text });
    }
  }
  return out;
}

/**
 * Finds each month grid: a row of day numbers starting with 1, with weekday
 * names directly underneath. Returns 0-based row indexes and 0-based months.
 */
function findBlocks(values) {
  var blocks = [];
  var prevMonth = -1;
  var prevRow = -1;
  var yearOffset = 0;

  for (var r = 0; r + 1 < values.length; r++) {
    if (values[r][1] !== 1 || values[r][2] !== 2) continue;
    // Must be a real weekday string: a date cell stringifies to "Thu Jan 09 ..."
    // and would otherwise look like one.
    if (typeof values[r + 1][1] !== 'string') continue;
    var below = values[r + 1][1].trim().toLowerCase().slice(0, 3);
    if (WEEKDAYS.indexOf(below) < 0) continue;

    var month = -1;
    for (var rr = Math.max(prevRow + 1, r - 4); rr < r; rr++) {
      for (var cc = 0; cc < values[rr].length; cc++) {
        var v = values[rr][cc];
        if (typeof v !== 'string') continue;
        var idx = MONTHS.indexOf(v.trim().toLowerCase());
        if (idx >= 0) month = idx;
      }
    }
    if (month < 0) month = (prevMonth >= 0) ? (prevMonth + 1) % 12 : 0;
    if (prevMonth >= 0 && month < prevMonth) yearOffset++;

    blocks.push({ row: r, month: month, yearOffset: yearOffset });
    prevMonth = month;
    prevRow = r;
  }
  return blocks;
}

function findPersonRow(values, fromRow, toRow) {
  var wanted = CONFIG.PERSON.trim().toLowerCase();
  for (var r = fromRow; r < toRow && r < values.length; r++) {
    var v = values[r][0];
    if (typeof v === 'string' && v.trim().toLowerCase() === wanted) return r;
  }
  return -1;
}

function normaliseColour(colour) {
  var c = String(colour || '').trim().toLowerCase();
  if (c === '' || c === '#ffffff' || c === 'white' || c === 'none') return '';
  return c;
}

// ------------------------------------------------------------ data -> events --

function buildEvents() {
  return readRoster().map(toEvent).filter(function (e) { return e; });
}

function toEvent(day) {
  var note = /^-?\d+(\.\d+)?$/.test(day.text) ? '' : day.text; // bare numbers are hours
  var explicit = day.text ? parseTimeRange(day.text) : null;
  var shift = SHIFTS[day.colour];

  if (explicit || shift) {
    var label = explicit ? day.text : shift.label;
    var startAt = explicit ? explicit.start : shift.start;
    var endAt = explicit ? explicit.end : shift.end;
    var start = at(day.date, startAt[0], startAt[1]);
    var end = at(day.date, endAt[0], endAt[1]);
    if (end <= start) end = new Date(end.getTime() + 24 * 3600 * 1000);
    return {
      allDay: false,
      date: day.date,
      start: start,
      end: end,
      summary: CONFIG.TITLE_PREFIX + label,
      note: (note === label) ? '' : note
    };
  }

  if (NON_SHIFTS[day.colour]) {
    if (!CONFIG.INCLUDE_LEAVE) return null;
    return allDay(day, NON_SHIFTS[day.colour], note);
  }

  var keyed = TEXT_ENTRIES[day.text.toLowerCase()];
  if (keyed) {
    if (!CONFIG.INCLUDE_LEAVE) return null;
    return allDay(day, keyed, note);
  }

  if (day.text.toUpperCase() === 'DOD') {
    if (!CONFIG.INCLUDE_DAYS_OFF) return null;
    return allDay(day, 'Day off', note);
  }

  if (day.colour) {
    // A colour with no mapping - surface it rather than silently dropping it.
    return allDay(day, 'Rostered - check the sheet',
                  (note + ' (colour ' + day.colour + ')').trim());
  }
  return null;
}

function allDay(day, summary, note) {
  return { allDay: true, date: day.date, summary: summary, note: note || '' };
}

function at(date, hour, minute) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0);
}

/** Parses hand-typed ranges like "8-5", "2-10", "9.30-2", "12.30-9.30". */
function parseTimeRange(text) {
  var m = /^\s*(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm)?\s*-\s*(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm)?\s*$/i.exec(text);
  if (!m) return null;
  var sh = Number(m[1]), sm = Number(m[2] || 0), sap = m[3];
  var eh = Number(m[4]), em = Number(m[5] || 0), eap = m[6];
  if (sh > 24 || eh > 24) return null;

  if (sap) sh = (sh % 12) + (sap.toLowerCase() === 'pm' ? 12 : 0);
  else if (sh < 6) sh += 12; // shifts start 6am at the earliest

  if (eap) eh = (eh % 12) + (eap.toLowerCase() === 'pm' ? 12 : 0);
  else if (eh * 60 + em <= sh * 60 + sm && eh < 12) eh += 12;

  return { start: [sh % 24, sm], end: [eh % 24, em] };
}

// ----------------------------------------------------------- events -> ICS --

function toIcs(events) {
  var stamp = utc(new Date());
  var lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//roster-calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:' + CONFIG.PERSON + ' - ' + CONFIG.CALENDAR_NAME,
    'X-WR-TIMEZONE:' + CONFIG.TIMEZONE,
    'REFRESH-INTERVAL;VALUE=DURATION:PT4H',
    'X-PUBLISHED-TTL:PT4H'
  ];

  events.forEach(function (ev) {
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + ymd(ev.date) + '-' + slug(CONFIG.PERSON) + '@roster');
    lines.push('DTSTAMP:' + stamp);
    if (ev.allDay) {
      var next = new Date(ev.date.getTime() + 24 * 3600 * 1000);
      lines.push('DTSTART;VALUE=DATE:' + ymd(ev.date));
      lines.push('DTEND;VALUE=DATE:' + ymd(next));
      lines.push('TRANSP:TRANSPARENT');
    } else {
      // Written in UTC, so the feed stays correct across daylight-saving changes.
      lines.push('DTSTART:' + utc(ev.start));
      lines.push('DTEND:' + utc(ev.end));
      lines.push('TRANSP:OPAQUE');
    }
    lines.push(fold('SUMMARY:' + escapeText(ev.summary)));
    if (ev.note) lines.push(fold('DESCRIPTION:' + escapeText('Roster note: ' + ev.note)));
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

function utc(date) {
  return Utilities.formatDate(date, 'UTC', "yyyyMMdd'T'HHmmss'Z'");
}

function ymd(date) {
  return Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyyMMdd');
}

function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function escapeText(text) {
  return String(text)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
}

/** iCalendar lines are folded at 75 octets. */
function fold(line) {
  if (line.length <= 73) return line;
  var parts = [line.slice(0, 73)];
  var rest = line.slice(73);
  while (rest.length > 72) {
    parts.push(rest.slice(0, 72));
    rest = rest.slice(72);
  }
  parts.push(rest);
  return parts.join('\r\n ');
}

// ------------------------------------------------------------- fallback mode --

/**
 * Writes the feed to a Drive file instead of serving it from a web app, for
 * accounts where "Anyone" web-app access is blocked. Run it once, share the
 * file as "anyone with the link", then subscribe to
 *   https://drive.google.com/uc?export=download&id=<FILE ID>
 * Pair it with installHourlyRefresh() so the file keeps up with the roster.
 */
function publishToDrive() {
  var ics = toIcs(buildEvents());
  var existing = DriveApp.getFilesByName(CONFIG.DRIVE_FILE_NAME);
  var file;
  if (existing.hasNext()) {
    file = existing.next();
    file.setContent(ics);
  } else {
    file = DriveApp.createFile(CONFIG.DRIVE_FILE_NAME, ics, 'text/calendar');
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
  var url = 'https://drive.google.com/uc?export=download&id=' + file.getId();
  Logger.log('Subscribe to: ' + url);
  return url;
}

/** Installs an hourly trigger for publishToDrive(). Safe to run twice. */
function installHourlyRefresh() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'publishToDrive') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('publishToDrive').timeBased().everyHours(1).create();
  Logger.log('Hourly refresh installed.');
}

// ------------------------------------------------------------- diagnostics --

/** Run this from the editor to check the parse before subscribing. */
function preview() {
  Logger.log(debugReport(buildEvents()));
}

function debugReport(events) {
  var lines = [];
  lines.push('Person: ' + CONFIG.PERSON);
  lines.push('Timezone (config): ' + CONFIG.TIMEZONE);
  lines.push('Timezone (script project): ' + Session.getScriptTimeZone());
  if (Session.getScriptTimeZone() !== CONFIG.TIMEZONE) {
    lines.push('WARNING: set the project timezone to ' + CONFIG.TIMEZONE +
               ' under Project Settings, or shift times will be wrong.');
  }
  lines.push('Events: ' + events.length);

  var counts = {};
  events.forEach(function (e) { counts[e.summary] = (counts[e.summary] || 0) + 1; });
  lines.push('');
  lines.push('By type:');
  Object.keys(counts).sort().forEach(function (k) { lines.push('  ' + counts[k] + '  ' + k); });

  lines.push('');
  lines.push('Next 20:');
  var now = new Date();
  events.filter(function (e) { return e.date >= new Date(now.getFullYear(), now.getMonth(), now.getDate()); })
        .slice(0, 20)
        .forEach(function (e) {
          var when = e.allDay
              ? Utilities.formatDate(e.date, CONFIG.TIMEZONE, 'EEE dd MMM') + '  (all day)'
              : Utilities.formatDate(e.start, CONFIG.TIMEZONE, 'EEE dd MMM HH:mm') + ' - ' +
                Utilities.formatDate(e.end, CONFIG.TIMEZONE, 'HH:mm');
          lines.push('  ' + when + '  ' + e.summary + (e.note ? '  [' + e.note + ']' : ''));
        });

  var unknown = {};
  readRoster().forEach(function (d) {
    if (d.colour && !SHIFTS[d.colour] && !NON_SHIFTS[d.colour] &&
        !TEXT_ENTRIES[d.text.toLowerCase()] && !parseTimeRange(d.text)) {
      unknown[d.colour] = (unknown[d.colour] || 0) + 1;
    }
  });
  var keys = Object.keys(unknown);
  lines.push('');
  lines.push(keys.length ? 'Unmapped colours (add them to SHIFTS or NON_SHIFTS):' : 'No unmapped colours.');
  keys.forEach(function (k) { lines.push('  ' + k + '  x' + unknown[k]); });

  return lines.join('\n');
}
