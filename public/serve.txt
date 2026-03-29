import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { setServers } from 'node:dns/promises';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import PDFDocument from 'pdfkit';
import Car from './models/cars.js';
import Admin from './models/Admin.js';

dotenv.config();
setServers(['1.1.1.1', '8.8.8.8']);

const mongoURI       = process.env.MONGODB_URI        || 'mongodb://localhost:27017/car_rental';
const JWT_SECRET     = process.env.JWT_SECRET         || 'your_fallback_secret_key';
const URGENCY_URL    = process.env.URGENCY_SERVICE_URL || 'http://localhost:5001';
const PORT           = process.env.PORT               || 5000;
const BRAND          = 'Triple R and A Transport Services';
const tokenBlacklist = new Set();

const app = express();
app.use(cors());
app.use(express.json());

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 500,
    message: { message: 'Too many requests. Please slow down.' },
    standardHeaders: true, legacyHeaders: false,
});
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 10,
    message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
    standardHeaders: true, legacyHeaders: false,
});
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, max: 5,
    message: { message: 'Too many messages sent. Please wait before sending again.' },
    standardHeaders: true, legacyHeaders: false,
});
const bookingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, max: 10,
    message: { message: 'Too many booking attempts. Please try again later.' },
    standardHeaders: true, legacyHeaders: false,
});

app.use(generalLimiter);

async function callClassifier(message, subject = '') {
    try {
        const res = await fetch(`${URGENCY_URL}/classify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, subject }),
            signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) throw new Error(`Classifier HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn(`[urgency] classifier unreachable: ${err.message} — defaulting to low`);
        return { urgency: 'low', score: 0, breakdown: {}, confidence: 'fallback' };
    }
}

async function callBatchReclassify(messages) {
    const res = await fetch(`${URGENCY_URL}/reclassify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
        signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Reclassify HTTP ${res.status}`);
    const data = await res.json();
    return data.results || [];
}

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});
transporter.verify(err =>
    err ? console.warn('Email not ready:', err.message) : console.log('Email ready')
);

function htmlShell(title, body, accent = '#2563eb') {
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

function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}
function fmtPeso(n) { return 'PHP ' + Number(n ?? 0).toLocaleString('en-PH'); }

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

function buildSubmittedEmail(b, t) {
    return {
        subject: `Booking Received - #${String(b._id).slice(-8).toUpperCase()} | ${BRAND}`,
        html: htmlShell('Booking Received', `<p>Hi <strong>${b.customerName}</strong>,</p>
<p>Thank you for choosing <strong>${BRAND}</strong>! We have received your booking. Our team will review it and contact you shortly with pricing and confirmation.</p>
${bookingTable(b, t)}<p>Questions? Reach our support team anytime.</p>`, '#f59e0b'),
    };
}

