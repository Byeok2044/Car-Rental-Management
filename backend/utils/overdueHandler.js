import Booking from '../models/booking.js';
import BookingPayment from '../models/BookingPayment.js';
import { sendEmail, buildOverdueEmail } from './email.js';

export async function handleOverdueBooking(booking) {
    const now = new Date();

    // Guard: skip if already marked overdue (prevents double-processing)
    if (booking.status === 'Overdue') return;

    // Re-fetch with populated fields if not already populated
    if (!booking.customerId?.email) {
        booking = await Booking.findById(booking._id)
            .populate('carId', 'title')
            .populate('customerId', 'name email');
    }

    // 1. Mark as Overdue
    booking.status = 'Overdue';
    await booking.save();

    // 2. Update payment notes
    const payment = await BookingPayment.findOne({ bookingId: booking._id });
    if (payment) {
        const note = `[SYSTEM: Marked Overdue on ${now.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}]`;
        payment.paymentNotes = payment.paymentNotes
            ? `${payment.paymentNotes} ${note}`
            : note;
        await payment.save();
    }

    // 3. Send email
    const customerEmail = booking.customerId?.email;
    if (customerEmail) {
        const populatedData = {
            ...booking.toObject(),
            customerName: booking.customerId?.name || 'Customer'
        };
        const carTitle = booking.carId?.title || 'your vehicle';
        const { subject, html } = buildOverdueEmail(populatedData, carTitle);
        await sendEmail(customerEmail, subject, html);
        console.log(`[AUTO] Overdue email sent to ${customerEmail}`);
    }

    console.log(`[AUTO] Booking ${booking._id} fully processed as Overdue.`);
}