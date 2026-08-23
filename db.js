const { Pool } = require('pg');
const crypto = require('crypto');
const config = require('./config');

if (!config.databaseUrl) {
  console.warn('WARNING: DATABASE_URL is not set. Set it in your .env (or Render env vars) to a Postgres connection string.');
}

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.dbSsl ? { rejectUnauthorized: false } : false,
});

// Creates all required tables if they don't exist yet. Safe to call every startup.
async function init() {
  try {
    // Records table (existing)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        dob TEXT,
        gender TEXT,
        phone TEXT NOT NULL,
        email TEXT,
        location TEXT NOT NULL,
        address TEXT,
        education TEXT,
        occupation TEXT,
        notes TEXT,
        photo_data TEXT,
        photo_mime TEXT,
        qr_data TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        pincode TEXT
      );
    `);

    // New registration fields (added for Yuva Sangam form) — safe to run every startup.
    await pool.query(`ALTER TABLE records ADD COLUMN IF NOT EXISTS whatsapp TEXT;`);
    await pool.query(`ALTER TABLE records ADD COLUMN IF NOT EXISTS house_number TEXT;`);
    await pool.query(`ALTER TABLE records ADD COLUMN IF NOT EXISTS society TEXT;`);
    await pool.query(`ALTER TABLE records ADD COLUMN IF NOT EXISTS landmark TEXT;`);
    await pool.query(`ALTER TABLE records ADD COLUMN IF NOT EXISTS interest TEXT;`);
    await pool.query(`ALTER TABLE records ADD COLUMN IF NOT EXISTS join_medium TEXT;`);
    await pool.query(`ALTER TABLE records ADD COLUMN IF NOT EXISTS join_medium_other TEXT;`);
    await pool.query(`ALTER TABLE records ADD COLUMN IF NOT EXISTS age INTEGER;`);
    await pool.query(`ALTER TABLE records ADD COLUMN IF NOT EXISTS location_other TEXT;`);

    // Events table (new)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        event_name TEXT NOT NULL,
        event_date DATE NOT NULL,
        event_description TEXT,
        location TEXT,
        max_capacity INTEGER,
        status TEXT DEFAULT 'upcoming',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Create index on event_date for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
    `);

    // New event fields — event time + two contact persons (added for the
    // event form + registration-page "Event Details" section). Safe to run
    // every startup.
    await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS event_time TEXT;`);
    await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS contact1_name TEXT;`);
    await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS contact1_mobile TEXT;`);
    await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS contact2_name TEXT;`);
    await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS contact2_mobile TEXT;`);

    // Event Attendance table (new)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_attendance (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        checked_in_by TEXT,
        temperature DECIMAL(5,2),
        notes TEXT,
        UNIQUE(event_id, record_id)
      );
    `);

    // Create indexes on attendance table
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_event ON event_attendance(event_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_record ON event_attendance(record_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_checkin_time ON event_attendance(checked_in_at);
    `);

    // Event Admins table (new) — scoped admin accounts, one event each,
    // created/managed only by the main (env-based) admin.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS event_admins (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log('Database ready (all tables checked/created).');
  } catch (err) {
    console.error('Database init error:', err);
    throw err;
  }
}

// ==================== RECORD FUNCTIONS (EXISTING) ====================

function rowToRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    dob: row.dob || '',
    gender: row.gender || '',
    phone: row.phone,
    whatsapp: row.whatsapp || '',
    email: row.email || '',
    location: row.location,
    locationOther: row.location_other || '',
    houseNumber: row.house_number || '',
    society: row.society || '',
    landmark: row.landmark || '',
    address: row.address || '',
    education: row.education || '',
    occupation: row.occupation || '',
    interest: row.interest || '',
    joinMedium: row.join_medium || '',
    joinMediumOther: row.join_medium_other || '',
    age: row.age || '',
    notes: row.notes || '',
    photoMime: row.photo_mime || null,
    hasPhoto: !!row.photo_data,
    createdAt: row.created_at,
    pincode: row.pincode,
  };
}

async function getAllRecords() {
  const { rows } = await pool.query('SELECT * FROM records ORDER BY created_at DESC');
  return rows.map(rowToRecord);
}

async function getRecordById(id) {
  const { rows } = await pool.query('SELECT * FROM records WHERE id = $1', [id]);
  return rowToRecord(rows[0]);
}

async function getPhoto(id) {
  const { rows } = await pool.query('SELECT photo_data, photo_mime FROM records WHERE id = $1', [id]);
  if (!rows[0] || !rows[0].photo_data) return null;
  return { buffer: Buffer.from(rows[0].photo_data, 'base64'), mime: rows[0].photo_mime };
}

async function getQr(id) {
  const { rows } = await pool.query('SELECT qr_data FROM records WHERE id = $1', [id]);
  if (!rows[0] || !rows[0].qr_data) return null;
  return Buffer.from(rows[0].qr_data, 'base64');
}

async function addRecord(record) {
  await pool.query(
    `INSERT INTO records
      (id, name, dob, gender, phone, whatsapp, email, location, location_other, house_number, society, landmark, address, education, occupation, interest, join_medium, join_medium_other, age, notes, photo_data, photo_mime, qr_data, created_at, pincode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
    [
      record.id,
      record.name,
      record.dob || null,
      record.gender || null,
      record.phone,
      record.whatsapp || null,
      record.email || null,
      record.location,
      record.locationOther || null,
      record.houseNumber || null,
      record.society || null,
      record.landmark || null,
      record.address || null,
      record.education || null,
      record.occupation || null,
      record.interest || null,
      record.joinMedium || null,
      record.joinMediumOther || null,
      record.age || null,
      record.notes || null,
      record.photoData || null,
      record.photoMime || null,
      record.qrData,
      record.createdAt,
      record.pincode || null,
    ]
  );
  return record;
}

async function deleteRecord(id) {
  const result = await pool.query('DELETE FROM records WHERE id = $1', [id]);
  return result.rowCount > 0;
}

async function countRecords() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM records');
  return rows[0].count;
}