function buildQuoteEmail(b, t) {
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

function buildActiveEmail(b, t) {
    return {
        subject: `Your Rental is Now Active - #${String(b._id).slice(-8).toUpperCase()} | ${BRAND}`,
        html: htmlShell('Your Rental is Active', `<p>Hi <strong>${b.customerName}</strong>,</p>
<p>Your booking is now <strong>Active</strong>. Your vehicle is ready for pick-up.</p>
${bookingTable(b, t)}<p>Bring a valid ID and your reference number. Drive safely!</p>`, '#16a34a'),
    };
}


/**
 * Generates a professional PDF receipt as a Buffer.
 * @param {Object} booking  - Mongoose booking document (with populated carId)
 * @param {string} carTitle - Human-readable vehicle name
 * @returns {Promise<Buffer>}
 */
function generateReceiptPDF(booking, carTitle) {
    return new Promise((resolve, reject) => {
        const doc    = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `Receipt - ${BRAND}`, Author: BRAND } });
        const chunks = [];
 
        doc.on('data',  chunk => chunks.push(chunk));
        doc.on('end',   ()    => resolve(Buffer.concat(chunks)));
        doc.on('error', err   => reject(err));
 
        const pageW   = doc.page.width;   // 595.28
        const pageH   = doc.page.height;  // 841.89
        const margin  = 56;
        const contentW = pageW - margin * 2;
 
        const refNo    = `#${String(booking._id).slice(-8).toUpperCase()}`;
        const issuedOn = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
 
        // ── COLOUR PALETTE ────────────────────────────────────────────────────
        const C = {
            navy:       '#0f2340',
            navyLight:  '#1a3a5c',
            accent:     '#1d4ed8',
            accentMid:  '#3b82f6',
            gold:       '#b08d57',
            goldLight:  '#d4af7a',
            green:      '#14532d',
            greenLight: '#166534',
            slate:      '#334155',
            muted:      '#64748b',
            hairline:   '#cbd5e1',
            offwhite:   '#f8fafc',
            white:      '#ffffff',
            black:      '#0a0a0a',
            redBadge:   '#991b1b',
            amberBadge: '#92400e',
        };
 
        function hex(h) {
            return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
        }
        function fillHex(h)   { doc.fillColor(h); }
        function strokeHex(h) { doc.strokeColor(h); }
 
        // ── HEADER ────────────────────────────────────────────────────────────
        // Dark navy bar
        doc.rect(0, 0, pageW, 110).fill(C.navy);
 
        // Gold top accent rule (3 px)
        doc.rect(0, 0, pageW, 3).fill(C.gold);
 
        // Brand name (left)
        doc.fontSize(18).font('Helvetica-Bold').fillColor(C.white)
           .text(BRAND, margin, 26, { width: contentW * 0.62 });
 
        // "OFFICIAL RECEIPT" label top-right
        doc.fontSize(8).font('Helvetica-Bold').fillColor(C.goldLight)
           .text('OFFICIAL RECEIPT', pageW - margin - 130, 26, { width: 130, align: 'right', characterSpacing: 1.5 });
 
        // Ref + Date beneath label
        doc.fontSize(8.5).font('Helvetica').fillColor('#93c5fd')
           .text(`Ref: ${refNo}`, pageW - margin - 130, 42, { width: 130, align: 'right' });
        doc.fontSize(8.5).fillColor('#93c5fd')
           .text(`Issued: ${issuedOn}`, pageW - margin - 130, 56, { width: 130, align: 'right' });
 
        // Gold divider in header
        doc.moveTo(margin, 82).lineTo(pageW - margin, 82)
           .strokeColor(C.gold).lineWidth(0.5).stroke();
 
        // Tagline
        doc.fontSize(8).font('Helvetica').fillColor('#7dd3fc')
           .text('Triple R and A Transport Services  ·  Official Rental Receipt  ·  Please retain for your records',
                 margin, 90, { width: contentW });
 
        // ── BILL-TO / RECEIPT META ROW ────────────────────────────────────────
        let y = 128;
 
        // Two-column row: Bill To (left) | Receipt details (right)
        const colW = contentW / 2 - 12;
 
        // Left: Bill To
        doc.fontSize(7).font('Helvetica-Bold').fillColor(C.gold)
           .text('BILL TO', margin, y, { characterSpacing: 1.2 });
        y += 13;
        doc.fontSize(12).font('Helvetica-Bold').fillColor(C.black)
           .text(booking.customerName, margin, y, { width: colW });
 
        const contactParts = [];
        if (booking.customerEmail) contactParts.push(booking.customerEmail);
        if (booking.customerPhone) contactParts.push(booking.customerPhone);
        if (contactParts.length) {
            doc.fontSize(8.5).font('Helvetica').fillColor(C.muted)
               .text(contactParts.join('   ·   '), margin, y + 18, { width: colW });
        }
 
        // Right: Receipt meta
        const rightX = margin + colW + 24;
        const labelColW = 90, valColW = colW - labelColW;
 
        const metaRows = [
            ['Receipt No.',  refNo],
            ['Issue Date',   issuedOn],
            ['Status',       booking.status],
            ['Payment',      booking.paymentStatus],
        ];
 
        let metaY = y - 13;
        for (const [label, val] of metaRows) {
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.muted)
               .text(label, rightX, metaY, { width: labelColW });
            doc.fontSize(7.5).font('Helvetica').fillColor(C.slate)
               .text(val, rightX + labelColW, metaY, { width: valColW, align: 'right' });
            metaY += 14;
        }
 
        y += 40;
 
        // Full-width hairline separator
        doc.moveTo(margin, y).lineTo(pageW - margin, y)
           .strokeColor(C.hairline).lineWidth(0.75).stroke();
 
        y += 16;
 
        // ── SECTION: RENTAL DETAILS ───────────────────────────────────────────
        // Section heading with left accent bar
        doc.rect(margin, y, 3, 12).fill(C.accent);
        doc.fontSize(8).font('Helvetica-Bold').fillColor(C.accent)
           .text('RENTAL DETAILS', margin + 10, y + 1, { characterSpacing: 1.1 });
        y += 22;
 
        // Table header row
        const col1 = margin;
        const col2 = margin + 210;
        const rowH  = 28;
 
        doc.rect(col1, y, contentW, rowH - 2).fill(C.navy);
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.white)
           .text('DESCRIPTION', col1 + 12, y + 9, { characterSpacing: 0.8 });
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.white)
           .text('DETAILS', col2, y + 9, { characterSpacing: 0.8 });
        y += rowH;
 
        const detailRows = [
            ['Vehicle',        carTitle],
            ...(booking.qty > 1 ? [['Quantity', `${booking.qty} unit(s)`]] : []),
            ['Pickup Date',    fmtDate(booking.startDate)],
            ['Return Date',    fmtDate(booking.endDate)],
            ['Duration',       `${booking.rentalDays} day${booking.rentalDays !== 1 ? 's' : ''}`],
            ...(booking.pickupLocation ? [['Pickup Location', booking.pickupLocation]] : []),
            ...(booking.paymentMethod  ? [['Payment Method',  booking.paymentMethod]]  : []),
        ];
 
        detailRows.forEach((row, i) => {
            const rowY = y + i * rowH;
            // Alternating row shade
            if (i % 2 === 0) {
                doc.rect(col1, rowY, contentW, rowH - 1).fill(C.offwhite);
            } else {
                doc.rect(col1, rowY, contentW, rowH - 1).fill(C.white);
            }
            // Left label
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.slate)
               .text(row[0], col1 + 12, rowY + 9, { width: 190 });
            // Right value
            doc.fontSize(8.5).font('Helvetica').fillColor(C.black)
               .text(row[1], col2, rowY + 9, { width: contentW - (col2 - col1) - 12 });
            // Bottom hairline
            doc.moveTo(col1, rowY + rowH - 1).lineTo(col1 + contentW, rowY + rowH - 1)
               .strokeColor(C.hairline).lineWidth(0.4).stroke();
        });
 
        y += detailRows.length * rowH + 20;
 
        // ── SECTION: PAYMENT SUMMARY ──────────────────────────────────────────
        doc.rect(margin, y, 3, 12).fill(C.accent);
        doc.fontSize(8).font('Helvetica-Bold').fillColor(C.accent)
           .text('PAYMENT SUMMARY', margin + 10, y + 1, { characterSpacing: 1.1 });
        y += 22;
 
        // Summary table — right-aligned values
        const summaryLabelX = margin;
        const summaryValX   = margin + contentW - 160;
        const summaryValW   = 150;
        const sumRowH       = 26;
 
        const outstanding = Math.max(0, (booking.quotedPrice ?? 0) - (booking.amountPaid ?? 0));
 
        const summaryRows = [
            { label: 'Quoted Price',        val: fmtPeso(booking.quotedPrice ?? 0), bold: false },
            { label: 'Amount Paid',         val: fmtPeso(booking.amountPaid ?? 0),  bold: false },
        ];
 
        summaryRows.forEach((row, i) => {
            const rowY = y + i * sumRowH;
            if (i % 2 === 0) doc.rect(margin, rowY, contentW, sumRowH - 1).fill(C.offwhite);
            else             doc.rect(margin, rowY, contentW, sumRowH - 1).fill(C.white);
 
            doc.fontSize(8.5).font(row.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(C.slate)
               .text(row.label, summaryLabelX + 12, rowY + 8, { width: 200 });
            doc.fontSize(8.5).font(row.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(C.black)
               .text(row.val, summaryValX, rowY + 8, { width: summaryValW, align: 'right' });
 
            doc.moveTo(margin, rowY + sumRowH - 1).lineTo(margin + contentW, rowY + sumRowH - 1)
               .strokeColor(C.hairline).lineWidth(0.4).stroke();
        });
 
        y += summaryRows.length * sumRowH;
 
        // BALANCE OUTSTANDING — highlighted row
        const balColor = outstanding === 0 ? C.green : C.navy;
        doc.rect(margin, y, contentW, sumRowH + 4).fill(balColor);
        doc.fontSize(9).font('Helvetica-Bold').fillColor(C.white)
           .text('BALANCE OUTSTANDING', summaryLabelX + 12, y + 9, { width: 200 });
        doc.fontSize(9).font('Helvetica-Bold').fillColor(outstanding === 0 ? '#86efac' : C.goldLight)
           .text(fmtPeso(outstanding), summaryValX, y + 9, { width: summaryValW, align: 'right' });
        y += sumRowH + 4 + 18;
 
        // ── PAYMENT NOTES ─────────────────────────────────────────────────────
        if (booking.paymentNotes) {
            doc.rect(margin, y, contentW, 44).fill(C.offwhite);
            doc.rect(margin, y, 3, 44).fill(C.accentMid);
            doc.fontSize(7).font('Helvetica-Bold').fillColor(C.accent)
               .text('NOTES', margin + 12, y + 8, { characterSpacing: 1 });
            doc.fontSize(8.5).font('Helvetica').fillColor(C.slate)
               .text(booking.paymentNotes, margin + 12, y + 20, { width: contentW - 24 });
            y += 60;
        }
 
        // ── SIGNATURE / AUTHORISATION BLOCK ──────────────────────────────────
        // Formal sign-off with dotted lines
        const sigY = Math.max(y + 20, pageH - 170);
 
        doc.moveTo(margin, sigY).lineTo(pageW - margin, sigY)
           .strokeColor(C.hairline).lineWidth(0.75).stroke();
 
        const sigColW = (contentW - 40) / 2;
 
        // Left: Prepared by
        doc.fontSize(7).font('Helvetica-Bold').fillColor(C.muted)
           .text('PREPARED BY', margin, sigY + 14, { characterSpacing: 1 });
        doc.moveTo(margin, sigY + 46).lineTo(margin + sigColW, sigY + 46)
           .strokeColor(C.slate).lineWidth(0.6).stroke();
        doc.fontSize(7.5).font('Helvetica').fillColor(C.slate)
           .text('Authorised Signature', margin, sigY + 50);
 
        // Right: Received by
        const sig2X = margin + sigColW + 40;
        doc.fontSize(7).font('Helvetica-Bold').fillColor(C.muted)
           .text('RECEIVED BY', sig2X, sigY + 14, { characterSpacing: 1 });
        doc.moveTo(sig2X, sigY + 46).lineTo(sig2X + sigColW, sigY + 46)
           .strokeColor(C.slate).lineWidth(0.6).stroke();
        doc.fontSize(7.5).font('Helvetica').fillColor(C.slate)
           .text('Customer Signature & Date', sig2X, sigY + 50);
 
        // ── FOOTER ────────────────────────────────────────────────────────────
        // Navy footer bar
        doc.rect(0, pageH - 52, pageW, 52).fill(C.navy);
        // Gold top rule
        doc.rect(0, pageH - 52, pageW, 2).fill(C.gold);
 
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.white)
           .text(BRAND, margin, pageH - 38, { width: contentW * 0.6 });
        doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
           .text('This is an official receipt. Please keep it for your records.',
                 margin, pageH - 24, { width: contentW * 0.65 });
 
        // Right side of footer: ref + generated timestamp
        doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
           .text(`Ref: ${refNo}`, pageW - margin - 180, pageH - 38, { width: 180, align: 'right' });
        doc.fontSize(7).fillColor('#64748b')
           .text(`Generated: ${new Date().toLocaleString('en-PH')}`,
                 pageW - margin - 180, pageH - 24, { width: 180, align: 'right' });
 
        doc.end();
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// COMPLETED EMAIL — now attaches a PDF receipt
// ─────────────────────────────────────────────────────────────────────────────

async function buildCompletedEmail(b, t) {
    const refNo = `#${String(b._id).slice(-8).toUpperCase()}`;

    const html = htmlShell('Rental Completed', `<p>Hi <strong>${b.customerName}</strong>,</p>
<p>Your rental is now <strong>Completed</strong>. Thank you for choosing <strong>${BRAND}</strong>!</p>
${bookingTable(b, t)}
<div class="attach-note">
  <strong>📄 Official Receipt Attached</strong>
  A PDF receipt is attached to this email. Please save it for your records and any future reference.
</div>
<p>We hope to see you again on your next journey.</p>
<p>Warm regards,<br/><strong>${BRAND} Team</strong></p>`, '#2563eb');

    // Generate the receipt PDF
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
            ? [{
                filename: `Receipt-${refNo.replace('#', '')}.pdf`,
                content:  pdfBuffer,
                contentType: 'application/pdf',
            }]
            : [],
    };
}

