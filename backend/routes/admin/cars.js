import { Router } from 'express';
import Car from '../../models/cars.js';
import { requireAdmin } from '../../middleware/auth.js';
import { clean } from '../../utils/helpers.js';

const router = Router();
router.use(requireAdmin);

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
            return res.status(400).json({ message: 'title, description, image, and type are required.' });

        const car = await Car.create({
            title:       clean(title),
            description: clean(description),
            image, type,
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
        if (image       !== undefined) u.image       = image;
        if (type        !== undefined) u.type        = type;
        if (stock       !== undefined) u.stock       = Math.max(0, Number(stock));

        const car = await Car.findByIdAndUpdate(req.params.id, u, { new: true });
        if (!car) return res.status(404).json({ message: 'Car not found.' });
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
        res.json({ message: `"${car.title}" deleted successfully.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error.' });
    }
});

export default router;