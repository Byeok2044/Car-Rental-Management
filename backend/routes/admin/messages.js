import { Router } from 'express';
import Message from '../../models/Message.js';
import { requireAdmin } from '../../middleware/auth.js';
import { callBatchReclassify } from '../../utils/classifier.js';
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

// POST /api/admin/messages/reclassify
router.post('/reclassify', async (req, res) => {
    try {
        const dbMessages = await Message.find({ urgencyConfirmed: { $ne: true } });
        const results    = await callBatchReclassify(
            dbMessages.map(m => ({ _id: String(m._id), message: m.message, subject: m.subject || '' }))
        );

        let updated = 0;
        for (const r of results) {
            await Message.findByIdAndUpdate(r._id, {
                urgency:          r.urgency,
                urgencyScore:     r.score,
                urgencyBreakdown: r.breakdown,
                urgencyMethod:    'rule-based-v3',
            });
            updated++;
        }

        console.log(`Reclassified ${updated} messages via Python service`);
        res.json({ message: `Reclassified ${updated} message(s).`, updated });
    } catch (err) {
        console.error('Reclassify error:', err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

// GET /api/admin/messages/urgency-report
router.get('/urgency-report', async (req, res) => {
    try {
        const msgs   = await Message.find({}, 'urgency status');
        const report = msgs.reduce((acc, m) => {
            const urg = m.urgency || 'unclassified';
            acc.total++;
            acc[urg] = (acc[urg] || 0) + 1;
            if (urg === 'high' && m.status === 'Unread') acc.highUnread++;
            return acc;
        }, { total: 0, high: 0, medium: 0, low: 0, unclassified: 0, highUnread: 0 });

        res.json(report);
    } catch (err) {
        console.error('Urgency report error:', err);
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

// PUT /api/admin/messages/:id/urgency
router.put('/:id/urgency', async (req, res) => {
    const { urgency } = req.body;
    if (!['high', 'medium', 'low'].includes(urgency))
        return res.status(400).json({ message: "urgency must be 'high', 'medium', or 'low'." });
    try {
        const msg = await Message.findByIdAndUpdate(
            req.params.id,
            { urgency, urgencyConfirmed: true, urgencyCorrected: urgency },
            { new: true }
        );
        if (!msg) return res.status(404).json({ message: 'Message not found.' });
        console.log(`Urgency corrected: ${msg._id} -> ${urgency}`);
        res.json({ message: 'Urgency updated.', msg });
    } catch (err) {
        console.error('Urgency update error:', err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

export default router;