async function searchRecords(term) {
  const like = `%${term}%`;
  const { rows } = await pool.query(
    `SELECT * FROM records
     WHERE name ILIKE $1 OR location ILIKE $1 OR education ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1
        OR whatsapp ILIKE $1 OR society ILIKE $1 OR landmark ILIKE $1 OR interest ILIKE $1 OR join_medium ILIKE $1
     ORDER BY created_at DESC`,
    [like]
  );
  return rows.map(rowToRecord);
}

// Combines the free-text search box with the advanced filter panel
// (area/education/interest/joinMedium/gender/age range/registration date
// range) on the admin dashboard, building a single parameterized WHERE
// clause. Passing no filters returns every record, same as getAllRecords().
async function queryRecords(filters = {}) {
  const { search, location, education, interest, joinMedium, gender, ageMin, ageMax, dateFrom, dateTo } = filters;
  const clauses = [];
  const params = [];

  function add(clause, value) {
    params.push(value);
    clauses.push(clause.replace('?', `$${params.length}`));
  }

  if (search && search.trim()) {
    const like = `%${search.trim()}%`;
    const cols = ['name', 'location', 'education', 'phone', 'email', 'whatsapp', 'society', 'landmark', 'interest', 'join_medium'];
    params.push(like);
    const p = `$${params.length}`;
    clauses.push(`(${cols.map((c) => `${c} ILIKE ${p}`).join(' OR ')})`);
  }
  if (location && location.trim()) add('location = ?', location.trim());
  if (education && education.trim()) add('education ILIKE ?', `%${education.trim()}%`);
  if (interest && interest.trim()) add('interest = ?', interest.trim());
  if (joinMedium && joinMedium.trim()) add('join_medium = ?', joinMedium.trim());
  if (gender && gender.trim()) add('gender = ?', gender.trim());
  if (ageMin) add('age >= ?', parseInt(ageMin, 10));
  if (ageMax) add('age <= ?', parseInt(ageMax, 10));
  if (dateFrom) add('created_at >= ?', new Date(`${dateFrom}T00:00:00`));
  if (dateTo) add('created_at <= ?', new Date(`${dateTo}T23:59:59.999`));

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT * FROM records ${where} ORDER BY created_at DESC`, params);
  return rows.map(rowToRecord);
}

// Registered users who have NOT checked in to a given event yet — used as a
// recipient filter for the manual "send event email" feature.
async function getUsersNotCheckedIn(eventId) {
  const { rows } = await pool.query(
    `SELECT r.* FROM records r
     WHERE NOT EXISTS (SELECT 1 FROM event_attendance ea WHERE ea.event_id = $1 AND ea.record_id = r.id)
     ORDER BY r.created_at DESC`,
    [eventId]
  );
  return rows.map(rowToRecord);
}

// ==================== EVENT FUNCTIONS (NEW) ====================

async function createEvent(event) {
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO events
      (id, event_name, event_date, event_time, event_description, location, max_capacity,
       contact1_name, contact1_mobile, contact2_name, contact2_mobile, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      id,
      event.name,
      event.date,
      event.time || null,
      event.description,
      event.location,
      event.maxCapacity,
      event.contact1Name || null,
      event.contact1Mobile || null,
      event.contact2Name || null,
      event.contact2Mobile || null,
      'upcoming',
    ]
  );
  return id;
}

// Nearest event that hasn't already happened (by date, and by time if it's
// today) — used to populate the "Event Details" section on the public
// registration page. Falls back to null when nothing is scheduled.
async function getUpcomingEvent() {
  const { rows } = await pool.query(
    `SELECT * FROM events
     WHERE (status IS NULL OR status != 'completed')
       AND event_date >= CURRENT_DATE - INTERVAL '1 day'
     ORDER BY event_date ASC, event_time ASC NULLS LAST
     LIMIT 1`
  );
  return rows[0] || null;
}

async function getAllEvents() {
  const { rows } = await pool.query(
    `SELECT * FROM events ORDER BY event_date DESC`
  );
  return rows;
}

async function getAllEventsWithAttendanceCounts() {
  const { rows } = await pool.query(
    `SELECT e.*, COUNT(ea.id)::int AS checked_in_count
     FROM events e
     LEFT JOIN event_attendance ea ON ea.event_id = e.id
     GROUP BY e.id
     ORDER BY e.event_date DESC`
  );
  return rows;
}

async function getEventById(eventId) {
  const { rows } = await pool.query(
    `SELECT * FROM events WHERE id = $1`,
    [eventId]
  );
  return rows[0] || null;
}

async function getEventByDate(date) {
  // Get event for a specific date (YYYY-MM-DD format)
  const { rows } = await pool.query(
    `SELECT * FROM events WHERE event_date = $1 LIMIT 1`,
    [date]
  );
  return rows[0] || null;
}

async function updateEvent(eventId, event) {
  await pool.query(
    `UPDATE events SET
       event_name = $1,
       event_date = $2,
       event_time = $3,
       event_description = $4,
       location = $5,
       max_capacity = $6,
       contact1_name = $7,
       contact1_mobile = $8,
       contact2_name = $9,
       contact2_mobile = $10,
       updated_at = NOW()
     WHERE id = $11`,
    [
      event.name,
      event.date,
      event.time || null,
      event.description,
      event.location,
      event.maxCapacity,
      event.contact1Name || null,
      event.contact1Mobile || null,
      event.contact2Name || null,
      event.contact2Mobile || null,
      eventId,
    ]
  );
}

async function updateEventStatus(eventId, status) {
  await pool.query(
    `UPDATE events SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, eventId]
  );
}

