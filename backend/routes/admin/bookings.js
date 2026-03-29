import { Router } from 'express';
import mongoose from 'mongoose';
import Booking from '../../models/Booking.js';
import Car from '../../models/cars.js';
import { requireAdmin } from '../../middleware/auth.js';
import { fmtPeso } from '../../utils/helpers.js';
import {
    sendEmail,
    buildActiveEmail,
    buildCompletedEmail,
    buildQuoteEmail,
    buildExtensionEmail,
} from '../../utils/email.js';

const router = Router();
router.use(requireAdmin);

// PUT /api/admin/bookings/:id/status
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

        if (status === 'Active' && booking.paymentStatus === 'Unpaid') {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ message: 'Booking cannot be marked Active until at least a partial payment has been recorded.' });
        }
        if (status === 'Completed' && booking.paymentStatus !== 'Paid') {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ message: 'Booking cannot be marked Completed until it is fully paid.' });
        }

        let car = null;
        if (terminal.includes(status) && !terminal.includes(booking.status)) {
            car = await Car.findById(booking.carId).session(session);
            if (car) {
                car.stock += booking.qty ?? 1;
                await car.save({ session });
                console.log(`Stock restored: ${car.title} -> ${car.stock}`);
            }
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
                buildCompletedEmail(booking, carTitle)
                    .then(({ subject, html, attachments }) => sendEmail(booking.customerEmail, subject, html, attachments))
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

// PUT /api/admin/bookings/:id/quote
router.put('/:id/quote', async (req, res) => {
    const { quotedPrice, paymentNotes } = req.body;
    if (quotedPrice == null || isNaN(quotedPrice) || Number(quotedPrice) <= 0)
        return res.status(400).json({ message: 'A valid quoted price greater than 0 is required.' });
    try {
        const booking = await Booking.findByIdAndUpdate(
            req.params.id,
            { quotedPrice: Number(quotedPrice), quotedAt: new Date(), totalCost: Number(quotedPrice), paymentNotes: paymentNotes?.trim() || '' },
            { new: true }
        ).populate('carId', 'title type image');

        if (!booking) return res.status(404).json({ message: 'Booking not found.' });

        if (booking.customerEmail) {
            const { subject, html } = buildQuoteEmail(booking, booking.carId?.title || 'your vehicle');
            sendEmail(booking.customerEmail, subject, html);
        }
        console.log(`Quote set: ${booking._id} -> ${fmtPeso(quotedPrice)}`);
        res.json({ message: 'Quote set successfully.', booking });
    } catch (err) {
        console.error('Quote error:', err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

// PUT /api/admin/bookings/:id/payment
router.put('/:id/payment', async (req, res) => {
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
    } catch (err) {
        console.error('Payment error:', err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

// DELETE /api/admin/bookings/:id
router.delete('/:id', async (req, res) => {
    const RESTORE_STATUSES = ['Pending', 'Active'];
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
                console.log(`Stock restored on delete: ${car.title} -> ${car.stock}`);
            }
        }

        await Booking.findByIdAndDelete(req.params.id).session(session);
        await session.commitTransaction(); session.endSession();
        console.log(`Booking deleted: ${booking._id} (was ${booking.status})`);
        res.json({ message: 'Booking deleted successfully.', deletedId: booking._id });
    } catch (err) {
        await session.abortTransaction(); session.endSession();
        console.error('Delete booking error:', err);
        res.status(500).json({ message: 'Server Error: Could not delete booking.' });
    }
});

// PUT /api/admin/bookings/:id/extend
router.put('/:id/extend', async (req, res) => {
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

        const newEnd = new Date(booking.endDate);
        newEnd.setDate(newEnd.getDate() + extra);
        booking.endDate    = newEnd;
        booking.rentalDays = (booking.rentalDays || 1) + extra;

        const dailyRate = booking.carId?.dailyRate ?? 0;
        if (dailyRate > 0 && booking.quotedPrice != null) {
            const extraCost     = dailyRate * (booking.qty ?? 1) * extra;
            booking.quotedPrice = (booking.quotedPrice || 0) + extraCost;
            booking.totalCost   = booking.quotedPrice;
        }

        const note = `[Extension +${extra}d${reason ? ': ' + reason.trim() : ''}]`;
        booking.paymentNotes = booking.paymentNotes ? `${booking.paymentNotes} ${note}` : note;
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

export default router;