const nodemailer = require('nodemailer');
const config = require('../config');

async function main() {
const to = process.argv[2];

console.log('--- SMTP config check ---');
console.log('SMTP_HOST:', config.email.host || '(missing)');
console.log('SMTP_PORT:', config.email.port);
console.log('SMTP_SECURE:', config.email.secure);
console.log('SMTP_USER:', config.email.user || '(missing)');
console.log('SMTP_PASS:', config.email.pass ? '(set, ' + config.email.pass.length + ' chars)' : '(missing)');
console.log('EMAIL_FROM:', config.email.from || '(missing)');
console.log('-------------------------\n');

const missing = [];
if (!config.email.host) missing.push('SMTP_HOST');
if (!config.email.user) missing.push('SMTP_USER');
if (!config.email.pass) missing.push('SMTP_PASS');
if (missing.length) {
console.error(`FAIL: missing ${missing.join(', ')} in your .env file. Add them and try again.`);
process.exit(1);
}

if (!to) {
console.error('FAIL: no recipient given. Usage: node utils/test-email.js you@example.com');
process.exit(1);
}

const transporter = nodemailer.createTransport({
host: config.email.host,
port: config.email.port,
secure: config.email.secure,
auth: { user: config.email.user, pass: config.email.pass },
});

try {
console.log('Connecting and authenticating...');
await transporter.verify();
console.log('SUCCESS: SMTP login OK.\n');
} catch (err) {
console.error('FAIL: could not authenticate with the SMTP server.');
console.error({ message: err.message, code: err.code, responseCode: err.responseCode, command: err.command });
if (err.code === 'EAUTH') {
console.error('\nHint: EAUTH usually means the username/password is wrong.');
console.error('For Gmail, SMTP_PASS must be a 16-character "App Password" (Google Account -> Security -> 2-Step Verification -> App passwords), NOT your normal Gmail login password.');
}
process.exit(1);
}

try {
console.log(`Sending test email to ${to}...`);
const info = await transporter.sendMail({
from: config.email.from,
to,
subject: 'PostgresQR - SMTP test email',
text: 'If you are reading this, your SMTP config in .env is working correctly.',
});

if (info.rejected && info.rejected.length) {
console.error('FAIL: server accepted the connection but rejected the recipient:', info.rejected);
process.exit(1);
}

console.log(`SUCCESS: test email sent — messageId=${info.messageId} response="${info.response}"`);
console.log(`Check the inbox (and spam folder) for ${to}.`);
} catch (err) {
console.error(`FAIL: login worked but sending failed.`);
console.error({ message: err.message, code: err.code, responseCode: err.responseCode, command: err.command });
process.exit(1);
}
}

main();
