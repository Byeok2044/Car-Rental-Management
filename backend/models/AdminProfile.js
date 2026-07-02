import mongoose from 'mongoose';

const adminProfileSchema = new mongoose.Schema({
    adminId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, unique: true },
    fullName:    { type: String, trim: true, default: '' },
    bio:         { type: String, trim: true, default: '' },
    phone:       { type: String, trim: true, default: '' },
    email:       { type: String, trim: true, lowercase: true, default: '' },
    role:        { type: String, trim: true, default: 'Administrator' },
    location:    { type: String, trim: true, default: '' },
    avatarColor: { type: String, default: '#2563eb' },
}, { timestamps: true });

export default mongoose.models.AdminProfile
    || mongoose.model('AdminProfile', adminProfileSchema, 'admin_profiles');