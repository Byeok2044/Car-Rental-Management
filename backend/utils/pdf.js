import PDFDocument from 'pdfkit';
import { BRAND, fmtDate, fmtPeso } from './helpers.js';

/**
 * Generates a professional PDF receipt as a Buffer.
 * @param {Object} booking  - Mongoose booking document
 * @param {string} carTitle - Human-readable vehicle name
 * @returns {Promise<Buffer>}
 */
export function generateReceiptPDF(booking, carTitle) {
    return new Promise((resolve, reject) => {
        const doc    = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `Receipt - ${BRAND}`, Author: BRAND } });
        const chunks = [];

        doc.on('data',  chunk => chunks.push(chunk));
        doc.on('end',   ()    => resolve(Buffer.concat(chunks)));
        doc.on('error', err   => reject(err));

        const pageW    = doc.page.width;
        const pageH    = doc.page.height;
        const margin   = 56;
        const contentW = pageW - margin * 2;

        const refNo    = `#${String(booking._id).slice(-8).toUpperCase()}`;
        const issuedOn = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

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

        // ── HEADER ─────────────────────────────────────────────────────────────
        doc.rect(0, 0, pageW, 110).fill(C.navy);
        doc.rect(0, 0, pageW, 3).fill(C.gold);

        doc.fontSize(18).font('Helvetica-Bold').fillColor(C.white)
           .text(BRAND, margin, 26, { width: contentW * 0.62 });

        doc.fontSize(8).font('Helvetica-Bold').fillColor(C.goldLight)
           .text('OFFICIAL RECEIPT', pageW - margin - 130, 26, { width: 130, align: 'right', characterSpacing: 1.5 });
        doc.fontSize(8.5).font('Helvetica').fillColor('#93c5fd')
           .text(`Ref: ${refNo}`, pageW - margin - 130, 42, { width: 130, align: 'right' });
        doc.fontSize(8.5).fillColor('#93c5fd')
           .text(`Issued: ${issuedOn}`, pageW - margin - 130, 56, { width: 130, align: 'right' });

        doc.moveTo(margin, 82).lineTo(pageW - margin, 82)
           .strokeColor(C.gold).lineWidth(0.5).stroke();

        doc.fontSize(8).font('Helvetica').fillColor('#7dd3fc')
           .text('Triple R and A Transport Services  ·  Official Rental Receipt  ·  Please retain for your records',
                 margin, 90, { width: contentW });

        // ── BILL-TO / RECEIPT META ──────────────────────────────────────────────
        let y = 128;
        const colW = contentW / 2 - 12;

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

        const rightX    = margin + colW + 24;
        const labelColW = 90, valColW = colW - labelColW;
        const metaRows  = [
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
        doc.moveTo(margin, y).lineTo(pageW - margin, y)
           .strokeColor(C.hairline).lineWidth(0.75).stroke();
        y += 16;

        // ── RENTAL DETAILS ──────────────────────────────────────────────────────
        doc.rect(margin, y, 3, 12).fill(C.accent);
        doc.fontSize(8).font('Helvetica-Bold').fillColor(C.accent)
           .text('RENTAL DETAILS', margin + 10, y + 1, { characterSpacing: 1.1 });
        y += 22;

        const col1 = margin, col2 = margin + 210, rowH = 28;
        doc.rect(col1, y, contentW, rowH - 2).fill(C.navy);
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.white)
           .text('DESCRIPTION', col1 + 12, y + 9, { characterSpacing: 0.8 });
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.white)
           .text('DETAILS', col2, y + 9, { characterSpacing: 0.8 });
        y += rowH;

        const detailRows = [
            ['Vehicle',      carTitle],
            ...(booking.qty > 1 ? [['Quantity', `${booking.qty} unit(s)`]] : []),
            ['Pickup Date',  fmtDate(booking.startDate)],
            ['Return Date',  fmtDate(booking.endDate)],
            ['Duration',     `${booking.rentalDays} day${booking.rentalDays !== 1 ? 's' : ''}`],
            ...(booking.pickupLocation ? [['Pickup Location', booking.pickupLocation]] : []),
            ...(booking.paymentMethod  ? [['Payment Method',  booking.paymentMethod]]  : []),
        ];

        detailRows.forEach((row, i) => {
            const rowY = y + i * rowH;
            doc.rect(col1, rowY, contentW, rowH - 1).fill(i % 2 === 0 ? C.offwhite : C.white);
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C.slate)
               .text(row[0], col1 + 12, rowY + 9, { width: 190 });
            doc.fontSize(8.5).font('Helvetica').fillColor(C.black)
               .text(row[1], col2, rowY + 9, { width: contentW - (col2 - col1) - 12 });
            doc.moveTo(col1, rowY + rowH - 1).lineTo(col1 + contentW, rowY + rowH - 1)
               .strokeColor(C.hairline).lineWidth(0.4).stroke();
        });

        y += detailRows.length * rowH + 20;

        // ── PAYMENT SUMMARY ─────────────────────────────────────────────────────
        doc.rect(margin, y, 3, 12).fill(C.accent);
        doc.fontSize(8).font('Helvetica-Bold').fillColor(C.accent)
           .text('PAYMENT SUMMARY', margin + 10, y + 1, { characterSpacing: 1.1 });
        y += 22;

        const summaryLabelX = margin;
        const summaryValX   = margin + contentW - 160;
        const summaryValW   = 150;
        const sumRowH       = 26;
        const outstanding   = Math.max(0, (booking.quotedPrice ?? 0) - (booking.amountPaid ?? 0));

        const summaryRows = [
            { label: 'Quoted Price', val: fmtPeso(booking.quotedPrice ?? 0), bold: false },
            { label: 'Amount Paid',  val: fmtPeso(booking.amountPaid ?? 0),  bold: false },
        ];

        summaryRows.forEach((row, i) => {
            const rowY = y + i * sumRowH;
            doc.rect(margin, rowY, contentW, sumRowH - 1).fill(i % 2 === 0 ? C.offwhite : C.white);
            doc.fontSize(8.5).font(row.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(C.slate)
               .text(row.label, summaryLabelX + 12, rowY + 8, { width: 200 });
            doc.fontSize(8.5).font(row.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(C.black)
               .text(row.val, summaryValX, rowY + 8, { width: summaryValW, align: 'right' });
            doc.moveTo(margin, rowY + sumRowH - 1).lineTo(margin + contentW, rowY + sumRowH - 1)
               .strokeColor(C.hairline).lineWidth(0.4).stroke();
        });

        y += summaryRows.length * sumRowH;

        const balColor = outstanding === 0 ? C.green : C.navy;
        doc.rect(margin, y, contentW, sumRowH + 4).fill(balColor);
        doc.fontSize(9).font('Helvetica-Bold').fillColor(C.white)
           .text('BALANCE OUTSTANDING', summaryLabelX + 12, y + 9, { width: 200 });
        doc.fontSize(9).font('Helvetica-Bold').fillColor(outstanding === 0 ? '#86efac' : C.goldLight)
           .text(fmtPeso(outstanding), summaryValX, y + 9, { width: summaryValW, align: 'right' });
        y += sumRowH + 4 + 18;

        // ── PAYMENT NOTES ───────────────────────────────────────────────────────
        if (booking.paymentNotes) {
            doc.rect(margin, y, contentW, 44).fill(C.offwhite);
            doc.rect(margin, y, 3, 44).fill(C.accentMid);
            doc.fontSize(7).font('Helvetica-Bold').fillColor(C.accent)
               .text('NOTES', margin + 12, y + 8, { characterSpacing: 1 });
            doc.fontSize(8.5).font('Helvetica').fillColor(C.slate)
               .text(booking.paymentNotes, margin + 12, y + 20, { width: contentW - 24 });
            y += 60;
        }

        // ── SIGNATURE BLOCK ─────────────────────────────────────────────────────
        const sigY    = Math.max(y + 20, pageH - 170);
        const sigColW = (contentW - 40) / 2;
        const sig2X   = margin + sigColW + 40;

        doc.moveTo(margin, sigY).lineTo(pageW - margin, sigY)
           .strokeColor(C.hairline).lineWidth(0.75).stroke();

        doc.fontSize(7).font('Helvetica-Bold').fillColor(C.muted)
           .text('PREPARED BY', margin, sigY + 14, { characterSpacing: 1 });
        doc.moveTo(margin, sigY + 46).lineTo(margin + sigColW, sigY + 46)
           .strokeColor(C.slate).lineWidth(0.6).stroke();
        doc.fontSize(7.5).font('Helvetica').fillColor(C.slate)
           .text('Authorised Signature', margin, sigY + 50);

        doc.fontSize(7).font('Helvetica-Bold').fillColor(C.muted)
           .text('RECEIVED BY', sig2X, sigY + 14, { characterSpacing: 1 });
        doc.moveTo(sig2X, sigY + 46).lineTo(sig2X + sigColW, sigY + 46)
           .strokeColor(C.slate).lineWidth(0.6).stroke();
        doc.fontSize(7.5).font('Helvetica').fillColor(C.slate)
           .text('Customer Signature & Date', sig2X, sigY + 50);

        // ── FOOTER ──────────────────────────────────────────────────────────────
        doc.rect(0, pageH - 52, pageW, 52).fill(C.navy);
        doc.rect(0, pageH - 52, pageW, 2).fill(C.gold);

        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.white)
           .text(BRAND, margin, pageH - 38, { width: contentW * 0.6 });
        doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
           .text('This is an official receipt. Please keep it for your records.',
                 margin, pageH - 24, { width: contentW * 0.65 });
        doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
           .text(`Ref: ${refNo}`, pageW - margin - 180, pageH - 38, { width: 180, align: 'right' });
        doc.fontSize(7).fillColor('#64748b')
           .text(`Generated: ${new Date().toLocaleString('en-PH')}`,
                 pageW - margin - 180, pageH - 24, { width: 180, align: 'right' });

        doc.end();
    });
}