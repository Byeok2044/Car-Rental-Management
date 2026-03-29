// 1. Load environment variables IMMEDIATELY before any other imports
import 'dotenv/config'; 

import express from 'express';
import cors from 'cors';
import { setServers } from 'node:dns/promises';
import { generalLimiter } from './middleware/rateLimiter.js';
import connectDB from './config/db.js';
import router from './routes/index.js';
import { getTransporter } from './utils/email.js';

// Set DNS servers
setServers(['1.1.1.1', '8.8.8.8']);

// Now getTransporter() will have access to process.env.EMAIL_USER
getTransporter().verify(err =>
    err ? console.warn('Email not ready:', err.message) : console.log('Email ready')
);

const PORT = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());
app.use(generalLimiter);

app.use('/api', router);

connectDB().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});