const express = require('express');
const session = require('express-session');
const path = require('path');

const config = require('./configconst express = require('express');
const session = require('express-session');
const path = require('path');

const config = require('./config');
const db = require('./db');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const {
  formatEventDate, formatShortDate, formatDateTime, formatTime,
  formatEventDateGu, formatShortDateGu, formatDateTimeGu, formatTimeGu,
} = require('./utils/datetime');

const app = express();
app.get('/healthz', function(req, res) {
  res.status(200).send('OK');
});
// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Make IST-aware date/time formatters available in every EJS template
// (e.g. <%= formatDateTime(person.checked_in_at) %>) without each route
// having to pass them through res.render() individually.
app.locals.formatEventDate = formatEventDate;
app.locals.formatShortDate = formatShortDate;
app.locals.formatDateTime = formatDateTime;
app.locals.formatTime = formatTime;
app.locals.formatEventDateGu = formatEventDateGu;
app.locals.formatShortDateGu = formatShortDateGu;
app.locals.formatDateTimeGu = formatDateTimeGu;
app.locals.formatTimeGu = formatTimeGu;

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files (css, client-side assets - photos & QR codes are now served
// dynamically from the database via routes, not from this static folder)
app.use(express.static(path.join(__dirname, 'public')));

// Sessions (used for admin login only)
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
      httpOnly: true,
    },
  })
);

// Routes
app.use('/', publicRoutes);
app.use('/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { message: 'Page not found.' });
});

// Generic error handler (catches errors passed via next(err) from async routes)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).render('404', { message: 'Something went wrong. Please try again.' });
});

async function start() {
  try {
    await db.init();
  } catch (err) {
    console.error('Failed to connect to the database. Check DATABASE_URL in your .env file.');
    console.error(err);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log('==================================================');
    console.log(`  QR Registration App running!`);
    console.log(`  Local:      http://localhost:${config.port}`);
    console.log(`  Register:   http://localhost:${config.port}/register`);
    console.log(`  Admin:      http://localhost:${config.port}/admin/login`);
    console.log('==================================================');
  });
}

start();

const db = require('./db');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const {
  formatEventDate, formatShortDate, formatDateTime, formatTime,
  formatEventDateGu, formatShortDateGu, formatDateTimeGu, formatTimeGu,
} = require('./utils/datetime');

const app = express();
app.get('/healthz', function(req, res) {
  res.status(200).send('OK');
});
// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Make IST-aware date/time formatters available in every EJS template
// (e.g. <%= formatDateTime(person.checked_in_at) %>) without each route
// having to pass them through res.render() individually.
app.locals.formatEventDate = formatEventDate;
app.locals.formatShortDate = formatShortDate;
app.locals.formatDateTime = formatDateTime;
app.locals.formatTime = formatTime;
app.locals.formatEventDateGu = formatEventDateGu;
app.locals.formatShortDateGu = formatShortDateGu;
app.locals.formatDateTimeGu = formatDateTimeGu;
app.locals.formatTimeGu = formatTimeGu;

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files (css, client-side assets - photos & QR codes are now served
// dynamically from the database via routes, not from this static folder)
app.use(express.static(path.join(__dirname, 'public')));

// Sessions (used for admin login only)
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
      httpOnly: true,
    },
  })
);

// Routes
app.use('/', publicRoutes);
app.use('/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { message: 'Page not found.' });
});

// Generic error handler (catches errors passed via next(err) from async routes)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).render('404', { message: 'Something went wrong. Please try again.' });
});

async function start() {
  try {
    await db.init();
  } catch (err) {
    console.error('Failed to connect to the database. Check DATABASE_URL in your .env file.');
    console.error(err);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log('==================================================');
    console.log(`  QR Registration App running!`);
    console.log(`  Local:      http://localhost:${config.port}`);
    console.log(`  Register:   http://localhost:${config.port}/register`);
    console.log(`  Admin:      http://localhost:${config.port}/admin/login`);
    console.log('==================================================');
  });
}

start();