async function deleteEvent(eventId) {
  const result = await pool.query(
    `DELETE FROM events WHERE id = $1`,
    [eventId]
  );
  return result.rowCount > 0;
}

// ==================== ATTENDANCE FUNCTIONS (NEW) ====================

async function checkInUser(eventId, recordId, adminUsername, notes = null) {
  // Check if already checked in
  const { rows: existing } = await pool.query(
    `SELECT id FROM event_attendance WHERE event_id = $1 AND record_id = $2`,
    [eventId, recordId]
  );

  if (existing.length > 0) {
    return { success: false, error: 'User already checked in for this event' };
  }

  const id = crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO event_attendance (id, event_id, record_id, checked_in_by, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, eventId, recordId, adminUsername, notes]
    );
    return { success: true, id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function getEventAttendance(eventId) {
  const { rows } = await pool.query(
    `SELECT
       ea.id,
       ea.checked_in_at,
       ea.checked_in_by,
       ea.temperature,
       ea.notes AS attendance_notes,
       r.id as record_id,
       r.name,
       r.dob,
       r.gender,
       r.phone,
       r.whatsapp,
       r.email,
       r.location,
       r.location_other,
       r.house_number,
       r.society,
       r.landmark,
       r.address,
       r.education,
       r.occupation,
       r.interest,
       r.join_medium,
       r.join_medium_other,
       r.age,
       r.pincode,
       r.notes AS record_notes
     FROM event_attendance ea
     JOIN records r ON ea.record_id = r.id
     WHERE ea.event_id = $1
     ORDER BY ea.checked_in_at DESC`,
    [eventId]
  );
  return rows;
}

// Same shape as getEventAttendance, plus an optional filter panel (area,
// education, gender, checked-in date/time range, checked-in-by admin) for
// the event detail page's attendance table.
async function queryEventAttendance(eventId, filters = {}) {
  const { location, education, gender, checkedInFrom, checkedInTo, checkedInBy } = filters;
  const clauses = ['ea.event_id = $1'];
  const params = [eventId];

  function add(clause, value) {
    params.push(value);
    clauses.push(clause.replace('?', `$${params.length}`));
  }

  if (location && location.trim()) add('r.location = ?', location.trim());
  if (education && education.trim()) add('r.education ILIKE ?', `%${education.trim()}%`);
  if (gender && gender.trim()) add('r.gender = ?', gender.trim());
  if (checkedInFrom) add('ea.checked_in_at >= ?', new Date(`${checkedInFrom}T00:00:00`));
  if (checkedInTo) add('ea.checked_in_at <= ?', new Date(`${checkedInTo}T23:59:59.999`));
  if (checkedInBy && checkedInBy.trim()) add('ea.checked_in_by ILIKE ?', `%${checkedInBy.trim()}%`);

  const { rows } = await pool.query(
    `SELECT
       ea.id,
       ea.checked_in_at,
       ea.checked_in_by,
       ea.temperature,
       ea.notes AS attendance_notes,
       r.id as record_id,
       r.name,
       r.dob,
       r.gender,
       r.phone,
       r.whatsapp,
       r.email,
       r.location,
       r.location_other,
       r.house_number,
       r.society,
       r.landmark,
       r.address,
       r.education,
       r.occupation,
       r.interest,
       r.join_medium,
       r.join_medium_other,
       r.age,
       r.pincode,
       r.notes AS record_notes
     FROM event_attendance ea
     JOIN records r ON ea.record_id = r.id
     WHERE ${clauses.join(' AND ')}
     ORDER BY ea.checked_in_at DESC`,
    params
  );
  return rows;
}

async function getAttendanceCount(eventId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int as count FROM event_attendance WHERE event_id = $1`,
    [eventId]
  );
  return rows[0].count;
}

async function isUserCheckedIn(eventId, recordId) {
  const { rows } = await pool.query(
    `SELECT id FROM event_attendance WHERE event_id = $1 AND record_id = $2`,
    [eventId, recordId]
  );
  return rows.length > 0;
}

async function getCheckInInfo(eventId, recordId) {
  const { rows } = await pool.query(
    `SELECT checked_in_at, checked_in_by FROM event_attendance WHERE event_id = $1 AND record_id = $2`,
    [eventId, recordId]
  );
  if (!rows[0]) return null;
  return { checkedInAt: rows[0].checked_in_at, checkedInBy: rows[0].checked_in_by };
}

async function getAttendanceByUser(recordId) {
  // Get all events a user has attended
  const { rows } = await pool.query(
    `SELECT
       ea.id,
       ea.checked_in_at,
       e.id as event_id,
       e.event_name,
       e.event_date,
       e.location
     FROM event_attendance ea
     JOIN events e ON ea.event_id = e.id
     WHERE ea.record_id = $1
     ORDER BY e.event_date DESC`,
    [recordId]
  );
  return rows;
}

async function removeCheckIn(eventId, recordId) {
  const result = await pool.query(
    `DELETE FROM event_attendance WHERE event_id = $1 AND record_id = $2`,
    [eventId, recordId]
  );
  return result.rowCount > 0;
}

async function getEventStats(eventId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int as total_checked_in,
       COUNT(DISTINCT checked_in_by)::int as unique_admins,
       MIN(checked_in_at) as first_checkin,
       MAX(checked_in_at) as last_checkin
     FROM event_attendance
     WHERE event_id = $1`,
    [eventId]
  );
  return rows[0];
}

