import { Router } from 'express';
import mongoose from 'mongoose';
import Booking from '../../models/booking.js';
import BookingPayment from '../../models/BookingPayment.js';
import Customer from '../../models/Customer.js';
import Car from '../../models/cars.js';
import { requireAdmin } from '../../middleware/auth.js';
import { fmtPeso } from '../../utils/helpers.js';
import {
    sendEmail,
    buildActiveEmail,
    buildCompletedEmail,
    buildQuoteEmail,
    buildExtensionEmail,
    buildDocsVerifiedEmail,
    buildDocsRejectedEmail,
} from '../../utils/email.js';
import { generateReceiptPDF } from '../../utils/pdf.js';

const router = Router();
router.use(requireAdmin);

// ── helper: load booking with everything attached ─────────────────────────────
async function loadFull(id) {
    const booking = await Booking.findById(id)
        .populate('carId',      'title type image dailyRate')
        .populate('customerId', 'name email phone')
        .lean();
    if (!booking) return null;
    const payment = await BookingPayment.findOne({ bookingId: id }).lean();
    return {
        ...booking,
        customerName:  booking.customerId?.name  || '',
        customerEmail: booking.customerId?.email || '',
        customerPhone: booking.customerId?.phone || '',
        ...(payment ? {
            quotedPrice:   payment.quotedPrice,
            quotedAt:      payment.quotedAt,
            totalCost:     payment.totalCost,
            amountPaid:    payment.amountPaid,
            paymentStatus: payment.paymentStatus,
            paymentMethod: payment.paymentMethod,
            paymentNotes:  payment.paymentNotes,
        } : {}),
    };
}

// ── POST /api/admin/bookings/:id/verify-docs ──────────────────────────────────
// Verifies documents and moves booking from Unverified → Pending
router.post('/:id/verify-docs', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('customerId', 'name email phone')
            .populate('carId',      'title type image');

        if (!booking)
            return res.status(404).json({ message: 'Booking not found.' });

        if (booking.status !== 'Unverified')
            return res.status(400).json({
                message: `Only Unverified bookings can have documents verified. Current status: ${booking.status}.`,
            });

        if (!booking.kycDocUrls || booking.kycDocUrls.length === 0)
            return res.status(400).json({
                message: 'No documents have been submitted for this booking.',
            });

        booking.docsVerified    = true;
        booking.docsVerifiedAt  = new Date();
        booking.docsVerifiedBy  = req.admin?.id || 'admin';
        booking.docsRejected    = false;
        booking.docsRejectReason = '';
        booking.status          = 'Pending';
        await booking.save();

        const populated = await loadFull(booking._id);

        // Send verification email
        const customerEmail = booking.customerId?.email || '';
        if (customerEmail) {
            const carTitle = booking.carId?.title || 'your vehicle';
            const { subject, html } = buildDocsVerifiedEmail(populated, carTitle);
            sendEmail(customerEmail, subject, html);
        }

        console.log(`Docs verified: booking ${booking._id} → Pending`);
        return res.json({ message: 'Documents verified. Booking is now Pending.', booking: populated });
    } catch (err) {
        console.error('Verify docs error:', err);
        return res.status(500).json({ message: 'Server Error.' });
    }
});

// ── POST /api/admin/bookings/:id/reject-docs ──────────────────────────────────
// Rejects documents — booking is cancelled, customer is emailed
router.post('/:id/reject-docs', async (req, res) => {
    const { reason = '' } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(req.params.id)
            .session(session)
            .populate('customerId', 'name email phone')
            .populate('carId',      'title type image');

        if (!booking) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ message: 'Booking not found.' });
        }

        if (booking.status !== 'Unverified') {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({
                message: `Only Unverified bookings can have documents rejected. Current status: ${booking.status}.`,
            });
        }

        // Restore stock since booking is being cancelled
        const car = await Car.findById(booking.carId._id || booking.carId).session(session);
        if (car) {
            car.stock += booking.qty ?? 1;
            await car.save({ session });
        }

        booking.docsRejected    = true;
        booking.docsRejectedAt  = new Date();
        booking.docsRejectReason = reason.trim();
        booking.docsVerified    = false;
        booking.status          = 'Cancelled';
        await booking.save({ session });

        await session.commitTransaction();
        session.endSession();

        const populated = await loadFull(booking._id);

        // Send rejection email
        const customerEmail = booking.customerId?.email || '';
        if (customerEmail) {
            const carTitle = booking.carId?.title || 'your vehicle';
            const { subject, html } = buildDocsRejectedEmail(populated, carTitle, reason.trim());
            sendEmail(customerEmail, subject, html);
        }

        console.log(`Docs rejected: booking ${booking._id} → Cancelled`);
        return res.json({ message: 'Documents rejected. Booking has been cancelled.', booking: populated });
    } catch (err) {
        await session.abortTransaction(); session.endSession();
        console.error('Reject docs error:', err);
        return res.status(500).json({ message: 'Server Error.' });
    }
});

