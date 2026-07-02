import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
    username:           { type: String, required: true, unique: true },
    email:              { type: String, unique: true, sparse: true },
    password:           { type: String, required: true },
    role:               { type: String, default: 'admin' },
    resetToken:         { type: String, default: null },
    resetTokenExpiry:   { type: Date,   default: null },
});

export default mongoose.model('Admin', adminSchema, 'Admin');