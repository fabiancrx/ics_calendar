/**
 * Corroborates the timezone display bug:
 *
 * @fullcalendar/icalendar's IcalExpander calls ICAL.Time.toString() to produce
 * the start/end strings it hands to FullCalendar.  toString() returns the time
 * in the *event's source timezone* with no UTC offset, e.g. "2026-05-25T09:05:00".
 * FullCalendar treats a bare ISO string as the user's local time, so an Eastern
 * user sees 09:05 EDT instead of the correct 11:05 EDT (09:05 MDT = 15:05 UTC).
 *
 * The fix: the worker must output UTC-format datetimes (with Z suffix) so that
 * toString() returns a Z-anchored string that FullCalendar parses correctly.
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ICAL from 'ical.js';
import { normalizeIcsTimezones } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICS_PATH = join(__dirname, '../dev-assets/calendar.ics');

// Finds the May 25 2026 occurrence of the weekly Mountain Standard Time event
// and returns it as an ICAL.Time so tests can call toString() or toJSDate().
function getMay25MountainOccurrence(icsText) {
  const jCalData = ICAL.parse(icsText);
  const component = new ICAL.Component(jCalData);
  for (const vtz of component.getAllSubcomponents('vtimezone')) {
    ICAL.TimezoneService.register(vtz);
  }
  const events = component.getAllSubcomponents('vevent').map(v => new ICAL.Event(v));

  const target = events.find(ev => {
    if (!ev.isRecurring()) return false;
    const tz = ev.startDate?.timezone;
    return (tz === 'Mountain Standard Time' || tz === 'America/Denver')
      && ev.startDate?.hour === 9
      && ev.startDate?.minute === 5;
  });
  if (!target) return null;

  const may25 = new Date('2026-05-25T00:00:00Z').getTime();
  const may26 = new Date('2026-05-26T00:00:00Z').getTime();
  const iter = target.iterator();
  let next;
  while ((next = iter.next())) {
    const t = next.toJSDate().getTime();
    if (t >= may26) break;
    if (t >= may25) return next;
  }
  return null;
}

describe('worker timezone normalisation', () => {
  test('normalizeIcsTimezones preserves VTIMEZONE TZIDs that have a matching VTIMEZONE block', () => {
    const raw = readFileSync(ICS_PATH, 'utf8');
    const out = normalizeIcsTimezones(raw);
    // When a VTIMEZONE block is present, the Windows name must be left unchanged
    // so ical.js finds it by the same key used in DTSTART.
    expect(out).toContain('TZID:Mountain Standard Time');
    expect(out).toContain('TZID=Mountain Standard Time:');
    expect(out).not.toContain('America/Denver');
  });

  test('normalizeIcsTimezones still renames orphan Windows TZIDs (no VTIMEZONE block)', () => {
    const orphan = 'DTSTART;TZID=Central Standard Time:20260525T090000';
    const out = normalizeIcsTimezones(orphan);
    expect(out).toContain('America/Chicago');
  });

  // Corroborates the bug in @fullcalendar/icalendar's IcalExpander:
  // it calls toString() on each occurrence, which returns the local time in the
  // event's source timezone with no UTC offset — "2026-05-25T09:05:00".
  // FullCalendar parses that bare string as the viewer's local time, so an
  // Eastern user sees 09:05 EDT instead of the correct 11:05 EDT.
  test('toString() on May 25 Mountain occurrence returns bare local time (the IcalExpander bug)', () => {
    const raw = readFileSync(ICS_PATH, 'utf8');
    const occ = getMay25MountainOccurrence(normalizeIcsTimezones(raw));
    expect(occ).not.toBeNull();
    // This is what the old IcalExpander handed to FullCalendar — wrong for
    // viewers not in Mountain time because it carries no UTC offset information.
    expect(occ.toString()).toBe('2026-05-25T09:05:00');
  });

  // Validates the fix: using toJSDate() instead of toString() gives a proper
  // UTC-based Date (09:05 MDT = 15:05 UTC).  The app's custom event source
  // passes this Date object directly to FullCalendar, which then renders it
  // correctly in whatever timezone the viewer's browser is set to.
  test('toJSDate() on May 25 Mountain occurrence returns correct UTC time (the fix)', () => {
    const raw = readFileSync(ICS_PATH, 'utf8');
    const occ = getMay25MountainOccurrence(normalizeIcsTimezones(raw));
    expect(occ).not.toBeNull();
    // 09:05 MDT (UTC-6) = 15:05 UTC → Eastern user sees 11:05 EDT ✓
    expect(occ.toJSDate().toISOString()).toBe('2026-05-25T15:05:00.000Z');
  });
});
