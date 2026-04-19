/**
 * backend/routes/index.js  (UPDATED — adds /api/upload)
 *
 * Only change from original: import + mount uploadRouter
 */

import { Router } from 'express';
import carsRouter          from './cars.js';
import bookingsRouter      from './bookings.js';
import messagesRouter      from './messages.js';
import adminAuthRouter     from './admin/auth.js';
import adminBookingsRouter from './admin/bookings.js';
import adminCarsRouter     from './admin/cars.js';
import adminMessagesRouter from './admin/messages.js';
import dashboardRouter     from './admin/dashboard.js';
import adminProfileRouter  from './admin/profile.js';
import uploadRouter        from './upload.js';   // ← NEW

const router = Router();

// Public routes
router.use('/cars',            carsRouter);
router.use('/bookings',        bookingsRouter);
router.use('/messages',        messagesRouter);

// Admin routes
router.use('/admin/profile',   adminProfileRouter);
router.use('/admin/bookings',  adminBookingsRouter);
router.use('/admin/cars',      adminCarsRouter);
router.use('/admin/messages',  adminMessagesRouter);
router.use('/admin',           adminAuthRouter);
router.use('/dashboard',       dashboardRouter);

// Upload (auth-gated signing endpoint)  ← NEW
router.use('/upload',          uploadRouter);

export default router;