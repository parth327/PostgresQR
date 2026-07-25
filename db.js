const { Pool } = require('pg');
const config = require('./config');

if (!config.databaseUrl) {
  console.warn('WARNING: DATABASE_URL is not set. Set it in your .env (or Render env vars) to a Postgres connection string.');
}

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.dbSsl ? { rejectUnauthorized: false } : false,
});

// Creates the table if it doesn't exist yet. Safe to call every startup.
async function init() {
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('Database ready (records table checked/created).');
}

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

// Returns the raw photo buffer + mime type for a record, or null if none.
async function getPhoto(id) {
  const { rows } = await pool.query('SELECT photo_data, photo_mime FROM records WHERE id = $1', [id]);
  if (!rows[0] || !rows[0].photo_data) return null;
  return { buffer: Buffer.from(rows[0].photo_data, 'base64'), mime: rows[0].photo_mime };
}

// Returns the raw QR PNG buffer for a record, or null if not found.
async function getQr(id) {
  const { rows } = await pool.query('SELECT qr_data FROM records WHERE id = $1', [id]);
  if (!rows[0] || !rows[0].qr_data) return null;
  return Buffer.from(rows[0].qr_data, 'base64');
}

async function addRecord(record) {
  await pool.query(
    `INSERT INTO records
      (id, name, dob, gender, phone, email, location, address, education, occupation, notes, photo_data, photo_mime, qr_data, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
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

module.exports = {
  init,
  getAllRecords,
  getRecordById,
  getPhoto,
  getQr,
  addRecord,
  deleteRecord,
  countRecords,
  searchRecords,
};
