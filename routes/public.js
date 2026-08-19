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
      const {
        name, dob, gender, phone, whatsapp, email, location, address,
        houseNumber, society, landmark, education, occupation, notes, pincode,
        interest, joinMedium, joinMediumOther, age,
      } = req.body;

      const missing = [];
      if (!name || !name.trim()) missing.push('પૂરું નામ');
      if (!phone || !phone.trim()) missing.push('ફોન નંબર');
      if (!location || !location.trim()) missing.push('એરિયા');
      if (!education || !education.trim()) missing.push('અભ્યાસ');
      if (!interest || !interest.trim()) missing.push('રુચિનો વિષય');
      if (!joinMedium || !joinMedium.trim()) missing.push('કયા માધ્યમથી યુવા સંગમ માં જોડાવાના છો?');
      if (joinMedium === 'અન્ય' && (!joinMediumOther || !joinMediumOther.trim())) missing.push('અન્ય');

      const ageNum = age ? parseInt(age, 10) : null;
      if (!age || Number.isNaN(ageNum) || ageNum < 15 || ageNum > 100) missing.push('ઉંમર (15-100)');

      if (missing.length) {
        return res.render('register', {
          error: `કૃપા કરીને આ ફિલ્ડ ભરો: ${missing.join(', ')}`,
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
        whatsapp: (whatsapp || '').trim(),
        email: (email || '').trim(),
        location: location.trim(),
        houseNumber: (houseNumber || '').trim(),
        society: (society || '').trim(),
        landmark: (landmark || '').trim(),
        address: (address || '').trim(),
        education: (education || '').trim(),
        occupation: (occupation || '').trim(),
        interest: (interest || '').trim(),
        joinMedium: (joinMedium || '').trim(),
        joinMediumOther: joinMedium === 'અન્ય' ? (joinMediumOther || '').trim() : '',
        age: ageNum,
        notes: (notes || '').trim(),
        photoData: req.file ? req.file.buffer.toString('base64') : null,
        photoMime: req.file ? req.file.mimetype : null,
        qrData: qrBuffer.toString('base64'),
        createdAt,
        pincode : pincode,
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

// GET /view/:id -> page shown when the QR code is scanned.
// Only a logged-in admin may see the saved details. Anyone else (i.e. any
// member of the public scanning the QR) is shown a locked/restricted page
// and offered an admin-login link that brings them straight back here.
router.get('/view/:id', async (req, res) => {
  const record = await db.getRecordById(req.params.id);
  if (!record) return res.status(404).render('404', { message: 'This QR code does not match any record.' });

  const isAdmin = !!(req.session && req.session.isAdmin);

  if (!isAdmin) {
    return res.status(403).render('view-restricted', {
      loginUrl: `/admin/login?next=${encodeURIComponent(`/view/${record.id}`)}`,
    });
  }

  const attendanceHistory = await db.getAttendanceByUser(record.id);

  res.render('view-record', {
    record,
    photoUrl: record.hasPhoto ? `/photo/${record.id}` : null,
    qrUrl: `/qr/${record.id}`,
    isAdmin: true,
    attendanceHistory,
  });
});

// GET /photo/:id -> serves the uploaded photo straight from the database.
// Restricted to admins only, same as the profile details themselves.
router.get('/photo/:id', async (req, res) => {
  if (!(req.session && req.session.isAdmin)) {
    return res.status(403).send('Forbidden');
  }
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
