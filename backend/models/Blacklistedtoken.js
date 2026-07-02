import mongoose from 'mongoose';

const blacklistedTokenSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true, index: true },
    // TTL index: MongoDB auto-deletes documents once `expiresAt` is reached.
    // This prevents unbounded collection growth — tokens expire at the same
    // time their JWT would have expired anyway.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export default mongoose.models.BlacklistedToken
    || mongoose.model('BlacklistedToken', blacklistedTokenSchema, 'blacklisted_tokens');