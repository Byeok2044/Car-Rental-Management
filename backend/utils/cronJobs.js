import cron from 'node-cron';
import Booking from '../models/booking.js';
import { handleOverdueBooking } from './overdueHandler.js';

let isRunning = false;

async function runOverdueSweep() {
    if (isRunning) return;
    isRunning = true;

    try {
        const now = new Date();

        // Give a 1-day allowance — only mark overdue if endDate was YESTERDAY or earlier
        // e.g. return date is May 22 → overdue starts May 23
        const overdueThreshold = new Date(now);
        overdueThreshold.setHours(0, 0, 0, 0); // Start of today (midnight)

        const overdueBookings = await Booking.find({
            status: 'Active',
            endDate: { $lt: overdueThreshold } // endDate before today midnight = overdue
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
    } finally {
        isRunning = false;
    }
}

export function startCronJobs() {
    console.log('[CRON] Starting overdue sweep — checking every 5 seconds...');

    runOverdueSweep();

    cron.schedule('*/5 * * * * *', runOverdueSweep, {
        scheduled: true,
        timezone: 'Asia/Manila'
    });
}