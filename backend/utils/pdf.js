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

/**
 * Generates a formal, multi-page Lease Contract for Motor Vehicles and Chauffeur Services.
 * @param {Object} booking  - Populated Mongoose booking object containing customer & car models
 * @returns {Promise<Buffer>}
 */
export function generateContractPDF(booking) {
    return new Promise((resolve, reject) => {
        // Standard A4 initialization setup with clean 1-inch (72pt) margins
        const doc = new PDFDocument({ size: 'A4', margin: 72, info: { Title: `Lease Contract - ${booking._id}`, Author: BRAND } });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', err => reject(err));

        const customer = booking.customerId || {};
        const car = booking.carId || {};

        const lesseeName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim().toUpperCase() || '____________________';
        const lesseeAddress = customer.address || '________________________________________________________';
        
        const carMake = car.make || '____________________';
        const carColor = car.color || '____________________';
        const carModelYear = car.year || '__________';
        const carPlateNumber = car.plateNumber || '__________';

        const rawPrice = booking.quotedPrice || booking.totalPrice || 60000;
        const rentalFeeStr = fmtPeso(rawPrice);
        
        // Formatted operational date terms
        const todayStr = new Date().toLocaleDateString('en-PH', { day: 'numeric', month: 'long', year: 'numeric' });
        const startStr = booking.startDate ? fmtDate(booking.startDate) : '____________________';
        const endStr = booking.endDate ? fmtDate(booking.endDate) : '____________________';
        const durationMonths = Math.max(1, Math.round((new Date(booking.endDate) - new Date(booking.startDate)) / (1000 * 60 * 60 * 24 * 30))) || 3;

        // Helper configuration for text structural flow
        const writeTitle = (text) => doc.font('Helvetica-Bold').fontSize(12).text(text, { align: 'center' }).moveDown(1);
        const writePara = (text, options = {}) => doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a').text(text, { align: 'justify', lineGap: 2, ...options }).moveDown(0.8);
        const writeSection = (title) => doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text(title).moveDown(0.4);

        // --- TITLE HEADER ---
        writeTitle('CONTRACT FOR LEASE OF MOTOR VEHICLES AND CHAUFFEUR SERVICES');
        writePara('KNOW ALL MEN BY THE PRESENTS;');
        writePara(`This Contract entered this ${todayStr} at Quezon City by and between:`);
        
        writePara(`TRIPLE R & A Transport Services, a company duly organized and existing under the laws of the Philippines, with postal address at 3rd Floor Main Bldg. Ben-Lor St. Center, 1103 Quezon Avenue, Diliman Quezon City herein duly represented by its President, Mrs. ANAREZA ESTIMO, hereinafter called the "LESSOR"`, { indent: 20 });
        writePara('And', { align: 'center' });
        writePara(`${lesseeName}, existing under the laws of the Philippines, with postal address at ${lesseeAddress}, hereinafter referred to as "LESSEE"`, { indent: 20 });
        
        writeSection('WITNESSETH: That-');
        writePara('WHEREAS, the LESSOR is engaged in the business of providing transport services, lease of motor vehicles and chauffeur services;');
        writePara('WHEREAS, the LESSEE desires to lease motor vehicles from the LESSOR and the latter is willing to lease the same to the LESSEE;');
        writePara('NOW THEREFORE, for and in consideration of the reciprocal covenants and agreements herein contained, the LESSOR and the LESSEE hereby agree and mutually bind themselves as follows:');

        // --- SECTION 1: LEASED VEHICLES ---
        writeSection('Section 1 - LEASED VEHICLES');
        writePara('The Lessor hereby leases to the LESSEE the motor vehicle/s described below:');
        
        const listTop = doc.y;
        doc.font('Helvetica-Bold').fontSize(9.5);
        doc.text('• Car Make:', 90, listTop).text('• Color:', 280, listTop);
        doc.text('• Year Model:', 90, listTop + 14).text('• Plate Number:', 280, listTop + 14);
        
        doc.font('Helvetica').fontSize(9.5);
        doc.text(carMake, 160, listTop).text(carColor, 325, listTop);
        doc.text(carModelYear, 160, listTop + 14).text(carPlateNumber, 360, listTop + 14);
        
        doc.y = listTop + 34;
        writePara('The LESSEE hereby acknowledges that he/she received the above - described vehicles in good order and condition.');

        // --- SECTION 2: RENTAL ---
        writeSection('Section 2 - RENTAL');
        writePara(`A. The monthly rental shall be ${rentalFeeStr} per vehicle, exclusive of VAT but inclusive of Chauffeur Service and Comprehensive Insurance. The rental fee shall be payable every 10th and 25th of the month and will be deposited to Lessor's Bank Details as such:`);
        
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('Bank Name:', 90).text('Account Name:', 90).text('Account No.:', 90);
        doc.font('Helvetica').text('BDO - Checking Account (Espana Basilo Branch)', 170, doc.y - 42);
        doc.text('TRIPLE R and A Transport Services', 170, doc.y - 14);
        doc.text('008298004404', 170, doc.y + 14);
        
        doc.y += 24;
        writePara(`B. The LESSEE also agrees to give a one (1) month advance of ${rentalFeeStr} per vehicle to be applied to the last month rental under this Contract.`);
        writePara('C. A monthly rental not paid when due shall bear interest, penalty and service charges equivalent to two percent (2%) thereof per month of delay. Any three (03) consecutive months of delay in the payment of monthly rentals on the part of the LESSEE shall be a ground for the LESSOR to Pre-terminate this Contract upon fifteen (15) days prior written notice to the LESSEE.');

        // --- SECTION 3: TERM ---
        writeSection('Section 3 - TERM AND DURATION');
        writePara(`This Contract shall be for a period of ${durationMonths} months commencing upon the delivery of the leased vehicles to the LESSEE on ${startStr} and shall expire on ${endStr}. Renewable monthly up to a maximum period of Thirty Six (36) months, upon mutual consent of the parties and subject to the terms and conditions set forth. However, in case one party breaches or violates any term of this Contract the aggrieved party may Pre-terminate this Contract upon fifteen (15) days prior written notice to the other party.`);

        // --- SECTION 4: CHAUFFEUR ---
        writeSection('Section 4 - CHAUFFEUR SERVICE CONDITIONS');
        writePara('The monthly rental fee under Article 2 (A) covers Chauffeur Services shall be subject to the following terms and conditions:');
        writePara('A. The Chauffeur service shall be up to maximum of 10 continuous hour daily (inclusive of waiting time) six (6) days a week, from Monday to Saturday. In excess of ten (10) hours the chauffeur\'s fee shall be at ONE HUNDRED FIFTY PESOS (Php 150.00) per hour or TWO HUNDRED TEN PESOS (Php 210.00) per hour for Legal Holiday or ONE HUNDRED SIXTY PESOS (Php 160.00) per hour for Sunday and Special Holiday, but not exceed twenty-four (24) hours.');
        writePara('B. A Daily Trip Ticket shall be filled out and accomplished by the assigned chauffeur and duly initialed by the LESSEE, which shall be for the basis for the computation of the chauffeur\'s fee for the service rendered in excess of ten (10) hours as mentioned in subparagraph 1 above. A copy of Trip Ticket shall be provided to the LESSEE.');
        writePara('C. A Surcharge of FIVE HUNDRED PESOS (Php 500.00) per day shall be added to the monthly rental for any out-of-town trip same day return or EIGHT HUNDRED PESOS (Php 800.00) per night for overnight. The term "Out-of-Town Trips" shall mean the areas beyond Metro Manila. The out of town surcharge shall cover the chauffeur\'s fee, his per diem and lodging expenses. No other surcharge shall be imposed upon the LESSEE.');
        writePara('D. The Chauffeur shall always drive at a lawful and allowable speed according to traffic rules and regulations considering road and traffic conditions prevailing in a particular area and at a particular time.');
        writePara('E. The Lessee shall allow the chauffeur/driver to have sufficient time to rest or at least eight (8) hours of rest, otherwise any damage caused by the negligence of the chauffeurs/driver as a result of lack of rest shall be borne by the LESSEE.');
        writePara('F. The LESSOR reserved the right to substitute any other chauffeur according to the exigencies of the service with at least five (5) days prior written notification to the LESSEE. Likewise, if the LESSEE shall request for the replacement of any driver, the LESSOR shall comply immediately thereto.');
        writePara('G. The LESSEE expressly agrees that it shall not compel the chauffeur to perform any act that may endanger his life and limb or that his passengers or imperil the condition of the leased vehicles.');
        writePara('H. In the event that a new law or regulation is enacted increasing the minimum wage pertaining to chauffeur service, the monthly rental fee provided in Article 2 (A) herefo shall be adjusted proportionately.');

        // --- REMAINDER CLAUSES ---
        writeSection('Section 5 - BAGGAGE / PERSONAL EFFECTS');
        writePara('The LESSOR shall not be responsible for any loss or damage to any baggage or personal belongings of any person who avails of its services, except for caused directly attributable to is or its personnel\'s/ assigned chauffeur\'s act or negligence. However, in case a baggage or property is lost, the LESSOR undertakes to exert earnest efforts in locating and recovering the same.');

        writeSection('Section 6 - VEHICLE USE');
        writePara('A. The LESSEE shall not use or permit any leased vehicle to be used for the transportation of goods or persons in violation of any law or regulations or for the transportation of any material deemed extra hazardous by reason of being explosive or inflammable or for any illegal purpose. The LESSEE shall reimburse the LESSOR for actual damages sustained by the LESSOR as a result of such use. The LESSEE shall also reimburse the LESSOR in case any of the leased vehicles is confiscated by any governmental agency, or other reasonable expense incurred as a result thereof, whenever such confiscation or expense is caused by the illegal use of such vehicle by the LESSEE.');
        writePara('B. The LESSEE shall not use the aforementioned vehicles for towing, pushing, or any other purpose that that for which they were designed nor for the transportation for hire of passengers or animals.');
        writePara('C. The LESSEE shall not use the leased vehicles to participate in any motor sports events or rally.');
        writePara('D. The LESSEE shall not permit the leased vehicles to be operated or driven by any person/s under the influence of alcohol or drugs.');
        writePara('E. The LESSEE shall not overload any leased vehicle beyond its specified carrying capacity nor operate any leased vehicle on flat or insufficiently inflated tires.');
        writePara('F. The LESSOR shall not be responsible for loss or damage to any goods or other property placed or carried in any leased vehicle arising from any cause under Article 6 (A) to 6 (E) above.');

        writeSection('Section 7 - MAINTENANCE AND REPAIR');
        writePara('The LESSOR shall be responsible for the operation, maintenance and repair of the leased vehicles.');

        writeSection('Section 8 - REPLACEMENT VEHICLE');
        writePara('In the event of a breakdown, the LESSOR shall provide a replacement car. The replacement vehicle shall be of the same type as that of original leased vehicles.');

        writeSection('Section 9 - INSURANCE COVERAGE');
        writePara('A. The LESSEE and all its passengers as well as their properties on board the lease vehicles shall be insured under a Comprehensive Motor Vehicle Insurance Policy, a copy of which is available for inspection by the LESSEE at the office of the LESSOR. The motor vehicle policy shall contain coverage for Third Party Bodily Injury/Death up to a maximum limit of Php 500,000.00 and coverage for Third Party Property Damage up to a maximum limit of Php 500,000.00.');
        writePara('B. The Coverage for Personal Accident Insurance (PAI) is Php 50,000.00 per passenger. However, the LESSEE may opt to increase its coverage or have another insurance coverage at its own cost and to utilize the LESSOR\'s fleet prices.');
        writePara('C. The LESSOR shall render the LESSEE free from any liabilities arising from any third-party/bodily injury/death and third-party property damage provided that the LESSEE advises and submits to the LESSOR all pertinent documents related to the accident as soon as possible.');

        writeSection('Section 10 - FUEL, PARKING AND TOLL FEES');
        writePara('Shall be for the account of LESSEE during the entire lease period. The leased vehicles shall be initially supplied with full tank of fuel which should be refilled at LESSEE\'s expense upon return of the unit at the end of the lease period.');

        writeSection('Section 11 - OWNERSHIP');
        writePara('This is a lease contract only and the LESSEE acquires no ownership, title, property rights or interest in or to the leased vehicles but only the right of use in accordance with provisions of the Contract.');

        writeSection('Section 12 - BREACH OF TERMS AND CONDITIONS');
        writePara('If the LESSEE shall breach of any of the terms, conditions, or provisions herein contained, or if during the term of this Contract or any extension thereof, bankruptcy or insolvency proceedings shall be commenced by or against the LESSEE, or if the LESSEE shall make an assignment for the benefit of creditors, or if any action shall be taken against or by the LESSEE to accomplish any such purpose, or if a receiver of the property or business of the LESSEE shall be appointed, then and in any such event, these events shall be sufficient ground/s for the termination of this Contract.');
        writePara('In relation thereto, the LESSEE hereby authorizes and empowers the LESSOR to enter its premises or any other place where the lease vehicles may be found to take possession and carry away and remove such leased vehicles with or without legal process and thereby terminate the LESSEE\'s right to retention and use of such leased vehicles.');

        writeSection('Section 13 - RENEWAL');
        writePara('This Contract may be renewed by the parties subject to such terms and conditions as may be mutually agreed upon by them.');

        writeSection('Section 14 - PRE TERMINATION');
        writePara('Should this Contract be terminated prematurely by the LESSEE for any reason and/or cause, the LESSEE shall be charged 50% for the monthly rentals pertaining to the remaining balance of the Contract.');

        writeSection('Section 15 - ATTORNEY\'S FEE AND VENUE OF ACTION');
        writePara('In case of court suit arising out of or in connection with this Contract, the venue of the action shall be in the City of Quezon City and it is hereby agreed that the LESSEE shall entitled to seek as relief attorney\'s fee equivalent to twenty five (25%) percent of the amount due but in no case shall the same be less than TWO HUNDRED THOUSAND PESOS (Php 200,000.00).');

        writeSection('Section 16 - SEVERABILITY');
        writePara('In the event any of the terms or provisions hereof are in violation of, or prohibited by any applicable law, statutes or ordinance of any city or other government subdivision, such terms or provisions shall be of no force and effect to the extent of such violation or prohibition without invalidating the other terms and provision of the Contract not affected thereby.');

        writeSection('Section 17 - ENTIRE AGREEMENT');
        writePara('This Agreement constitutes the entire agreement between the parties with respect to the subject matter hereof, and supersedes any and all prior representation and agreements, whether oral or written.');

        doc.moveDown(1.5);
        writePara('IN WITNESS WHEREOF, the parties have executed this Contract on the date and place first above written.');
        
        doc.moveDown(1);
        const currentY = doc.y;
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('TRIPLE R & A TRANSPORT SERVICE', 72, currentY);
        doc.text('(LESSOR)', 72, currentY + 14);
        doc.font('Helvetica').text('ANAREZA T. ESTIMO\nOwner', 72, currentY + 42);

        doc.font('Helvetica-Bold').text(lesseeName, 320, currentY, { width: 200 });
        doc.text('(LESSEE)', 320, currentY + 14);
        doc.font('Helvetica').text('Authorized Representative', 320, currentY + 42);

        // --- NOTARIAL ACKNOWLEDGEMENT ---
        doc.addPage();
        writeTitle('ACKNOWLEDGEMENT');
        writePara('REPUBLIC OF THE PHILIPPINES )');
        writePara('QUEZON CITY, METRO MANILA ) S.S.');
        
        writePara(`BEFORE ME, a Notary Public for and in Quezon City, personally appeared the following individuals presenting competent evidence of identification:`);
        
        doc.moveDown(1);
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('NAME', 72, doc.y);
        doc.text('GOVERNMENT ID NO.', 240, doc.y - 11);
        doc.text('DATE & PLACE ISSUED', 400, doc.y - 11);
        
        doc.moveTo(72, doc.y + 4).lineTo(523, doc.y + 4).strokeColor('#000').lineWidth(0.75).stroke();
        
        doc.y += 10;
        doc.font('Helvetica').fontSize(9);
        doc.text('TRIPLE R & A TRANSPORT SERVICES', 72, doc.y);
        doc.text('P7444078', 240, doc.y - 11);
        doc.text('July 2024 / Manila', 400, doc.y - 11);
        
        doc.y += 14;
        doc.text(lesseeName, 72, doc.y, { width: 160 });
        doc.text('____________________', 240, doc.y - 11);
        doc.text('____________________', 400, doc.y - 11);
        
        doc.y += 24;
        writePara('Known to me and to me known to be the same persons who executed the foregoing Contract for Lease of Motor Vehicles and Chauffeur Services consisting of multi-pages, including the page on which this acknowledgement is written, and they acknowledged to me that the same is their free and voluntary act and deed.');
        
        writePara('WITNESS MY HAND AND NOTARIAL SEAL on the date and place first written above.');
        
        doc.moveDown(2);
        doc.text('Doc. No. _________;');
        doc.text('Page No. _________;');
        doc.text('Book No. _________;');
        doc.text(`Series of 2026.`);

        doc.end();
    });
}