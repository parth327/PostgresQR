const express = require('express');

const config = require('../config');
const db = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const { verifyPassword } = require('../utils/auth');
const { sendExcelFile, safeFilename } = require('../utils/excel');
const { formatEventDate, formatDateTime } = require('../utils/datetime');

const router = express.Router();

// ==================== EXISTING ADMIN LOGIN ROUTES ====================

// Only allow redirecting back to a safe, same-site path after login
// (never to an absolute/external URL) to avoid open-redirect issues.
function safeNext(next) {
  if (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) {
    return next;
  }
  return '/admin/dashboard';
}

// GET /admin/login
router.get('/login', (req, res) => {
  const next = safeNext(req.query.next);
  if (req.session && req.session.isAdmin) return res.redirect(next);
  res.render('admin-login', { error: null, next });
});

// POST /admin/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const next = safeNext(req.body.next || req.query.next);

  if (!config.adminPasswordHash) {
    return res.render('admin-login', {
      error: 'Admin password is not configured on the server. Check the .env file.',
      next,
    });
  }

  const validUsername = username === config.adminUsername;
  const validPassword = validUsername && verifyPassword(password, config.adminPasswordHash);

  if (validUsername && validPassword) {
    req.session.isAdmin = true;
    req.session.adminUsername = username;
    return res.redirect(next);
  }

  res.render('admin-login', { error: 'Invalid username or password.', next });
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
      isAdmin: true,
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
      isAdmin: true,
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
    isAdmin: true,
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
        isAdmin: true,
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

// ==================== EXCEL EXPORT ROUTES ====================
// NOTE: /events/export is defined here, before GET /events/:id below,
// so Express doesn't match "export" as an :id value.

