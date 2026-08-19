// Sends the generated QR code to the registrant automatically after
// registration, by Email.
//
// Email is optional — if SMTP isn't configured in .env, it's skipped with
// a console warning instead of throwing, so registration itself never
// fails just because the mail provider is unset or unreachable.

const nodemailer = require('nodemailer');
const config = require('../config');

// ---------------------------------------------------------------------
// Email (SMTP via Nodemailer)
// ---------------------------------------------------------------------

let mailTransporter = null;
let mailTransporterChecked = false;

function getMailTransporter() {
  if (mailTransporterChecked) return mailTransporter;
  mailTransporterChecked = true;
  if (!config.email.host || !config.email.user || !config.email.pass) {
    return null;
  }
  mailTransporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure, // true for port 465, false for 587/others
    auth: { user: config.email.user, pass: config.email.pass },
  });
  return mailTransporter;
}

async function sendEmailQr({ to, name, qrBuffer, viewUrl }) {
  if (!to || !to.trim()) return { skipped: true, reason: 'no email address on record' };

  const transporter = getMailTransporter();
  if (!transporter) {
    console.warn('[notify] Email not sent: SMTP is not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS in .env).');
    return { skipped: true, reason: 'smtp not configured' };
  }

  try {
    await transporter.sendMail({
      from: config.email.from,
      to: to.trim(),
      subject: 'Your Registration QR Code - Yuva Sangam 2026',
      text:
        `Namaste ${name},\n\n` +
        `Thank you for registering for Yuva Sangam 2026. Your QR code is attached to this email.\n` +
        `Please show it at check-in.\n\n` +
        `You can also view it any time at: ${viewUrl}\n`,
      html:
        `<p>Namaste ${name},</p>` +
        `<p>Thank you for registering for <strong>Yuva Sangam 2026</strong>. Your QR code is attached ` +
        `to this email — please show it at check-in.</p>` +
        `<p><img src="cid:qrcode" alt="Your QR Code" style="width:220px;height:220px;" /></p>`,
      attachments: [
        { filename: 'qr-code.png', content: qrBuffer, cid: 'qrcode' },
      ],
    });
    return { success: true };
  } catch (err) {
    console.error('[notify] Failed to send email:', err.message);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------
// Convenience wrapper for a freshly-created record. Never throws — a
// failed/skipped send is only logged, so registration always succeeds
// even if the mail provider is down or unconfigured.
// ---------------------------------------------------------------------

async function notifyNewRegistration({ record, qrBuffer, viewUrl }) {
  const emailResult = await sendEmailQr({ to: record.email, name: record.name, qrBuffer, viewUrl });
  return { email: emailResult };
}

module.exports = {
  sendEmailQr,
  notifyNewRegistration,
};
