const express = require('express');

const config = require('../config');
const db = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const requireMainAdmin = require('../middleware/requireMainAdmin');
const requireEventAccess = require('../middleware/requireEventAccess');
const { verifyPassword, hashPassword } = require('../utils/auth');
const { sendExcelFile, sendCsvFile, safeFilename } = require('../utils/excel');
const { formatEventDate, formatDateTime } = require('../utils/datetime');
const notify = require('../utils/notify');

const router = express.Router();

// Filter dropdown option lists — mirror the registration form's choices
// (views/register.ejs) so admins can filter on exactly what users could pick.
const FILTER_OPTIONS = {
  locations: ['કૃષ્ણા નગર', 'કુબેરનગર', 'સૈજપુર', 'સરદારનગર', 'નરોડા', 'હરિદર્શન', 'અન્ય'],
  interests: ['સેવા', 'પર્યાવરણ', 'વાંચન', 'લેખન', 'વક્તા', 'રમત'],
  joinMediums: ['શાખા', 'સાપ્તાહિક મિલન', 'અન્ય'],
  genders: ['Male', 'Female', 'Other'],
};

// Pulls the user-list filter panel's fields out of req.query.
function extractRecordFilters(query) {
  return {
    search: query.search || '',
    location: query.location || '',
    education: query.education || '',
    interest: query.interest || '',
    joinMedium: query.joinMedium || '',
    gender: query.gender || '',
    ageMin: query.ageMin || '',
    ageMax: query.ageMax || '',
    dateFrom: query.dateFrom || '',
    dateTo: query.dateTo || '',
  };
}

// Pulls the attendance filter panel's fields out of req.query.
function extractAttendanceFilters(query) {
  return {
    location: query.aLocation || '',
    education: query.aEducation || '',
    gender: query.aGender || '',
    checkedInFrom: query.checkedInFrom || '',
    checkedInTo: query.checkedInTo || '',
    checkedInBy: query.checkedInBy || '',
  };
}

// ==================== ADMIN LOGIN ROUTES ====================

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
router.post('/login', async (req, res, next) => {
  try {
    const { username, password, adminType } = req.body;
    const nextUrl = safeNext(req.body.next || req.query.next);

    // ---- Event Admin login: checked against the event_admins DB table ----
    if (adminType === 'event') {
      const eventAdmin = username ? await db.getEventAdminByUsername(username.trim()) : null;
      const validPassword = eventAdmin && verifyPassword(password, eventAdmin.password_hash);

      if (eventAdmin && validPassword) {
        req.session.isAdmin = true;
        req.session.adminRole = 'event';
        req.session.adminUsername = eventAdmin.username;
        req.session.adminEventId = eventAdmin.event_id;
        return res.redirect(nextUrl);
      }

      return res.render('admin-login', { error: 'વપરાશકર્તા નામ અથવા પાસવર્ડ ખોટો છે.', next: nextUrl });
    }

    // ---- Main Admin login: unchanged, env-based, all rights ----
    if (!config.adminPasswordHash) {
      return res.render('admin-login', {
        error: 'સર્વર પર એડમિન પાસવર્ડ સેટ કરેલો નથી. કૃપા કરીને .env ફાઇલ તપાસો.',
        next: nextUrl,
      });
    }

    const validUsername = username === config.adminUsername;
    const validPassword = validUsername && verifyPassword(password, config.adminPasswordHash);

    if (validUsername && validPassword) {
      req.session.isAdmin = true;
      req.session.adminRole = 'main';
      req.session.adminUsername = username;
      return res.redirect(nextUrl);
    }

    res.render('admin-login', { error: 'વપરાશકર્તા નામ અથવા પાસવર્ડ ખોટો છે.', next: nextUrl });
  } catch (err) {
    next(err);
  }
});

// POST /admin/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

