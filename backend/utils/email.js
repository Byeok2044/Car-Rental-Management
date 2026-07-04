import { Resend } from 'resend';
import { BRAND, fmtDate, fmtPeso } from './helpers.js';
import { generateReceiptPDF } from './pdf.js';


const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const FROM = process.env.EMAIL_FROM || 'reychee06@gmail.com';

export function getTransporter() {
    if (!process.env.BREVO_API_KEY) {
        console.warn('BREVO_API_KEY not set. Email functions will be disabled.');
    }
    return {
        verify: async () => {
            if (!process.env.BREVO_API_KEY) throw new Error('BREVO_API_KEY missing');
            return true;
        },
    };
}
// ── HTML TEMPLATE ─────────────────────────────────────────────────────────────

export function htmlShell(title, body, accent = '#2563eb') {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<style>body{margin:0;padding:0;background:#f3f4f8;font-family:'Segoe UI',Arial,sans-serif;color:#111827}
.wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)}
.hdr{background:${accent};padding:32px 40px 24px;color:#fff}.hdr h1{margin:0;font-size:1.5rem;font-weight:800}
.hdr p{margin:6px 0 0;font-size:.9rem;opacity:.85}.bdy{padding:32px 40px}
.bdy p{font-size:.95rem;line-height:1.7;margin:0 0 14px}
table{width:100%;border-collapse:collapse;margin:20px 0}
td{padding:10px 14px;font-size:.9rem;border-bottom:1px solid #f1f5f9}
td:first-child{font-weight:600;color:#374151;width:38%}
.tr td{background:#f0fdf4;font-weight:800;font-size:1.05rem}.tr td:last-child{color:#065f46}
.rbox{background:#f8fafc;border-left:4px solid ${accent};border-radius:0 8px 8px 0;padding:18px 20px;margin:20px 0;font-size:.92rem;line-height:1.75;white-space:pre-wrap}
.obox{background:#f1f5f9;border-radius:8px;padding:16px 18px;margin:20px 0;font-size:.85rem;color:#475569}
.ftr{background:#f9fafb;padding:20px 40px;text-align:center;font-size:.8rem;color:#9ca3af;border-top:1px solid #f1f5f9}
.attach-note{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;margin:20px 0;font-size:.88rem;color:#1e40af}
.attach-note strong{display:block;margin-bottom:4px}
</style></head><body><div class="wrap">
<div class="hdr"><h1>${BRAND}</h1><p>${title}</p></div>
<div class="bdy">${body}</div>
<div class="ftr">&copy; ${new Date().getFullYear()} ${BRAND} &bull; All rights reserved.</div>
</div></body></html>`;
}

// ── SHARED BOOKING TABLE ──────────────────────────────────────────────────────

function bookingTable(b, carTitle) {
    return `<table>
<tr><td>Reference</td><td>#${String(b._id).slice(-8).toUpperCase()}</td></tr>
<tr><td>Vehicle</td><td>${carTitle}</td></tr>
${(b.qty ?? 1) > 1 ? `<tr><td>Quantity</td><td>${b.qty} unit(s)</td></tr>` : ''}
<tr><td>Pickup Date</td><td>${fmtDate(b.startDate)}</td></tr>
<tr><td>Return Date</td><td>${fmtDate(b.endDate)}</td></tr>
<tr><td>Rental Days</td><td>${b.rentalDays} day${b.rentalDays !== 1 ? 's' : ''}</td></tr>
${b.pickupLocation ? `<tr><td>Pickup Location</td><td>${b.pickupLocation}</td></tr>` : ''}
</table>`;
}

// ── EMAIL BUILDERS ────────────────────────────────────────────────────────────

export function buildSubmittedEmail(booking, customer, carTitle) {
    return {
        subject: `Booking Received - #${String(booking._id).slice(-8).toUpperCase()} | ${BRAND}`,
        html: htmlShell('Booking Received', `
            <p>Hi <strong>${customer.name}</strong>,</p>
            <p>Thank you for choosing <strong>${BRAND}</strong>! We have received your booking.</p>
            ${bookingTable(booking, carTitle)}
            <p>Questions? Reach our support team anytime.</p>
        `, '#f59e0b'),
    };
}

export function buildQuoteEmail(b, t) {
    return {
        subject: `Your Rental Quote - #${String(b._id).slice(-8).toUpperCase()} | ${BRAND}`,
        html: htmlShell('Your Rental Quote', `<p>Hi <strong>${b.customerName}</strong>,</p>
<p>Here is the quote for your rental:</p>
<table>
<tr><td>Vehicle</td><td>${t}</td></tr>
${(b.qty ?? 1) > 1 ? `<tr><td>Quantity</td><td>${b.qty} unit(s)</td></tr>` : ''}
<tr><td>Pickup Date</td><td>${fmtDate(b.startDate)}</td></tr>
<tr><td>Return Date</td><td>${fmtDate(b.endDate)}</td></tr>
<tr><td>Rental Days</td><td>${b.rentalDays} day${b.rentalDays !== 1 ? 's' : ''}</td></tr>
${b.pickupLocation ? `<tr><td>Pickup Location</td><td>${b.pickupLocation}</td></tr>` : ''}
${b.paymentNotes   ? `<tr><td>Notes</td><td>${b.paymentNotes}</td></tr>` : ''}
<tr class="tr"><td>Total Quote</td><td>${fmtPeso(b.quotedPrice)}</td></tr>
</table>
<p>To confirm, please arrange payment. We accept <strong>Cash</strong>, <strong>GCash</strong>, and <strong>Bank Transfer</strong>.</p>
<p>Warm regards,<br/><strong>${BRAND} Team</strong></p>`, '#065f46'),
    };
}

// ── NEW: Quote Updated Email ───────────────────────────────────────────────────
/**
 * Sent when an admin updates an *existing* quoted price.
 * Shows a clear before/after comparison with colour-coded change indicator.
 *
 * @param {Object} b         - Populated booking document (with customerName, etc.)
 * @param {string} t         - Human-readable vehicle title
 * @param {number} oldPrice  - The previous quoted price
 * @param {number} newPrice  - The newly set quoted price
 */
export function buildQuoteUpdatedEmail(b, t, oldPrice, newPrice) {
    const refNo        = `#${String(b._id).slice(-8).toUpperCase()}`;
    const diff         = newPrice - oldPrice;
    const isIncrease   = diff > 0;
    const changeLabel  = isIncrease ? 'increased' : 'decreased';
    const changeColor  = isIncrease ? '#991b1b' : '#065f46';
    const changeBg     = isIncrease ? '#fee2e2' : '#f0fdf4';
    const changeBorder = isIncrease ? '#fecaca' : '#a7f3d0';
    const changeSign   = isIncrease ? '+' : '';
    const headerAccent = isIncrease ? '#b91c1c' : '#065f46';

    return {
        subject: `Quote Updated (${changeSign}${fmtPeso(Math.abs(diff))}) — ${refNo} | ${BRAND}`,
        html: htmlShell('Rental Quote Updated', `
<p>Hi <strong>${b.customerName}</strong>,</p>
<p>We want to let you know that the quoted price for your rental booking <strong>${refNo}</strong> has been <strong>${changeLabel}</strong> by our team.</p>

<div style="background:${changeBg};border:1.5px solid ${changeBorder};border-radius:10px;padding:20px 24px;margin:24px 0">
  <p style="margin:0 0 14px;font-size:.75rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:${changeColor}">
    &#9650; Quote ${changeLabel.charAt(0).toUpperCase() + changeLabel.slice(1)}
  </p>
  <table style="margin:0;border:none">
    <tr>
      <td style="border:none;padding:6px 14px 6px 0;width:38%;font-weight:600;color:#374151">Previous Quote</td>
      <td style="border:none;padding:6px 0;font-size:1.1rem;font-weight:700;color:#6b7280;text-decoration:line-through">${fmtPeso(oldPrice)}</td>
    </tr>
    <tr>
      <td style="border:none;padding:6px 14px 6px 0;font-weight:700;color:${changeColor}">Updated Quote</td>
      <td style="border:none;padding:6px 0;font-size:1.4rem;font-weight:800;color:${changeColor}">${fmtPeso(newPrice)}</td>
    </tr>
    <tr>
      <td style="border:none;padding:6px 14px 6px 0;font-weight:600;color:#374151">Change</td>
      <td style="border:none;padding:6px 0;font-size:.95rem;font-weight:700;color:${changeColor}">${changeSign}${fmtPeso(Math.abs(diff))}</td>
    </tr>
  </table>
</div>

<table>
<tr><td>Reference</td><td>${refNo}</td></tr>
<tr><td>Vehicle</td><td>${t}</td></tr>
${(b.qty ?? 1) > 1 ? `<tr><td>Quantity</td><td>${b.qty} unit(s)</td></tr>` : ''}
<tr><td>Pickup Date</td><td>${fmtDate(b.startDate)}</td></tr>
<tr><td>Return Date</td><td>${fmtDate(b.endDate)}</td></tr>
<tr><td>Rental Days</td><td>${b.rentalDays} day${b.rentalDays !== 1 ? 's' : ''}</td></tr>
${b.pickupLocation ? `<tr><td>Pickup Location</td><td>${b.pickupLocation}</td></tr>` : ''}
${b.paymentNotes   ? `<tr><td>Notes</td><td>${b.paymentNotes}</td></tr>` : ''}
<tr class="tr"><td>New Total</td><td>${fmtPeso(newPrice)}</td></tr>
</table>

<p>If you have already made a partial payment, our team will factor this in when processing your balance.</p>
<p>If you have any questions or concerns about this price change, please don't hesitate to contact us — we're happy to help.</p>
<p>Warm regards,<br/><strong>${BRAND} Team</strong></p>
        `, headerAccent),
    };
}

export function buildActiveEmail(b, t) {
    return {
        subject: `Your Rental is Now Active - #${String(b._id).slice(-8).toUpperCase()} | ${BRAND}`,
        html: htmlShell('Your Rental is Active', `<p>Hi <strong>${b.customerName}</strong>,</p>
<p>Your booking is now <strong>Active</strong>. Your vehicle is ready for pick-up.</p>
${bookingTable(b, t)}<p>Bring a valid ID and your reference number. Drive safely!</p>`, '#16a34a'),
    };
}

export async function buildCompletedEmail(b, t) {
    const refNo = `#${String(b._id).slice(-8).toUpperCase()}`;
    const html  = htmlShell('Rental Completed', `<p>Hi <strong>${b.customerName}</strong>,</p>
<p>Your rental is now <strong>Completed</strong>. Thank you for choosing <strong>${BRAND}</strong>!</p>
${bookingTable(b, t)}
<div class="attach-note">
  <strong>📄 Official Receipt Attached</strong>
  A PDF receipt is attached to this email. Please save it for your records and any future reference.
</div>
<p>We hope to see you again on your next journey.</p>
<p>Warm regards,<br/><strong>${BRAND} Team</strong></p>`, '#2563eb');

    let pdfBuffer = null;
    try {
        pdfBuffer = await generateReceiptPDF(b, t);
    } catch (err) {
        console.error('[receipt] PDF generation failed:', err.message);
    }

    return {
        subject: `Rental Completed - Thank You! | ${BRAND}`,
        html,
        attachments: pdfBuffer
            ? [{ filename: `Receipt-${refNo.replace('#', '')}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
            : [],
    };
}

export function buildExtensionEmail(b, t, extraDays, reason) {
    return {
        subject: `Booking Extended — +${extraDays} Day${extraDays !== 1 ? 's' : ''} | ${BRAND}`,
        html: htmlShell('Your Rental Has Been Extended', `<p>Hi <strong>${b.customerName}</strong>,</p>
<p>Your rental has been <strong>extended by ${extraDays} day${extraDays !== 1 ? 's' : ''}</strong>.</p>
<table>
<tr><td>Reference</td><td>#${String(b._id).slice(-8).toUpperCase()}</td></tr>
<tr><td>Vehicle</td><td>${t}</td></tr>
${(b.qty ?? 1) > 1 ? `<tr><td>Quantity</td><td>${b.qty} unit(s)</td></tr>` : ''}
<tr><td>Extended By</td><td>+${extraDays} day${extraDays !== 1 ? 's' : ''}</td></tr>
<tr><td>New Return Date</td><td>${fmtDate(b.endDate)}</td></tr>
<tr><td>Total Rental Days</td><td>${b.rentalDays} day${b.rentalDays !== 1 ? 's' : ''}</td></tr>
${reason ? `<tr><td>Reason</td><td>${reason}</td></tr>` : ''}
${b.quotedPrice ? `<tr class="tr"><td>Updated Quote</td><td>${fmtPeso(b.quotedPrice)}</td></tr>` : ''}
</table>
<p>If you have any questions, please contact our support team.</p>
<p>Warm regards,<br/><strong>${BRAND} Team</strong></p>`, '#16a34a'),
    };
}

export function buildReplyEmail(msg, replySubject, replyBody) {
    return {
        subject: replySubject || `Re: ${msg.subject || 'Your enquiry'} | ${BRAND}`,
        html: htmlShell('Reply to your enquiry', `<p>Hi <strong>${msg.name}</strong>,</p>
<p>Our support team has responded to your message:</p>
<div class="rbox">${replyBody.replace(/\n/g, '<br/>')}</div>
<div class="obox"><p style="font-size:.75rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#94a3b8;margin:0 0 8px">Your original message</p>
<p style="margin:0;font-style:italic">"${msg.message}"</p></div>
<p>Warm regards,<br/><strong>${BRAND} Support Team</strong></p>`),
    };
}

// ── SEND ──────────────────────────────────────────────────────────────────────

export async function sendEmail(to, subject, html, attachments = []) {
    if (!to || !process.env.BREVO_API_KEY) return;
    try {
        const res = await fetch(BREVO_API_URL, {
            method: 'POST',
            headers: {
                'api-key': process.env.BREVO_API_KEY,
                'Content-Type': 'application/json',
                'accept': 'application/json',
            },
            body: JSON.stringify({
                sender: { name: BRAND, email: FROM },
                to: [{ email: to }],
                subject,
                htmlContent: html,
                attachment: attachments.map(a => ({
                    name: a.filename,
                    content: a.content.toString('base64'),
                })),
            }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || `Brevo HTTP ${res.status}`);

        console.log(`Email -> ${to}${attachments.length ? ` (+${attachments.length} attachment(s))` : ''} [${data.messageId}]`);
    } catch (e) {
        console.error('Email error:', e.message);
    }
}

export function buildDocsVerifiedEmail(booking, carTitle) {
    const refNo = `#${String(booking._id).slice(-8).toUpperCase()}`;
    return {
        subject: `Documents Verified — Your Booking is Now Pending | ${BRAND}`,
        html: htmlShell('Documents Verified ✓', `
            <p>Hi <strong>${booking.customerName}</strong>,</p>
            <p>Great news! Our team has reviewed and <strong>verified your submitted documents</strong>. Your booking is now in <strong>Pending</strong> status.</p>
            ${bookingTable(booking, carTitle)}
            <p>Here's what happens next:</p>
            <ol style="padding-left:20px;line-height:2">
                <li>Our team will send you a <strong>price quote</strong> for your rental.</li>
                <li>Once you make a payment, your booking will be marked <strong>Active</strong>.</li>
                <li>Pick up your vehicle on the agreed start date — bring a valid ID.</li>
            </ol>
            <p>If you have any questions in the meantime, feel free to reply to this email or contact our support team.</p>
            <p>Thank you for choosing <strong>${BRAND}</strong>!</p>
        `, '#16a34a'),
    };
}

export function buildDocsRejectedEmail(booking, carTitle, reason) {
    const refNo = `#${String(booking._id).slice(-8).toUpperCase()}`;
    return {
        subject: `Action Required — Document Verification Failed | ${BRAND}`,
        html: htmlShell('Document Verification Failed', `
            <p>Hi <strong>${booking.customerName}</strong>,</p>
            <p>We were unable to verify the documents submitted for your booking <strong>${refNo}</strong>.</p>
            ${bookingTable(booking, carTitle)}
            ${reason ? `
            <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 8px 8px 0;padding:14px 18px;margin:16px 0">
                <p style="margin:0 0 4px;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#991b1b">Reason for rejection</p>
                <p style="margin:0;font-size:.9rem;color:#7f1d1d">${reason}</p>
            </div>` : ''}
            <p>To proceed with your rental, please <strong>submit new or corrected documents</strong> by contacting our support team. Common reasons for rejection include:</p>
            <ul style="padding-left:20px;line-height:2;color:#374151">
                <li>Blurry or unreadable images</li>
                <li>Expired identification documents</li>
                <li>Documents that do not match the booking name</li>
                <li>Missing required pages or sections</li>
            </ul>
            <p>Please contact us as soon as possible if you wish to reschedule or resubmit your documents.</p>
            <p>We apologize for the inconvenience.</p>
        `, '#dc2626'),
    };
}