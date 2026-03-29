import { Router } from 'express';
import mongoose from 'mongoose';
import Booking from '../models/booking.js';
import Car from '../models/cars.js';
import { bookingLimiter } from '../middleware/rateLimiter.js';
import { requireAdmin } from '../middleware/auth.js';
import { emailRegex, clean } from '../utils/helpers.js';
import { sendEmail, buildSubmittedEmail } from '../utils/email.js';
import { generateReceiptPDF } from '../utils/pdf.js';

const router = Router();

// POST /api/bookings — create single booking
router.post('/', bookingLimiter, async (req, res) => {
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
        if (!car) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ message: 'Car not found.' });
        }
        if (car.stock < Number(qty)) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ message: `Only ${car.stock} unit(s) available.` });
        }

        const [booking] = await Booking.create([{
            carId, qty: Number(qty),
            customerName:  clean(customerName),
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
        if (booking.customerEmail) {
            const { subject, html } = buildSubmittedEmail(booking, car.title);
            sendEmail(booking.customerEmail, subject, html);
        }

        return res.status(201).json({ message: 'Booking created successfully!', booking });
    } catch (err) {
        await session.abortTransaction(); session.endSession();
        console.error('Booking error:', err);
        return res.status(500).json({ message: 'Server Error: Could not create booking.' });
    }
});

// POST /api/bookings/batch — create multiple bookings at once
router.post('/batch', bookingLimiter, async (req, res) => {
    const { bookings } = req.body;
    if (!Array.isArray(bookings) || !bookings.length)
        return res.status(400).json({ message: 'bookings array is required.' });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const created = [], emailQueue = [];

        for (const item of bookings) {
            const { carId, qty = 1, customerName, customerEmail, customerPhone, startDate, endDate, rentalDays, pickupLocation } = item;

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

            const [booking] = await Booking.create([{
                carId, qty: Number(qty),
                customerName:  clean(customerName),
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
            if (booking.customerEmail) {
                const { subject, html } = buildSubmittedEmail(booking, carTitle);
                sendEmail(booking.customerEmail, subject, html);
            }
        }

        return res.status(201).json({ message: `${created.length} booking(s) created successfully!`, bookings: created });
    } catch (err) {
        await session.abortTransaction(); session.endSession();
        console.error('Batch booking error:', err);
        return res.status(500).json({ message: 'Server Error: Could not process batch booking.' });
    }
});

// GET /api/bookings — admin: list all bookings
router.get('/', requireAdmin, async (req, res) => {
    try {
        res.json(await Booking.find().sort({ createdAt: -1 }).populate('carId', 'title type image'));
    } catch {
        res.status(500).json({ message: 'Server Error.' });
    }
});

router.get('/:id/receipt', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id).populate('carId');
        if (!booking) return res.status(404).send('Booking not found');

        const carTitle = booking.carId?.title || 'Vehicle';
        const pdfBuffer = await generateReceiptPDF(booking, carTitle);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename=receipt-${booking._id}.pdf`,
            'Content-Length': pdfBuffer.length,
        });

        res.send(pdfBuffer);
    } catch (err) {
        console.error('PDF Receipt Error:', err);
        res.status(500).send('Error generating professional receipt');
    }
});

export default router;