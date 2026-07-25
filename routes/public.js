const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const QRCode = require('qrcode');

const config = require('../config');
const db = require('../db');

const router = express.Router();

// ---- Photo upload setup (kept in memory, never written to disk) ----
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Only image files (jpg, png, webp, gif) are allowed for the photo.'));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// GET /  -> redirect to register (friendly root)
router.get('/', (req, res) => {
  res.redirect('/register');
});

// GET /register -> show the public registration form (no login required)
router.get('/register', (req, res) => {
  res.render('register', { error: null, formData: {} });
});

// POST /register -> save details + generate unique QR code
router.post('/register', (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      return res.render('register', { error: err.message, formData: req.body });
    }

    try {
      const { name, dob, gender, phone, email, location, address, education, occupation, notes } = req.body;

      if (!name || !name.trim() || !phone || !phone.trim() || !location || !location.trim()) {
        return res.render('register', {
          error: 'Please fill in all required fields (Name, Phone, Location).',
          formData: req.body,
        });
      }

      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const viewUrl = `${config.baseUrl}/view/${id}`;

      const qrBuffer = await QRCode.toBuffer(viewUrl, { type: 'png', width: 400, margin: 2 });

      const record = {
        id,
        name: name.trim(),
        dob: dob || '',
        gender: gender || '',
        phone: phone.trim(),
        email: (email || '').trim(),
        location: location.trim(),
        address: (address || '').trim(),
        education: (education || '').trim(),
        occupation: (occupation || '').trim(),
        notes: (notes || '').trim(),
        photoData: req.file ? req.file.buffer.toString('base64') : null,
        photoMime: req.file ? req.file.mimetype : null,
        qrData: qrBuffer.toString('base64'),
        createdAt,
      };

      await db.addRecord(record);
      res.redirect(`/success/${id}`);
    } catch (dbErr) {
      console.error('Failed to save record:', dbErr);
      res.status(500).render('404', { message: 'Something went wrong saving your details. Please try again.' });
    }
  });
});

// GET /success/:id -> confirmation page showing the generated QR
router.get('/success/:id', async (req, res) => {
  const record = await db.getRecordById(req.params.id);
  if (!record) return res.status(404).render('404', { message: 'Record not found.' });
  const viewUrl = `${config.baseUrl}/view/${record.id}`;
  res.render('success', { record, viewUrl, qrUrl: `/qr/${record.id}` });
});

// GET /view/:id -> public page shown when the QR code is scanned
router.get('/view/:id', async (req, res) => {
  const record = await db.getRecordById(req.params.id);
  if (!record) return res.status(404).render('404', { message: 'This QR code does not match any record.' });
  res.render('view-record', {
    record,
    photoUrl: record.hasPhoto ? `/photo/${record.id}` : null,
    qrUrl: `/qr/${record.id}`,
    isAdmin: !!(req.session && req.session.isAdmin),
  });
});

// GET /photo/:id -> serves the uploaded photo straight from the database
router.get('/photo/:id', async (req, res) => {
  const photo = await db.getPhoto(req.params.id);
  if (!photo) return res.status(404).send('Not found');
  res.set('Content-Type', photo.mime);
  res.set('Content-Disposition', `inline; filename="photo-${req.params.id}"`);
  res.send(photo.buffer);
});

// GET /qr/:id -> serves the generated QR code PNG straight from the database
router.get('/qr/:id', async (req, res) => {
  const qrBuffer = await db.getQr(req.params.id);
  if (!qrBuffer) return res.status(404).send('Not found');
  res.set('Content-Type', 'image/png');
  res.set('Content-Disposition', `inline; filename="qr-${req.params.id}.png"`);
  res.send(qrBuffer);
});

module.exports = router;
