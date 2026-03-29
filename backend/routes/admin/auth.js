import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import Admin from '../../models/Admin.js';
import { requireAdmin, tokenBlacklist } from '../../middleware/auth.js';
import { loginLimiter } from '../../middleware/rateLimiter.js';
import { emailRegex, escapeRegex, hashToken, BRAND } from '../../utils/helpers.js';
import { sendEmail, htmlShell } from '../../utils/email.js';

const router  = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret_key';

// POST /api/admin/login
router.post('/login', loginLimiter, async (req, res) => {
    const { identifier, password } = req.body;
    try {
        if (!identifier || !password)
            return res.status(400).json({ message: 'Identifier and password are required.' });

        const escaped = escapeRegex(identifier.trim());
        const user = await Admin.findOne({
            $or: [
                { username: { $regex: new RegExp(`^${escaped}$`, 'i') } },
                { email:    { $regex: new RegExp(`^${escaped}$`, 'i') } },
            ],
        });

        if (!user)                                                  return res.status(401).json({ message: 'User not found.' });
        if (user.role !== 'admin')                                  return res.status(403).json({ message: 'Access denied.' });
        if (!await bcrypt.compare(password, user.password))        return res.status(401).json({ message: 'Invalid credentials.' });

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        console.log('Login OK:', user.username);
        res.json({ token, message: 'Welcome back!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// POST /api/admin/logout
router.post('/logout', requireAdmin, (req, res) => {
    tokenBlacklist.add(req.token);
    res.json({ message: 'Logged out successfully.' });
});

// POST /api/admin/forgot-password
router.post('/forgot-password', loginLimiter, async (req, res) => {
    const raw_email = req.body?.email;
    if (!raw_email || typeof raw_email !== 'string')
        return res.status(400).json({ message: 'Email is required.' });

    const email = raw_email.trim().toLowerCase();
    if (!emailRegex.test(email))
        return res.json({ message: 'If that email is registered, a reset link has been sent.' });

    try {
        const escaped = escapeRegex(email);
        const admin   = await Admin.findOne({
            $or: [
                { email:    { $regex: new RegExp(`^${escaped}$`, 'i') } },
                { username: { $regex: new RegExp(`^${escaped}$`, 'i') } },
            ],
        });

        if (!admin) {
            console.log(`[forgot-password] no account for ${email} — silent no-op`);
            return res.json({ message: 'If that email is registered, a reset link has been sent.' });
        }

        const rawToken    = crypto.randomBytes(32).toString('hex');
        const hashedToken = hashToken(rawToken);
        admin.resetToken       = hashedToken;
        admin.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
        await admin.save();

        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/reset-password?token=${rawToken}`;
        const html     = htmlShell('Password Reset Request', `
            <p>Hi <strong>${admin.username}</strong>,</p>
            <p>We received a request to reset the password for the admin account associated with this email address.</p>
            <p>Click the button below to set a new password. This link is valid for <strong>1 hour</strong> and can only be used once.</p>
            <p style="text-align:center;margin:28px 0">
                <a href="${resetUrl}"
                   style="background:#2563eb;color:#fff;padding:14px 32px;border-radius:8px;
                          text-decoration:none;font-weight:700;font-size:0.95rem;display:inline-block">
                    Reset Password
                </a>
            </p>
            <p>If you did not request a password reset you can safely ignore this email — your password will not change.</p>
            <p style="font-size:0.82rem;color:#6b7280;margin-top:20px">
                Or copy this link into your browser:<br/>
                <span style="word-break:break-all">${resetUrl}</span>
            </p>
        `, '#2563eb');

        await sendEmail(admin.email, `Password Reset | ${BRAND}`, html);
        console.log(`[forgot-password] reset email sent to ${admin.email}`);
        return res.json({ message: 'If that email is registered, a reset link has been sent.' });
    } catch (err) {
        console.error('[forgot-password] error:', err);
        return res.status(500).json({ message: 'Server Error.' });
    }
});

// POST /api/admin/reset-password
router.post('/reset-password', async (req, res) => {
    const { token: rawToken, newPassword } = req.body;

    if (!rawToken || typeof rawToken !== 'string' || !newPassword)
        return res.status(400).json({ message: 'Token and new password are required.' });
    if (newPassword.length < 8)
        return res.status(400).json({ message: 'Password must be at least 8 characters.' });

    try {
        const hashedToken = hashToken(rawToken.trim());
        const admin = await Admin.findOne({
            resetToken:       hashedToken,
            resetTokenExpiry: { $gt: new Date() },
        });

        if (!admin)
            return res.status(400).json({ message: 'Reset link is invalid or has expired. Please request a new one.' });

        admin.password         = await bcrypt.hash(newPassword, 12);
        admin.resetToken       = null;
        admin.resetTokenExpiry = null;
        await admin.save();

        console.log(`[reset-password] password changed for ${admin.email}`);
        return res.json({ message: 'Password reset successfully. You can now log in.' });
    } catch (err) {
        console.error('[reset-password] error:', err);
        return res.status(500).json({ message: 'Server Error.' });
    }
});

export default router;