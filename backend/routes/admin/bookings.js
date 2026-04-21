
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
    buildDocsVerifiedEmail,
    buildDocsRejectedEmail,
} from '../../utils/email.js';
import { generateReceiptPDF } from '../../utils/pdf.js';

const router = Router();
router.use(requireAdmin);

// ── Statuses that are considered "terminal" (no more stock changes needed) ────
const TERMINAL_STATUSES = ['Completed', 'Cancelled'];

// ── Statuses that still hold stock (restoring needed on cancel/complete) ──────
const STOCK_HOLDING_STATUSES = ['Unverified', 'Pending', 'Active'];

// ── helper: load a booking fully populated with payment data ─────────────────
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

// ────────────────────────────────────────────────────────────────────────────
// GET /api/admin/bookings
// ────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const bookings = await Booking.find()
            .populate('carId',      'title type image dailyRate')
            .populate('customerId', 'name email phone')
            .sort({ createdAt: -1 })
            .lean();

        const bookingIds = bookings.map(b => b._id);
        const payments   = await BookingPayment.find({ bookingId: { $in: bookingIds } }).lean();
        const payMap     = Object.fromEntries(payments.map(p => [String(p.bookingId), p]));

        const shaped = bookings.map(b => {
            const pay = payMap[String(b._id)] || {};
            return {
                ...b,
                customerName:  b.customerId?.name  || '',
                customerEmail: b.customerId?.email || '',
                customerPhone: b.customerId?.phone || '',
                quotedPrice:   pay.quotedPrice   ?? null,
                amountPaid:    pay.amountPaid    ?? 0,
                paymentStatus: pay.paymentStatus ?? 'Unpaid',
                paymentMethod: pay.paymentMethod ?? null,
                paymentNotes:  pay.paymentNotes  ?? '',
            };
        });

        res.json(shaped);
    } catch (err) {
        console.error('GET /api/admin/bookings error:', err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/admin/bookings/:id/verify-docs
// Verifies KYC documents → moves booking Unverified → Pending
// This is the ONLY way to reach 'Pending'.
// ────────────────────────────────────────────────────────────────────────────
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

        booking.docsVerified     = true;
        booking.docsVerifiedAt   = new Date();
        booking.docsVerifiedBy   = req.admin?.id || 'admin';
        booking.docsRejected     = false;
        booking.docsRejectReason = '';
        booking.status           = 'Pending';
        await booking.save();

        const populated = await loadFull(booking._id);
        const customerEmail = booking.customerId?.email || '';

        if (customerEmail) {
            const carTitle = booking.carId?.title || 'your vehicle';
            const { subject, html } = buildDocsVerifiedEmail(populated, carTitle);
            sendEmail(customerEmail, subject, html);
        }

        console.log(`[verify-docs] booking ${booking._id} → Pending`);
        return res.json({ message: 'Documents verified. Booking is now Pending.', booking: populated });
    } catch (err) {
        console.error('verify-docs error:', err);
        return res.status(500).json({ message: 'Server Error.' });
    }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/admin/bookings/:id/reject-docs
// Rejects KYC documents → cancels booking, restores stock, emails customer
// ────────────────────────────────────────────────────────────────────────────
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

        // Restore stock (booking was holding a reservation)
        const carId = booking.carId?._id || booking.carId;
        const car   = await Car.findById(carId).session(session);
        if (car) {
            car.stock += booking.qty ?? 1;
            await car.save({ session });
        }

        booking.docsRejected     = true;
        booking.docsRejectedAt   = new Date();
        booking.docsRejectReason = reason.trim();
        booking.docsVerified     = false;
        booking.status           = 'Cancelled';
        await booking.save({ session });

        await session.commitTransaction();
        session.endSession();

        const populated     = await loadFull(booking._id);
        const customerEmail = booking.customerId?.email || '';

        if (customerEmail) {
            const carTitle = booking.carId?.title || 'your vehicle';
            const { subject, html } = buildDocsRejectedEmail(populated, carTitle, reason.trim());
            sendEmail(customerEmail, subject, html);
        }

        console.log(`[reject-docs] booking ${booking._id} → Cancelled`);
        return res.json({ message: 'Documents rejected. Booking has been cancelled.', booking: populated });
    } catch (err) {
        await session.abortTransaction(); session.endSession();
        console.error('reject-docs error:', err);
        return res.status(500).json({ message: 'Server Error.' });
    }
});

