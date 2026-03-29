import { Router } from 'express';
import carsRouter          from './cars.js';
import bookingsRouter      from './bookings.js';
import messagesRouter      from './messages.js';
import adminAuthRouter     from './admin/auth.js';
import adminBookingsRouter from './admin/bookings.js';
import adminCarsRouter     from './admin/cars.js';
import adminMessagesRouter from './admin/messages.js';
import dashboardRouter     from './admin/dashboard.js';

const router = Router();

// Public routes
router.use('/cars',            carsRouter);
router.use('/bookings',        bookingsRouter);
router.use('/messages',        messagesRouter);

// Admin routes
router.use('/admin',           adminAuthRouter);       // login, logout, forgot/reset-password
router.use('/admin/bookings',  adminBookingsRouter);   // booking management
router.use('/admin/cars',      adminCarsRouter);       // car management
router.use('/admin/messages',  adminMessagesRouter);   // message management
router.use('/dashboard',       dashboardRouter);       // analytics & seasonal

export default router;