/**
 * test_overdue.js
 *
 * Manually triggers the overdue booking sweep so you can verify it works
 * without waiting for the nightly cron job.
 *
 * Usage (from /backend):
 *   node test_overdue.js                 -- sweep existing Active bookings
 *   node test_overdue.js --create        -- create a fake past-due booking, then sweep
 *   node test_overdue.js --create --keep -- same, but don't clean up the test booking
 *
 * What it does:
 *   1. Connects to MongoDB using your .env MONGODB_URI
 *   2. Optionally creates an Active booking with endDate = yesterday
 *   3. Runs the same sweep logic as cronJobs.js
 *   4. Prints a detailed report of what changed
 *   5. Optionally deletes the test booking it created
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { setServers } from 'node:dns/promises';

setServers(['1.1.1.1', '8.8.8.8']);

// ── Models ────────────────────────────────────────────────────────────────────
import Booking from './models/booking.js';
import BookingPayment from './models/BookingPayment.js';
import Car from './models/cars.js';
import Customer from './models/Customer.js';
import { sendEmail, buildOverdueEmail } from './utils/email.js';

// ── Config ─────────────────────────────────────────────────────────────────────
const CREATE_TEST_BOOKING = process.argv.includes('--create');
const KEEP_TEST_BOOKING   = process.argv.includes('--keep');
const DRY_RUN             = process.argv.includes('--dry');

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/car_rental';

// ── Helpers ────────────────────────────────────────────────────────────────────
const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const red    = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const blue   = (s) => `\x1b[34m${s}\x1b[0m`;
const bold   = (s) => `\x1b[1m${s}\x1b[0m`;
const dim    = (s) => `\x1b[2m${s}\x1b[0m`;

function log(msg)  { console.log(msg); }
function sep()     { log(dim('─'.repeat(60))); }
function ok(msg)   { log(green('  ✓ ' + msg)); }
function warn(msg) { log(yellow('  ⚠ ' + msg)); }
function err(msg)  { log(red('  ✗ ' + msg)); }
function info(msg) { log(blue('  ℹ ' + msg)); }

// ── Create a test booking that is already overdue ──────────────────────────────
async function createTestBooking() {
    sep();
    log(bold('Creating test overdue booking…'));

    const car = await Car.findOne({ stock: { $gte: 0 } });
    if (!car) { err('No cars in DB. Add a vehicle first.'); return null; }

    const customer = await Customer.findOne();
    if (!customer) { err('No customers in DB. Complete a real booking first.'); return null; }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(0, 0, 0, 0);

    const booking = await Booking.create({
        carId:          car._id,
        customerId:     customer._id,
        qty:            1,
        startDate:      twoDaysAgo,
        endDate:        yesterday,           // already past!
        rentalDays:     2,
        pickupLocation: 'Test Location',
        status:         'Active',            // must be Active for sweep to catch it
        kycDocUrls:     [],
        customerType:   'individual',
    });

    await BookingPayment.create({
        bookingId:     booking._id,
        quotedPrice:   1500,
        totalCost:     1500,
        amountPaid:    750,
        paymentStatus: 'Partially Paid',
        paymentMethod: 'Cash',
    });

    ok(`Created test booking: ${booking._id}`);
    info(`  Car:        ${car.title}`);
    info(`  Customer:   ${customer.name} (${customer.email})`);
    info(`  Period:     ${twoDaysAgo.toDateString()} → ${yesterday.toDateString()}`);
    info(`  Status:     Active (will become Overdue after sweep)`);

    return booking._id.toString();
}

// ── Run the overdue sweep (same logic as cronJobs.js) ──────────────────────────
async function runOverdueSweep() {
    sep();
    log(bold('Running overdue sweep…'));
    if (DRY_RUN) warn('DRY RUN — no database changes will be made');

    const now = new Date();

    const overdueBookings = await Booking.find({
        status:  'Active',
        endDate: { $lt: now },
    })
        .populate('carId',      'title type')
        .populate('customerId', 'name email');

    if (overdueBookings.length === 0) {
        warn('No overdue bookings found (Active bookings where endDate < now).');
        log(dim('\n  Hint: run with --create to make a test booking, or check'));
        log(dim('  that you have Active bookings with past endDates in your DB.\n'));
        return { found: 0, processed: 0, emailsSent: 0, errors: [] };
    }

    log(`  Found ${red(overdueBookings.length)} overdue booking(s):\n`);

    let processed = 0, emailsSent = 0;
    const errors = [];

    for (const booking of overdueBookings) {
        const shortId = booking._id.toString().slice(-8).toUpperCase();
        const customer = booking.customerId;
        const car      = booking.carId;

        log(`  ${bold('#' + shortId)}  ${car?.title || 'Unknown vehicle'}`);
        log(`  ${dim('Customer:')} ${customer?.name || '—'}  ${dim('<' + (customer?.email || 'no email') + '>')}`);
        log(`  ${dim('End date:')} ${booking.endDate.toDateString()}  (${Math.floor((now - booking.endDate) / 86400000)} day(s) overdue)`);

        if (!DRY_RUN) {
            try {
                // Mark overdue
                booking.status = 'Overdue';
                await booking.save();

                // Append system note to payment record
                const payment = await BookingPayment.findOne({ bookingId: booking._id });
                if (payment) {
                    const note = `[SYSTEM: Marked Overdue on ${now.toLocaleDateString()}]`;
                    payment.paymentNotes = payment.paymentNotes
                        ? `${payment.paymentNotes} ${note}`
                        : note;
                    await payment.save();
                    ok(`Updated payment record`);
                } else {
                    warn('No payment record found — booking may not have a quote yet');
                }

                ok(`Status → ${red('Overdue')}`);
                processed++;

                // Send email if customer has an email address
                if (customer?.email) {
                    const populatedData = {
                        ...booking.toObject(),
                        customerName: customer.name || 'Customer',
                    };
                    const carTitle = car?.title || 'your vehicle';

                    try {
                        const { subject, html } = buildOverdueEmail(populatedData, carTitle);
                        await sendEmail(customer.email, subject, html);
                        ok(`Email dispatched → ${customer.email}`);
                        emailsSent++;
                    } catch (emailErr) {
                        warn(`Email failed: ${emailErr.message}`);
                    }
                } else {
                    warn('No customer email — skipping email notification');
                }

            } catch (sweepErr) {
                err(`Failed to process booking: ${sweepErr.message}`);
                errors.push({ id: shortId, error: sweepErr.message });
            }
        } else {
            log(`  ${dim('[dry-run: would have marked Overdue + sent email]')}`);
            processed++;
        }

        log('');
    }

    return { found: overdueBookings.length, processed, emailsSent, errors };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
    log('\n' + bold('══════════════════════════════════════════════'));
    log(bold('  Triple R & A — Overdue Booking Test Script'));
    log(bold('══════════════════════════════════════════════') + '\n');

    log(`  ${dim('Mode:')} ${CREATE_TEST_BOOKING ? 'Create + Sweep' : 'Sweep only'}`);
    log(`  ${dim('Time:')} ${new Date().toLocaleString()}`);
    log(`  ${dim('URI:')}  ${mongoURI.replace(/:\/\/.*@/, '://***:***@')}\n`);

    try {
        await mongoose.connect(mongoURI);
        ok('Connected to MongoDB');
    } catch (connectErr) {
        err('MongoDB connection failed: ' + connectErr.message);
        process.exit(1);
    }

    let testBookingId = null;

    if (CREATE_TEST_BOOKING) {
        testBookingId = await createTestBooking();
        if (!testBookingId) {
            await mongoose.disconnect();
            process.exit(1);
        }
    }

    const result = await runOverdueSweep();

    sep();
    log(bold('Summary'));
    log(`  Overdue found:    ${result.found}`);
    log(`  Processed:        ${result.processed}`);
    log(`  Emails sent:      ${result.emailsSent}`);
    if (result.errors.length > 0) {
        log(`  Errors:           ${red(result.errors.length)}`);
        result.errors.forEach(e => log(`    - #${e.id}: ${e.error}`));
    }

    // Clean up the test booking unless --keep was passed
    if (testBookingId && !KEEP_TEST_BOOKING) {
        sep();
        log(bold('Cleaning up test booking…'));
        try {
            await Booking.findByIdAndDelete(testBookingId);
            await BookingPayment.findOneAndDelete({ bookingId: testBookingId });
            ok(`Deleted test booking #${testBookingId.slice(-8).toUpperCase()}`);
        } catch (cleanErr) {
            warn(`Cleanup failed: ${cleanErr.message}`);
        }
    } else if (testBookingId && KEEP_TEST_BOOKING) {
        info(`Test booking kept — it is now Overdue in the DB.`);
        info(`ID: ${testBookingId}`);
        info(`Resolve it via Admin Dashboard → Bookings → filter "Overdue".`);
    }

    sep();
    log(bold('How to verify the result:'));
    log('  1. Open the Admin Dashboard and filter Bookings by "Overdue".');
    log('  2. Check that the affected booking\'s status changed from Active → Overdue.');
    log('  3. Open the booking drawer → the payment notes should contain a [SYSTEM: ...] entry.');
    log('  4. Check the customer\'s inbox (or your test email) for the overdue notification.');
    log('');
    log(dim('  Tip: Re-run with --dry to preview without changes.'));
    log(dim('  Tip: Re-run with --create --keep to leave an Overdue booking in the DB.'));
    log('');

    await mongoose.disconnect();
    ok('Disconnected. Done.\n');
}

main().catch(e => {
    err('Fatal error: ' + e.message);
    console.error(e);
    process.exit(1);
});