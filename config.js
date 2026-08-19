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
    brevoApiKey: process.env.BREVO_API_KEY || '',
    from: process.env.EMAIL_FROM || '',
    fromName: process.env.EMAIL_FROM_NAME || 'Yuva Sangam 2026',
  },
};

