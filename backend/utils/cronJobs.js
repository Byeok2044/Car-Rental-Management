import cron from 'node-cron';
import Booking from '../models/booking.js';
import { handleOverdueBooking } from './overdueHandler.js';

async function runOverdueSweep() {
    try {
        const now = new Date();

        const overdueBookings = await Booking.find({
            status: 'Active',
            endDate: { $lt: now }
        }).populate('carId', 'title').populate('customerId', 'name email');

        if (overdueBookings.length === 0) return;

        console.log(`[CRON] Found ${overdueBookings.length} overdue booking(s).`);

        for (const booking of overdueBookings) {
            try {
                await handleOverdueBooking(booking);
            } catch (err) {
                console.error(`[CRON] Failed for booking ${booking._id}:`, err);
            }
        }
    } catch (err) {
        console.error('[CRON] Fatal error in overdue sweep:', err);
    }
}

export function startCronJobs() {
    console.log('[CRON] Starting overdue sweep — checking every second...');

    runOverdueSweep(); // Run immediately on startup

    // node-cron smallest unit is 1 second using 6-field syntax
    cron.schedule('* * * * * *', runOverdueSweep, {
        scheduled: true,
        timezone: 'Asia/Manila'
    });
}