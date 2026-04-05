import React, { useState, useEffect, useCallback } from 'react';
import Card from '../features/Card.jsx';
import RentModal from '../features/RentModal.jsx';
import SearchBar from '../features/SearchBar.jsx';
import './Rent.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function safeJson(res) {
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { throw new Error(`Server error (HTTP ${res.status}). Is the backend running?`); }
}

function Rent() {
    const [cars, setCars]               = useState([]);
    const [selectedCar, setSelectedCar] = useState(null);
    const [loading, setLoading]         = useState(true);
    const [error, setError]             = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchCars = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res  = await fetch(`${API_URL}/api/cars`);
            const data = await safeJson(res);
            if (!res.ok) throw new Error(data.message || `Server error: ${res.status}`);
            setCars(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch cars:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchCars(); }, [fetchCars]);

    const filteredCars = cars.filter(car => {
        const term = searchQuery.toLowerCase();
        return [car.name, car.make, car.brand, car.model, car.title, car.type]
            .filter(Boolean)
            .some(field => field.toString().toLowerCase().includes(term));
    });

    // Handles a batch of bookings — one per cart item
    // bookings = [{ carId, qty, customerName, customerEmail, customerPhone,
    //               startDate, endDate, rentalDays, pickupLocation }, ...]
    const handleRentConfirm = async (bookings) => {
        try {
            const res = await fetch(`${API_URL}/api/bookings/batch`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ bookings }),
            });

            const result = await safeJson(res);
            if (!res.ok) throw new Error(result.message || 'Booking failed.');

            // Decrement stock locally for each booked vehicle
            setCars(prev => prev.map(c => {
                const booked = bookings.find(b => b.carId === c._id);
                return booked
                    ? { ...c, stock: Math.max(0, c.stock - booked.qty) }
                    : c;
            }));

           

        } catch (err) {
            console.error('Booking error:', err);
            alert(` ${err.message}`);
        }
    };

    return (
        <div className="rent-page">
            <header className="rent-header">
    <div className="rent-overlay"></div> {/* Add this line */}
    <div className="rent-header-content"> {/* Wrap content for better layering */}
        <h1>OUR FLEET</h1>
        <p>Select from our range of well-maintained vehicles.</p>
    </div>
</header>

            <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by brand, model, or type..."
            />

            <main className="fleet-grid">
                {loading && <p className="status-message">Loading vehicles...</p>}
                {!loading && error && <p className="error-message">{error}</p>}
                {!loading && !error && filteredCars.length === 0 && (
                    <div className="no-results">
                        {searchQuery ? (
                            <>
                                No cars found for 
                                <br />
                                <strong>"{searchQuery}"</strong>
                            </>
                        ) : (
                            'No vehicles available at the moment.'
                        )}
                    </div>
                )}
                {!loading && !error && filteredCars.map(car => (
                    <Card
                        key={car._id}
                        {...car}
                        disabled={car.stock === 0}
                        onRent={() => setSelectedCar(car)}
                    />
                ))}
            </main>

            {selectedCar && (
                <RentModal
                    car={selectedCar}
                    allCars={cars}          // pass full list so user can add more vehicles
                    onClose={() => setSelectedCar(null)}
                    onConfirm={handleRentConfirm}
                />
            )}
        </div>
    );
}

export default Rent;