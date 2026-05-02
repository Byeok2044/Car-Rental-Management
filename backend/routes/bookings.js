/**
 * backend/routes/bookings.js
 *
 * Handles public customer-facing booking creation.
 * Supports both 'individual' and 'business' customer types.
 *
 * Business bookings:
 *   - customerName  = authorized person's name (who signs the contract)
 *   - businessName  = company/business name
 *   - authorizedPerson = same as customerName for business (explicit field)
 *   - customerEmail = company contact email
 *   - customerPhone = company contact phone
 *   These are stored on both the Customer record and the Booking record.
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
const CLOUDINARY_ORIGIN = 'https://res.cloudinary.com/';

function isSafeDocUrl(url) {
    if (typeof url !== 'string') return false;
    if (!url.startsWith(CLOUDINARY_ORIGIN)) return false;
    if (!url.includes('/kyc_docs/')) return false;
    try {
        const parsed = new URL(url);
        if (parsed.search) return false;
    } catch {
        return false;
    }
    return true;
}

const ALLOWED_CUSTOMER_TYPES = new Set(['individual', 'business']);

// ── GET /api/bookings ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const bookings = await Booking.find()
            .populate('carId',      'title type image dailyRate')
            .populate('customerId', 'name email phone customerType businessName authorizedPerson')
            .sort({ createdAt: -1 })
            .lean();

        const shaped = bookings.map(b => ({
            ...b,
            customerName:     b.customerId?.name             || '',
            customerEmail:    b.customerId?.email            || '',
            customerPhone:    b.customerId?.phone            || '',
            // Business fields — prefer booking-level fields (more reliable),
            // fall back to customer record
            businessName:     b.businessName     || b.customerId?.businessName     || '',
            authorizedPerson: b.authorizedPerson || b.customerId?.authorizedPerson || '',
        }));

        res.json(shaped);
    } catch (err) {
        console.error('GET /api/bookings error:', err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

// ── POST /api/bookings/batch ──────────────────────────────────────────────────
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

        // Business type requires businessName
        if (b.customerType === 'business' && !b.businessName?.trim())
            return res.status(400).json({ message: 'Business name is required for business bookings.' });

        // Validate KYC doc URLs
        if (Array.isArray(b.kycDocUrls)) {
            for (const url of b.kycDocUrls) {
                if (!isSafeDocUrl(url))
                    return res.status(400).json({
                        message: 'Invalid document URL. Documents must be uploaded through the provided upload flow.',
                    });
            }
            if (b.kycDocUrls.length > 5)
                return res.status(400).json({ message: 'A maximum of 5 KYC documents may be attached per booking.' });
        }
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const created = [];

        for (const b of bookings) {
            const qty          = Math.max(1, Number(b.qty) || 1);
            const customerType = ALLOWED_CUSTOMER_TYPES.has(b.customerType) ? b.customerType : 'individual';

            // Sanitize all string fields
            const customerName     = clean(b.customerName);      // for business = authorized person name
            const customerEmail    = b.customerEmail.trim().toLowerCase();
            const customerPhone    = (b.customerPhone || '').replace(/[^\d+]/g, '').slice(0, 20);
            const pickupLocation   = clean(b.pickupLocation || '');
            const businessName     = customerType === 'business' ? clean(b.businessName     || '') : '';
            const authorizedPerson = customerType === 'business' ? clean(b.authorizedPerson || customerName) : '';

            if (!customerName)
                throw new Error('Customer name must not be empty after sanitization.');

            // Lock and decrement stock
            const car = await Car.findById(b.carId).session(session);
            if (!car) throw new Error(`Vehicle not found: ${b.carId}`);
            if (car.stock < qty)
                throw new Error(`Insufficient stock for "${car.title}" (requested ${qty}, available ${car.stock}).`);

            car.stock -= qty;
            await car.save({ session });

            // Upsert customer record
            // For businesses: look up by email; update business fields if found
            let customer = await Customer.findOne({ email: customerEmail }).session(session);
            if (!customer) {
                [customer] = await Customer.create(
                    [{
                        name:             customerName,
                        email:            customerEmail,
                        phone:            customerPhone,
                        customerType,
                        businessName,
                        authorizedPerson,
                    }],
                    { session }
                );
            } else {
                // Update mutable fields; preserve existing data if new value is empty
                customer.name             = customerName;
                customer.phone            = customerPhone || customer.phone;
                customer.customerType     = customerType;
                if (businessName)     customer.businessName     = businessName;
                if (authorizedPerson) customer.authorizedPerson = authorizedPerson;
                await customer.save({ session });
            }

            const kycDocUrls = Array.isArray(b.kycDocUrls)
                ? b.kycDocUrls.filter(isSafeDocUrl)
                : [];

            // Create the booking — store business fields directly on booking
            // so they are preserved even if the customer record is later modified
            const [booking] = await Booking.create(
                [{
                    carId:            car._id,
                    customerId:       customer._id,
                    qty,
                    startDate:        new Date(b.startDate),
                    endDate:          new Date(b.endDate),
                    rentalDays:       Number(b.rentalDays) || 1,
                    pickupLocation,
                    status:           'Unverified',
                    kycDocUrls,
                    customerType,
                    businessName,
                    authorizedPerson,
                }],
                { session }
            );

            created.push({
                _id:              booking._id,
                car:              car.title,
                customerName,
                customerEmail,
                customerType,
                businessName,
                authorizedPerson,
                status:           booking.status,
                rentalDays:       booking.rentalDays,
                pickupLocation:   booking.pickupLocation,
            });
        }

        await session.commitTransaction();
        session.endSession();

        // Fire-and-forget confirmation emails
        for (const info of created) {
            try {
                const fullBooking = await Booking.findById(info._id)
                    .populate('carId',      'title type image')
                    .populate('customerId', 'name email phone customerType businessName authorizedPerson')
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
            message:  `${created.length} booking(s) submitted. Pending document review.`,
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