function buildReplyEmail(msg, replySubject, replyBody) {
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

// ─────────────────────────────────────────────────────────────────────────────
// sendEmail — now accepts optional attachments array
// ─────────────────────────────────────────────────────────────────────────────

function buildExtensionEmail(b, t, extraDays, reason) {
    return {
        subject: `Booking Extended — +${extraDays} Day${extraDays !== 1 ? 's' : ''} | ${BRAND}`,
        html: htmlShell('Your Rental Has Been Extended', `<p>Hi <strong>${b.customerName}</strong>,</p>
<p>Your rental has been <strong>extended by ${extraDays} day${extraDays !== 1 ? 's' : ''}</strong>.</p>
<table>
<tr><td>Reference</td><td>#${String(b._id).slice(-8).toUpperCase()}</td></tr>
<tr><td>Vehicle</td><td>${t}</td></tr>
${(b.qty??1)>1?`<tr><td>Quantity</td><td>${b.qty} unit(s)</td></tr>`:''}
<tr><td>Extended By</td><td>+${extraDays} day${extraDays!==1?'s':''}</td></tr>
<tr><td>New Return Date</td><td>${fmtDate(b.endDate)}</td></tr>
<tr><td>Total Rental Days</td><td>${b.rentalDays} day${b.rentalDays!==1?'s':''}</td></tr>
${reason?`<tr><td>Reason</td><td>${reason}</td></tr>`:''}
${b.quotedPrice?`<tr class="tr"><td>Updated Quote</td><td>${fmtPeso(b.quotedPrice)}</td></tr>`:''}
</table>
<p>If you have any questions, please contact our support team.</p>
<p>Warm regards,<br/><strong>${BRAND} Team</strong></p>`, '#16a34a'),
    };
}

async function sendEmail(to, subject, html, attachments = []) {
    if (!to || !process.env.EMAIL_USER) return;
    try {
        await transporter.sendMail({
            from: `"${BRAND}" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
            attachments,
        });
        console.log(`Email -> ${to}${attachments.length ? ` (+${attachments.length} attachment(s))` : ''}`);
    } catch (e) { console.error('Email error:', e.message); }
}

const bookingSchema = new mongoose.Schema({
    carId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },
    qty:            { type: Number, required: true, min: 1, default: 1 },
    customerName:   { type: String, required: true, trim: true },
    customerEmail:  { type: String, trim: true, lowercase: true },
    customerPhone:  { type: String, trim: true },
    startDate:      { type: Date, required: true },
    endDate:        { type: Date, required: true },
    rentalDays:     { type: Number, required: true, min: 1 },
    pickupLocation: { type: String, trim: true },
    quotedPrice:    { type: Number, default: null },
    quotedAt:       { type: Date, default: null },
    paymentStatus:  { type: String, enum: ['Unpaid', 'Partially Paid', 'Paid'], default: 'Unpaid' },
    amountPaid:     { type: Number, default: 0 },
    paymentMethod:  { type: String, enum: ['Cash', 'GCash', 'Bank Transfer', 'Other'], default: null },
    paymentNotes:   { type: String, trim: true, default: '' },
    totalCost:      { type: Number, default: 0 },
    status:         { type: String, enum: ['Pending', 'Active', 'Completed', 'Cancelled'], default: 'Pending' },
}, { timestamps: true });

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema, 'bookings');

const replySchema = new mongoose.Schema({
    subject: { type: String, trim: true },
    body:    { type: String, required: true, trim: true },
    sentBy:  { type: String, default: 'Admin' },
    sentAt:  { type: Date, default: Date.now },
}, { _id: true });

const messageSchema = new mongoose.Schema({
    name:             { type: String, required: true, trim: true },
    email:            { type: String, required: true, trim: true, lowercase: true },
    subject:          { type: String, trim: true },
    message:          { type: String, required: true, trim: true },
    status:           { type: String, enum: ['Unread', 'Read', 'Archived'], default: 'Unread' },
    replies:          { type: [replySchema], default: [] },
    urgency:          { type: String, enum: ['high', 'medium', 'low', null], default: null },
    urgencyScore:     { type: Number, default: null },
    urgencyBreakdown: { type: Object, default: null },
    urgencyMethod:    { type: String, enum: ['rule-based', 'ml'], default: 'rule-based' },
    urgencyConfirmed: { type: Boolean, default: false },
    urgencyCorrected: { type: String, enum: ['high', 'medium', 'low', null], default: null },
}, { timestamps: true });

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema, 'messages');

function requireAdmin(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer '))
        return res.status(401).json({ message: 'No token provided.' });
    const token = auth.split(' ')[1];
    if (tokenBlacklist.has(token))
        return res.status(401).json({ message: 'Session expired.' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin')
            return res.status(403).json({ message: 'Access denied.' });
        req.admin = decoded;
        req.token = token;
        next();
    } catch {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function clean(str) { return String(str ?? '').replace(/<[^>]*>/g, '').trim(); }

function hashToken(raw) {
    return crypto.createHash('sha256').update(raw).digest('hex');
}

mongoose.connect(mongoURI)
    .then(() => {
        console.log('Database Connected');
        console.log('MongoDB Connected:', mongoose.connection.name);
        console.log('Admins collection:', Admin.collection.name);
        console.log('Bookings collection:', Booking.collection.name);
    })
    .catch(err => console.error('MongoDB Error:', err));

app.get('/api/cars', async (req, res) => {
    try { res.json(await Car.find()); }
    catch { res.status(500).json({ message: 'Server Error: Could not retrieve cars.' }); }
});

app.post('/api/bookings', bookingLimiter, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { carId, qty = 1, customerName, customerEmail, customerPhone, startDate, endDate, rentalDays, pickupLocation } = req.body;
        if (!carId || !customerName || !startDate || !endDate || !rentalDays) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ message: 'Missing required booking fields.' });
        }
        if (Number(qty) > 10) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ message: 'Cannot book more than 10 units at once.' });
        }
        if (customerEmail && !emailRegex.test(customerEmail)) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ message: 'Invalid email address.' });
        }
        const car = await Car.findById(carId).session(session);
        if (!car) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ message: 'Car not found.' }); }
        if (car.stock < Number(qty)) { await session.abortTransaction(); session.endSession(); return res.status(400).json({ message: `Only ${car.stock} unit(s) available.` }); }
        const [booking] = await Booking.create([{
            carId, qty: Number(qty), customerName: clean(customerName),
            customerEmail: customerEmail?.trim().toLowerCase() || '',
            customerPhone: customerPhone?.trim() || '',
            startDate: new Date(startDate), endDate: new Date(endDate),
            rentalDays: Number(rentalDays), pickupLocation: pickupLocation || '',
            totalCost: 0, quotedPrice: null, paymentStatus: 'Unpaid', status: 'Pending',
        }], { session });
        car.stock -= Number(qty);
        await car.save({ session });
        await session.commitTransaction(); session.endSession();
        console.log(`New booking: ${booking._id} | ${car.title}`);
        if (booking.customerEmail) { const { subject, html } = buildSubmittedEmail(booking, car.title); sendEmail(booking.customerEmail, subject, html); }
        return res.status(201).json({ message: 'Booking created successfully!', booking });
    } catch (err) {
        await session.abortTransaction(); session.endSession();
        console.error('Booking error:', err);
        return res.status(500).json({ message: 'Server Error: Could not create booking.' });
    }
});

app.post('/api/bookings/batch', bookingLimiter, async (req, res) => {
    const { bookings } = req.body;
    if (!Array.isArray(bookings) || !bookings.length)
        return res.status(400).json({ message: 'bookings array is required.' });
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const created = [], emailQueue = [];
        for (const item of bookings) {
            const { carId, qty = 1, customerName, customerEmail, customerPhone, startDate, endDate, rentalDays, pickupLocation } = item;
            if (!carId || !customerName || !startDate || !endDate || !rentalDays) { await session.abortTransaction(); session.endSession(); return res.status(400).json({ message: 'Missing required fields.' }); }
            if (Number(qty) > 10) { await session.abortTransaction(); session.endSession(); return res.status(400).json({ message: 'Cannot book more than 10 units at once.' }); }
            if (customerEmail && !emailRegex.test(customerEmail)) { await session.abortTransaction(); session.endSession(); return res.status(400).json({ message: 'Invalid email address.' }); }
            const car = await Car.findById(carId).session(session);
            if (!car) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ message: `Car not found: ${carId}` }); }
            if (car.stock < Number(qty)) { await session.abortTransaction(); session.endSession(); return res.status(400).json({ message: `Insufficient stock for "${car.title}".` }); }
            const [booking] = await Booking.create([{
                carId, qty: Number(qty), customerName: clean(customerName),
                customerEmail: customerEmail?.trim().toLowerCase() || '',
                customerPhone: customerPhone?.trim() || '',
                startDate: new Date(startDate), endDate: new Date(endDate),
                rentalDays: Number(rentalDays), pickupLocation: pickupLocation || '',
                totalCost: 0, quotedPrice: null, paymentStatus: 'Unpaid', status: 'Pending',
            }], { session });
            car.stock -= Number(qty);
            await car.save({ session });
            created.push(booking);
            emailQueue.push({ booking, carTitle: car.title });
        }
        await session.commitTransaction(); session.endSession();
        for (const { booking, carTitle } of emailQueue) {
            if (booking.customerEmail) { const { subject, html } = buildSubmittedEmail(booking, carTitle); sendEmail(booking.customerEmail, subject, html); }
        }
        return res.status(201).json({ message: `${created.length} booking(s) created successfully!`, bookings: created });
    } catch (err) {
        await session.abortTransaction(); session.endSession();
        console.error('Batch booking error:', err);
        return res.status(500).json({ message: 'Server Error: Could not process batch booking.' });
    }
});

app.post('/api/messages', contactLimiter, async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        if (!name || !email || !message) return res.status(400).json({ message: 'Name, email, and message are required.' });
        if (!emailRegex.test(email)) return res.status(400).json({ message: 'Invalid email address.' });
        const { urgency, score, breakdown } = await callClassifier(message.trim(), subject?.trim() || '');
        const msg = await Message.create({
            name: clean(name), email: email.trim().toLowerCase(),
            subject: clean(subject || ''), message: clean(message),
            urgency, urgencyScore: score, urgencyBreakdown: breakdown, urgencyMethod: 'rule-based',
        });
        console.log(`New message from: ${msg.email} [urgency: ${urgency}, score: ${score}]`);
        return res.status(201).json({ message: 'Message received. Thank you!', id: msg._id });
    } catch (err) { console.error('Message error:', err); res.status(500).json({ message: 'Server Error.' }); }
});


app.post('/api/admin/login', loginLimiter, async (req, res) => {
    const { identifier, password } = req.body;
    try {
        if (!identifier || !password)
            return res.status(400).json({ message: 'Identifier and password are required.' });
        const escaped = escapeRegex(identifier.trim());
        const user = await Admin.findOne({
            $or: [
                { username: { $regex: new RegExp(`^${escaped}$`, 'i') } },
                { email:    { $regex: new RegExp(`^${escaped}$`, 'i') } },
            ],
        });
        if (!user) return res.status(401).json({ message: 'User not found.' });
        if (user.role !== 'admin') return res.status(403).json({ message: 'Access denied.' });
        if (!await bcrypt.compare(password, user.password)) return res.status(401).json({ message: 'Invalid credentials.' });
        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        console.log('Login OK:', user.username);
        res.json({ token, message: 'Welcome back!' });
    } catch (err) { console.error(err); res.status(500).json({ message: 'Internal Server Error' }); }
});

app.post('/api/admin/forgot-password', loginLimiter, async (req, res) => {
    const raw_email = req.body?.email;
    if (!raw_email || typeof raw_email !== 'string') {
        return res.status(400).json({ message: 'Email is required.' });
    }
 
    const email = raw_email.trim().toLowerCase();
 
    if (!emailRegex.test(email)) {
        return res.json({ message: 'If that email is registered, a reset link has been sent.' });
    }
 
    try {
        const escaped = escapeRegex(email);
        const admin = await Admin.findOne({
            $or: [
                { email: { $regex: new RegExp(`^${escaped}$`, 'i') } },
                { username: { $regex: new RegExp(`^${escaped}$`, 'i') } }
            ]
        });
 
        if (!admin) {
            console.log(`[forgot-password] no account for ${email} — silent no-op`);
            return res.json({ message: 'If that email is registered, a reset link has been sent.' });
        }
 
        const rawToken    = crypto.randomBytes(32).toString('hex');
        const hashedToken = hashToken(rawToken);
        const expiry      = new Date(Date.now() + 60 * 60 * 1000);
        admin.resetToken       = hashedToken;
        admin.resetTokenExpiry = expiry;
        await admin.save();
 
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/reset-password?token=${rawToken}`;
 
        const html = htmlShell('Password Reset Request', `
            <p>Hi <strong>${admin.username}</strong>,</p>
            <p>We received a request to reset the password for the admin account associated with this email address.</p>
            <p>Click the button below to set a new password. This link is valid for <strong>1 hour</strong> and can only be used once.</p>
            <p style="text-align:center;margin:28px 0">
                <a href="${resetUrl}"
                   style="background:#2563eb;color:#fff;padding:14px 32px;border-radius:8px;
                          text-decoration:none;font-weight:700;font-size:0.95rem;display:inline-block">
                    Reset Password
                </a>
            </p>
            <p>If you did not request a password reset you can safely ignore this email — your password will not change.</p>
            <p style="font-size:0.82rem;color:#6b7280;margin-top:20px">
                Or copy this link into your browser:<br/>
                <span style="word-break:break-all">${resetUrl}</span>
            </p>
        `, '#2563eb');
 
        await sendEmail(admin.email, `Password Reset | ${BRAND}`, html);
        console.log(`[forgot-password] reset email sent to ${admin.email}`);
 
        return res.json({ message: 'If that email is registered, a reset link has been sent.' });
 
    } catch (err) {
        console.error('[forgot-password] error:', err);
        return res.status(500).json({ message: 'Server Error.' });
    }
});

app.post('/api/admin/reset-password', async (req, res) => {
    const { token: rawToken, newPassword } = req.body;
 
    if (!rawToken || typeof rawToken !== 'string' || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required.' });
    }
 
    if (newPassword.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }
 
    try {
        const hashedToken = hashToken(rawToken.trim());
 
        const admin = await Admin.findOne({
            resetToken:       hashedToken,
            resetTokenExpiry: { $gt: new Date() },
        });
 
        if (!admin) {
            return res.status(400).json({ message: 'Reset link is invalid or has expired. Please request a new one.' });
        }
 
        admin.password         = await bcrypt.hash(newPassword, 12);
        admin.resetToken       = null;
        admin.resetTokenExpiry = null;
        await admin.save();
 
        console.log(`[reset-password] password changed for ${admin.email}`);
        return res.json({ message: 'Password reset successfully. You can now log in.' });
 
    } catch (err) {
        console.error('[reset-password] error:', err);
        return res.status(500).json({ message: 'Server Error.' });
    }
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
    tokenBlacklist.add(req.token);
    res.json({ message: 'Logged out successfully.' });
});

app.get('/api/bookings', requireAdmin, async (req, res) => {
    try { res.json(await Booking.find().sort({ createdAt: -1 }).populate('carId', 'title type image')); }
    catch { res.status(500).json({ message: 'Server Error.' }); }
});

app.put('/api/admin/bookings/:id/status', requireAdmin, async (req, res) => {
    const { status } = req.body;
    const allowed  = ['Pending', 'Active', 'Completed', 'Cancelled'];
    const terminal = ['Completed', 'Cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status.' });
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(req.params.id).session(session);
        if (!booking) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ message: 'Booking not found.' }); }

        // ── PAYMENT GATE ──────────────────────────────────────────────────────
        if (status === 'Active' && booking.paymentStatus === 'Unpaid') {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ message: 'Booking cannot be marked Active until at least a partial payment has been recorded.' });
        }
        if (status === 'Completed' && booking.paymentStatus !== 'Paid') {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ message: 'Booking cannot be marked Completed until it is fully paid.' });
        }
        // ─────────────────────────────────────────────────────────────────────

        let car = null;
        if (terminal.includes(status) && !terminal.includes(booking.status)) {
            car = await Car.findById(booking.carId).session(session);
            if (car) { car.stock += booking.qty ?? 1; await car.save({ session }); console.log(`Stock restored: ${car.title} -> ${car.stock}`); }
        }
        booking.status = status;
        await booking.save({ session });
        await session.commitTransaction(); session.endSession();
        const populated = await Booking.findById(booking._id).populate('carId', 'title type image');
        console.log(`Booking ${booking._id} -> ${status}`);
        if (booking.customerEmail) {
            const carTitle = populated.carId?.title || car?.title || 'your vehicle';
            if (status === 'Active') {
                const { subject, html } = buildActiveEmail(booking, carTitle);
                sendEmail(booking.customerEmail, subject, html);
            } else if (status === 'Completed') {
                // buildCompletedEmail is async — generates the PDF receipt
                buildCompletedEmail(booking, carTitle).then(({ subject, html, attachments }) => {
                    sendEmail(booking.customerEmail, subject, html, attachments);
                }).catch(err => console.error('[completed email] failed:', err.message));
            }
        }
        res.json({ message: 'Status updated.', booking: populated });
    } catch (err) { await session.abortTransaction(); session.endSession(); console.error('Status error:', err); res.status(500).json({ message: 'Server Error.' }); }
});