// GET /admin/dashboard/export -> export the users list (respects ?search=)
router.get('/dashboard/export', requireAdmin, async (req, res, next) => {
  try {
    const search = (req.query.search || '').trim();
    const records = search ? await db.searchRecords(search) : await db.getAllRecords();

    const rows = records.map((r) => ({
      name: r.name,
      age: r.age,
      phone: r.phone,
      whatsapp: r.whatsapp,
      email: r.email,
      gender: r.gender,
      dob: r.dob,
      location: r.location,
      pincode: r.pincode,
      houseNumber: r.houseNumber,
      society: r.society,
      landmark: r.landmark,
      address: r.address,
      education: r.education,
      interest: r.interest,
      joinMedium: r.joinMedium === 'અન્ય' ? (r.joinMediumOther || r.joinMedium) : r.joinMedium,
      occupation: r.occupation,
      notes: r.notes,
      hasPhoto: r.hasPhoto ? 'Yes' : 'No',
      createdAt: formatDateTime(r.createdAt),
      profileLink: `${config.baseUrl}/view/${r.id}`,
      id: r.id,
    }));

    await sendExcelFile(res, {
      filename: `users${search ? '-search-' + safeFilename(search) : ''}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'Users',
      title: 'Registered Users',
      subtitle: `${records.length} user${records.length === 1 ? '' : 's'}${search ? ` matching "${search}"` : ''} \u2022 Generated ${formatDateTime(new Date())}`,
      columns: [
        { header: 'Name', key: 'name', width: 22 },
        { header: 'Age', key: 'age', width: 8 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'WhatsApp', key: 'whatsapp', width: 15 },
        { header: 'Email', key: 'email', width: 26 },
        { header: 'Gender', key: 'gender', width: 12 },
        { header: 'DOB', key: 'dob', width: 14 },
        { header: 'Area', key: 'location', width: 18 },
        { header: 'Pincode', key: 'pincode', width: 12 },
        { header: 'House No.', key: 'houseNumber', width: 14 },
        { header: 'Society', key: 'society', width: 20 },
        { header: 'Landmark', key: 'landmark', width: 20 },
        { header: 'Address', key: 'address', width: 30 },
        { header: 'Education', key: 'education', width: 20 },
        { header: 'Interest', key: 'interest', width: 16 },
        { header: 'Joined Via', key: 'joinMedium', width: 18 },
        { header: 'Occupation', key: 'occupation', width: 20 },
        { header: 'Notes', key: 'notes', width: 28 },
        { header: 'Has Photo', key: 'hasPhoto', width: 12 },
        { header: 'Registered On', key: 'createdAt', width: 22 },
        { header: 'Profile Link', key: 'profileLink', width: 36, hyperlink: true },
        { header: 'Record ID', key: 'id', width: 30 },
      ],
      rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/events/export -> export the events list
router.get('/events/export', requireAdmin, async (req, res, next) => {
  try {
    const events = await db.getAllEventsWithAttendanceCounts();

    const rows = events.map((e) => ({
      name: e.event_name,
      date: formatEventDate(e.event_date),
      status: (e.status || '').toUpperCase(),
      location: e.location,
      maxCapacity: e.max_capacity,
      checkedInCount: e.checked_in_count,
      description: e.event_description,
      createdAt: formatDateTime(e.created_at),
      id: e.id,
    }));

    await sendExcelFile(res, {
      filename: `events-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'Events',
      title: 'Events',
      headerColor: 'FF0066CC',
      subtitle: `${events.length} event${events.length === 1 ? '' : 's'} \u2022 Generated ${formatDateTime(new Date())}`,
      columns: [
        { header: 'Event Name', key: 'name', width: 28 },
        { header: 'Date', key: 'date', width: 20 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Location', key: 'location', width: 22 },
        { header: 'Max Capacity', key: 'maxCapacity', width: 14 },
        { header: 'Checked-In Count', key: 'checkedInCount', width: 17 },
        { header: 'Description', key: 'description', width: 34 },
        { header: 'Created On', key: 'createdAt', width: 22 },
        { header: 'Event ID', key: 'id', width: 30 },
      ],
      rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/events/:id/export -> export one event's attendance list (full user details)
router.get('/events/:id/export', requireAdmin, async (req, res, next) => {
  try {
    const event = await db.getEventById(req.params.id);
    if (!event) return res.status(404).render('404', { message: 'Event not found' });

    const attendance = await db.getEventAttendance(req.params.id);

    const rows = attendance.map((p) => ({
      name: p.name,
      age: p.age,
      phone: p.phone,
      whatsapp: p.whatsapp,
      email: p.email,
      gender: p.gender,
      dob: p.dob,
      location: p.location,
      pincode: p.pincode,
      houseNumber: p.house_number,
      society: p.society,
      landmark: p.landmark,
      address: p.address,
      education: p.education,
      interest: p.interest,
      joinMedium: p.join_medium === 'અન્ય' ? (p.join_medium_other || p.join_medium) : p.join_medium,
      occupation: p.occupation,
      recordNotes: p.record_notes,
      checkedInAt: formatDateTime(p.checked_in_at),
      checkedInBy: p.checked_in_by,
      temperature: p.temperature,
      attendanceNotes: p.attendance_notes,
      recordId: p.record_id,
    }));

    const eventDateStr = formatEventDate(event.event_date);

    await sendExcelFile(res, {
      filename: `${safeFilename(event.event_name)}-attendance-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'Attendance',
      title: `${event.event_name} \u2014 Attendance`,
      headerColor: 'FF0066CC',
      subtitle: `${eventDateStr}${event.location ? ' \u2022 ' + event.location : ''} \u2022 ${attendance.length} checked in \u2022 Generated ${formatDateTime(new Date())}`,
      columns: [
        { header: 'Name', key: 'name', width: 22 },
        { header: 'Age', key: 'age', width: 8 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'WhatsApp', key: 'whatsapp', width: 15 },
        { header: 'Email', key: 'email', width: 26 },
        { header: 'Gender', key: 'gender', width: 12 },
        { header: 'DOB', key: 'dob', width: 14 },
        { header: 'Area', key: 'location', width: 18 },
        { header: 'Pincode', key: 'pincode', width: 12 },
        { header: 'House No.', key: 'houseNumber', width: 14 },
        { header: 'Society', key: 'society', width: 20 },
        { header: 'Landmark', key: 'landmark', width: 20 },
        { header: 'Address', key: 'address', width: 30 },
        { header: 'Education', key: 'education', width: 20 },
        { header: 'Interest', key: 'interest', width: 16 },
        { header: 'Joined Via', key: 'joinMedium', width: 18 },
        { header: 'Occupation', key: 'occupation', width: 20 },
        { header: 'Notes', key: 'recordNotes', width: 26 },
        { header: 'Checked-In At', key: 'checkedInAt', width: 22 },
        { header: 'Checked-In By', key: 'checkedInBy', width: 16 },
        { header: 'Temperature', key: 'temperature', width: 13 },
        { header: 'Attendance Notes', key: 'attendanceNotes', width: 26 },
        { header: 'Record ID', key: 'recordId', width: 30 },
      ],
      rows,
    });
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
      isAdmin: true,
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
        isAdmin: true,
      });
    }

    const attendance = await db.getEventAttendance(event.id);
    const stats = await db.getEventStats(event.id);

    res.render('admin-checkin', {
      event,
      attendance,
      stats,
      adminUsername: req.session.adminUsername,
      isAdmin: true,
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
