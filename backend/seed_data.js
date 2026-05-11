import 'dotenv/config';
import mongoose from 'mongoose';
import Car from './models/cars.js';
import Customer from './models/Customer.js';
import Booking from './models/booking.js';
import BookingPayment from './models/BookingPayment.js';
import { setServers } from 'node:dns/promises';
setServers(['8.8.8.8', '1.1.1.1']); 

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

        const bookings = [];
        const payments = [];

        // 3. Generate bookings for July (6) to October (9) 2024
        console.log('Generating historical bookings for July - Oct 2024...');
        
        const year = 2024;
        const startMonth = 6; // July (0-indexed)
        const endMonth = 9;   // October (0-indexed)

        for (let m = startMonth; m <= endMonth; m++) {
            // Random number of bookings per month (e.g., 8 to 15)
            // Increased slightly to give your ARIMA model better density
            const monthlyCount = Math.floor(Math.random() * 8) + 8;

            for (let j = 0; j < monthlyCount; j++) {
                const bId = new mongoose.Types.ObjectId();
                
                // Set the date within the specific month
                const startDate = new Date(year, m, j + 1, 10, 0, 0);
                
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 3);

                const price = 1800 + (Math.floor(Math.random() * 700)); 

                bookings.push({
                    _id: bId,
                    carId: car._id,
                    customerId: customer._id,
                    qty: 1,
                    startDate: startDate,
                    endDate: endDate,
                    rentalDays: 3,
                    status: 'Completed',
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

        console.log(`Successfully added ${bookings.length} bookings for July-Oct 2024.`);
        process.exit(0);
    } catch (err) {
        console.error('Seed Error:', err);
        process.exit(1);
    }
}

seedData();