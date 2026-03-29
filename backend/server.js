import 'dotenv/config'; 

import express from 'express';
import cors from 'cors';
import { setServers } from 'node:dns/promises';
import { generalLimiter } from './middleware/rateLimiter.js';
import connectDB from './config/db.js';
import router from './routes/index.js';
import { getTransporter } from './utils/email.js';
import { generateReceiptPDF } from './utils/pdf.js';
import Booking from './models/booking.js';

// 1. Set DNS servers
setServers(['1.1.1.1', '8.8.8.8']);

// 2. INITIALIZE APP (This must happen before app.get or app.use)
const app = express();
const PORT = process.env.PORT || 5000;

// 3. APPLY MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(generalLimiter);

// 4. VERIFY EMAIL TRANSPORTER
getTransporter().verify(err =>
    err ? console.warn('Email not ready:', err.message) : console.log('Email ready')
);

// 5. DEFINE YOUR ROUTES
app.get('/api/admin/bookings/:id/receipt', async (req, res) => {
    try {
        // Find booking and populate carId to get the 'title'
        const booking = await Booking.findById(req.params.id).populate('carId');
        if (!booking) return res.status(404).send('Booking not found');

        const carTitle = booking.carId?.title || 'Vehicle';
        
        // Use the EXACT same function used for email attachments
        const pdfBuffer = await generateReceiptPDF(booking, carTitle);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename=receipt-${booking._id}.pdf`,
            'Content-Length': pdfBuffer.length,
        });

        res.send(pdfBuffer);
    } catch (err) {
        console.error('PDF Receipt Error:', err);
        res.status(500).send('Error generating professional receipt');
    }
});

// Use the main router
app.use('/api', router);

// 6. CONNECT TO DB AND START SERVER
connectDB().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});