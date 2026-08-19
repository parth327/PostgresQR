require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  baseUrl: (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  sessionSecret: process.env.SESSION_SECRET || 'insecure-dev-secret-change-me',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || '',
  databaseUrl: process.env.DATABASE_URL || '',
  // Render (and most hosted Postgres) requires SSL. Set DB_SSL=false in .env
  // if you're connecting to a local Postgres install without SSL.
  dbSsl: process.env.DB_SSL !== 'false',

  // ---- Email (SMTP) — used to email the QR code after registration ----
  email: {
    host: process.env.SMTP_HOST || '',
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
    secure: process.env.SMTP_SECURE === 'true', // true for port 465
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || process.env.SMTP_USER || '',
  },

  // ---- Twilio — used to send the QR via WhatsApp and SMS after registration ----
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    smsFrom: process.env.TWILIO_SMS_FROM || '',           // e.g. '+15017122661'
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM || '', // e.g. 'whatsapp:+14155238886'
  },
};

