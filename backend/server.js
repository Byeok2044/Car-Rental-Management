import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setServers } from 'node:dns/promises';
import { generalLimiter } from './middleware/rateLimiter.js';
import connectDB from './config/db.js';
import router from './routes/index.js';
import { getTransporter } from './utils/email.js';

dotenv.config();
setServers(['1.1.1.1', '8.8.8.8']);

// Verify email AFTER dotenv has loaded credentials
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