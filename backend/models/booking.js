import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
    carId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },
    qty:            { type: Number, required: true, min: 1, default: 1 },
    customerName:   { type: String, required: true, trim: true },
    customerEmail:  { type: String, trim: true, lowercase: true },
    customerPhone:  { type: String, trim: true },
    startDate:      { type: Date, required: true },
    endDate:        { type: Date, required: true },
    rentalDays:     { type: Number, required: true, min: 1 },
    pickupLocation: { type: String, trim: true },
    quotedPrice:    { type: Number, default: null },
    quotedAt:       { type: Date, default: null },
    paymentStatus:  { type: String, enum: ['Unpaid', 'Partially Paid', 'Paid'], default: 'Unpaid' },
    amountPaid:     { type: Number, default: 0 },
    paymentMethod:  { type: String, enum: ['Cash', 'GCash', 'Bank Transfer', 'Other'], default: null },
    paymentNotes:   { type: String, trim: true, default: '' },
    totalCost:      { type: Number, default: 0 },
    status:         { type: String, enum: ['Pending', 'Active', 'Completed', 'Cancelled'], default: 'Pending' },
}, { timestamps: true });

export default mongoose.models.Booking || mongoose.model('Booking', bookingSchema, 'bookings');