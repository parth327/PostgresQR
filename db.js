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
        pincode TEXT NOT NULL
      );
    `);

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
    email: row.email || '',
    location: row.location,
    address: row.address || '',
    education: row.education || '',
    occupation: row.occupation || '',
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
      (id, name, dob, gender, phone, email, location, address, education, occupation, notes, photo_data, photo_mime, qr_data, created_at, pincode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      record.id,
      record.name,
      record.dob || null,
      record.gender || null,
      record.phone,
      record.email || null,
      record.location,
      record.address || null,
      record.education || null,
      record.occupation || null,
      record.notes || null,
      record.photoData || null,
      record.photoMime || null,
      record.qrData,
      record.createdAt,
      record.pincode,
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
     ORDER BY created_at DESC`,
    [like]
  );
  return rows.map(rowToRecord);
}

// ==================== EVENT FUNCTIONS (NEW) ====================

async function createEvent(event) {
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO events (id, event_name, event_date, event_description, location, max_capacity, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, event.name, event.date, event.description, event.location, event.maxCapacity, 'upcoming']
  );
  return id;
}

async function getAllEvents() {
  const { rows } = await pool.query(
    `SELECT * FROM events ORDER BY event_date DESC`
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
       r.id as record_id,
       r.name,
       r.phone,
       r.email,
       r.location,
       r.education
     FROM event_attendance ea
     JOIN records r ON ea.record_id = r.id
     WHERE ea.event_id = $1
     ORDER BY ea.checked_in_at DESC`,
    [eventId]
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
  // Event functions
  createEvent,
  getAllEvents,
  getEventById,
  getEventByDate,
  updateEventStatus,
  deleteEvent,
  // Attendance functions
  checkInUser,
  getEventAttendance,
  getAttendanceCount,
  isUserCheckedIn,
  getAttendanceByUser,
  removeCheckIn,
  getEventStats,
};
