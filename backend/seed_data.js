// backend/seed_data.js


import 'dotenv/config';
import mongoose from 'mongoose';
import Car from './models/cars.js';
import Customer from './models/Customer.js';
import Booking from './models/booking.js';
import BookingPayment from './models/BookingPayment.js';
import { setServers } from 'node:dns/promises';
setServers(['8.8.8.8', '1.1.1.1']); // Force standard DNS resolution

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/car_rental';

async function seedData() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(mongoURI);

        // 1. Ensure we have at least one Car
        let car = await Car.findOne();
        if (!car) {
            console.log('No cars found. Creating dummy cars...');
            car = await Car.create({
                title: 'Toyota Fortuner',
                description: 'Luxury SUV',
                image: 'fortuner.jpg',
                type: 'SUV',
                stock: 5
            });
            await Car.create({
                title: 'Toyota Innova',
                description: 'Family MPV',
                image: 'innova.jpg',
                type: 'MPV',
                stock: 8
            });
        }

        // 2. Ensure we have a Customer
        let customer = await Customer.findOne();
        if (!customer) {
            console.log('No customers found. Creating dummy customer...');
            customer = await Customer.create({
                name: 'John Doe',
                email: 'john@example.com',
                phone: '09123456789',
                customerType: 'individual'
            });
        }

        console.log('Cleaning up old historical dummy data...');
        // Optional: comment out if you want to keep existing data
        // await Booking.deleteMany({ status: 'Completed' }); 

        const bookings = [];
        const payments = [];

        // 3. Generate 6 months of historical data
        // ARIMA needs a time series (at least 3-6 months)
        console.log('Generating 6 months of historical bookings...');
        
        for (let i = 6; i >= 1; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            date.setDate(1); // Start of month

            // Random number of bookings per month (e.g., 5 to 12)
            const monthlyCount = Math.floor(Math.random() * 8) + 5;

            for (let j = 0; j < monthlyCount; j++) {
                const bId = new mongoose.Types.ObjectId();
                const startDate = new Date(date);
                startDate.setDate(j + 1);
                
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 3);

                const price = 1500 + (Math.floor(Math.random() * 500)); // Variable revenue

                bookings.push({
                    _id: bId,
                    carId: car._id,
                    customerId: customer._id,
                    qty: 1,
                    startDate: startDate,
                    endDate: endDate,
                    rentalDays: 3,
                    status: 'Completed', // ARIMA only looks at Completed status
                    createdAt: startDate,
                    updatedAt: startDate
                });

                payments.push({
                    bookingId: bId,
                    quotedPrice: price,
                    totalCost: price,
                    amountPaid: price,
                    paymentStatus: 'Paid',
                    paymentMethod: 'Cash',
                    createdAt: startDate
                });
            }
        }

        await Booking.insertMany(bookings);
        await BookingPayment.insertMany(payments);

        console.log(`Successfully added ${bookings.length} bookings across 6 months.`);
        process.exit(0);
    } catch (err) {
        console.error('Seed Error:', err);
        process.exit(1);
    }
}

seedData();