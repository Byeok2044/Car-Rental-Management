import cron from 'node-cron';
import Booking from '../models/booking.js';
import BookingPayment from '../models/BookingPayment.js';
import { sendEmail, buildOverdueEmail } from './email.js';

export function startCronJobs() {
    // Runs every day at 00:01 AM (Asia/Manila time)
    cron.schedule('1 0 * * *', async () => {
        console.log('[CRON] Running daily overdue sweep...');
        try {
            const now = new Date();
            
            // Find all Active bookings where the end date has passed
            const overdueBookings = await Booking.find({
                status: 'Active',
                endDate: { $lt: now }
            }).populate('carId', 'title').populate('customerId', 'name email');

            if (overdueBookings.length === 0) {
                console.log('[CRON] No overdue bookings found.');
                return;
            }

            for (const booking of overdueBookings) {
                // 1. Update status to Overdue
                booking.status = 'Overdue';
                await booking.save();

                // 2. Add an automated note to the payment record
                const payment = await BookingPayment.findOne({ bookingId: booking._id });
                if (payment) {
                    const note = `[SYSTEM: Marked Overdue on ${now.toLocaleDateString()}]`;
                    payment.paymentNotes = payment.paymentNotes ? `${payment.paymentNotes} ${note}` : note;
                    await payment.save();
                }

                // 3. Dispatch Notification
                const customerEmail = booking.customerId?.email;
                if (customerEmail) {
                    // Map customer details to match email template variables
                    const populatedData = {
                        ...booking.toObject(),
                        customerName: booking.customerId?.name || 'Customer'
                    };
                    const carTitle = booking.carId?.title || 'your vehicle';
                    
                    const { subject, html } = buildOverdueEmail(populatedData, carTitle);
                    await sendEmail(customerEmail, subject, html);
                }

                console.log(`[CRON] Booking ${booking._id} marked Overdue. Email dispatched.`);
            }
        } catch (err) {
            console.error('[CRON] Error running overdue sweep:', err);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Manila" // <-- Ensures the cron runs at midnight PH Time
    });
}