import { Router } from 'express';
import mongoose from 'mongoose';
import Booking from '../models/booking.js';
import BookingPayment from '../models/BookingPayment.js';
import Customer from '../models/Customer.js';
import Car from '../models/cars.js';
import { bookingLimiter } from '../middleware/rateLimiter.js';
import { requireAdmin } from '../middleware/auth.js';
import { emailRegex, clean } from '../utils/helpers.js';
import { sendEmail, buildSubmittedEmail } from '../utils/email.js';

const router = Router();

// ── helper: find or create customer ──────────────────────────────────────────
async function findOrCreateCustomer({ name, email, phone }, session) {
    const query = email
        ? { email: email.trim().toLowerCase() }
        : { name: clean(name) };

    let customer = await Customer.findOne(query).session(session);
    if (!customer) {
        [customer] = await Customer.create([{
            name:  clean(name),
            email: email?.trim().toLowerCase() || '',
            phone: phone?.trim() || '',
        }], { session });
    }
    return customer;
}

// POST /api/bookings
router.post('/', bookingLimiter, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const {
            carId, qty = 1,
            customerName, customerEmail, customerPhone,
            startDate, endDate, rentalDays, pickupLocation,
        } = req.body;

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
        if (!car) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ message: 'Car not found.' });
        }
        if (car.stock < Number(qty)) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ message: `Only ${car.stock} unit(s) available.` });
        }

        const customer = await findOrCreateCustomer(
            { name: customerName, email: customerEmail, phone: customerPhone },
            session
        );

        const [booking] = await Booking.create([{
            carId,
            customerId: customer._id,
            qty: Number(qty),
            startDate: new Date(startDate),
            endDate:   new Date(endDate),
            rentalDays: Number(rentalDays),
            pickupLocation: pickupLocation || '',
            status: 'Pending',
        }], { session });

        await BookingPayment.create([{ bookingId: booking._id }], { session });

        car.stock -= Number(qty);
        await car.save({ session });
        await session.commitTransaction();
        session.endSession();

        console.log(`New booking: ${booking._id} | ${car.title}`);

        if (customer.email) {
            const { subject, html } = buildSubmittedEmail(booking, customer, car.title);
            sendEmail(customer.email, subject, html);
        }

        return res.status(201).json({ message: 'Booking created successfully!', booking });
    } catch (err) {
        await session.abortTransaction(); session.endSession();
        console.error('Booking error:', err);
        return res.status(500).json({ message: 'Server Error: Could not create booking.' });
    }
});

// POST /api/bookings/batch
router.post('/batch', bookingLimiter, async (req, res) => {
    const { bookings } = req.body;
    if (!Array.isArray(bookings) || !bookings.length)
        return res.status(400).json({ message: 'bookings array is required.' });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const created = [], emailQueue = [];

        for (const item of bookings) {
            const {
                carId, qty = 1,
                customerName, customerEmail, customerPhone,
                startDate, endDate, rentalDays, pickupLocation,
            } = item;

            if (!carId || !customerName || !startDate || !endDate || !rentalDays) {
                await session.abortTransaction(); session.endSession();
                return res.status(400).json({ message: 'Missing required fields.' });
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
            if (!car) {
                await session.abortTransaction(); session.endSession();
                return res.status(404).json({ message: `Car not found: ${carId}` });
            }
            if (car.stock < Number(qty)) {
                await session.abortTransaction(); session.endSession();
                return res.status(400).json({ message: `Insufficient stock for "${car.title}".` });
            }

            const customer = await findOrCreateCustomer(
                { name: customerName, email: customerEmail, phone: customerPhone },
                session
            );

            const [booking] = await Booking.create([{
                carId,
                customerId: customer._id,
                qty: Number(qty),
                startDate:      new Date(startDate),
                endDate:        new Date(endDate),
                rentalDays:     Number(rentalDays),
                pickupLocation: pickupLocation || '',
                status: 'Pending',
            }], { session });

            await BookingPayment.create([{ bookingId: booking._id }], { session });

            car.stock -= Number(qty);
            await car.save({ session });
            created.push(booking);
            emailQueue.push({ booking, customer, carTitle: car.title });
        }

        await session.commitTransaction();
        session.endSession();

        for (const { booking, customer, carTitle } of emailQueue) {
            if (customer.email) {
                const { subject, html } = buildSubmittedEmail(booking, customer, carTitle);
                sendEmail(customer.email, subject, html);
            }
        }

        return res.status(201).json({
            message: `${created.length} booking(s) created successfully!`,
            bookings: created,
        });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error('Batch booking error:', err);
        return res.status(500).json({ message: 'Server Error: Could not process batch booking.' });
    }
});

// GET /api/bookings — admin list
router.get('/', requireAdmin, async (req, res) => {
    try {
        const bookings = await Booking.find()
            .sort({ createdAt: -1 })
            .populate('carId', 'title type image')
            .populate('customerId', 'name email phone')
            .lean();

        // Attach payment info to each booking
        const ids = bookings.map(b => b._id);
        const payments = await BookingPayment.find({ bookingId: { $in: ids } }).lean();
        const paymentMap = Object.fromEntries(payments.map(p => [String(p.bookingId), p]));

        const merged = bookings.map(b => ({
            ...b,
            // Keep old field names so the frontend doesn't break yet
            customerName:  b.customerId?.name  || '',
            customerEmail: b.customerId?.email || '',
            customerPhone: b.customerId?.phone || '',
            ...paymentMap[String(b._id)],
        }));

        res.json(merged);
    } catch {
        res.status(500).json({ message: 'Server Error.' });
    }
});

export default router;