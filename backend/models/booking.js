import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
    carId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Car',      required: true },
    customerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    qty:            { type: Number, required: true, min: 1, default: 1 },
    startDate:      { type: Date,   required: true },
    endDate:        { type: Date,   required: true },
    rentalDays:     { type: Number, required: true, min: 1 },
    pickupLocation: { type: String, trim: true },
    status: {
        type: String,
        enum: ['Unverified', 'Pending', 'Active', 'Overdue', 'Completed', 'Cancelled'],
        default: 'Unverified',
    },
    kycDocUrls:       { type: [String], default: [] },
    customerType:     { type: String, enum: ['individual', 'business'], default: 'individual' },
    businessName:     { type: String, trim: true, default: '' },
    authorizedPerson: { type: String, trim: true, default: '' },
    docsVerified:     { type: Boolean, default: false },
    docsVerifiedAt:   { type: Date,    default: null },
    docsVerifiedBy:   { type: String,  default: null },
    docsRejected:     { type: Boolean, default: false },
    docsRejectedAt:   { type: Date,    default: null },
    docsRejectReason: { type: String, trim: true, default: '' },
}, { timestamps: true });

// ── Auto-detect overdue on every save ────────────────────────────────────────
bookingSchema.post('save', async function (doc) {
    const now = new Date();

    if (doc.status === 'Active' && doc.endDate < now) {
        console.log(`[AUTO] Booking ${doc._id} detected as overdue on save.`);
        try {
            const { handleOverdueBooking } = await import('../utils/overdueHandler.js');
            await handleOverdueBooking(doc);
        } catch (err) {
            console.error(`[AUTO] Failed to handle overdue booking ${doc._id}:`, err);
        }
    }
});

export default mongoose.models.Booking || mongoose.model('Booking', bookingSchema, 'bookings');