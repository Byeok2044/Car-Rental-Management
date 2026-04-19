import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
    carId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Car',     required: true },
    customerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    qty:            { type: Number, required: true, min: 1, default: 1 },
    startDate:      { type: Date,   required: true },
    endDate:        { type: Date,   required: true },
    rentalDays:     { type: Number, required: true, min: 1 },
    pickupLocation: { type: String, trim: true },
    status:         { type: String, enum: ['Pending', 'Active', 'Completed', 'Cancelled'], default: 'Pending' },
}, { timestamps: true });

export default mongoose.models.Booking || mongoose.model('Booking', bookingSchema, 'bookings');