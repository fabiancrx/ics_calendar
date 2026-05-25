// Maps Windows timezone IDs (used by Exchange/Outlook) to IANA names.
// ical.js only understands IANA names; without this mapping it treats times as
// floating (no offset applied), which shifts events by the UTC offset amount.
const WINDOWS_TO_IANA = {
  'AUS Central Standard Time': 'Australia/Darwin',
  'AUS Eastern Standard Time': 'Australia/Sydney',
  'Afghanistan Standard Time': 'Asia/Kabul',
  'Alaskan Standard Time': 'America/Anchorage',
  'Arab Standard Time': 'Asia/Riyadh',
  'Arabian Standard Time': 'Asia/Dubai',
  'Arabic Standard Time': 'Asia/Baghdad',
  'Argentina Standard Time': 'America/Argentina/Buenos_Aires',
  'Atlantic Standard Time': 'America/Halifax',
  'Azerbaijan Standard Time': 'Asia/Baku',
  'Azores Standard Time': 'Atlantic/Azores',
  'Canada Central Standard Time': 'America/Regina',
  'Cape Verde Standard Time': 'Atlantic/Cape_Verde',
  'Caucasus Standard Time': 'Asia/Yerevan',
  'Cen. Australia Standard Time': 'Australia/Adelaide',
  'Central America Standard Time': 'America/Guatemala',
  'Central Asia Standard Time': 'Asia/Almaty',
  'Central Brazilian Standard Time': 'America/Cuiaba',
  'Central Europe Standard Time': 'Europe/Budapest',
  'Central European Standard Time': 'Europe/Warsaw',
  'Central Pacific Standard Time': 'Pacific/Guadalcanal',
  'Central Standard Time': 'America/Chicago',
  'Central Standard Time (Mexico)': 'America/Mexico_City',
  'China Standard Time': 'Asia/Shanghai',
  'Dateline Standard Time': 'Etc/GMT+12',
  'E. Africa Standard Time': 'Africa/Nairobi',
  'E. Australia Standard Time': 'Australia/Brisbane',
  'E. Europe Standard Time': 'Asia/Nicosia',
  'E. South America Standard Time': 'America/Sao_Paulo',
  'Eastern Standard Time': 'America/New_York',
  'Eastern Standard Time (Mexico)': 'America/Cancun',
  'Egypt Standard Time': 'Africa/Cairo',
  'Ekaterinburg Standard Time': 'Asia/Yekaterinburg',
  'FLE Standard Time': 'Europe/Kiev',
  'Fiji Standard Time': 'Pacific/Fiji',
  'GMT Standard Time': 'Europe/London',
  'GTB Standard Time': 'Europe/Bucharest',
  'Georgian Standard Time': 'Asia/Tbilisi',
  'Greenland Standard Time': 'America/Godthab',
  'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'Hawaiian Standard Time': 'Pacific/Honolulu',
  'India Standard Time': 'Asia/Calcutta',
  'Iran Standard Time': 'Asia/Tehran',
  'Israel Standard Time': 'Asia/Jerusalem',
  'Jordan Standard Time': 'Asia/Amman',
  'Kaliningrad Standard Time': 'Europe/Kaliningrad',
  'Korea Standard Time': 'Asia/Seoul',
  'Libya Standard Time': 'Africa/Tripoli',
  'Line Islands Standard Time': 'Pacific/Kiritimati',
  'Magadan Standard Time': 'Asia/Magadan',
  'Mauritius Standard Time': 'Indian/Mauritius',
  'Middle East Standard Time': 'Asia/Beirut',
  'Montevideo Standard Time': 'America/Montevideo',
  'Morocco Standard Time': 'Africa/Casablanca',
  'Mountain Standard Time': 'America/Denver',
  'Mountain Standard Time (Mexico)': 'America/Chihuahua',
  'Myanmar Standard Time': 'Asia/Rangoon',
  'N. Central Asia Standard Time': 'Asia/Novosibirsk',
  'Namibia Standard Time': 'Africa/Windhoek',
  'Nepal Standard Time': 'Asia/Katmandu',
  'New Zealand Standard Time': 'Pacific/Auckland',
  'Newfoundland Standard Time': 'America/St_Johns',
  'North Asia East Standard Time': 'Asia/Irkutsk',
  'North Asia Standard Time': 'Asia/Krasnoyarsk',
  'Pacific SA Standard Time': 'America/Santiago',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Pacific Standard Time (Mexico)': 'America/Santa_Isabel',
  'Pakistan Standard Time': 'Asia/Karachi',
  'Paraguay Standard Time': 'America/Asuncion',
  'Romance Standard Time': 'Europe/Paris',
  'Russia Time Zone 10': 'Asia/Srednekolymsk',
  'Russia Time Zone 11': 'Asia/Kamchatka',
  'Russia Time Zone 3': 'Europe/Samara',
  'Russian Standard Time': 'Europe/Moscow',
  'SA Eastern Standard Time': 'America/Cayenne',
  'SA Pacific Standard Time': 'America/Bogota',
  'SA Western Standard Time': 'America/La_Paz',
  'SE Asia Standard Time': 'Asia/Bangkok',
  'Samoa Standard Time': 'Pacific/Apia',
  'Singapore Standard Time': 'Asia/Singapore',
  'South Africa Standard Time': 'Africa/Johannesburg',
  'Sri Lanka Standard Time': 'Asia/Colombo',
  'Syria Standard Time': 'Asia/Damascus',
  'Taipei Standard Time': 'Asia/Taipei',
  'Tasmania Standard Time': 'Australia/Hobart',
  'Tokyo Standard Time': 'Asia/Tokyo',
  'Tonga Standard Time': 'Pacific/Tongatapu',
  'Turkey Standard Time': 'Europe/Istanbul',
  'US Eastern Standard Time': 'America/Indiana/Indianapolis',
  'US Mountain Standard Time': 'America/Phoenix',
  'UTC': 'UTC',
  'UTC+12': 'Pacific/Fiji',
  'UTC-02': 'America/Noronha',
  'UTC-11': 'Pacific/Pago_Pago',
  'Ulaanbaatar Standard Time': 'Asia/Ulaanbaatar',
  'Venezuela Standard Time': 'America/Caracas',
  'Vladivostok Standard Time': 'Asia/Vladivostok',
  'W. Australia Standard Time': 'Australia/Perth',
  'W. Central Africa Standard Time': 'Africa/Lagos',
  'W. Europe Standard Time': 'Europe/Berlin',
  'West Asia Standard Time': 'Asia/Tashkent',
  'West Pacific Standard Time': 'Pacific/Port_Moresby',
  'Yakutsk Standard Time': 'Asia/Yakutsk',
};

