const express = require('express');

const config = require('../config');
const db = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const { verifyPassword } = require('../utils/auth');

const router = express.Router();

// ==================== EXISTING ADMIN LOGIN ROUTES ====================

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

    // Get today's event for quick access
    const today = new Date().toISOString().split('T')[0];
    const todayEvent = await db.getEventByDate(today);

    res.render('admin-dashboard', {
      records: records.map((r) => ({ ...r, qrUrl: `/qr/${r.id}` })),
      total,
      search: req.query.search || '',
      adminUsername: req.session.adminUsername,
      baseUrl: config.baseUrl,
      todayEvent,
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

    // Get attendance history for this record
    const attendanceHistory = await db.getAttendanceByUser(req.params.id);

    res.render('view-record', {
      record,
      photoUrl: record.hasPhoto ? `/photo/${record.id}` : null,
      qrUrl: `/qr/${record.id}`,
      isAdmin: true,
      attendanceHistory,
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

// ==================== NEW EVENT MANAGEMENT ROUTES ====================

// GET /admin/events -> list all events
router.get('/events', requireAdmin, async (req, res, next) => {
  try {
    const events = await db.getAllEvents();
    res.render('admin-events', {
      events,
      adminUsername: req.session.adminUsername,
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/events/create -> show create event form
router.get('/events/create', requireAdmin, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  res.render('admin-event-form', {
    event: null,
    today,
    adminUsername: req.session.adminUsername,
  });
});

// POST /admin/events/create -> create new event
router.post('/events/create', requireAdmin, async (req, res, next) => {
  try {
    const { eventName, eventDate, eventDescription, location, maxCapacity } = req.body;

    if (!eventName || !eventDate) {
      const today = new Date().toISOString().split('T')[0];
      return res.render('admin-event-form', {
        event: req.body,
        error: 'Event name and date are required',
        today,
        adminUsername: req.session.adminUsername,
      });
    }

    await db.createEvent({
      name: eventName,
      date: eventDate,
      description: eventDescription || '',
      location: location || '',
      maxCapacity: maxCapacity || null,
    });

    res.redirect('/admin/events');
  } catch (err) {
    next(err);
  }
});

// GET /admin/events/:id -> view event details and attendance
router.get('/events/:id', requireAdmin, async (req, res, next) => {
  try {
    const event = await db.getEventById(req.params.id);
    if (!event) return res.status(404).render('404', { message: 'Event not found' });

    const attendance = await db.getEventAttendance(req.params.id);
    const stats = await db.getEventStats(req.params.id);

    res.render('admin-event-detail', {
      event,
      attendance,
      stats,
      adminUsername: req.session.adminUsername,
    });
  } catch (err) {
    next(err);
  }
});

// ==================== CHECK-IN ROUTES ====================

// GET /admin/checkin -> check-in page (scanner interface)
router.get('/checkin', requireAdmin, async (req, res, next) => {
  try {
    // Get event (from query param or today's event)
    let event;
    if (req.query.eventId) {
      event = await db.getEventById(req.query.eventId);
    } else {
      const today = new Date().toISOString().split('T')[0];
      event = await db.getEventByDate(today);
    }

    if (!event) {
      return res.render('admin-checkin', {
        event: null,
        error: 'No event found. Please select an event.',
        adminUsername: req.session.adminUsername,
      });
    }

    const attendance = await db.getEventAttendance(event.id);
    const stats = await db.getEventStats(event.id);

    res.render('admin-checkin', {
      event,
      attendance,
      stats,
      adminUsername: req.session.adminUsername,
    });
  } catch (err) {
    next(err);
  }
});

// API endpoint: POST /admin/api/checkin
// Called when admin scans a QR or enters a user ID
router.post('/api/checkin', requireAdmin, async (req, res, next) => {
  try {
    const { recordId, eventId } = req.body;

    if (!recordId) {
      return res.json({ success: false, error: 'User ID required' });
    }

    // Get event (use provided eventId or today's event)
    let event;
    if (eventId) {
      event = await db.getEventById(eventId);
    } else {
      const today = new Date().toISOString().split('T')[0];
      event = await db.getEventByDate(today);
    }

    if (!event) {
      return res.json({ success: false, error: 'No active event found' });
    }

    // Get user record
    const record = await db.getRecordById(recordId);
    if (!record) {
      return res.json({ success: false, error: 'User record not found' });
    }

    // Check if already checked in
    const alreadyCheckedIn = await db.isUserCheckedIn(event.id, recordId);
    if (alreadyCheckedIn) {
      return res.json({
        success: false,
        error: 'User already checked in',
        record,
      });
    }

    // Perform check-in
    const result = await db.checkInUser(
      event.id,
      recordId,
      req.session.adminUsername,
      null
    );

    if (!result.success) {
      return res.json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      message: `${record.name} checked in successfully`,
      record,
    });
  } catch (err) {
    console.error('Check-in error:', err);
    next(err);
  }
});

// API endpoint: POST /admin/api/checkout
// Remove a check-in
router.post('/api/checkout', requireAdmin, async (req, res, next) => {
  try {
    const { recordId, eventId } = req.body;

    const success = await db.removeCheckIn(eventId, recordId);
    if (success) {
      return res.json({ success: true, message: 'Check-out successful' });
    } else {
      return res.json({ success: false, error: 'Check-in record not found' });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
