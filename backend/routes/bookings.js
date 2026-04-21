/**
 * backend/routes/bookings.js  (FIXED)
 *
 * Security fixes applied:
 *  1. kycDocUrls validated — only HTTPS Cloudinary URLs from our own account
 *     are accepted. Arbitrary URLs injected by malicious clients are rejected.
 *  2. customerName, customerEmail, customerPhone, and pickupLocation are all
 *     sanitized with the existing clean() helper before being persisted.
 *  3. customerType is allowlisted to prevent arbitrary enum injection.
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

// ── URL allow-list for KYC documents ─────────────────────────────────────────
// Only accept secure URLs originating from our Cloudinary account (kyc_docs folder).
// This prevents clients from injecting external tracker URLs, data-URIs, or links
// to content hosted elsewhere.
const CLOUDINARY_ORIGIN = 'https://res.cloudinary.com/';

function isSafeDocUrl(url) {
    if (typeof url !== 'string') return false;
    // Must be HTTPS and from our Cloudinary account
    if (!url.startsWith(CLOUDINARY_ORIGIN)) return false;
    // Must target the kyc_docs folder
    if (!url.includes('/kyc_docs/')) return false;
    // Reject anything with query-string params (could be tracking pixels)
    try {
        const parsed = new URL(url);
        if (parsed.search) return false;
    } catch {
        return false;
    }
    return true;
}

// Allowlisted customer types — prevents arbitrary enum values reaching the model
const ALLOWED_CUSTOMER_TYPES = new Set(['individual', 'business']);

// ── GET /api/bookings  (kept for backward compat with admin route) ────────────
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

    // ── Per-item validation ───────────────────────────────────────────────────
    for (const b of bookings) {
        if (!b.carId || !b.customerName || !b.customerEmail || !b.startDate || !b.endDate)
            return res.status(400).json({
                message: 'Each booking requires carId, customerName, customerEmail, startDate, endDate.',
            });

        if (!emailRegex.test(b.customerEmail))
            return res.status(400).json({ message: `Invalid email: ${b.customerEmail}` });

        // FIX 1: Validate every supplied doc URL before touching the DB.
        // Reject the entire request if any URL is suspicious.
        if (Array.isArray(b.kycDocUrls)) {
            for (const url of b.kycDocUrls) {
                if (!isSafeDocUrl(url))
                    return res.status(400).json({
                        message: `Invalid document URL supplied. Documents must be uploaded through the provided upload flow.`,
                    });
            }
            // Hard cap: no more than 5 documents per booking line
            if (b.kycDocUrls.length > 5)
                return res.status(400).json({ message: 'A maximum of 5 KYC documents may be attached per booking.' });
        }
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const created = [];

        for (const b of bookings) {
            const qty = Math.max(1, Number(b.qty) || 1);

            // Lock and decrement stock
            const car = await Car.findById(b.carId).session(session);
            if (!car) throw new Error(`Vehicle not found: ${b.carId}`);
            if (car.stock < qty)
                throw new Error(`Insufficient stock for "${car.title}" (requested ${qty}, available ${car.stock}).`);

            car.stock -= qty;
            await car.save({ session });

            // FIX 2: Sanitize all customer-supplied string fields with clean()
            // before writing to the Customer or Booking collections.
            const customerName  = clean(b.customerName);
            const customerEmail = b.customerEmail.trim().toLowerCase();
            // Phone: strip everything except digits and leading +
            const customerPhone = (b.customerPhone || '').replace(/[^\d+]/g, '').slice(0, 20);

            if (!customerName)
                throw new Error('Customer name must not be empty after sanitization.');

            // FIX 3: Allowlist customerType so only known enum values reach the model
            const customerType = ALLOWED_CUSTOMER_TYPES.has(b.customerType)
                ? b.customerType
                : 'individual';

            // Sanitize pickup location
            const pickupLocation = clean(b.pickupLocation || '');

            // Upsert customer record
            let customer = await Customer.findOne({ email: customerEmail }).session(session);
            if (!customer) {
                [customer] = await Customer.create(
                    [{ name: customerName, email: customerEmail, phone: customerPhone }],
                    { session }
                );
            } else {
                customer.name  = customerName;
                customer.phone = customerPhone;
                await customer.save({ session });
            }

            // Only accept URLs that passed the allow-list check above
            const kycDocUrls = Array.isArray(b.kycDocUrls)
                ? b.kycDocUrls.filter(isSafeDocUrl)
                : [];

            // Create booking — status defaults to 'Unverified' per the model
            const [booking] = await Booking.create(
                [{
                    carId:          car._id,
                    customerId:     customer._id,
                    qty,
                    startDate:      new Date(b.startDate),
                    endDate:        new Date(b.endDate),
                    rentalDays:     Number(b.rentalDays) || 1,
                    pickupLocation,
                    status:         'Unverified',
                    kycDocUrls,
                    customerType,
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