app.put('/api/admin/bookings/:id/quote', requireAdmin, async (req, res) => {
    const { quotedPrice, paymentNotes } = req.body;
    if (quotedPrice == null || isNaN(quotedPrice) || Number(quotedPrice) <= 0)
        return res.status(400).json({ message: 'A valid quoted price greater than 0 is required.' });
    try {
        const booking = await Booking.findByIdAndUpdate(req.params.id,
            { quotedPrice: Number(quotedPrice), quotedAt: new Date(), totalCost: Number(quotedPrice), paymentNotes: paymentNotes?.trim() || '' },
            { new: true }
        ).populate('carId', 'title type image');
        if (!booking) return res.status(404).json({ message: 'Booking not found.' });
        if (booking.customerEmail) { const { subject, html } = buildQuoteEmail(booking, booking.carId?.title || 'your vehicle'); sendEmail(booking.customerEmail, subject, html); }
        console.log(`Quote set: ${booking._id} -> ${fmtPeso(quotedPrice)}`);
        res.json({ message: 'Quote set successfully.', booking });
    } catch (err) { console.error('Quote error:', err); res.status(500).json({ message: 'Server Error.' }); }
});

app.put('/api/admin/bookings/:id/payment', requireAdmin, async (req, res) => {
    const { amountPaid, paymentMethod, paymentNotes } = req.body;
    if (amountPaid == null || isNaN(amountPaid) || Number(amountPaid) < 0)
        return res.status(400).json({ message: 'A valid amount (0 or greater) is required.' });
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found.' });
        if (!booking.quotedPrice) return res.status(400).json({ message: 'Set a quoted price before recording payment.' });
        const paid = Number(amountPaid);
        booking.amountPaid    = paid;
        booking.paymentStatus = paid >= booking.quotedPrice ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid';
        if (paymentMethod) booking.paymentMethod = paymentMethod;
        if (paymentNotes)  booking.paymentNotes  = paymentNotes.trim();
        await booking.save();
        const populated = await Booking.findById(booking._id).populate('carId', 'title type image');
        console.log(`Payment: ${booking._id} -> ${fmtPeso(paid)} (${booking.paymentStatus})`);
        res.json({ message: 'Payment recorded.', booking: populated });
    } catch (err) { console.error('Payment error:', err); res.status(500).json({ message: 'Server Error.' }); }
});

