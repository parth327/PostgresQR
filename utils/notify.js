const nodemailer = require('nodemailer');
const config = require('../config');

let mailTransporter = null;
let mailTransporterChecked = false;

function getMailTransporter() {
if (mailTransporterChecked) return mailTransporter;
mailTransporterChecked = true;

const missing = [];
if (!config.email.host) missing.push('SMTP_HOST');
if (!config.email.user) missing.push('SMTP_USER');
if (!config.email.pass) missing.push('SMTP_PASS');
if (missing.length) {
console.warn(`[notify] Email disabled: missing ${missing.join(', ')} in your .env file.`);
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
if (!to || !to.trim()) {
console.warn('[notify] Email skipped: no email address on this record.');
return { skipped: true, reason: 'no email address on record' };
}

const transporter = getMailTransporter();
if (!transporter) {
// getMailTransporter() already logged exactly which env var is missing.
return { skipped: true, reason: 'smtp not configured' };
}

try {
const info = await transporter.sendMail({
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

// sendMail() can resolve without throwing even if the receiving server
// rejected the recipient — info.rejected catches that case too.
if (info.rejected && info.rejected.length) {
console.error(`[notify] FAIL: ${to.trim()} was rejected by the mail server.`, { rejected: info.rejected, response: info.response });
return { success: false, error: `Recipient rejected: ${info.rejected.join(', ')}` };
}

console.log(`[notify] SUCCESS: email sent to ${to.trim()} — messageId=${info.messageId} response="${info.response}"`);
return { success: true, messageId: info.messageId };
} catch (err) {
// err.code / responseCode / command are the actual useful bits for SMTP
// failures — err.message alone is often just a vague "Invalid login".
// Common err.code values: EAUTH (wrong user/pass), ECONNECTION/ETIMEDOUT
// (can't reach host/port), ESOCKET (TLS/port mismatch, e.g. secure flag
// wrong for the port).
console.error(`[notify] FAIL: could not send email to ${to.trim()}.`, {
message: err.message,
code: err.code,
responseCode: err.responseCode,
command: err.command,
});
return { success: false, error: err.message, code: err.code };
}
}

async function notifyNewRegistration({ record, qrBuffer, viewUrl }) {
const emailResult = await sendEmailQr({ to: record.email, name: record.name, qrBuffer, viewUrl });
return { email: emailResult };
}

module.exports = {
sendEmailQr,
notifyNewRegistration,
};