// ── PUT /api/admin/bookings/:id/status ───────────────────────────────────────
router.put('/:id/status', async (req, res) => {
    const { status } = req.body;
    const allowed  = ['Pending', 'Active', 'Completed', 'Cancelled'];
    const terminal = ['Completed', 'Cancelled'];

    if (!allowed.includes(status))
        return res.status(400).json({ message: 'Invalid status.' });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(req.params.id).session(session);
        if (!booking) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ message: 'Booking not found.' });
        }

        const payment = await BookingPayment.findOne({ bookingId: booking._id }).session(session);

        // Cannot manually set to Pending — that only happens via verify-docs
        if (status === 'Pending')
            return res.status(400).json({ message: 'Booking moves to Pending automatically when documents are verified.' });

        // Cannot activate if status is Unverified
        if (status === 'Active' && booking.status === 'Unverified') {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ message: 'Documents must be verified before activating a booking.' });
        }

        if (status === 'Active' && (!payment || payment.paymentStatus === 'Unpaid')) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ message: 'Booking cannot be marked Active until at least a partial payment has been recorded.' });
        }
        if (status === 'Completed' && (!payment || payment.paymentStatus !== 'Paid')) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ message: 'Booking cannot be marked Completed until it is fully paid.' });
        }

        let car = null;
        if (terminal.includes(status) && !terminal.includes(booking.status)) {
            car = await Car.findById(booking.carId).session(session);
            if (car) {
                car.stock += booking.qty ?? 1;
                await car.save({ session });
            }
        }

        booking.status = status;
        await booking.save({ session });
        await session.commitTransaction();
        session.endSession();

        const populated = await loadFull(booking._id);

        if (populated.customerEmail) {
            const carTitle = populated.carId?.title || car?.title || 'your vehicle';
            if (status === 'Active') {
                const { subject, html } = buildActiveEmail(populated, carTitle);
                sendEmail(populated.customerEmail, subject, html);
            } else if (status === 'Completed') {
                buildCompletedEmail(populated, carTitle)
                    .then(({ subject, html, attachments }) =>
                        sendEmail(populated.customerEmail, subject, html, attachments))
                    .catch(err => console.error('[completed email] failed:', err.message));
            }
        }

        res.json({ message: 'Status updated.', booking: populated });
    } catch (err) {
        await session.abortTransaction(); session.endSession();
        console.error('Status error:', err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

// ── PUT /api/admin/bookings/:id/quote ────────────────────────────────────────
router.put('/:id/quote', async (req, res) => {
    const { quotedPrice, paymentNotes } = req.body;
    if (quotedPrice == null || isNaN(quotedPrice) || Number(quotedPrice) <= 0)
        return res.status(400).json({ message: 'A valid quoted price greater than 0 is required.' });

    try {
        const booking = await Booking.findById(req.params.id)
            .populate('customerId', 'name email phone')
            .populate('carId', 'title type image dailyRate');
        if (!booking) return res.status(404).json({ message: 'Booking not found.' });

        // Can only quote Pending (verified) bookings
        if (booking.status === 'Unverified')
            return res.status(400).json({ message: 'Documents must be verified before setting a quote.' });

        await BookingPayment.findOneAndUpdate(
            { bookingId: booking._id },
            {
                quotedPrice:  Number(quotedPrice),
                quotedAt:     new Date(),
                totalCost:    Number(quotedPrice),
                paymentNotes: paymentNotes?.trim() || '',
            },
            { new: true, upsert: true }
        );

        const populated = await loadFull(booking._id);

        if (populated.customerEmail) {
            const { subject, html } = buildQuoteEmail(populated, populated.carId?.title || 'your vehicle');
            sendEmail(populated.customerEmail, subject, html);
        }

        console.log(`Quote set: ${booking._id} -> ${fmtPeso(quotedPrice)}`);
        res.json({ message: 'Quote set successfully.', booking: populated });
    } catch (err) {
        console.error('Quote error:', err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

// ── PUT /api/admin/bookings/:id/payment ──────────────────────────────────────
router.put('/:id/payment', async (req, res) => {
    const { amountPaid, paymentMethod, paymentNotes } = req.body;
    if (amountPaid == null || isNaN(amountPaid) || Number(amountPaid) < 0)
        return res.status(400).json({ message: 'A valid amount (0 or greater) is required.' });

    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found.' });

        const payment = await BookingPayment.findOne({ bookingId: booking._id });
        if (!payment?.quotedPrice)
            return res.status(400).json({ message: 'Set a quoted price before recording payment.' });

        const paid = Number(amountPaid);
        payment.amountPaid    = paid;
        payment.paymentStatus = paid >= payment.quotedPrice ? 'Paid'
            : paid > 0 ? 'Partially Paid' : 'Unpaid';
        if (paymentMethod) payment.paymentMethod = paymentMethod;
        if (paymentNotes)  payment.paymentNotes  = paymentNotes.trim();
        await payment.save();

        const populated = await loadFull(booking._id);
        console.log(`Payment: ${booking._id} -> ${fmtPeso(paid)} (${payment.paymentStatus})`);
        res.json({ message: 'Payment recorded.', booking: populated });
    } catch (err) {
        console.error('Payment error:', err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

// ── DELETE /api/admin/bookings/:id ───────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    const RESTORE_STATUSES = ['Unverified', 'Pending', 'Active'];
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(req.params.id).session(session);
        if (!booking) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ message: 'Booking not found.' });
        }

        if (RESTORE_STATUSES.includes(booking.status)) {
            const car = await Car.findById(booking.carId).session(session);
            if (car) {
                car.stock += booking.qty ?? 1;
                await car.save({ session });
            }
        }

        await BookingPayment.findOneAndDelete({ bookingId: booking._id }).session(session);
        await Booking.findByIdAndDelete(req.params.id).session(session);
        await session.commitTransaction();
        session.endSession();

        console.log(`Booking deleted: ${booking._id}`);
        res.json({ message: 'Booking deleted successfully.', deletedId: booking._id });
    } catch (err) {
        await session.abortTransaction(); session.endSession();
        console.error('Delete booking error:', err);
        res.status(500).json({ message: 'Server Error: Could not delete booking.' });
    }
});

// ── PUT /api/admin/bookings/:id/adjust ───────────────────────────────────────
router.put('/:id/adjust', async (req, res) => {
    const { startDate, endDate, reason } = req.body;
    if (!endDate) return res.status(400).json({ message: 'endDate is required.' });

    try {
        const booking = await Booking.findById(req.params.id)
            .populate('carId', 'title type dailyRate image');
        if (!booking) return res.status(404).json({ message: 'Booking not found.' });

        if (!['Pending', 'Active'].includes(booking.status))
            return res.status(400).json({ message: `Cannot adjust a "${booking.status}" booking.` });

        const newEnd   = new Date(endDate);  newEnd.setHours(0,0,0,0);
        let   newStart = new Date(booking.startDate); newStart.setHours(0,0,0,0);

        if (booking.status === 'Pending' && startDate) {
            const parsedStart = new Date(startDate); parsedStart.setHours(0,0,0,0);
            if (parsedStart >= newEnd)
                return res.status(400).json({ message: 'Start date must be before end date.' });
            newStart = parsedStart;
            booking.startDate = newStart;
        }

        if (newEnd <= newStart)
            return res.status(400).json({ message: 'End date must be after start date.' });

        const msPerDay      = 1000 * 60 * 60 * 24;
        const newRentalDays = Math.round((newEnd - newStart) / msPerDay) + 1;
        const oldRentalDays = booking.rentalDays || 1;
        const dayDiff       = newRentalDays - oldRentalDays;

        booking.endDate    = newEnd;
        booking.rentalDays = newRentalDays;
        await booking.save();

        const dailyRate = booking.carId?.dailyRate ?? 0;
        if (dailyRate > 0 && dayDiff !== 0) {
            const payment = await BookingPayment.findOne({ bookingId: booking._id });
            if (payment?.quotedPrice != null) {
                const adjustment = dailyRate * (booking.qty ?? 1) * dayDiff;
                payment.quotedPrice = Math.max(0, payment.quotedPrice + adjustment);
                payment.totalCost   = payment.quotedPrice;
                const action = dayDiff > 0 ? `extended +${dayDiff}d` : `shortened ${dayDiff}d`;
                const note   = `[Adjustment: ${action}${reason ? ': ' + reason.trim() : ''}]`;
                payment.paymentNotes = payment.paymentNotes ? `${payment.paymentNotes} ${note}` : note;
                await payment.save();
            }
        }

        const populated = await loadFull(booking._id);
        res.json({ message: 'Booking adjusted successfully.', booking: populated });
    } catch (err) {
        console.error('Adjust booking error:', err);
        res.status(500).json({ message: 'Server Error: Could not adjust booking.' });
    }
});

// ── GET /api/admin/bookings/:id/receipt ──────────────────────────────────────
router.get('/:id/receipt', async (req, res) => {
    try {
        const full = await loadFull(req.params.id);
        if (!full) return res.status(404).send('Booking not found');

        const pdfBuffer = await generateReceiptPDF(full, full.carId?.title || 'Vehicle');
        res.set({
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename=receipt-${full._id}.pdf`,
            'Content-Length':      pdfBuffer.length,
        });
        res.send(pdfBuffer);
    } catch (err) {
        console.error('PDF Receipt Error:', err);
        res.status(500).send('Error generating receipt');
    }
});

export default router;