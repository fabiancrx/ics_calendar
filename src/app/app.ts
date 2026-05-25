import { Component, effect, inject, signal, ViewChild } from '@angular/core';
import { LoggerService } from './logger.service';
import { FullCalendarModule, FullCalendarComponent } from '@fullcalendar/angular';
import { CalendarOptions, EventInput, EventSourceFuncArg } from '@fullcalendar/core';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import * as ICAL from 'ical.js';
import { environment } from '../environments/environment';

const STORAGE_KEY_URL = 'ics_url';
const STORAGE_KEY_VIEW = 'ics_view';

function restoreFromStorage(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.has('url')) return;
  if (environment.defaultUrl) {
    params.set('url', environment.defaultUrl);
    window.location.replace(`${window.location.pathname}?${params.toString()}`);
    return;
  }
  const savedUrl = localStorage.getItem(STORAGE_KEY_URL);
  if (!savedUrl) return;
  params.set('url', savedUrl);
  const savedView = localStorage.getItem(STORAGE_KEY_VIEW);
  if (savedView) params.set('view', savedView);
  console.info('[ICS Today] Restoring from storage:', savedUrl);
  window.location.replace(`${window.location.pathname}?${params.toString()}`);
}

restoreFromStorage();

function isMobileScreen(): boolean {
  return window.innerWidth < 640;
}

const MOBILE_TOOLBAR = {
  left: 'prev,next today',
  center: 'title',
  right: 'timeGridDay,listWeek,dayGridMonth',
};
const DESKTOP_TOOLBAR = {
  left: 'prev,next today',
  center: 'title',
  right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
};

function parseIcsUrl(): string | null {
  const raw = new URLSearchParams(window.location.search).get('url');
  if (!raw) return null;
  try {
    new URL(raw);
    return raw;
  } catch {
    return null;
  }
}

const VIEW_MAP: Record<string, string> = {
  month: 'dayGridMonth',
  week: 'timeGridWeek',
  day: 'timeGridDay',
  list: 'listWeek',
};

const VIEW_KEY_MAP: Record<string, string> = {
  dayGridMonth: 'month',
  timeGridWeek: 'week',
  timeGridDay: 'day',
  listWeek: 'list',
};

function parseView(): string {
  const raw = new URLSearchParams(window.location.search).get('view') ?? '';
  return VIEW_MAP[raw] ?? 'timeGridDay';
}

function currentScrollTime(): string {
  const h = Math.max(0, new Date().getHours() - 1);
  return `${String(h).padStart(2, '0')}:00:00`;
}

// Builds a FullCalendar function-based event source that fetches and parses an
// ICS feed using ical.js directly.  The key difference from @fullcalendar/icalendar's
// built-in IcalExpander is using toJSDate() instead of toString() for every
// occurrence: toString() returns the local time in the event's source timezone
// with no UTC offset, which FullCalendar misreads as the viewer's local time.
// toJSDate() returns a proper UTC-based Date that FullCalendar renders correctly
// regardless of the viewer's timezone.
function buildIcsEventSource(url: string) {
  let calendarPromise: Promise<ICAL.Component> | null = null;

  function getCalendar(): Promise<ICAL.Component> {
    if (!calendarPromise) {
      calendarPromise = fetch(url)
        .then(r => r.text())
        .then(text => {
          const cal = new ICAL.Component(ICAL.parse(text));
          for (const vtz of cal.getAllSubcomponents('vtimezone')) {
            ICAL.TimezoneService.register(vtz);
          }
          return cal;
        })
        .catch(err => { calendarPromise = null; throw err; });
    }
    return calendarPromise;
  }

  return (
    fetchInfo: EventSourceFuncArg,
    success: (events: EventInput[]) => void,
    failure: (err: Error) => void,
  ) => {
    getCalendar()
      .then(cal => success(expandIcsEvents(cal, fetchInfo.start, fetchInfo.end)))
      .catch(failure);
  };
}

function expandIcsEvents(cal: ICAL.Component, rangeStart: Date, rangeEnd: Date): EventInput[] {
  const all = cal.getAllSubcomponents('vevent').map(v => new ICAL.Event(v));
  const exceptions = all.filter(e => e.isRecurrenceException());
  const mains = all.filter(e => !e.isRecurrenceException());

  // Mirror IcalExpander: expand the range by 1 day each side.
  const start = new Date(rangeStart);
  start.setDate(start.getDate() - 1);
  const end = new Date(rangeEnd);
  end.setDate(end.getDate() + 1);

  const results: EventInput[] = [];

  for (const event of mains) {
    const exdates = new Set<number>();
    for (const p of event.component.getAllProperties('exdate')) {
      exdates.add((p.getFirstValue() as ICAL.Time).toJSDate().getTime());
    }

    if (event.isRecurring()) {
      const iter = event.iterator();
      let next: ICAL.Time | null;
      let i = 0;
      while ((next = iter.next()) && i++ < 1000) {
        const occ = event.getOccurrenceDetails(next);
        const occStart = occ.startDate.toJSDate();
        const occEnd = occ.endDate.toJSDate();
        if (occStart > end) break;
        if (occEnd < start || exdates.has(occStart.getTime())) continue;
        const ex = exceptions.find(
          x => x.uid === event.uid &&
               x.recurrenceId.toJSDate().getTime() === occStart.getTime(),
        );
        results.push(toEventInput(
          ex ?? event,
          ex ? ex.startDate.toJSDate() : occStart,
          ex ? ex.endDate.toJSDate() : occEnd,
        ));
      }
    } else {
      const s = event.startDate.toJSDate();
      const e = event.endDate.toJSDate();
      if (s <= end && e >= start) results.push(toEventInput(event, s, e));
    }
  }

  return results;
}