// GET /admin/dashboard -> list of all saved records + their QR codes
// Both admin roles can view/export the full user list; delete and the custom
// event-email sender are main-admin only — event admins cannot delete users
// or send emails.
router.get('/dashboard', requireAdmin, async (req, res, next) => {
  try {
    const filters = extractRecordFilters(req.query);
    const records = await db.queryRecords(filters);
    const total = await db.countRecords();

    // Get today's event for quick access
    const today = new Date().toISOString().split('T')[0];
    const todayEvent = await db.getEventByDate(today);

    res.render('admin-dashboard', {
      records: records.map((r) => ({ ...r, qrUrl: `/qr/${r.id}` })),
      total,
      filters,
      filterOptions: FILTER_OPTIONS,
      search: filters.search,
      adminUsername: req.session.adminUsername,
      adminRole: req.session.adminRole,
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
    if (!record) return res.status(404).render('404', { message: 'આ રેકોર્ડ મળ્યો નહીં.' });

    // Get attendance history for this record
    const attendanceHistory = await db.getAttendanceByUser(req.params.id);

    res.render('view-record', {
      record,
      photoUrl: record.hasPhoto ? `/photo/${record.id}` : null,
      qrUrl: `/qr/${record.id}`,
      isAdmin: true,
      adminRole: req.session.adminRole,
      attendanceHistory,
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/delete/:id -> delete a record (main admin only)
router.post('/delete/:id', requireMainAdmin, async (req, res, next) => {
  try {
    await db.deleteRecord(req.params.id);
    res.redirect('/admin/dashboard');
  } catch (err) {
    next(err);
  }
});

// ==================== EVENT ADMIN MANAGEMENT (main admin only) ====================

async function renderEventAdmins(req, res, extra = {}) {
  const eventAdmins = await db.getAllEventAdmins();
  const events = await db.getAllEvents();
  res.render('admin-event-admins', {
    eventAdmins,
    events,
    adminUsername: req.session.adminUsername,
    adminRole: req.session.adminRole,
    isAdmin: true,
    error: null,
    ...extra,
  });
}

// GET /admin/event-admins -> list + create form
router.get('/event-admins', requireMainAdmin, async (req, res, next) => {
  try {
    await renderEventAdmins(req, res);
  } catch (err) {
    next(err);
  }
});

// POST /admin/event-admins -> create a new event admin
router.post('/event-admins', requireMainAdmin, async (req, res, next) => {
  try {
    const { username, eventId, password } = req.body;

    if (!username || !username.trim() || !eventId || !password || !password.trim()) {
      return renderEventAdmins(req, res, { error: 'બધી વિગતો (વપરાશકર્તા નામ, ઇવેન્ટ, પાસવર્ડ) ભરવી ફરજિયાત છે.' });
    }

    const existing = await db.getEventAdminByUsername(username.trim());
    if (existing) {
      return renderEventAdmins(req, res, { error: 'આ વપરાશકર્તા નામ પહેલેથી અસ્તિત્વમાં છે.' });
    }

    await db.createEventAdmin({
      username: username.trim(),
      passwordHash: hashPassword(password),
      eventId,
    });

    res.redirect('/admin/event-admins');
  } catch (err) {
    next(err);
  }
});

// POST /admin/event-admins/:id/password -> reset an event admin's password
router.post('/event-admins/:id/password', requireMainAdmin, async (req, res, next) => {
  try {
    const { password } = req.body;
    if (password && password.trim()) {
      await db.updateEventAdminPassword(req.params.id, hashPassword(password));
    }
    res.redirect('/admin/event-admins');
  } catch (err) {
    next(err);
  }
});

// POST /admin/event-admins/:id/event -> reassign an event admin to a different event
router.post('/event-admins/:id/event', requireMainAdmin, async (req, res, next) => {
  try {
    const { eventId } = req.body;
    if (eventId) {
      await db.updateEventAdminEvent(req.params.id, eventId);
    }
    res.redirect('/admin/event-admins');
  } catch (err) {
    next(err);
  }
});

// POST /admin/event-admins/:id/delete -> remove an event admin account
router.post('/event-admins/:id/delete', requireMainAdmin, async (req, res, next) => {
  try {
    await db.deleteEventAdmin(req.params.id);
    res.redirect('/admin/event-admins');
  } catch (err) {
    next(err);
  }
});

// ==================== EVENT MANAGEMENT ROUTES ====================

// GET /admin/events -> list all events (main admin); event admins are sent
// straight to their own event's detail page since they only have one.
router.get('/events', requireAdmin, async (req, res, next) => {
  try {
    if (req.session.adminRole === 'event') {
      return res.redirect(`/admin/events/${req.session.adminEventId}`);
    }

    const events = await db.getAllEvents();
    res.render('admin-events', {
      events,
      adminUsername: req.session.adminUsername,
      adminRole: req.session.adminRole,
      isAdmin: true,
      query: req.query,
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/events/create -> show create event form (main admin only)
router.get('/events/create', requireMainAdmin, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  res.render('admin-event-form', {
    event: null,
    error: null,
    today,
    adminUsername: req.session.adminUsername,
    adminRole: req.session.adminRole,
    isAdmin: true,
  });
});

// POST /admin/events/create -> create new event (main admin only)
router.post('/events/create', requireMainAdmin, async (req, res, next) => {
  try {
    const {
      eventName, eventDate, eventTime, eventDescription, location, maxCapacity,
      contact1Name, contact1Mobile, contact2Name, contact2Mobile,
    } = req.body;

    if (!eventName || !eventDate) {
      const today = new Date().toISOString().split('T')[0];
      return res.render('admin-event-form', {
        event: req.body,
        error: 'ઇવેન્ટનું નામ અને તારીખ ફરજિયાત છે.',
        today,
        adminUsername: req.session.adminUsername,
        adminRole: req.session.adminRole,
        isAdmin: true,
      });
    }

    await db.createEvent({
      name: eventName,
      date: eventDate,
      time: eventTime || '',
      description: eventDescription || '',
      location: location || '',
      maxCapacity: maxCapacity || null,
      contact1Name: contact1Name || '',
      contact1Mobile: contact1Mobile || '',
      contact2Name: contact2Name || '',
      contact2Mobile: contact2Mobile || '',
    });

    res.redirect('/admin/events');
  } catch (err) {
    next(err);
  }
});

// GET /admin/events/:id/edit -> show edit event form (main admin only)
router.get('/events/:id/edit', requireMainAdmin, async (req, res, next) => {
  try {
    const event = await db.getEventById(req.params.id);
    if (!event) return res.status(404).render('404', { message: 'ઇવેન્ટ મળ્યો નહીં' });

    const today = new Date().toISOString().split('T')[0];
    res.render('admin-event-form', {
      event: {
        id: event.id,
        eventName: event.event_name,
        // event_date comes back from pg as a JS Date at UTC midnight for
        // DATE columns — format to plain YYYY-MM-DD for the <input type=date>.
        eventDate: event.event_date instanceof Date
          ? event.event_date.toISOString().split('T')[0]
          : String(event.event_date).split('T')[0],
        eventTime: event.event_time || '',
        location: event.location || '',
        maxCapacity: event.max_capacity || '',
        eventDescription: event.event_description || '',
        contact1Name: event.contact1_name || '',
        contact1Mobile: event.contact1_mobile || '',
        contact2Name: event.contact2_name || '',
        contact2Mobile: event.contact2_mobile || '',
      },
      isEdit: true,
      error: null,
      today,
      adminUsername: req.session.adminUsername,
      adminRole: req.session.adminRole,
      isAdmin: true,
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/events/:id/edit -> save edited event (main admin only)
router.post('/events/:id/edit', requireMainAdmin, async (req, res, next) => {
  try {
    const existing = await db.getEventById(req.params.id);
    if (!existing) return res.status(404).render('404', { message: 'ઇવેન્ટ મળ્યો નહીં' });

    const {
      eventName, eventDate, eventTime, eventDescription, location, maxCapacity,
      contact1Name, contact1Mobile, contact2Name, contact2Mobile,
    } = req.body;

    if (!eventName || !eventDate) {
      const today = new Date().toISOString().split('T')[0];
      return res.render('admin-event-form', {
        event: { ...req.body, id: req.params.id },
        isEdit: true,
        error: 'ઇવેન્ટનું નામ અને તારીખ ફરજિયાત છે.',
        today,
        adminUsername: req.session.adminUsername,
        adminRole: req.session.adminRole,
        isAdmin: true,
      });
    }

    await db.updateEvent(req.params.id, {
      name: eventName,
      date: eventDate,
      time: eventTime || '',
      description: eventDescription || '',
      location: location || '',
      maxCapacity: maxCapacity || null,
      contact1Name: contact1Name || '',
      contact1Mobile: contact1Mobile || '',
      contact2Name: contact2Name || '',
      contact2Mobile: contact2Mobile || '',
    });

    res.redirect(`/admin/events/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

// ==================== EXCEL EXPORT ROUTES ====================
// NOTE: /events/export is defined here, before GET /events/:id below,
// so Express doesn't match "export" as an :id value.

// GET /admin/dashboard/export -> export the (filtered) users list, as
// Excel by default or CSV with ?format=csv. Both admin roles can export.
router.get('/dashboard/export', requireAdmin, async (req, res, next) => {
  try {
    const filters = extractRecordFilters(req.query);
    const search = filters.search.trim();
    const records = await db.queryRecords(filters);

    const rows = records.map((r) => ({
      name: r.name,
      age: r.age,
      phone: r.phone,
      whatsapp: r.whatsapp,
      email: r.email,
      gender: r.gender,
      dob: r.dob,
      location: r.location === 'અન્ય' ? (r.locationOther || r.location) : r.location,
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

    const columns = [
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
    ];
    const baseName = `users${search ? '-search-' + safeFilename(search) : ''}-${new Date().toISOString().slice(0, 10)}`;

    if (req.query.format === 'csv') {
      return sendCsvFile(res, { filename: `${baseName}.csv`, columns, rows });
    }

    await sendExcelFile(res, {
      filename: `${baseName}.xlsx`,
      sheetName: 'Users',
      title: 'Registered Users',
      subtitle: `${records.length} user${records.length === 1 ? '' : 's'}${search ? ` matching "${search}"` : ''} • Generated ${formatDateTime(new Date())}`,
      columns,
      rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/events/export -> export the all-events summary (main admin only)

// POST /admin/events/:id/delete -> delete an event (main admin only)
router.post('/events/:id/delete', requireMainAdmin, async (req, res, next) => {
  try {
    const deleted = await db.deleteEvent(req.params.id);
    if (!deleted) return res.status(404).render('404', { message: 'ઇવેન્ટ મળ્યો નહીં' });
    res.redirect('/admin/events?deleted=1');
  } catch (err) {
    next(err);
  }
});

router.get('/events/export', requireMainAdmin, async (req, res, next) => {
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

    const columns = [
        { header: 'Event Name', key: 'name', width: 28 },
        { header: 'Date', key: 'date', width: 20 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Location', key: 'location', width: 22 },
        { header: 'Max Capacity', key: 'maxCapacity', width: 14 },
        { header: 'Checked-In Count', key: 'checkedInCount', width: 17 },
        { header: 'Description', key: 'description', width: 34 },
        { header: 'Created On', key: 'createdAt', width: 22 },
        { header: 'Event ID', key: 'id', width: 30 },
    ];
    const baseName = `events-${new Date().toISOString().slice(0, 10)}`;

    if (req.query.format === 'csv') {
      return sendCsvFile(res, { filename: `${baseName}.csv`, columns, rows });
    }

    await sendExcelFile(res, {
      filename: `${baseName}.xlsx`,
      sheetName: 'Events',
      title: 'Events',
      headerColor: 'FF0066CC',
      subtitle: `${events.length} event${events.length === 1 ? '' : 's'} • Generated ${formatDateTime(new Date())}`,
      columns,
      rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/events/:id/export -> export one event's (filtered) attendance
// list, as Excel by default or CSV with ?format=csv.
router.get('/events/:id/export', requireAdmin, requireEventAccess, async (req, res, next) => {
  try {
    const event = await db.getEventById(req.params.id);
    if (!event) return res.status(404).render('404', { message: 'ઇવેન્ટ મળ્યો નહીં' });

    const attendanceFilters = extractAttendanceFilters(req.query);
    const attendance = await db.queryEventAttendance(req.params.id, attendanceFilters);

    const rows = attendance.map((p) => ({
      name: p.name,
      age: p.age,
      phone: p.phone,
      whatsapp: p.whatsapp,
      email: p.email,
      gender: p.gender,
      dob: p.dob,
      location: p.location === 'અન્ય' ? (p.location_other || p.location) : p.location,
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
    const columns = [
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
    ];
    const baseName = `${safeFilename(event.event_name)}-attendance-${new Date().toISOString().slice(0, 10)}`;

    if (req.query.format === 'csv') {
      return sendCsvFile(res, { filename: `${baseName}.csv`, columns, rows });
    }

    await sendExcelFile(res, {
      filename: `${baseName}.xlsx`,
      sheetName: 'Attendance',
      title: `${event.event_name} — Attendance`,
      headerColor: 'FF0066CC',
      subtitle: `${eventDateStr}${event.location ? ' • ' + event.location : ''} • ${attendance.length} checked in • Generated ${formatDateTime(new Date())}`,
      columns,
      rows,
    });
  } catch (err) {
    next(err);
  }
});

// ==================== EVENT EMAIL ROUTES ====================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== CUSTOM EMAIL (user list page, main admin only) ====================
// A free-form, single-recipient email composer reachable straight from the
// user list ("✉" button per row, or the "Custom Email" button up top) —
// unlike the event-email sender above, this is never tied to an event and
// never sends to a bulk list, so it can go out immediately with no
// confirmation step.

// GET /admin/custom-email -> compose form. ?to= & ?name= optionally prefill
// the recipient (used by the per-row "✉" button on the dashboard).
router.get('/custom-email', requireMainAdmin, (req, res) => {
  res.render('admin-custom-email', {
    adminUsername: req.session.adminUsername,
    adminRole: req.session.adminRole,
    isAdmin: true,
    result: null,
    error: null,
    formData: {
      to: req.query.to || '',
      name: req.query.name || '',
    },
  });
});

// POST /admin/custom-email -> send the composed email to a single, freely
// editable address (does not have to belong to any registered user).
router.post('/custom-email', requireMainAdmin, async (req, res, next) => {
  try {
    const { to, name, subject, message } = req.body;
    const renderBase = {
      adminUsername: req.session.adminUsername,
      adminRole: req.session.adminRole,
      isAdmin: true,
    };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!to || !emailRegex.test(to.trim()) || !subject || !subject.trim() || !message || !message.trim()) {
      return res.render('admin-custom-email', {
        ...renderBase,
        result: null,
        error: 'કૃપા કરીને યોગ્ય ઈમેલ સરનામું, વિષય અને સંદેશ ભરો.',
        formData: req.body,
      });
    }

    const bodyHtml = buildEmailBodyHtml(message);
    const outcome = await notify.sendEventEmail({
      to: to.trim(),
      name: name ? name.trim() : null,
      subject: subject.trim(),
      bodyHtml,
    });

    res.render('admin-custom-email', {
      ...renderBase,
      error: null,
      formData: { to: to.trim(), name: name || '' },
      result: {
        to: to.trim(),
        sent: outcome.success ? 1 : 0,
        failed: outcome.success || outcome.skipped ? 0 : 1,
        skipped: outcome.skipped ? 1 : 0,
        skipReason: outcome.skipped ? outcome.reason : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/events/:id/email -> compose form for the manual event email
// (main admin only — event admins can no longer access the custom email sender)
router.get('/events/:id/email', requireMainAdmin, async (req, res, next) => {
  try {
    const event = await db.getEventById(req.params.id);
    if (!event) return res.status(404).render('404', { message: 'ઇવેન્ટ મળ્યો નહીં' });

    res.render('admin-event-email', {
      event,
      adminUsername: req.session.adminUsername,
      adminRole: req.session.adminRole,
      isAdmin: true,
      result: null,
      preview: null,
      error: null,
      formData: {},
    });
  } catch (err) {
    next(err);
  }
});

function buildEmailBodyHtml(message) {
  return message
    .trim()
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 12px;">${para.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// POST /admin/events/:id/email -> send the composed email.
//
// Two safety nets, added after a live filter pool got emailed during testing:
//  1. "Test mode" (a single admin-entered address) always sends immediately
//     and never touches the real recipient pool.
//  2. A real send to "all registered users" / "not checked in" requires an
//     explicit confirmation round-trip showing the recipient count first —
//     the first submit only previews, the second (with confirmed=1) sends.
router.post('/events/:id/email', requireMainAdmin, async (req, res, next) => {
  try {
    const event = await db.getEventById(req.params.id);
    if (!event) return res.status(404).render('404', { message: 'ઇવેન્ટ મળ્યો નહીં' });

    const { subject, message, recipients, testEmail, confirmed } = req.body;
    const renderBase = {
      event,
      adminUsername: req.session.adminUsername,
      adminRole: req.session.adminRole,
      isAdmin: true,
    };

    if (!subject || !subject.trim() || !message || !message.trim()) {
      return res.render('admin-event-email', {
        ...renderBase,
        result: null,
        preview: null,
        error: 'વિષય અને સંદેશ બંને ભરવા ફરજિયાત છે.',
        formData: req.body,
      });
    }

    const bodyHtml = buildEmailBodyHtml(message);

    // ---- Test mode: single address, sends immediately, no confirmation needed ----
    if (testEmail && testEmail.trim()) {
      const outcome = await notify.sendEventEmail({
        to: testEmail.trim(),
        name: null,
        subject: `[ટેસ્ટ] ${subject.trim()}`,
        bodyHtml,
      });
      return res.render('admin-event-email', {
        ...renderBase,
        error: null,
        preview: null,
        formData: {},
        result: {
          testMode: true,
          to: testEmail.trim(),
          sent: outcome.success ? 1 : 0,
          failed: outcome.success || outcome.skipped ? 0 : 1,
          skipped: outcome.skipped ? 1 : 0,
        },
      });
    }

    const targets = recipients === 'not-checked-in'
      ? await db.getUsersNotCheckedIn(event.id)
      : await db.getAllRecords();

    // ---- Preview step: show the real recipient count and require a second click ----
    if (confirmed !== '1') {
      return res.render('admin-event-email', {
        ...renderBase,
        error: null,
        result: null,
        formData: req.body,
        preview: { count: targets.length, recipients: recipients || 'all' },
      });
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const record of targets) {
      const outcome = await notify.sendEventEmail({
        to: record.email,
        name: record.name,
        subject: subject.trim(),
        bodyHtml,
      });
      if (outcome.success) sent++;
      else if (outcome.skipped) skipped++;
      else failed++;
      // Small delay between sends to stay comfortably within Brevo's rate limits.
      await sleep(150);
    }

    res.render('admin-event-email', {
      ...renderBase,
      error: null,
      preview: null,
      formData: {},
      result: { sent, failed, skipped, total: targets.length },
    });
  } catch (err) {
    next(err);
  }
});

// ==================== QR EMAIL ROUTES (main admin only) ====================

// GET /admin/send-qr-all -> show bulk QR send confirmation page
router.get('/send-qr-all', requireMainAdmin, async (req, res, next) => {
  try {
    const allRecords = await db.getAllRecords();
    const withEmail = allRecords.filter((r) => r.email && r.email.trim());
    res.render('admin-send-qr-all', {
      total: allRecords.length,
      withEmail: withEmail.length,
      withoutEmail: allRecords.length - withEmail.length,
      adminUsername: req.session.adminUsername,
      adminRole: req.session.adminRole,
      isAdmin: true,
      result: null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/send-qr-all -> bulk send QR emails to all registered users
router.post('/send-qr-all', requireMainAdmin, async (req, res, next) => {
  try {
    const allRecords = await db.getAllRecords();
    const targets = allRecords.filter((r) => r.email && r.email.trim());

    let sent = 0; let failed = 0; let skipped = 0;
    const errors = [];

    for (const record of targets) {
      try {
        const qrBuffer = await db.getQr(record.id);
        if (!qrBuffer) { skipped++; continue; }
        const viewUrl = `${config.baseUrl}/view/${record.id}`;
        const outcome = await notify.sendEmailQr({ to: record.email, name: record.name, qrBuffer, viewUrl });
        if (outcome.success) sent++;
        else if (outcome.skipped) skipped++;
        else { failed++; errors.push(`${record.name}: ${outcome.error}`); }
        // Rate-limit delay: Brevo free tier ~3 emails/sec
        await sleep(350);
      } catch (e) {
        failed++;
        errors.push(`${record.name}: ${e.message}`);
      }
    }

    res.render('admin-send-qr-all', {
      total: allRecords.length,
      withEmail: targets.length,
      withoutEmail: allRecords.length - targets.length,
      adminUsername: req.session.adminUsername,
      adminRole: req.session.adminRole,
      isAdmin: true,
      result: { sent, failed, skipped, total: targets.length, errors: errors.slice(0, 10) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/events/:id -> view event details and attendance
router.get('/events/:id', requireAdmin, requireEventAccess, async (req, res, next) => {
  try {
    const event = await db.getEventById(req.params.id);
    if (!event) return res.status(404).render('404', { message: 'ઇવેન્ટ મળ્યો નહીં' });

    const attendanceFilters = extractAttendanceFilters(req.query);
    const attendance = await db.queryEventAttendance(req.params.id, attendanceFilters);
    const stats = await db.getEventStats(req.params.id);

    res.render('admin-event-detail', {
      event,
      attendance,
      stats,
      attendanceFilters,
      filterOptions: FILTER_OPTIONS,
      adminUsername: req.session.adminUsername,
      adminRole: req.session.adminRole,
      isAdmin: true,
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/send-qr/:id -> resend QR email to a single user
router.post('/send-qr/:id', requireMainAdmin, async (req, res, next) => {
  try {
    const record = await db.getRecordById(req.params.id);
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' });

    if (!record.email || !record.email.trim()) {
      return res.json({ success: false, error: 'This user has no email address on file.' });
    }

    const qrBuffer = await db.getQr(req.params.id);
    if (!qrBuffer) return res.json({ success: false, error: 'QR code not found for this user.' });

    const viewUrl = `${config.baseUrl}/view/${record.id}`;
    const result = await notify.sendEmailQr({ to: record.email, name: record.name, qrBuffer, viewUrl });

    if (result.success) {
      return res.json({ success: true, message: `QR sent to ${record.email}` });
    } else if (result.skipped) {
      return res.json({ success: false, error: `Skipped: ${result.reason}` });
    } else {
      return res.json({ success: false, error: result.error || 'Failed to send email' });
    }
  } catch (err) {
    next(err);
  }
});

// ==================== CHECK-IN ROUTES ====================

// GET /admin/checkin -> check-in page (scanner interface)
router.get('/checkin', requireAdmin, requireEventAccess, async (req, res, next) => {
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
        error: 'કોઈ ઇવેન્ટ મળ્યો નહીં. કૃપા કરીને ઇવેન્ટ પસંદ કરો.',
        adminUsername: req.session.adminUsername,
        adminRole: req.session.adminRole,
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
      adminRole: req.session.adminRole,
      isAdmin: true,
    });
  } catch (err) {
    next(err);
  }
});

// API endpoint: POST /admin/api/checkin
// Called when admin scans a QR or enters a user ID
router.post('/api/checkin', requireAdmin, requireEventAccess, async (req, res, next) => {
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
router.post('/api/checkout', requireAdmin, requireEventAccess, async (req, res, next) => {
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