export function normalizeIcsTimezones(text) {
  // When a VTIMEZONE block is present for a Windows TZID, ical.js can resolve
  // it directly by name — renaming to IANA would cause ical.js to prefer its
  // bundled IANA data over the VTIMEZONE block, which can break DST handling
  // for recurring events that cross a DST boundary (e.g. created in winter,
  // displayed in summer). Only rename TZIDs that have no VTIMEZONE block,
  // so ical.js falls back to its built-in IANA timezone data for those.
  const definedTzids = new Set();
  for (const m of text.matchAll(/BEGIN:VTIMEZONE\r?\nTZID:([^\r\n]+)/g)) {
    definedTzids.add(m[1].trim());
  }

  for (const [winName, ianaName] of Object.entries(WINDOWS_TO_IANA)) {
    if (definedTzids.has(winName)) continue;
    text = text.replaceAll(`TZID:${winName}`, `TZID:${ianaName}`);
    text = text.replaceAll(`TZID=${winName}:`, `TZID=${ianaName}:`);
    text = text.replaceAll(`TZID=${winName};`, `TZID=${ianaName};`);
  }
  return text;
}

function isCalendarResponse(upstream, target) {
  const ct = upstream.headers.get('Content-Type') || '';
  return ct.includes('text/calendar') || ct.includes('text/plain') || target.endsWith('.ics');
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');

    if (!target) {
      return new Response('Missing url parameter', { status: 400 });
    }

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return new Response('Invalid URL', { status: 400 });
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return new Response('Only http/https URLs allowed', { status: 400 });
    }

    const upstream = await fetch(target, {
      headers: { 'User-Agent': 'ics-today/1.0' },
      redirect: 'follow',
    });

    const headers = {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    };

    if (isCalendarResponse(upstream, target)) {
      const text = await upstream.text();
      return new Response(normalizeIcsTimezones(text), { status: upstream.status, headers });
    }

    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'text/calendar; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });
  },
};