app.delete('/api/admin/bookings/:id', requireAdmin, async (req, res) => {
    const RESTORE_STATUSES = ['Pending', 'Active'];
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(req.params.id).session(session);
        if (!booking) { await session.abortTransaction(); session.endSession(); return res.status(404).json({ message: 'Booking not found.' }); }
        if (RESTORE_STATUSES.includes(booking.status)) {
            const car = await Car.findById(booking.carId).session(session);
            if (car) { car.stock += booking.qty ?? 1; await car.save({ session }); console.log(`Stock restored on delete: ${car.title} -> ${car.stock}`); }
        }
        await Booking.findByIdAndDelete(req.params.id).session(session);
        await session.commitTransaction(); session.endSession();
        console.log(`Booking deleted: ${booking._id} (was ${booking.status})`);
        res.json({ message: 'Booking deleted successfully.', deletedId: booking._id });
    } catch (err) { await session.abortTransaction(); session.endSession(); console.error('Delete booking error:', err); res.status(500).json({ message: 'Server Error: Could not delete booking.' }); }
});

app.put('/api/admin/bookings/:id/extend', requireAdmin, async (req, res) => {
    const { extraDays, reason } = req.body;
    const extra = Number(extraDays);
 
    if (!extra || isNaN(extra) || extra < 1 || extra > 365)
        return res.status(400).json({ message: 'extraDays must be a whole number between 1 and 365.' });
 
    try {
        const booking = await Booking.findById(req.params.id).populate('carId', 'title type dailyRate');
        if (!booking) return res.status(404).json({ message: 'Booking not found.' });
 
        if (!['Pending', 'Active'].includes(booking.status))
            return res.status(400).json({
                message: `Cannot extend a "${booking.status}" booking. Only Pending or Active bookings can be extended.`,
            });
 
        // Extend end date
        const newEnd = new Date(booking.endDate);
        newEnd.setDate(newEnd.getDate() + extra);
        booking.endDate    = newEnd;
        booking.rentalDays = (booking.rentalDays || 1) + extra;
 
        // Recalculate quoted price if a daily rate exists
        const dailyRate = booking.carId?.dailyRate ?? 0;
        if (dailyRate > 0 && booking.quotedPrice != null) {
            const extraCost     = dailyRate * (booking.qty ?? 1) * extra;
            booking.quotedPrice = (booking.quotedPrice || 0) + extraCost;
            booking.totalCost   = booking.quotedPrice;
        }
 
        // Append extension note to paymentNotes
        const note = `[Extension +${extra}d${reason ? ': ' + reason.trim() : ''}]`;
        booking.paymentNotes = booking.paymentNotes
            ? `${booking.paymentNotes} ${note}`
            : note;
 
        await booking.save();
 
        const populated = await Booking.findById(booking._id).populate('carId', 'title type image');
 
        if (booking.customerEmail) {
            const carTitle = populated.carId?.title || 'your vehicle';
            const { subject, html } = buildExtensionEmail(booking, carTitle, extra, reason);
            sendEmail(booking.customerEmail, subject, html);
        }
 
        console.log(`Booking ${booking._id} extended +${extra}d → ${newEnd.toDateString()}`);
        res.json({ message: `Booking extended by ${extra} day(s).`, booking: populated });
    } catch (err) {
        console.error('Extend booking error:', err);
        res.status(500).json({ message: 'Server Error: Could not extend booking.' });
    }
});

