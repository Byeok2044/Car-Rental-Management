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
        enum: ['Unverified', 'Pending', 'Active', 'Overdue', 'Completed', 'Cancelled'], // <-- Added 'Overdue'
        default: 'Unverified',
    },

    // KYC documents — array of Cloudinary secure URLs uploaded at booking time
    kycDocUrls:     { type: [String], default: [] },

    // Customer type flag so admin knows what docs to expect
    customerType:   { type: String, enum: ['individual', 'business'], default: 'individual' },
    businessName:     { type: String, trim: true, default: '' },
    authorizedPerson: { type: String, trim: true, default: '' },

    // Document verification tracking
    docsVerified:   { type: Boolean, default: false },
    docsVerifiedAt: { type: Date,    default: null },
    docsVerifiedBy: { type: String,  default: null },
    docsRejected:   { type: Boolean, default: false },
    docsRejectedAt: { type: Date,    default: null },
    docsRejectReason: { type: String, trim: true, default: '' },

}, { timestamps: true });

export default mongoose.models.Booking || mongoose.model('Booking', bookingSchema, 'bookings');