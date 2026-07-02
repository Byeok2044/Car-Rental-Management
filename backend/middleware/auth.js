import jwt from 'jsonwebtoken';
import BlacklistedToken from '../models/Blacklistedtoken.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret_key';

export async function requireAdmin(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer '))
        return res.status(401).json({ message: 'No token provided.' });

    const token = auth.split(' ')[1];

    // Verify signature and expiry first (cheap, synchronous) before hitting DB
    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    if (decoded.role !== 'admin')
        return res.status(403).json({ message: 'Access denied.' });

    // Check persistent blacklist (survives server restarts)
    try {
        const revoked = await BlacklistedToken.exists({ token });
        if (revoked)
            return res.status(401).json({ message: 'Session expired.' });
    } catch (err) {
        // If the DB check fails we err on the side of caution and reject.
        console.error('[auth] blacklist lookup failed:', err.message);
        return res.status(503).json({ message: 'Authentication service unavailable.' });
    }

    req.admin = decoded;
    req.token = token;
    next();
}

/**
 * Invalidate a token by inserting it into the blacklist collection.
 * The document will be removed automatically by the MongoDB TTL index
 * once `expiresAt` is reached, so the collection never grows unbounded.
 *
 * @param {string} token   - Raw JWT string
 * @param {number} exp     - JWT `exp` claim (unix seconds). If omitted, defaults to 24 h.
 */
export async function revokeToken(token, exp) {
    const expiresAt = exp
        ? new Date(exp * 1000)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);

    try {
        await BlacklistedToken.updateOne(
            { token },
            { $set: { token, expiresAt } },
            { upsert: true }
        );
    } catch (err) {
        // Duplicate-key on a race condition is harmless — token is already revoked.
        if (err.code !== 11000) throw err;
    }
}