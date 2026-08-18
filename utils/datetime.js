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

module.exports = { TIME_ZONE, formatEventDate, formatShortDate, formatDateTime, formatTime };
