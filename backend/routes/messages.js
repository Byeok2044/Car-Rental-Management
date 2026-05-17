import { Router } from 'express';
import Message from '../models/Message.js';
import { contactLimiter } from '../middleware/rateLimiter.js';
import { emailRegex, clean } from '../utils/helpers.js';

const router = Router();

// POST /api/messages — public contact form submission
router.post('/', contactLimiter, async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        if (!name || !email || !message)
            return res.status(400).json({ message: 'Name, email, and message are required.' });
        if (!emailRegex.test(email))
            return res.status(400).json({ message: 'Invalid email address.' });

        const msg = await Message.create({
            name:    clean(name),
            email:   email.trim().toLowerCase(),
            subject: clean(subject || ''),
            message: clean(message),
        });

        console.log(`New message from: ${msg.email}`);
        return res.status(201).json({ message: 'Message received. Thank you!', id: msg._id });
    } catch (err) {
        console.error('Message error:', err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

export default router;