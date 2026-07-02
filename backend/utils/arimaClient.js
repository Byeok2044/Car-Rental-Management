// backend/utils/arimaClient.js
// Thin client that calls the Python ARIMA micro-service.
// Falls back gracefully when the service is unavailable.

const ARIMA_URL = process.env.ARIMA_SERVICE_URL || 'http://localhost:5002';
const TIMEOUT_MS = 8_000;

/**
 * Generic POST to the ARIMA service.
 * Returns null if the service is unreachable or times out.
 */
async function arimaPost(endpoint, body) {
    try {
        const res = await fetch(`${ARIMA_URL}${endpoint}`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
            signal:  AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) {
            console.warn(`[arima] ${endpoint} → HTTP ${res.status}`);
            return null;
        }
        return await res.json();
    } catch (err) {
        console.warn(`[arima] ${endpoint} unavailable: ${err.message}`);
        return null;
    }
}

/**
 * Forecast revenue for the next `periods` months.
 * @param {Array<{period: string, revenue: number, label: string}>} history
 * @param {number} periods
 */
export async function forecastRevenue(history, periods = 6) {
    return arimaPost('/forecast/revenue', { history, periods, frequency: 'monthly' });
}

/**
 * Forecast booking counts for the next `periods` months.
 * @param {Array<{period: string, bookings: number, label: string}>} history
 * @param {number} periods
 */
export async function forecastBookings(history, periods = 3) {
    return arimaPost('/forecast/bookings', { history, periods });
}

/**
 * Forecast demand per vehicle type.
 * @param {Object<string, Array<{period: string, bookings: number}>>} history
 * @param {number} periods
 */
export async function forecastDemandByType(history, periods = 3) {
    return arimaPost('/forecast/demand_by_type', { history, periods });
}

/**
 * Quick single-call next-month forecast.
 * @param {number[]} revenueHistory  Raw revenue values oldest-first
 * @param {number[]} bookingHistory  Raw booking counts oldest-first
 */
export async function quickNextMonth(revenueHistory, bookingHistory) {
    return arimaPost('/forecast/quick_next_month', { revenueHistory, bookingHistory });
}

export default { forecastRevenue, forecastBookings, forecastDemandByType, quickNextMonth };