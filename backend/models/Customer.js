import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
    name:             { type: String, required: true, trim: true },
    email:            { type: String, trim: true, lowercase: true },
    phone:            { type: String, trim: true },

    // ── Business-specific fields ───────────────────────────────────────────
    customerType:     { type: String, enum: ['individual', 'business'], default: 'individual' },
    businessName:     { type: String, trim: true, default: '' },  // company/business name
    authorizedPerson: { type: String, trim: true, default: '' },  // person acting on behalf

}, { timestamps: true });

const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);

export default Customer;