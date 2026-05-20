import { Router } from 'express';
import Booking from '../../models/booking.js';
import BookingPayment from '../../models/BookingPayment.js';
import Car    from '../../models/cars.js';
import { requireAdmin } from '../../middleware/auth.js';
import { forecastRevenue, forecastBookings, forecastDemandByType, quickNextMonth }
    from '../../utils/arimaClient.js';

const router = Router();
router.use(requireAdmin);

// ─── GET /api/dashboard/analytics ────────────────────────────────────────────
router.get('/analytics', async (req, res) => {
    try {
        // Total revenue from completed bookings via BookingPayment
        const [revenueAgg] = await BookingPayment.aggregate([
            {
                $lookup: {
                    from:         'bookings',
                    localField:   'bookingId',
                    foreignField: '_id',
                    as:           'booking',
                },
            },
            { $unwind: '$booking' },
            { $match: { 'booking.status': 'Completed' } },
            { $group: { _id: null, total: { $sum: '$totalCost' } } },
        ]);
        const totalRevenue = revenueAgg?.total ?? 0;

        // Last 7 days revenue (from BookingPayment joined with completed bookings)
        const ago7 = new Date();
        ago7.setDate(ago7.getDate() - 7);
        ago7.setHours(0, 0, 0, 0);

        const dailyRaw = await BookingPayment.aggregate([
            {
                $lookup: {
                    from: 'bookings', localField: 'bookingId',
                    foreignField: '_id', as: 'booking',
                },
            },
            { $unwind: '$booking' },
            { $match: { 'booking.status': 'Completed', 'booking.updatedAt': { $gte: ago7 } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$booking.updatedAt' } },
                    revenue: { $sum: '$totalCost' },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d  = new Date();
            d.setDate(d.getDate() - (6 - i));
            const ds = d.toISOString().split('T')[0];
            return { date: ds, revenue: dailyRaw.find(r => r._id === ds)?.revenue ?? 0 };
        });

        // Pipeline (quoted amounts by payment status)
        const pAgg = await BookingPayment.aggregate([
            {
                $lookup: {
                    from: 'bookings', localField: 'bookingId',
                    foreignField: '_id', as: 'booking',
                },
            },
            { $unwind: '$booking' },
            { $match: { 'booking.status': { $ne: 'Cancelled' }, quotedPrice: { $gt: 0 } } },
            {
                $group: {
                    _id:            '$paymentStatus',
                    totalQuoted:    { $sum: '$quotedPrice' },
                    totalCollected: { $sum: '$amountPaid' },
                    count:          { $sum: 1 },
                },
            },
        ]);

        const pipeline = { confirmed: 0, partial: 0, outstanding: 0 };
        for (const p of pAgg) {
            if (p._id === 'Paid')           pipeline.confirmed   = p.totalQuoted;
            if (p._id === 'Partially Paid') pipeline.partial     = p.totalCollected;
            if (p._id === 'Unpaid')         pipeline.outstanding = p.totalQuoted;
        }
        pipeline.total = pipeline.confirmed + pipeline.partial + pipeline.outstanding;

        // Average price by vehicle type (from BookingPayment)
        const avgByType = await BookingPayment.aggregate([
            { $match: { quotedPrice: { $gt: 0 } } },
            {
                $lookup: {
                    from: 'bookings', localField: 'bookingId',
                    foreignField: '_id', as: 'booking',
                },
            },
            { $unwind: '$booking' },
            {
                $lookup: {
                    from: 'cars', localField: 'booking.carId',
                    foreignField: '_id', as: 'car',
                },
            },
            { $unwind: '$car' },
            {
                $group: {
                    _id:      '$car.type',
                    avgPrice: { $avg: '$quotedPrice' },
                    minPrice: { $min: '$quotedPrice' },
                    maxPrice: { $max: '$quotedPrice' },
                    bookings: { $sum: 1 },
                },
            },
            { $sort: { avgPrice: -1 } },
        ]);

        // Upcoming scheduled revenue (next 30 days)
        const now = new Date(), out30 = new Date();
        out30.setDate(now.getDate() + 30);

        const upcoming = await BookingPayment.aggregate([
            {
                $lookup: {
                    from: 'bookings', localField: 'bookingId',
                    foreignField: '_id', as: 'booking',
                },
            },
            { $unwind: '$booking' },
            {
                $match: {
                    'booking.status': { $in: ['Pending', 'Active'] },
                    quotedPrice: { $gt: 0 },
                    'booking.startDate': { $gte: now, $lte: out30 },
                },
            },
            {
                $group: {
                    _id: {
                        year: { $isoWeekYear: '$booking.startDate' },
                        week: { $isoWeek: '$booking.startDate' },
                    },
                    scheduledRevenue: { $sum: '$quotedPrice' },
                    bookingCount:     { $sum: 1 },
                },
            },
            { $sort: { '_id.year': 1, '_id.week': 1 } },
        ]);

        // Fleet stats
        const totalCars  = await Car.countDocuments();
        const [activeAgg] = await Booking.aggregate([
            { $match: { status: { $in: ['Active', 'Overdue'] } } }, // <-- Updated to include Overdue
            { $group: { _id: null, totalRented: { $sum: { $ifNull: ['$qty', 1] } } } },
        ]);
        const [stockAgg] = await Car.aggregate([
            { $group: { _id: null, totalStock: { $sum: '$stock' } } },
        ]);

        const fleet = {
            total:       totalCars,
            rented:      activeAgg?.totalRented ?? 0,
            available:   stockAgg?.totalStock ?? 0,
            maintenance: 0,
        };

        // Recent bookings (join payment info)
        const recent = await Booking.find()
            .sort({ createdAt: -1 }).limit(5)
            .populate('carId',      'title type licensePlate')
            .populate('customerId', 'name email phone')
            .lean();

        const recentIds = recent.map(b => b._id);
        const recentPayments = await BookingPayment.find({ bookingId: { $in: recentIds } }).lean();
        const payMap = Object.fromEntries(recentPayments.map(p => [String(p.bookingId), p]));

        const recentBookings = recent.map(b => {
            const pay = payMap[String(b._id)] || {};
            return {
                id:            b._id,
                customerName:  b.customerId?.name  || '',
                customerEmail: b.customerId?.email || 'N/A',
                car:           b.carId?.title || 'Unknown',
                licensePlate:  b.carId?.licensePlate || '-',
                qty:           b.qty ?? 1,
                startDate:     b.startDate,
                endDate:       b.endDate,
                totalCost:     pay.totalCost    ?? 0,
                quotedPrice:   pay.quotedPrice  ?? null,
                paymentStatus: pay.paymentStatus ?? 'Unpaid',
                status:        b.status,
                createdAt:     b.createdAt,
            };
        });

        // Booking counts by status
        const sAgg = await Booking.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);
        const bookingStats = sAgg.reduce(
            (a, x) => { a[x._id.toLowerCase()] = x.count; return a; },
            { pending: 0, active: 0, overdue: 0, completed: 0, cancelled: 0 } // <-- Added overdue initializer
        );

        res.status(200).json({
            success: true,
            data: { revenue: { total: totalRevenue, last7Days }, pipeline, avgByType, upcoming, fleet, recentBookings, bookingStats },
        });
    } catch (err) {
        console.error('Analytics error:', err);
        res.status(500).json({ success: false, message: 'Server Error: Could not load analytics.' });
    }
});

// ─── GET /api/dashboard/seasonal ─────────────────────────────────────────────
router.get('/seasonal', async (req, res) => {
    try {
        const monthlyVolume = await Booking.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            {
                $group: {
                    _id: { year: { $year: '$startDate' }, month: { $month: '$startDate' } },
                    bookings:   { $sum: 1 },
                    totalQty:   { $sum: { $ifNull: ['$qty', 1] } },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);

        // Join revenue from BookingPayment for seasonal revenue data
        const monthlyRevenue = await BookingPayment.aggregate([
            {
                $lookup: {
                    from: 'bookings', localField: 'bookingId',
                    foreignField: '_id', as: 'booking',
                },
            },
            { $unwind: '$booking' },
            { $match: { 'booking.status': { $ne: 'Cancelled' } } },
            {
                $group: {
                    _id: {
                        year:  { $year:  '$booking.startDate' },
                        month: { $month: '$booking.startDate' },
                    },
                    revenue: { $sum: '$totalCost' },
                },
            },
        ]);
        const revMap = Object.fromEntries(
            monthlyRevenue.map(r => [`${r._id.year}-${r._id.month}`, r.revenue])
        );

        const byMonth = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1, totalBookings: 0, totalRevenue: 0, years: 0,
        }));
        for (const row of monthlyVolume) {
            const m = byMonth[row._id.month - 1];
            m.totalBookings += row.bookings;
            m.totalRevenue  += revMap[`${row._id.year}-${row._id.month}`] ?? 0;
            m.years         += 1;
        }

        const avgBookingsPerMonth = byMonth.reduce((s, m) => s + m.totalBookings, 0) / 12 || 1;

        const seasonality = byMonth.map(m => {
            const avgBookings = m.years > 0 ? m.totalBookings / m.years : 0;
            const index       = avgBookings / avgBookingsPerMonth;
            const avgRevenue  = m.years > 0 ? m.totalRevenue / m.years : 0;
            return {
                month:             m.month,
                monthName:         new Date(2000, m.month - 1).toLocaleString('en', { month: 'long' }),
                avgBookings:       Math.round(avgBookings * 10) / 10,
                avgRevenue:        Math.round(avgRevenue),
                index:             Math.round(index * 100) / 100,
                tier:              index >= 1.3 ? 'peak' : index >= 0.9 ? 'normal' : 'low',
                pricingMultiplier: index >= 1.3 ? 1.20  : index >= 0.9 ? 1.00    : 0.90,
            };
        });

        const now2    = new Date();
        const outlook = Array.from({ length: 6 }, (_, i) => {
            const d   = new Date(now2.getFullYear(), now2.getMonth() + i, 1);
            const mon = d.getMonth() + 1;
            const seas = seasonality[mon - 1];
            return {
                year:              d.getFullYear(),
                month:             mon,
                monthName:         seas.monthName,
                index:             seas.index,
                tier:              seas.tier,
                pricingMultiplier: seas.pricingMultiplier,
                label:             `${seas.monthName} ${d.getFullYear()}`,
            };
        });

        const typeDemand = await Booking.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $lookup: { from: 'cars', localField: 'carId', foreignField: '_id', as: 'car' } },
            { $unwind: '$car' },
            {
                $group: {
                    _id:           '$car.type',
                    totalBookings: { $sum: 1 },
                    totalQty:      { $sum: { $ifNull: ['$qty', 1] } },
                    peakMonth:     { $push: { $month: '$startDate' } },
                },
            },
            { $sort: { totalBookings: -1 } },
        ]);

        // Attach avg revenue from payments per type
        const typeRevAgg = await BookingPayment.aggregate([
            { $match: { quotedPrice: { $gt: 0 } } },
            {
                $lookup: {
                    from: 'bookings', localField: 'bookingId',
                    foreignField: '_id', as: 'booking',
                },
            },
            { $unwind: '$booking' },
            {
                $lookup: {
                    from: 'cars', localField: 'booking.carId',
                    foreignField: '_id', as: 'car',
                },
            },
            { $unwind: '$car' },
            {
                $group: {
                    _id:        '$car.type',
                    avgRevenue: { $avg: '$quotedPrice' },
                },
            },
        ]);
        const typeRevMap = Object.fromEntries(typeRevAgg.map(t => [t._id, t.avgRevenue]));

        const typeDemandWithRev = typeDemand.map(t => ({
            ...t,
            avgRevenue: Math.round(typeRevMap[t._id] ?? 0),
        }));

        const currentStock = await Car.aggregate([
            { $group: { _id: '$type', totalStock: { $sum: '$stock' }, carCount: { $sum: 1 } } },
        ]);
        const stockMap = currentStock.reduce((a, s) => { a[s._id] = s; return a; }, {});

        const nextPeak       = outlook.find(o => o.tier === 'peak') || outlook[0];
        const peakMultiplier = nextPeak.index || 1;

        const inventoryRecs = typeDemandWithRev.map(type => {
            const stock          = stockMap[type._id] || { totalStock: 0, carCount: 0 };
            const avgMonthly     = type.totalBookings / Math.max(monthlyVolume.length, 1);
            const peakProjection = Math.ceil(avgMonthly * peakMultiplier);
            const gap            = peakProjection - stock.totalStock;
            return {
                type:             type._id,
                currentStock:     stock.totalStock,
                totalBookings:    type.totalBookings,
                avgMonthlyDemand: Math.round(avgMonthly * 10) / 10,
                peakProjection,
                recommendedStock: Math.max(peakProjection, 1),
                stockGap:         gap,
                status:           gap > 0 ? 'understocked' : gap < -2 ? 'overstocked' : 'optimal',
                avgRevenue:       type.avgRevenue,
            };
        });

        const yearAgg = await Booking.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $group: { _id: { $year: '$startDate' }, bookings: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]);

        const yoyGrowth = yearAgg.map((y, i) => ({
            year:          y._id,
            bookings:      y.bookings,
            bookingGrowth: i > 0 ? Math.round(((y.bookings - yearAgg[i-1].bookings) / yearAgg[i-1].bookings) * 100) : null,
        }));

        res.json({
            success: true,
            data: {
                seasonality, outlook, inventoryRecs,
                typeDemand: typeDemandWithRev,
                yoyGrowth, nextPeak,
                dataQuality: {
                    totalHistoricalMonths: monthlyVolume.length,
                    hasEnoughData:         monthlyVolume.length >= 3,
                    message:               monthlyVolume.length < 3
                        ? 'Add more completed bookings across multiple months for accurate seasonal patterns.'
                        : `Based on ${monthlyVolume.length} months of booking history.`,
                },
            },
        });
    } catch (err) {
        console.error('Seasonal analytics error:', err);
        res.status(500).json({ success: false, message: 'Server Error.' });
    }
});

