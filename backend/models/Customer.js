import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
    name:  { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
}, { timestamps: true });

// Check if the model exists before recreating it
const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);

export default Customer;