app.get('/api/admin/cars', requireAdmin, async (req, res) => {
    try { res.json(await Car.find().sort({ createdAt: -1 })); }
    catch { res.status(500).json({ message: 'Server Error.' }); }
});

app.post('/api/admin/cars', requireAdmin, async (req, res) => {
    try {
        const { title, description, image, type, stock } = req.body;
        if (!title || !description || !image || !type) return res.status(400).json({ message: 'title, description, image, and type are required.' });
        const car = await Car.create({ title: clean(title), description: clean(description), image, type, stock: Number(stock) || 1 });
        console.log(`Car added: ${car.title}`);
        res.status(201).json({ message: 'Car added successfully.', car });
    } catch (err) { console.error(err); res.status(500).json({ message: 'Server Error.' }); }
});

app.put('/api/admin/cars/:id', requireAdmin, async (req, res) => {
    try {
        const { title, description, image, type, stock } = req.body;
        const u = {};
        if (title       !== undefined) u.title       = clean(title);
        if (description !== undefined) u.description = clean(description);
        if (image       !== undefined) u.image       = image;
        if (type        !== undefined) u.type        = type;
        if (stock       !== undefined) u.stock       = Math.max(0, Number(stock));
        const car = await Car.findByIdAndUpdate(req.params.id, u, { new: true });
        if (!car) return res.status(404).json({ message: 'Car not found.' });
        res.json({ message: 'Car updated.', car });
    } catch (err) { console.error(err); res.status(500).json({ message: 'Server Error.' }); }
});