// ─── GET /api/dashboard/arima-forecast ───────────────────────────────────────
router.get('/arima-forecast', async (req, res) => {
    const periods = Math.min(parseInt(req.query.periods || '6', 10), 12);

    try {
        // Build monthly history from BookingPayment (revenue) + Booking (counts)
        const monthlyData = await BookingPayment.aggregate([
            {
                $lookup: {
                    from: 'bookings', localField: 'bookingId',
                    foreignField: '_id', as: 'booking',
                },
            },
            { $unwind: '$booking' },
            { $match: { 'booking.status': 'Completed' } },
            {
                $group: {
                    _id: {
                        year:  { $year:  '$booking.startDate' },
                        month: { $month: '$booking.startDate' },
                    },
                    revenue:  { $sum: '$totalCost' },
                    bookings: { $sum: 1 },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);

        const revenueHistory  = [];
        const bookingHistory  = [];

        for (const row of monthlyData) {
            const period = `${row._id.year}-${String(row._id.month).padStart(2, '0')}`;
            const label  = new Date(row._id.year, row._id.month - 1)
                .toLocaleString('en', { month: 'short', year: 'numeric' });
            revenueHistory.push({ period, label, revenue:  row.revenue });
            bookingHistory.push({ period, label, bookings: row.bookings });
        }

        // Per-type demand history
        const typeData = await Booking.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $lookup: { from: 'cars', localField: 'carId', foreignField: '_id', as: 'car' } },
            { $unwind: '$car' },
            {
                $group: {
                    _id: {
                        type:  '$car.type',
                        year:  { $year:  '$startDate' },
                        month: { $month: '$startDate' },
                    },
                    bookings: { $sum: 1 },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);

        const typeHistoryMap = {};
        for (const row of typeData) {
            const { type, year, month } = row._id;
            if (!typeHistoryMap[type]) typeHistoryMap[type] = [];
            const period = `${year}-${String(month).padStart(2, '0')}`;
            typeHistoryMap[type].push({ period, bookings: row.bookings });
        }

        const [revFc, bookFc, typeFc] = await Promise.all([
            revenueHistory.length  >= 3 ? forecastRevenue(revenueHistory, periods)  : null,
            bookingHistory.length  >= 3 ? forecastBookings(bookingHistory, periods)  : null,
            Object.keys(typeHistoryMap).length > 0
                ? forecastDemandByType(typeHistoryMap, Math.min(periods, 3))
                : null,
        ]);

        const rawRevValues  = revenueHistory.map(r => r.revenue);
        const rawBookValues = bookingHistory.map(r => r.bookings);
        const nextMonth = rawRevValues.length >= 3 || rawBookValues.length >= 3
            ? await quickNextMonth(rawRevValues, rawBookValues)
            : null;

        const dataQuality = {
            monthsOfData:          monthlyData.length,
            hasEnoughData:         monthlyData.length >= 6,
            arimaServiceAvailable: !!(revFc || bookFc),
            message: monthlyData.length < 3
                ? 'Need at least 3 months of completed bookings for ARIMA forecasting.'
                : monthlyData.length < 6
                ? 'Forecast accuracy improves with more historical data (6+ months recommended).'
                : `ARIMA trained on ${monthlyData.length} months of data.`,
        };

        res.json({
            success: true,
            data: {
                revenueHistory,
                bookingHistory,
                revenueForecast: revFc?.forecasts  || [],
                bookingForecast: bookFc?.forecasts  || [],
                typeForecast:    typeFc?.results    || {},
                nextMonth:       nextMonth || null,
                diagnostics: {
                    revenue:  revFc?.diagnostics  || null,
                    bookings: bookFc?.diagnostics  || null,
                },
                dataQuality,
            },
        });
    } catch (err) {
        console.error('ARIMA forecast error:', err);
        res.status(500).json({ success: false, message: 'Server Error: Could not generate ARIMA forecast.' });
    }
});

export default router;