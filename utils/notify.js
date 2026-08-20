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

// Builds a branded, inline-styled HTML email shell (table-based layout for
// max email-client compatibility). Reused by both the registration QR email
// and (in a later phase) the manual event-announcement email, so the brand
// header/footer only lives in one place.
function buildEmailHtml({ title, bodyHtml, ctaText, ctaUrl, imageCid }) {
  const ctaButton = ctaText && ctaUrl
    ? `<tr><td align="center" style="padding:0 32px 32px;">
         <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed 0%,#db2777 100%);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:999px;">${ctaText}</a>
       </td></tr>`
    : '';

  const qrImage = imageCid
    ? `<tr><td align="center" style="padding:0 32px 24px;">
         <div style="background:#f7f6fd;border:1px solid #e6e3f5;border-radius:16px;padding:20px;display:inline-block;">
           <img src="cid:${imageCid}" width="220" height="220" alt="QR Code" style="display:block;border-radius:10px;" />
         </div>
       </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="gu">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f7f6fd;font-family:'Noto Sans Gujarati','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f6fd;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(109,40,217,0.12);">
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#db2777 100%);padding:28px 32px;text-align:center;">
              <div style="font-size:13px;color:#f1ecfd;font-weight:700;letter-spacing:0.03em;margin-bottom:6px;">🕉️ રાષ્ટ્રીય સ્વયંસેવક સંઘ - નરોડા ભાગ 🕉️</div>
              <div style="font-size:22px;color:#ffffff;font-weight:800;">યુવા સંગમ ૨૦૨૬</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <h1 style="margin:0 0 16px;font-size:19px;color:#1f2937;font-weight:800;">${title}</h1>
              <div style="font-size:15px;line-height:1.7;color:#1f2937;">${bodyHtml}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f7f6fd;border-top:1px solid #e6e3f5;text-align:center;">
              <div style="font-size:12px;color:#6b7280;">યુવા સંગમ ૨૦૨૬ • રાષ્ટ્રીય સ્વયંસેવક સંઘ - નરોડા ભાગ</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
const bodyHtml =
  `<p style="margin:0 0 12px;">નમસ્તે ${name},</p>` +
  `<p style="margin:0 0 12px;">'યુવા સંગમ ૨૦૨૬' માટે નોંધણી કરાવવા બદલ આભાર. તમારો QR કોડ આ ઈમેલ સાથે PNG ફોર્મેટમાં જોડવામાં આવ્યો છે.</p>` +
  `<p style="margin:0;">કૃપા કરીને ચેક-ઈન સમયે તે બતાવશો.</p>`;

const htmlContent = buildEmailHtml({
  title: `નમસ્તે ${name}, આ રહ્યો તમારો QR કોડ`,
  bodyHtml,
  imageCid: 'qrcode',
  ctaText: viewUrl ? 'તમારી પ્રોફાઇલ જુઓ' : null,
  ctaUrl: viewUrl || null,
});

const result = await brevoRequest({
sender: { name: config.email.fromName, email: config.email.from },
to: [{ email: to.trim(), name: name || undefined }],
subject: 'Your Registration QR Code - Yuva Sangam 2026',
textContent:
`નમસ્તે ${name},\n\n` +
`'યુવા સંગમ ૨૦૨૬' (Yuva Sangam 2026) માટે નોંધણી કરાવવા બદલ આભાર. તમારો QR કોડ આ ઈમેલ સાથે PNG ફોર્મેટમાં જોડવામાં આવ્યો છે.\n` +
`કૃપા કરીને ચેક-ઈન સમયે તે બતાવશો.\n\n`,
htmlContent,
attachment: [{ content: qrBuffer.toString('base64'), name: 'qr-code.png' }],
inlineImages: [{ content: qrBuffer.toString('base64'), name: 'qr-code.png', contentId: 'qrcode' }],
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

// Manual event-announcement email — reuses the same branded shell as the
// registration QR email, with admin-authored subject/body instead.
async function sendEventEmail({ to, name, subject, bodyHtml }) {
  if (!to || !to.trim()) {
    return { skipped: true, reason: 'no email address on record' };
  }

  const missing = [];
  if (!config.email.brevoApiKey) missing.push('BREVO_API_KEY');
  if (!config.email.from) missing.push('EMAIL_FROM');
  if (missing.length) {
    return { skipped: true, reason: 'brevo not configured' };
  }

  try {
    const htmlContent = buildEmailHtml({ title: subject, bodyHtml });
    const result = await brevoRequest({
      sender: { name: config.email.fromName, email: config.email.from },
      to: [{ email: to.trim(), name: name || undefined }],
      subject,
      textContent: bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      htmlContent,
    });
    return { success: true, messageId: result.messageId };
  } catch (err) {
    return { success: false, error: err.message, code: err.code };
  }
}

async function notifyNewRegistration({ record, qrBuffer, viewUrl }) {
const emailResult = await sendEmailQr({ to: record.email, name: record.name, qrBuffer, viewUrl });
return { email: emailResult };
}

module.exports = {
buildEmailHtml,
sendEmailQr,
sendEventEmail,
notifyNewRegistration,
};
