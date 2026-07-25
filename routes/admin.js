const express = require('express');

const config = require('../config');
const db = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const { verifyPassword } = require('../utils/auth');

const router = express.Router();

// GET /admin/login
router.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin/dashboard');
  res.render('admin-login', { error: null });
});

// POST /admin/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!config.adminPasswordHash) {
    return res.render('admin-login', {
      error: 'Admin password is not configured on the server. Check the .env file.',
    });
  }

  const validUsername = username === config.adminUsername;
  const validPassword = validUsername && verifyPassword(password, config.adminPasswordHash);

  if (validUsername && validPassword) {
    req.session.isAdmin = true;
    req.session.adminUsername = username;
    return res.redirect('/admin/dashboard');
  }

  res.render('admin-login', { error: 'Invalid username or password.' });
});

// POST /admin/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

// GET /admin/dashboard -> list of all saved records + their QR codes
router.get('/dashboard', requireAdmin, async (req, res, next) => {
  try {
    const search = (req.query.search || '').trim();
    const records = search ? await db.searchRecords(search) : await db.getAllRecords();
    const total = await db.countRecords();

    res.render('admin-dashboard', {
      records: records.map((r) => ({ ...r, qrUrl: `/qr/${r.id}` })),
      total,
      search: req.query.search || '',
      adminUsername: req.session.adminUsername,
      baseUrl: config.baseUrl,
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/record/:id -> view single record details (admin view, reuses view-record page)
router.get('/record/:id', requireAdmin, async (req, res, next) => {
  try {
    const record = await db.getRecordById(req.params.id);
    if (!record) return res.status(404).render('404', { message: 'Record not found.' });
    res.render('view-record', {
      record,
      photoUrl: record.hasPhoto ? `/photo/${record.id}` : null,
      qrUrl: `/qr/${record.id}`,
      isAdmin: true,
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/delete/:id -> delete a record
router.post('/delete/:id', requireAdmin, async (req, res, next) => {
  try {
    await db.deleteRecord(req.params.id);
    res.redirect('/admin/dashboard');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
