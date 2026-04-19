import mongoose from 'mongoose';

const bookingPaymentSchema = new mongoose.Schema({
    bookingId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    quotedPrice:   { type: Number, default: null },
    quotedAt:      { type: Date,   default: null },
    totalCost:     { type: Number, default: 0 },
    amountPaid:    { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['Unpaid', 'Partially Paid', 'Paid'], default: 'Unpaid' },
    paymentMethod: { type: String, enum: ['Cash', 'GCash', 'Bank Transfer', 'Other'], default: null },
    paymentNotes:  { type: String, trim: true, default: '' },
}, { timestamps: true });

export default mongoose.models.BookingPayment || mongoose.model('BookingPayment', bookingPaymentSchema, 'booking_payments');