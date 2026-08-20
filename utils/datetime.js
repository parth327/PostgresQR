// All dates/times in this app are shown to Indian users, so every display
// is pinned to India Standard Time explicitly, no matter what timezone the
// server process itself is running in (e.g. UTC on Render). Without this,
// a check-in at 2:41 PM IST was rendering as 09:10 AM, because the server's
// default timezone (UTC) was used to format it instead of IST.
const TIME_ZONE = 'Asia/Kolkata';

// Matches the "📅 15 August 2026" style used for event dates.
function formatEventDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Short date, e.g. registration date on the dashboard table.
function formatShortDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', { timeZone: TIME_ZONE });
}

// Full date + time, e.g. "Checked-In At" columns.
function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', { timeZone: TIME_ZONE });
}

// Time only, e.g. the live check-in timestamp shown on an attendee card.
function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-IN', { timeZone: TIME_ZONE });
}

// gu-IN locale formatting depends on ICU data being present on the host,
// which isn't guaranteed (e.g. slim Node builds on some hosts), so Gujarati
// dates are built manually from a fixed month-name table instead.
const GUJARATI_MONTHS = [
  'જાન્યુઆરી', 'ફેબ્રુઆરી', 'માર્ચ', 'એપ્રિલ', 'મે', 'જૂન',
  'જુલાઈ', 'ઓગસ્ટ', 'સપ્ટેમ્બર', 'ઓક્ટોબર', 'નવેમ્બર', 'ડિસેમ્બર',
];
const GUJARATI_DIGITS = ['૦', '૧', '૨', '૩', '૪', '૫', '૬', '૭', '૮', '૯'];

function toGujaratiDigits(n) {
  return String(n).replace(/[0-9]/g, (d) => GUJARATI_DIGITS[d]);
}

// IST-local date/time parts for a value, used as the basis for all
// Gujarati-formatted output below.
function istParts(value) {
  const d = new Date(value);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    year: get('year'),
    month: Number(get('month')),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    dayPeriod: get('dayPeriod'),
  };
}

// e.g. "૧૫ ઓગસ્ટ ૨૦૨૬"
function formatEventDateGu(value) {
  if (!value) return '';
  const p = istParts(value);
  return `${toGujaratiDigits(p.day)} ${GUJARATI_MONTHS[p.month - 1]} ${toGujaratiDigits(p.year)}`;
}

// e.g. "૧૫/૮/૨૦૨૬"
function formatShortDateGu(value) {
  if (!value) return '';
  const p = istParts(value);
  return `${toGujaratiDigits(p.day)}/${toGujaratiDigits(p.month)}/${toGujaratiDigits(p.year)}`;
}

// e.g. "૩:૪૫ PM"
function formatTimeGu(value) {
  if (!value) return '';
  const p = istParts(value);
  return `${toGujaratiDigits(p.hour)}:${toGujaratiDigits(p.minute)} ${p.dayPeriod}`;
}

// e.g. "૧૫ ઓગસ્ટ ૨૦૨૬, ૩:૪૫ PM"
function formatDateTimeGu(value) {
  if (!value) return '';
  return `${formatEventDateGu(value)}, ${formatTimeGu(value)}`;
}

module.exports = {
  TIME_ZONE,
  formatEventDate,
  formatShortDate,
  formatDateTime,
  formatTime,
  formatEventDateGu,
  formatShortDateGu,
  formatDateTimeGu,
  formatTimeGu,
};
