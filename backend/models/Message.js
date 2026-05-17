import mongoose from 'mongoose';

const replySchema = new mongoose.Schema({
    subject: { type: String, trim: true },
    body:    { type: String, required: true, trim: true },
    sentBy:  { type: String, default: 'Admin' },
    sentAt:  { type: Date, default: Date.now },
}, { _id: true });

const messageSchema = new mongoose.Schema({
    name:    { type: String, required: true, trim: true },
    email:   { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, trim: true },
    message: { type: String, required: true, trim: true },
    status:  { type: String, enum: ['Unread', 'Read', 'Archived'], default: 'Unread' },
    replies: { type: [replySchema], default: [] },
    messageId: { type: String, default: null },
}, { timestamps: true });

export default mongoose.models.Message || mongoose.model('Message', messageSchema, 'messages');