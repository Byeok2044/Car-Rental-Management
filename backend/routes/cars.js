import { Router } from 'express';
import Car from '../models/cars.js';

const router = Router();

// GET /api/cars
router.get('/', async (req, res) => {
    try {
        res.json(await Car.find());
    } catch {
        res.status(500).json({ message: 'Server Error: Could not retrieve cars.' });
    }
});

export default router;