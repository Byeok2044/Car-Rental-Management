import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import { setServers } from 'node:dns/promises';
import { generalLimiter } from './middleware/rateLimiter.js';
import connectDB from './config/db.js';
import router from './routes/index.js';
import { getTransporter } from './utils/email.js';
import path from 'path';
import { fileURLToPath } from 'url';

setServers(['1.1.1.1', '8.8.8.8']);

const app = express();
const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(generalLimiter);
app.use(express.static(path.join(__dirname, '../dist')));

getTransporter().verify(err =>
    err ? console.warn('Email not ready:', err.message) : console.log('Email ready')
);

// This line now handles the receipt route through the nested routers
app.use('/api', router);

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

connectDB().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});