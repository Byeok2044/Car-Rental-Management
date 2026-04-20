/**
 * backend/routes/publicBookings.js
 *
 * Public-facing booking endpoint.
 * New bookings are created with status = 'Unverified' (the model default).
 * The admin must review KYC documents via POST /api/admin/bookings/:id/verify-docs
 * before the booking can proceed to 'Pending'.
 *
 * Mount this at: router.use('/bookings', publicBookingsRouter)
 * (replaces the old public /api/bookings route)
 */

import { Router } from 'express';
import mongoose   from 'mongoose';
import Booking    from '../models/booking.js';
import Car        from '../models/cars.js';
import Customer   from '../models/Customer.js';
import { bookingLimiter } from '../middleware/rateLimiter.js';
import { emailRegex, clean } from '../utils/helpers.js';
import { sendEmail, buildSubmittedEmail } from '../utils/email.js';

const router = Router();

// ── GET /api/bookings  (admin uses its own route — this is kept for compat) ──
router.get('/', async (req, res) => {
    try {
        const bookings = await Booking.find()
            .populate('carId',      'title type image dailyRate')
            .populate('customerId', 'name email phone')
            .sort({ createdAt: -1 })
            .lean();

        const shaped = bookings.map(b => ({
            ...b,
            customerName:  b.customerId?.name  || '',
            customerEmail: b.customerId?.email || '',
            customerPhone: b.customerId?.phone || '',
        }));

        res.json(shaped);
    } catch (err) {
        console.error('GET /api/bookings error:', err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

// ── POST /api/bookings/batch  (customer-facing multi-vehicle booking) ─────────
router.post('/batch', bookingLimiter, async (req, res) => {
    const { bookings } = req.body;

    if (!Array.isArray(bookings) || bookings.length === 0)
        return res.status(400).json({ message: 'bookings array is required.' });

    // Basic validation
    for (const b of bookings) {
        if (!b.carId || !b.customerName || !b.customerEmail || !b.startDate || !b.endDate)
            return res.status(400).json({ message: 'Each booking requires carId, customerName, customerEmail, startDate, endDate.' });
        if (!emailRegex.test(b.customerEmail))
            return res.status(400).json({ message: `Invalid email: ${b.customerEmail}` });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const created = [];

        for (const b of bookings) {
            const qty = Math.max(1, Number(b.qty) || 1);

            // Lock and decrement stock
            const car = await Car.findById(b.carId).session(session);
            if (!car)
                throw new Error(`Vehicle not found: ${b.carId}`);
            if (car.stock < qty)
                throw new Error(`Insufficient stock for "${car.title}" (requested ${qty}, available ${car.stock}).`);

            car.stock -= qty;
            await car.save({ session });

            // Upsert customer record
            const customerName  = clean(b.customerName);
            const customerEmail = b.customerEmail.trim().toLowerCase();
            const customerPhone = (b.customerPhone || '').trim();

            let customer = await Customer.findOne({ email: customerEmail }).session(session);
            if (!customer) {
                [customer] = await Customer.create(
                    [{ name: customerName, email: customerEmail, phone: customerPhone }],
                    { session }
                );
            } else {
                // Keep most-recent contact info
                customer.name  = customerName;
                customer.phone = customerPhone;
                await customer.save({ session });
            }

            // Create booking — status defaults to 'Unverified' per the model schema
            const [booking] = await Booking.create(
                [{
                    carId:          car._id,
                    customerId:     customer._id,
                    qty,
                    startDate:      new Date(b.startDate),
                    endDate:        new Date(b.endDate),
                    rentalDays:     Number(b.rentalDays) || 1,
                    pickupLocation: clean(b.pickupLocation || ''),
                    status:         'Unverified',   // explicit — matches model default
                    kycDocUrls:     Array.isArray(b.kycDocUrls) ? b.kycDocUrls.filter(Boolean) : [],
                    customerType:   b.customerType === 'business' ? 'business' : 'individual',
                }],
                { session }
            );

            created.push({
                _id:           booking._id,
                car:           car.title,
                customerName,
                customerEmail,
                status:        booking.status,
                rentalDays:    booking.rentalDays,
                pickupLocation: booking.pickupLocation,
            });
        }

        await session.commitTransaction();
        session.endSession();

        // Fire-and-forget confirmation emails
        for (const info of created) {
            try {
                const fullBooking = await Booking.findById(info._id)
                    .populate('carId',      'title type image')
                    .populate('customerId', 'name email phone')
                    .lean();

                const customer = { name: info.customerName };
                const { subject, html } = buildSubmittedEmail(
                    fullBooking,
                    customer,
                    fullBooking.carId?.title || 'your vehicle'
                );
                sendEmail(info.customerEmail, subject, html);
            } catch (emailErr) {
                console.error('[booking email] failed:', emailErr.message);
            }
        }

        console.log(`${created.length} booking(s) created (status: Unverified)`);
        res.status(201).json({
            message: `${created.length} booking(s) submitted. Pending document review.`,
            bookings: created,
        });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error('Batch booking error:', err);
        res.status(400).json({ message: err.message || 'Booking failed.' });
    }
});

export default router;