// ==================== EVENT ADMIN FUNCTIONS (NEW) ====================

async function createEventAdmin({ username, passwordHash, eventId }) {
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO event_admins (id, username, password_hash, event_id) VALUES ($1, $2, $3, $4)`,
    [id, username, passwordHash, eventId]
  );
  return id;
}

async function getEventAdminByUsername(username) {
  const { rows } = await pool.query('SELECT * FROM event_admins WHERE username = $1', [username]);
  return rows[0] || null;
}

async function getAllEventAdmins() {
  const { rows } = await pool.query(
    `SELECT ea.*, e.event_name, e.event_date
     FROM event_admins ea
     LEFT JOIN events e ON e.id = ea.event_id
     ORDER BY ea.created_at DESC`
  );
  return rows;
}

async function updateEventAdminPassword(id, passwordHash) {
  await pool.query(`UPDATE event_admins SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [passwordHash, id]);
}

async function updateEventAdminEvent(id, eventId) {
  await pool.query(`UPDATE event_admins SET event_id = $1, updated_at = NOW() WHERE id = $2`, [eventId, id]);
}

async function deleteEventAdmin(id) {
  const result = await pool.query('DELETE FROM event_admins WHERE id = $1', [id]);
  return result.rowCount > 0;
}

module.exports = {
  init,
  // Record functions
  getAllRecords,
  getRecordById,
  getPhoto,
  getQr,
  addRecord,
  deleteRecord,
  countRecords,
  searchRecords,
  queryRecords,
  getUsersNotCheckedIn,
  // Event functions
  createEvent,
  getAllEvents,
  getAllEventsWithAttendanceCounts,
  getEventById,
  getEventByDate,
  getUpcomingEvent,
  updateEvent,
  updateEventStatus,
  deleteEvent,
  // Attendance functions
  checkInUser,
  getEventAttendance,
  queryEventAttendance,
  getAttendanceCount,
  isUserCheckedIn,
  getCheckInInfo,
  getAttendanceByUser,
  removeCheckIn,
  getEventStats,
  // Event admin functions
  createEventAdmin,
  getEventAdminByUsername,
  getAllEventAdmins,
  updateEventAdminPassword,
  updateEventAdminEvent,
  deleteEventAdmin,
};
