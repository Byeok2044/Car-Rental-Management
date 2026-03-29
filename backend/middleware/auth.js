import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret_key';

// In-memory blacklist for invalidated tokens (logout)
export const tokenBlacklist = new Set();

export function requireAdmin(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer '))
        return res.status(401).json({ message: 'No token provided.' });

    const token = auth.split(' ')[1];

    if (tokenBlacklist.has(token))
        return res.status(401).json({ message: 'Session expired.' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin')
            return res.status(403).json({ message: 'Access denied.' });
        req.admin = decoded;
        req.token = token;
        next();
    } catch {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
}