// ────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/bookings/:id/status
// Allowed manual transitions:
//   Pending   → Active | Cancelled
//   Active    → Completed | Cancelled
//   (Unverified → Pending is handled ONLY by verify-docs above)
// ────────────────────────────────────────────────────────────────────────────
router.put('/:id/status', async (req, res) => {
    const { status } = req.body;

    // Manually settable statuses (NOT including Pending — that's verify-docs only)
    const MANUAL_ALLOWED = ['Active', 'Completed', 'Cancelled'];
    if (!MANUAL_ALLOWED.includes(status))
        return res.status(400).json({
            message: status === 'Pending'
                ? 'Booking moves to Pending automatically when documents are verified via the "Verify Documents" action.'
                : 'Invalid status.',
        });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(req.params.id).session(session);
        if (!booking) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ message: 'Booking not found.' });
        }

        // Guard: cannot activate an unverified booking
        if (status === 'Active' && booking.status === 'Unverified') {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({
                message: 'Documents must be verified before activating a booking.',
            });
        }

        // Guard: require at least partial payment for Active
        const payment = await BookingPayment.findOne({ bookingId: booking._id }).session(session);

        if (status === 'Active' && (!payment || payment.paymentStatus === 'Unpaid')) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({
                message: 'Booking cannot be marked Active until at least a partial payment has been recorded.',
            });
        }

        // Guard: require full payment for Completed
        if (status === 'Completed' && (!payment || payment.paymentStatus !== 'Paid')) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({
                message: 'Booking cannot be marked Completed until it is fully paid.',
            });
        }

        // Restore stock when moving to a terminal status from a stock-holding status
        let car = null;
        const movingToTerminal = TERMINAL_STATUSES.includes(status);
        const currentlyHolding = STOCK_HOLDING_STATUSES.includes(booking.status);
        if (movingToTerminal && currentlyHolding) {
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

        // Send status-change email
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

        console.log(`[status] booking ${booking._id} → ${status}`);
        res.json({ message: `Booking marked as ${status}.`, booking: populated });
    } catch (err) {
        await session.abortTransaction(); session.endSession();
        console.error('status change error:', err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

// ────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/bookings/:id/quote
// Only available when booking is Pending or Active (docs verified)
// ────────────────────────────────────────────────────────────────────────────
router.put('/:id/quote', async (req, res) => {
    const { quotedPrice, paymentNotes } = req.body;

    if (quotedPrice == null || isNaN(quotedPrice) || Number(quotedPrice) <= 0)
        return res.status(400).json({ message: 'A valid quoted price greater than 0 is required.' });

    try {
        const booking = await Booking.findById(req.params.id)
            .populate('customerId', 'name email phone')
            .populate('carId',      'title type image dailyRate');
        if (!booking) return res.status(404).json({ message: 'Booking not found.' });

        // Quoting is locked until docs are verified
        if (booking.status === 'Unverified')
            return res.status(400).json({
                message: "Documents must be verified before setting a quote. Verify the customer's KYC documents first.",
            });

        if (TERMINAL_STATUSES.includes(booking.status))
            return res.status(400).json({
                message: `Cannot quote a ${booking.status} booking.`,
            });

        await BookingPayment.findOneAndUpdate(
            { bookingId: booking._id },
            {
                quotedPrice:  Number(quotedPrice),
                quotedAt:     new Date(),
                totalCost:    Number(quotedPrice),
                paymentNotes: (paymentNotes || '').trim(),
            },
            { new: true, upsert: true }
        );

        const populated = await loadFull(booking._id);

        if (populated.customerEmail) {
            const { subject, html } = buildQuoteEmail(populated, populated.carId?.title || 'your vehicle');
            sendEmail(populated.customerEmail, subject, html);
        }

        console.log(`[quote] booking ${booking._id} → ${fmtPeso(quotedPrice)}`);
        res.json({ message: 'Quote set successfully.', booking: populated });
    } catch (err) {
        console.error('quote error:', err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

// ────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/bookings/:id/payment
// ────────────────────────────────────────────────────────────────────────────
router.put('/:id/payment', async (req, res) => {
    const { amountPaid, paymentMethod, paymentNotes } = req.body;

    if (amountPaid == null || isNaN(amountPaid) || Number(amountPaid) < 0)
        return res.status(400).json({ message: 'A valid amount (0 or greater) is required.' });

    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found.' });

        if (booking.status === 'Unverified')
            return res.status(400).json({
                message: 'Documents must be verified before recording payment.',
            });

        const payment = await BookingPayment.findOne({ bookingId: booking._id });
        if (!payment?.quotedPrice)
            return res.status(400).json({ message: 'Set a quoted price before recording payment.' });

        const paid            = Number(amountPaid);
        payment.amountPaid    = paid;
        payment.paymentStatus = paid >= payment.quotedPrice
            ? 'Paid'
            : paid > 0
            ? 'Partially Paid'
            : 'Unpaid';
        if (paymentMethod) payment.paymentMethod = paymentMethod;
        if (paymentNotes)  payment.paymentNotes  = paymentNotes.trim();
        await payment.save();

        const populated = await loadFull(booking._id);
        console.log(`[payment] booking ${booking._id} → ${fmtPeso(paid)} (${payment.paymentStatus})`);
        res.json({ message: 'Payment recorded.', booking: populated });
    } catch (err) {
        console.error('payment error:', err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

// ────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/bookings/:id
// ────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const booking = await Booking.findById(req.params.id).session(session);
        if (!booking) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ message: 'Booking not found.' });
        }

        // Restore stock if booking was still holding a vehicle reservation
        if (STOCK_HOLDING_STATUSES.includes(booking.status)) {
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

        console.log(`[delete] booking ${booking._id}`);
        res.json({ message: 'Booking deleted successfully.', deletedId: booking._id });
    } catch (err) {
        await session.abortTransaction(); session.endSession();
        console.error('delete error:', err);
        res.status(500).json({ message: 'Server Error: Could not delete booking.' });
    }
});

// ────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/bookings/:id/adjust
// Adjusts rental dates (Pending or Active only)
// ────────────────────────────────────────────────────────────────────────────
router.put('/:id/adjust', async (req, res) => {
    const { startDate, endDate, reason } = req.body;
    if (!endDate) return res.status(400).json({ message: 'endDate is required.' });

    try {
        const booking = await Booking.findById(req.params.id)
            .populate('carId', 'title type dailyRate image');
        if (!booking) return res.status(404).json({ message: 'Booking not found.' });

        if (!['Pending', 'Active'].includes(booking.status))
            return res.status(400).json({
                message: `Cannot adjust a "${booking.status}" booking. Only Pending or Active bookings can be adjusted.`,
            });

        const newEnd   = new Date(endDate);  newEnd.setHours(0, 0, 0, 0);
        let   newStart = new Date(booking.startDate); newStart.setHours(0, 0, 0, 0);

        if (booking.status === 'Pending' && startDate) {
            const parsedStart = new Date(startDate); parsedStart.setHours(0, 0, 0, 0);
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

        // Adjust quoted price proportionally if a daily rate exists
        const dailyRate = booking.carId?.dailyRate ?? 0;
        if (dailyRate > 0 && dayDiff !== 0) {
            const payment = await BookingPayment.findOne({ bookingId: booking._id });
            if (payment?.quotedPrice != null) {
                const adjustment     = dailyRate * (booking.qty ?? 1) * dayDiff;
                payment.quotedPrice  = Math.max(0, payment.quotedPrice + adjustment);
                payment.totalCost    = payment.quotedPrice;
                const action         = dayDiff > 0 ? `extended +${dayDiff}d` : `shortened ${dayDiff}d`;
                const note           = `[Adjustment: ${action}${reason ? ': ' + reason.trim() : ''}]`;
                payment.paymentNotes = payment.paymentNotes ? `${payment.paymentNotes} ${note}` : note;
                await payment.save();
            }
        }

        const populated = await loadFull(booking._id);
        res.json({ message: 'Booking adjusted successfully.', booking: populated });
    } catch (err) {
        console.error('adjust error:', err);
        res.status(500).json({ message: 'Server Error: Could not adjust booking.' });
    }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/admin/bookings/:id/receipt
// SECURITY FIX: Receipt is ONLY available for 'Completed' bookings.
// A receipt implies full payment and a closed rental — issuing one for
// Unverified / Pending / Active bookings could create fraudulent-looking
// documents. The frontend already restricts the Print button to Completed,
// but this backend guard ensures the API cannot be called directly.
// ────────────────────────────────────────────────────────────────────────────
router.get('/:id/receipt', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id).lean();

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found.' });
        }

        // ── SECURITY: only allow receipts for completed, fully-paid bookings ──
        if (booking.status !== 'Completed') {
            return res.status(403).json({
                message: `Receipts can only be generated for Completed bookings. This booking is "${booking.status}".`,
            });
        }

        const full = await loadFull(req.params.id);

        // Double-check payment status as an extra guard
        if (full.paymentStatus !== 'Paid') {
            return res.status(403).json({
                message: 'Receipts can only be generated for fully paid bookings.',
            });
        }

        const pdfBuffer = await generateReceiptPDF(full, full.carId?.title || 'Vehicle');
        res.set({
            'Content-Type':        'application/pdf',
            'Content-Disposition': `inline; filename=receipt-${full._id}.pdf`,
            'Content-Length':      pdfBuffer.length,
        });
        res.send(pdfBuffer);
    } catch (err) {
        console.error('PDF Receipt Error:', err);
        res.status(500).send('Error generating receipt.');
    }
});

export default router;