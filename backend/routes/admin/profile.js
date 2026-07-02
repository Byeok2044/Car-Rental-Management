import { Router } from 'express';
import AdminProfile from '../../models/AdminProfile.js';
import { requireAdmin } from '../../middleware/auth.js';
import { clean } from '../../utils/helpers.js';

const router = Router();
router.use(requireAdmin);

// GET /api/admin/profile
router.get('/', async (req, res) => {
    try {
        const profile = await AdminProfile.findOne({ adminId: req.admin.id });
        if (!profile) return res.json(null);
        res.json(profile);
    } catch (err) {
        console.error('Profile fetch error:', err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

// POST /api/admin/profile  (create or update — upsert)
router.post('/', async (req, res) => {
    try {
        const { fullName, bio, phone, email, role, location, avatarColor } = req.body;

        const update = {
            adminId:     req.admin.id,
            fullName:    clean(fullName   || ''),
            bio:         clean(bio        || ''),
            phone:       (phone    || '').trim(),
            email:       (email    || '').trim().toLowerCase(),
            role:        clean(role       || 'Administrator'),
            location:    clean(location   || ''),
            avatarColor: (avatarColor || '#2563eb').trim(),
        };

        const profile = await AdminProfile.findOneAndUpdate(
            { adminId: req.admin.id },
            { $set: update },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        console.log(`Admin profile saved for adminId: ${req.admin.id}`);
        res.json({ message: 'Profile saved successfully.', profile });
    } catch (err) {
        console.error('Profile save error:', err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

export default router;