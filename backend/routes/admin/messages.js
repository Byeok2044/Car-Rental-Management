import { Router } from 'express';
import Message from '../../models/Message.js';
import { requireAdmin } from '../../middleware/auth.js';
import { sendEmail, buildReplyEmail } from '../../utils/email.js';

const router = Router();
router.use(requireAdmin);

// GET /api/admin/messages
router.get('/', async (req, res) => {
    try {
        res.json(await Message.find().sort({ createdAt: -1 }));
    } catch {
        res.status(500).json({ message: 'Server Error.' });
    }
});

// PUT /api/admin/messages/:id/status
router.put('/:id/status', async (req, res) => {
    const { status } = req.body;
    if (!['Unread', 'Read', 'Archived'].includes(status))
        return res.status(400).json({ message: 'Invalid status.' });
    try {
        const msg = await Message.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!msg) return res.status(404).json({ message: 'Message not found.' });
        res.json({ message: 'Status updated.', msg });
    } catch {
        res.status(500).json({ message: 'Server Error.' });
    }
});

// DELETE /api/admin/messages/:id
router.delete('/:id', async (req, res) => {
    try {
        const msg = await Message.findByIdAndDelete(req.params.id);
        if (!msg) return res.status(404).json({ message: 'Message not found.' });
        res.json({ message: 'Message deleted.' });
    } catch {
        res.status(500).json({ message: 'Server Error.' });
    }
});

// POST /api/admin/messages/:id/reply
router.post('/:id/reply', async (req, res) => {
    const { subject, body } = req.body;
    if (!body?.trim()) return res.status(400).json({ message: 'Reply body is required.' });
    try {
        const msg = await Message.findById(req.params.id);
        if (!msg) return res.status(404).json({ message: 'Message not found.' });

        const reply = {
            subject: subject?.trim() || `Re: ${msg.subject || 'Your enquiry'}`,
            body:    body.trim(),
            sentBy:  'Admin',
            sentAt:  new Date(),
        };
        msg.replies.push(reply);
        if (msg.status === 'Unread') msg.status = 'Read';
        await msg.save();

        const { subject: es, html } = buildReplyEmail(msg, reply.subject, reply.body);
        sendEmail(msg.email, es, html);
        console.log(`Reply sent: ${msg._id} -> ${msg.email}`);
        res.status(200).json({ message: 'Reply sent successfully.', msg });
    } catch (err) {
        console.error('Reply error:', err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

export default router;