function toEventInput(event: ICAL.Event, start: Date, end: Date): EventInput {
  const urlProp = event.component.getFirstProperty('url');
  return {
    title: event.summary,
    start,
    end,
    allDay: event.startDate.isDate,
    url: urlProp ? String(urlProp.getFirstValue()) : '',
    extendedProps: {
      location: event.location,
      description: event.description,
    },
  };
}

export interface EventDetail {
  title: string;
  start: Date | null;
  end: Date | null;
  allDay: boolean;
  location?: string;
  description?: string;
  url?: string;
}

@Component({
  selector: 'app-root',
  imports: [FullCalendarModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  @ViewChild('calendar') calendarEl!: FullCalendarComponent;

  private readonly log = inject(LoggerService);

  constructor() {
    effect(() => {
      document.body.classList.toggle('modal-open', !!this.selectedEvent());
    });
  }

  readonly icsUrl = parseIcsUrl() ?? (environment.defaultUrl || null);
  readonly fetchFailed = signal(false);
  readonly selectedEvent = signal<EventDetail | null>(null);
  readonly urlDraft = signal(
    new URLSearchParams(window.location.search).get('url') ?? environment.defaultUrl ?? ''
  );
  readonly urlError = signal(false);

  get icsUrlHost(): string {
    if (!this.icsUrl) return '';
    try { return new URL(this.icsUrl).hostname; } catch { return ''; }
  }

  loadUrl(): void {
    const val = this.urlDraft().trim();
    if (!val) return;
    try {
      new URL(val);
      this.log.info('Loading calendar URL:', val);
      localStorage.setItem(STORAGE_KEY_URL, val);
      const params = new URLSearchParams(window.location.search);
      params.set('url', val);
      window.location.href = `${window.location.pathname}?${params.toString()}`;
    } catch {
      this.urlError.set(true);
    }
  }

  readonly calendarOptions: CalendarOptions = {
    plugins: [timeGridPlugin, dayGridPlugin, listPlugin],
    initialView: parseView(),
    scrollTime: currentScrollTime(),
    navLinks: true,
    navLinkDayClick: (date: Date) => {
      this.calendarEl.getApi().changeView('timeGridDay', date);
    },
    nowIndicator: true,
    dayMaxEvents: true,
    noEventsContent: 'No events this period',
    headerToolbar: isMobileScreen() ? MOBILE_TOOLBAR : DESKTOP_TOOLBAR,
    buttonText: {
      today: 'Today',
      month: 'Month',
      week: 'Week',
      day: 'Day',
      listWeek: 'List',
    },
    viewDidMount: (info) => {
      const key = VIEW_KEY_MAP[info.view.type];
      if (!key) return;
      const params = new URLSearchParams(window.location.search);
      params.set('view', key);
      window.history.replaceState(null, '', `?${params.toString()}`);
      localStorage.setItem(STORAGE_KEY_VIEW, key);
      this.log.debug('View changed:', key);
    },
    windowResize: () => {
      this.calendarEl.getApi().setOption(
        'headerToolbar',
        window.innerWidth < 640 ? MOBILE_TOOLBAR : DESKTOP_TOOLBAR
      );
    },
    eventClick: (info) => {
      info.jsEvent.preventDefault();
      this.log.debug('Event opened:', info.event.title);
      this.selectedEvent.set({
        title: info.event.title,
        start: info.event.start,
        end: info.event.end,
        allDay: info.event.allDay,
        location: info.event.extendedProps['location'],
        description: info.event.extendedProps['description'],
        url: info.event.url || undefined,
      });
    },
    events: this.icsUrl
      ? buildIcsEventSource(
          environment.proxyUrl
            ? `${environment.proxyUrl}/?url=${encodeURIComponent(this.icsUrl)}`
            : this.icsUrl,
        )
      : [],
    height: 'auto',
    eventSourceFailure: () => {
      this.log.error('Failed to fetch calendar:', this.icsUrl);
      this.fetchFailed.set(true);
    },
  };

  formatEventTime(ev: EventDetail): string {
    if (!ev.start) return '';
    if (ev.allDay) {
      const label = ev.start.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
      return ev.end && ev.end.getTime() - ev.start.getTime() > 86_400_000
        ? `${label} – ${new Date(ev.end.getTime() - 1).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}`
        : label;
    }
    const fmtDate = (d: Date) =>
      d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    const fmtTime = (d: Date) =>
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (!ev.end || ev.start.toDateString() === ev.end.toDateString()) {
      return `${fmtDate(ev.start)}, ${fmtTime(ev.start)}${ev.end ? ` – ${fmtTime(ev.end)}` : ''}`;
    }
    return `${fmtDate(ev.start)}, ${fmtTime(ev.start)} – ${fmtDate(ev.end)}, ${fmtTime(ev.end)}`;
  }
}