app.delete('/api/admin/cars/:id', requireAdmin, async (req, res) => {
    try {
        const car = await Car.findByIdAndDelete(req.params.id);
        if (!car) return res.status(404).json({ message: 'Car not found.' });
        console.log(`Car deleted: ${car.title}`);
        res.json({ message: `"${car.title}" deleted successfully.` });
    } catch (err) { console.error(err); res.status(500).json({ message: 'Server Error.' }); }
});

app.get('/api/admin/messages', requireAdmin, async (req, res) => {
    try { res.json(await Message.find().sort({ createdAt: -1 })); }
    catch { res.status(500).json({ message: 'Server Error.' }); }
});

app.post('/api/admin/messages/reclassify', requireAdmin, async (req, res) => {
    try {
        const dbMessages = await Message.find({ urgencyConfirmed: { $ne: true } });
        const results = await callBatchReclassify(dbMessages.map(m => ({ _id: String(m._id), message: m.message, subject: m.subject || '' })));
        let updated = 0;
        for (const r of results) {
            await Message.findByIdAndUpdate(r._id, { urgency: r.urgency, urgencyScore: r.score, urgencyBreakdown: r.breakdown, urgencyMethod: 'rule-based-v3' });
            updated++;
        }
        console.log(`Reclassified ${updated} messages via Python service`);
        res.json({ message: `Reclassified ${updated} message(s).`, updated });
    } catch (err) { console.error('Reclassify error:', err); res.status(500).json({ message: 'Server Error.' }); }
});

app.get('/api/admin/messages/urgency-report', requireAdmin, async (req, res) => {
    try {
        const msgs = await Message.find({}, 'urgency status');
        const report = msgs.reduce((acc, m) => {
            const urg = m.urgency || 'unclassified';
            acc.total++;
            acc[urg] = (acc[urg] || 0) + 1;
            if (urg === 'high' && m.status === 'Unread') acc.highUnread++;
            return acc;
        }, { total: 0, high: 0, medium: 0, low: 0, unclassified: 0, highUnread: 0 });
        res.json(report);
    } catch (err) { console.error('Urgency report error:', err); res.status(500).json({ message: 'Server Error.' }); }
});

app.put('/api/admin/messages/:id/status', requireAdmin, async (req, res) => {
    const { status } = req.body;
    if (!['Unread', 'Read', 'Archived'].includes(status)) return res.status(400).json({ message: 'Invalid status.' });
    try {
        const msg = await Message.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!msg) return res.status(404).json({ message: 'Message not found.' });
        res.json({ message: 'Status updated.', msg });
    } catch { res.status(500).json({ message: 'Server Error.' }); }
});

app.delete('/api/admin/messages/:id', requireAdmin, async (req, res) => {
    try {
        const msg = await Message.findByIdAndDelete(req.params.id);
        if (!msg) return res.status(404).json({ message: 'Message not found.' });
        res.json({ message: 'Message deleted.' });
    } catch { res.status(500).json({ message: 'Server Error.' }); }
});

app.post('/api/admin/messages/:id/reply', requireAdmin, async (req, res) => {
    const { subject, body } = req.body;
    if (!body?.trim()) return res.status(400).json({ message: 'Reply body is required.' });
    try {
        const msg = await Message.findById(req.params.id);
        if (!msg) return res.status(404).json({ message: 'Message not found.' });
        const reply = { subject: subject?.trim() || `Re: ${msg.subject || 'Your enquiry'}`, body: body.trim(), sentBy: 'Admin', sentAt: new Date() };
        msg.replies.push(reply);
        if (msg.status === 'Unread') msg.status = 'Read';
        await msg.save();
        const { subject: es, html } = buildReplyEmail(msg, reply.subject, reply.body);
        sendEmail(msg.email, es, html);
        console.log(`Reply sent: ${msg._id} -> ${msg.email}`);
        res.status(200).json({ message: 'Reply sent successfully.', msg });
    } catch (err) { console.error('Reply error:', err); res.status(500).json({ message: 'Server Error.' }); }
});

app.put('/api/admin/messages/:id/urgency', requireAdmin, async (req, res) => {
    const { urgency } = req.body;
    if (!['high', 'medium', 'low'].includes(urgency)) return res.status(400).json({ message: "urgency must be 'high', 'medium', or 'low'." });
    try {
        const msg = await Message.findByIdAndUpdate(req.params.id, { urgency, urgencyConfirmed: true, urgencyCorrected: urgency }, { new: true });
        if (!msg) return res.status(404).json({ message: 'Message not found.' });
        console.log(`Urgency corrected: ${msg._id} -> ${urgency}`);
        res.json({ message: 'Urgency updated.', msg });
    } catch (err) { console.error('Urgency update error:', err); res.status(500).json({ message: 'Server Error.' }); }
});


app.get('/api/dashboard/analytics', requireAdmin, async (req, res) => {
    try {
        const [{ total: totalRevenue } = { total: 0 }] = await Booking.aggregate([
            { $match: { status: 'Completed' } },
            { $group: { _id: null, total: { $sum: '$totalCost' } } },
        ]);
        const ago7 = new Date(); ago7.setDate(ago7.getDate() - 7); ago7.setHours(0, 0, 0, 0);
        const daily = await Booking.aggregate([
            { $match: { status: 'Completed', updatedAt: { $gte: ago7 } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } }, revenue: { $sum: '$totalCost' } } },
            { $sort: { _id: 1 } },
        ]);
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (6 - i));
            const ds = d.toISOString().split('T')[0];
            return { date: ds, revenue: daily.find(r => r._id === ds)?.revenue ?? 0 };
        });
        const pAgg = await Booking.aggregate([
            { $match: { status: { $ne: 'Cancelled' }, quotedPrice: { $gt: 0 } } },
            { $group: { _id: '$paymentStatus', totalQuoted: { $sum: '$quotedPrice' }, totalCollected: { $sum: '$amountPaid' }, count: { $sum: 1 } } },
        ]);
        const pipeline = { confirmed: 0, partial: 0, outstanding: 0 };
        for (const p of pAgg) {
            if (p._id === 'Paid')           pipeline.confirmed   = p.totalQuoted;
            if (p._id === 'Partially Paid') pipeline.partial     = p.totalCollected;
            if (p._id === 'Unpaid')         pipeline.outstanding = p.totalQuoted;
        }
        pipeline.total = pipeline.confirmed + pipeline.partial + pipeline.outstanding;
        const avgByType = await Booking.aggregate([
            { $match: { quotedPrice: { $gt: 0 } } },
            { $lookup: { from: 'cars', localField: 'carId', foreignField: '_id', as: 'car' } },
            { $unwind: '$car' },
            { $group: { _id: '$car.type', avgPrice: { $avg: '$quotedPrice' }, minPrice: { $min: '$quotedPrice' }, maxPrice: { $max: '$quotedPrice' }, bookings: { $sum: 1 } } },
            { $sort: { avgPrice: -1 } },
        ]);
        const now = new Date(), out30 = new Date(); out30.setDate(now.getDate() + 30);
        const upcoming = await Booking.aggregate([
            { $match: { status: { $in: ['Pending', 'Active'] }, quotedPrice: { $gt: 0 }, startDate: { $gte: now, $lte: out30 } } },
            { $group: { _id: { year: { $isoWeekYear: '$startDate' }, week: { $isoWeek: '$startDate' } }, scheduledRevenue: { $sum: '$quotedPrice' }, bookingCount: { $sum: 1 } } },
            { $sort: { '_id.year': 1, '_id.week': 1 } },
        ]);
        const totalCars = await Car.countDocuments();
        const [activeAgg] = await Booking.aggregate([{ $match: { status: 'Active' } }, { $group: { _id: null, totalRented: { $sum: { $ifNull: ['$qty', 1] } } } }]);
        const [stockAgg]  = await Car.aggregate([{ $group: { _id: null, totalStock: { $sum: '$stock' } } }]);
        const fleet = { total: totalCars, rented: activeAgg?.totalRented ?? 0, available: stockAgg?.totalStock ?? 0, maintenance: 0 };
        const recent = await Booking.find().sort({ createdAt: -1 }).limit(5).populate('carId', 'title type licensePlate').lean();
        const recentBookings = recent.map(b => ({
            id: b._id, customerName: b.customerName, customerEmail: b.customerEmail || 'N/A',
            car: b.carId?.title || 'Unknown', licensePlate: b.carId?.licensePlate || '-',
            qty: b.qty ?? 1, startDate: b.startDate, endDate: b.endDate,
            totalCost: b.totalCost, quotedPrice: b.quotedPrice, paymentStatus: b.paymentStatus,
            status: b.status, createdAt: b.createdAt,
        }));
        const sAgg = await Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
        const bookingStats = sAgg.reduce((a, x) => { a[x._id.toLowerCase()] = x.count; return a; }, { pending: 0, active: 0, completed: 0, cancelled: 0 });
        res.status(200).json({ success: true, data: { revenue: { total: totalRevenue ?? 0, last7Days }, pipeline, avgByType, upcoming, fleet, recentBookings, bookingStats } });
    } catch (err) { console.error('Analytics error:', err); res.status(500).json({ success: false, message: 'Server Error: Could not load analytics.' }); }
});

