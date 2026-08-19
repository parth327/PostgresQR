// Sends the generated QR code to the registrant automatically after
// registration, over three channels: Email, WhatsApp, and SMS.
//
// Each channel is independently optional — if its credentials aren't
// configured in .env, that channel is skipped with a console warning
// instead of throwing, so registration itself never fails because a
// notification provider is unset or unreachable.

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
// WhatsApp + SMS (Twilio) — lazily required so the app still runs fine
// if the `twilio` package/credentials aren't set up.
// ---------------------------------------------------------------------

let twilioClient = null;
let twilioClientChecked = false;

function getTwilioClient() {
  if (twilioClientChecked) return twilioClient;
  twilioClientChecked = true;
  if (!config.twilio.accountSid || !config.twilio.authToken) return null;
  try {
    const twilio = require('twilio');
    twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
  } catch (err) {
    console.warn('[notify] "twilio" package not installed — run `npm install twilio`.');
    twilioClient = null;
  }
  return twilioClient;
}

// Assumes Indian 10-digit mobile numbers by default (matches the form's
// existing validation). Anything already prefixed with "+" is left as-is.
function toE164(raw, defaultCountryCode = '91') {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith('+')) return trimmed.replace(/[^\d+]/g, '');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`;
  return `+${digits}`;
}

async function sendWhatsAppQr({ to, name, qrImageUrl, viewUrl }) {
  const number = toE164(to);
  if (!number) return { skipped: true, reason: 'no whatsapp/phone number on record' };

  const client = getTwilioClient();
  if (!client || !config.twilio.whatsappFrom) {
    console.warn('[notify] WhatsApp not sent: Twilio is not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in .env).');
    return { skipped: true, reason: 'twilio whatsapp not configured' };
  }

  try {
    await client.messages.create({
      from: config.twilio.whatsappFrom, // e.g. 'whatsapp:+14155238886'
      to: `whatsapp:${number}`,
      body: `Namaste ${name}! Thank you for registering for Yuva Sangam 2026. Your QR code is attached. View your details: ${viewUrl}`,
      mediaUrl: [qrImageUrl],
    });
    return { success: true };
  } catch (err) {
    console.error('[notify] Failed to send WhatsApp message:', err.message);
    return { success: false, error: err.message };
  }
}

async function sendSmsQr({ to, name, qrImageUrl }) {
  const number = toE164(to);
  if (!number) return { skipped: true, reason: 'no phone number on record' };

  const client = getTwilioClient();
  if (!client || !config.twilio.smsFrom) {
    console.warn('[notify] SMS not sent: Twilio is not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM in .env).');
    return { skipped: true, reason: 'twilio sms not configured' };
  }

  try {
    // Plain SMS can't carry an image reliably outside the US/Canada (MMS),
    // so we text a link to the QR image instead — it always works.
    await client.messages.create({
      from: config.twilio.smsFrom,
      to: number,
      body: `Namaste ${name}! Thanks for registering for Yuva Sangam 2026. View/download your QR code: ${qrImageUrl}`,
    });
    return { success: true };
  } catch (err) {
    console.error('[notify] Failed to send SMS:', err.message);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------
// Convenience: fire all three channels for a freshly-created record.
// Never throws — failures/skips are only logged, so registration always
// succeeds even if notification providers are down or unconfigured.
// ---------------------------------------------------------------------

async function notifyNewRegistration({ record, qrBuffer, viewUrl, qrImageUrl }) {
  const results = await Promise.allSettled([
    sendEmailQr({ to: record.email, name: record.name, qrBuffer, viewUrl }),
    sendWhatsAppQr({ to: record.whatsapp || record.phone, name: record.name, qrImageUrl, viewUrl }),
    sendSmsQr({ to: record.phone, name: record.name, qrImageUrl, viewUrl }),
  ]);

  const [emailResult, waResult, smsResult] = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { success: false, error: r.reason && r.reason.message }
  );

  return { email: emailResult, whatsapp: waResult, sms: smsResult };
}

module.exports = {
  sendEmailQr,
  sendWhatsAppQr,
  sendSmsQr,
  notifyNewRegistration,
};
