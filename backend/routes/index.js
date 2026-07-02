/**
 * backend/routes/index.js
 *
 * Single source of truth for all API routes.
 *
 * Previously the admin bookings router was NOT mounted here, meaning
 * verify-docs / reject-docs / receipt endpoints were unreachable.
 * This file fixes that by explicitly mounting adminBookingsRouter.
 */

import { Router } from 'express';
import carsRouter          from './cars.js';
import bookingsRouter      from './bookings.js';          // public customer-facing booking creation
import messagesRouter      from './messages.js';
import adminAuthRouter     from './admin/auth.js';
import adminBookingsRouter from './admin/bookings.js';    // admin booking management (verify, quote, etc.)
import adminCarsRouter     from './admin/cars.js';
import adminMessagesRouter from './admin/messages.js';
import dashboardRouter     from './admin/dashboard.js';
import adminProfileRouter  from './admin/profile.js';
import uploadRouter        from './upload.js';

const router = Router();

// ── Public routes (no auth required) ─────────────────────────────────────────
router.use('/cars',      carsRouter);
router.use('/bookings',  bookingsRouter);
router.use('/messages',  messagesRouter);

// ── Admin: auth (login, logout, forgot/reset password) ───────────────────────
// Mount BEFORE the catch-all /admin prefix so login doesn't require a token
router.use('/admin/profile',   adminProfileRouter);
router.use('/admin/bookings',  adminBookingsRouter);   // verify-docs, quote, payment, receipt, etc.
router.use('/admin/cars',      adminCarsRouter);
router.use('/admin/messages',  adminMessagesRouter);
router.use('/admin',           adminAuthRouter);       // login / logout / forgot-password

// ── Dashboard analytics ───────────────────────────────────────────────────────
router.use('/dashboard', dashboardRouter);

// ── Cloudinary signed-upload endpoints ───────────────────────────────────────
router.use('/upload', uploadRouter);

export default router;