app.get('/api/dashboard/seasonal', requireAdmin, async (req, res) => {
    try {
        const monthlyVolume = await Booking.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $group: { _id: { year: { $year: '$startDate' }, month: { $month: '$startDate' } }, bookings: { $sum: 1 }, revenue: { $sum: '$totalCost' }, totalQty: { $sum: { $ifNull: ['$qty', 1] } } } },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);
        const byMonth = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, totalBookings: 0, totalRevenue: 0, years: 0 }));
        for (const row of monthlyVolume) {
            const m = byMonth[row._id.month - 1];
            m.totalBookings += row.bookings; m.totalRevenue += row.revenue; m.years += 1;
        }
        const avgBookingsPerMonth = byMonth.reduce((s, m) => s + m.totalBookings, 0) / 12 || 1;
        const seasonality = byMonth.map(m => {
            const avgBookings = m.years > 0 ? m.totalBookings / m.years : 0;
            const index       = avgBookings / avgBookingsPerMonth;
            const avgRevenue  = m.years > 0 ? m.totalRevenue / m.years : 0;
            return {
                month: m.month, monthName: new Date(2000, m.month - 1).toLocaleString('en', { month: 'long' }),
                avgBookings: Math.round(avgBookings * 10) / 10, avgRevenue: Math.round(avgRevenue),
                index: Math.round(index * 100) / 100,
                tier: index >= 1.3 ? 'peak' : index >= 0.9 ? 'normal' : 'low',
                pricingMultiplier: index >= 1.3 ? 1.20 : index >= 0.9 ? 1.00 : 0.90,
            };
        });
        const now2 = new Date();
        const outlook = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(now2.getFullYear(), now2.getMonth() + i, 1);
            const mon = d.getMonth() + 1;
            const seas = seasonality[mon - 1];
            return { year: d.getFullYear(), month: mon, monthName: seas.monthName, index: seas.index, tier: seas.tier, pricingMultiplier: seas.pricingMultiplier, label: `${seas.monthName} ${d.getFullYear()}` };
        });
        const typeDemand = await Booking.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $lookup: { from: 'cars', localField: 'carId', foreignField: '_id', as: 'car' } },
            { $unwind: '$car' },
            { $group: { _id: '$car.type', totalBookings: { $sum: 1 }, totalQty: { $sum: { $ifNull: ['$qty', 1] } }, avgRevenue: { $avg: '$totalCost' }, peakMonth: { $push: { $month: '$startDate' } } } },
            { $sort: { totalBookings: -1 } },
        ]);
        const currentStock = await Car.aggregate([{ $group: { _id: '$type', totalStock: { $sum: '$stock' }, carCount: { $sum: 1 } } }]);
        const stockMap = currentStock.reduce((a, s) => { a[s._id] = s; return a; }, {});
        const nextPeak = outlook.find(o => o.tier === 'peak') || outlook[0];
        const peakMultiplier = nextPeak.index || 1;
        const inventoryRecs = typeDemand.map(type => {
            const stock = stockMap[type._id] || { totalStock: 0, carCount: 0 };
            const avgMonthly = type.totalBookings / Math.max(monthlyVolume.length, 1);
            const peakProjection = Math.ceil(avgMonthly * peakMultiplier);
            const gap = peakProjection - stock.totalStock;
            return { type: type._id, currentStock: stock.totalStock, totalBookings: type.totalBookings, avgMonthlyDemand: Math.round(avgMonthly * 10) / 10, peakProjection, recommendedStock: Math.max(peakProjection, 1), stockGap: gap, status: gap > 0 ? 'understocked' : gap < -2 ? 'overstocked' : 'optimal', avgRevenue: Math.round(type.avgRevenue) };
        });
        const yearAgg = await Booking.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $group: { _id: { $year: '$startDate' }, bookings: { $sum: 1 }, revenue: { $sum: '$totalCost' } } },
            { $sort: { _id: 1 } },
        ]);
        const yoyGrowth = yearAgg.map((y, i) => ({
            year: y._id, bookings: y.bookings, revenue: y.revenue,
            bookingGrowth: i > 0 ? Math.round(((y.bookings - yearAgg[i-1].bookings) / yearAgg[i-1].bookings) * 100) : null,
            revenueGrowth: i > 0 ? Math.round(((y.revenue - yearAgg[i-1].revenue) / yearAgg[i-1].revenue) * 100) : null,
        }));
        res.json({ success: true, data: { seasonality, outlook, inventoryRecs, typeDemand, yoyGrowth, nextPeak, dataQuality: { totalHistoricalMonths: monthlyVolume.length, hasEnoughData: monthlyVolume.length >= 3, message: monthlyVolume.length < 3 ? 'Add more completed bookings across multiple months for accurate seasonal patterns.' : `Based on ${monthlyVolume.length} months of booking history.` } } });
    } catch (err) { console.error('Seasonal analytics error:', err); res.status(500).json({ success: false, message: 'Server Error.' }); }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));