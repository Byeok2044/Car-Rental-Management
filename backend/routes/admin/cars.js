/**
 * backend/routes/admin/cars.js  (UPDATED)
 *
 * Changes from original:
 *   1. DELETE route now calls deleteImage() to remove the old Cloudinary asset
 *   2. PUT (edit) route calls deleteImage() on the OLD image when a new one is supplied
 *   3. POST (create) validates that the image URL is a Cloudinary URL (basic guard)
 *
 * Everything else is unchanged.
 */

import { Router } from 'express';
import Car from '../../models/cars.js';
import { requireAdmin } from '../../middleware/auth.js';
import { clean } from '../../utils/helpers.js';
import { deleteImage } from '../../utils/cloudinary.js';

const router = Router();
router.use(requireAdmin);

/** Basic guard: only accept URLs from our own Cloudinary account */
function isCloudinaryUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return url.startsWith('https://res.cloudinary.com/');
}

// GET /api/admin/cars
router.get('/', async (req, res) => {
    try {
        res.json(await Car.find().sort({ createdAt: -1 }));
    } catch {
        res.status(500).json({ message: 'Server Error.' });
    }
});

// POST /api/admin/cars
router.post('/', async (req, res) => {
    try {
        const { title, description, image, type, stock } = req.body;

        if (!title || !description || !image || !type)
            return res.status(400).json({
                message: 'title, description, image, and type are required.',
            });

        // Reject images that didn't come through our Cloudinary pipeline
        if (!isCloudinaryUrl(image))
            return res.status(400).json({
                message: 'Image must be uploaded via the provided upload flow.',
            });

        const car = await Car.create({
            title:       clean(title),
            description: clean(description),
            image,
            type,
            stock: Number(stock) || 1,
        });

        console.log(`Car added: ${car.title}`);
        res.status(201).json({ message: 'Car added successfully.', car });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

// PUT /api/admin/cars/:id
router.put('/:id', async (req, res) => {
    try {
        const { title, description, image, type, stock } = req.body;
        const u = {};

        if (title       !== undefined) u.title       = clean(title);
        if (description !== undefined) u.description = clean(description);
        if (type        !== undefined) u.type        = type;
        if (stock       !== undefined) u.stock       = Math.max(0, Number(stock));

        // If a new image URL is provided, validate it and schedule deletion of the old one
        if (image !== undefined) {
            if (image && !isCloudinaryUrl(image))
                return res.status(400).json({
                    message: 'Image must be uploaded via the provided upload flow.',
                });
            u.image = image;
        }

        const oldCar = await Car.findById(req.params.id);
        if (!oldCar) return res.status(404).json({ message: 'Car not found.' });

        const car = await Car.findByIdAndUpdate(req.params.id, u, { new: true });

        // Clean up the old Cloudinary asset *after* the DB write succeeds
        if (image && image !== oldCar.image && oldCar.image) {
            deleteImage(oldCar.image); // fire-and-forget (non-blocking)
        }

        res.json({ message: 'Car updated.', car });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

// DELETE /api/admin/cars/:id
router.delete('/:id', async (req, res) => {
    try {
        const car = await Car.findByIdAndDelete(req.params.id);
        if (!car) return res.status(404).json({ message: 'Car not found.' });

        console.log(`Car deleted: ${car.title}`);

        // Remove the image from Cloudinary (fire-and-forget)
        if (car.image) deleteImage(car.image);

        res.json({ message: `"${car.title}" deleted successfully.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

export default router;