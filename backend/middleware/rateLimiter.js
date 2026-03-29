import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 500,
    message: { message: 'Too many requests. Please slow down.' },
    standardHeaders: true, legacyHeaders: false,
});

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 10,
    message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
    standardHeaders: true, legacyHeaders: false,
});

export const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, max: 5,
    message: { message: 'Too many messages sent. Please wait before sending again.' },
    standardHeaders: true, legacyHeaders: false,
});

export const bookingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, max: 10,
    message: { message: 'Too many booking attempts. Please try again later.' },
    standardHeaders: true, legacyHeaders: false,
});