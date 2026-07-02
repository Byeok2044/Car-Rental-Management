import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import Booking from '../models/booking.js';

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/car_rental';

export default async function connectDB() {
    try {
        await mongoose.connect(mongoURI);
        console.log('Database Connected');
        console.log('MongoDB Connected:', mongoose.connection.name);
        console.log('Admins collection:', Admin.collection.name);
        console.log('Bookings collection:', Booking.collection.name);
    } catch (err) {
        console.error('MongoDB Error:', err);
        process.exit(1);
    }
}