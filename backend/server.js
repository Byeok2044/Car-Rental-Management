import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import { setServers } from 'node:dns/promises';
import { generalLimiter } from './middleware/rateLimiter.js';
import connectDB from './config/db.js';
import router from './routes/index.js';
import { getTransporter } from './utils/email.js';
import { startCronJobs } from './utils/cronJobs.js';

setServers(['1.1.1.1', '8.8.8.8']);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(generalLimiter);

getTransporter().verify(err =>
    err ? console.warn('Email not ready:', err.message) : console.log('Email ready')
);

// This line now handles the receipt route through the nested routers
app.use('/api', router);

connectDB().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    startCronJobs();
});