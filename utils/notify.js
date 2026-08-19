const https = require('https');
const config = require('../config');

function brevoRequest(payload) {
return new Promise((resolve, reject) => {
const body = JSON.stringify(payload);
const req = https.request(
{
hostname: 'api.brevo.com',
path: '/v3/smtp/email',
method: 'POST',
headers: {
'Content-Type': 'application/json',
Accept: 'application/json',
'api-key': config.email.brevoApiKey,
'Content-Length': Buffer.byteLength(body),
},
timeout: 15000,
},
(res) => {
let data = '';
res.on('data', (chunk) => { data += chunk; });
res.on('end', () => {
let parsed = {};
try { parsed = data ? JSON.parse(data) : {}; } catch (e) { parsed = { raw: data }; }
if (res.statusCode >= 200 && res.statusCode < 300) {
resolve(parsed);
} else {
const err = new Error(parsed.message || `Brevo API returned HTTP ${res.statusCode}`);
err.statusCode = res.statusCode;
err.code = parsed.code;
err.details = parsed;
reject(err);
}
});
}
);
req.on('timeout', () => req.destroy(new Error('Brevo API request timed out')));
req.on('error', reject);
req.write(body);
req.end();
});
}

async function sendEmailQr({ to, name, qrBuffer, viewUrl }) {
if (!to || !to.trim()) {
console.warn('[notify] Email skipped: no email address on this record.');
return { skipped: true, reason: 'no email address on record' };
}

const missing = [];
if (!config.email.brevoApiKey) missing.push('BREVO_API_KEY');
if (!config.email.from) missing.push('EMAIL_FROM');
if (missing.length) {
console.warn(`[notify] Email disabled: missing ${missing.join(', ')} in your .env file.`);
return { skipped: true, reason: 'brevo not configured' };
}

try {
const result = await brevoRequest({
sender: { name: config.email.fromName, email: config.email.from },
to: [{ email: to.trim(), name: name || undefined }],
subject: 'Your Registration QR Code - Yuva Sangam 2026',
textContent:
`નમસ્તે ${name},\n\n` +
`'યુવા સંગમ ૨૦૨૬' (Yuva Sangam 2026) માટે નોંધણી કરાવવા બદલ આભાર. તમારો QR કોડ આ ઈમેલ સાથે PNG ફોર્મેટમાં જોડવામાં આવ્યો છે.\n` +
`કૃપા કરીને ચેક-ઈન સમયે તે બતાવશો.\n\n`,
htmlContent:
`<p>નમસ્તે ${name},</p>` +
`<p>યુવા સંગમ ૨૦૨૬' (Yuva Sangam 2026) માટે નોંધણી કરાવવા બદલ આભાર. તમારો QR કોડ આ ઈમેલ સાથે PNG ફોર્મેટમાં જોડવામાં આવ્યો છે.` +
`કૃપા કરીને ચેક-ઈન સમયે તે બતાવશો.</p>`,
attachment: [{ content: qrBuffer.toString('base64'), name: 'qr-code.png' }],
});

console.log(`[notify] SUCCESS: email sent to ${to.trim()} via Brevo — messageId=${result.messageId}`);
return { success: true, messageId: result.messageId };
} catch (err) {
console.error(`[notify] FAIL: could not send email to ${to.trim()} via Brevo.`, {
message: err.message,
statusCode: err.statusCode,
code: err.code,
details: err.details,
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
