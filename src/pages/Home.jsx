import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Commons/Button.jsx';
import Card from '../features/Card.jsx';
import RentModal from '../features/RentModal.jsx';
import './Home.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function safeJson(res) {
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { throw new Error(`Server error (HTTP ${res.status})`); }
}

function Home() {
    const navigate = useNavigate();

    const [featuredCars, setFeaturedCars] = useState([]);
    const [allCars,      setAllCars]      = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState(null);
    const [selectedCar,  setSelectedCar]  = useState(null);

    const fetchCars = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res  = await fetch(`${API_BASE_URL}/api/cars`);
            const data = await safeJson(res);
            if (!res.ok) throw new Error(data.message || `Server error: ${res.status}`);
            const cars = Array.isArray(data) ? data : [];
            setAllCars(cars);
            const available = cars.filter(c => c.stock > 0);
            setFeaturedCars((available.length > 0 ? available : cars).slice(0, 3));
        } catch (err) {
            console.error('Failed to fetch cars:', err);
            setError('Unable to load vehicles at this time. Please try again later.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchCars(); }, [fetchCars]);

    const handleRentConfirm = async (bookings) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/bookings/batch`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ bookings }),
            });
            const result = await safeJson(res);
            if (!res.ok) throw new Error(result.message || 'Booking failed.');
            setAllCars(prev => prev.map(c => {
                const booked = bookings.find(b => b.carId === c._id);
                return booked ? { ...c, stock: Math.max(0, c.stock - booked.qty) } : c;
            }));
            setFeaturedCars(prev => prev.map(c => {
                const booked = bookings.find(b => b.carId === c._id);
                return booked ? { ...c, stock: Math.max(0, c.stock - booked.qty) } : c;
            }));
            setSelectedCar(null);
            const refs = result.bookings?.map(b => b._id).join(', ') ?? 'N/A';
            alert(`Booking confirmed!\nReference IDs: ${refs}`);
        } catch (err) {
            alert(` ${err.message}`);
        }
    };

    const SOCIAL_LINKS = [
        {
            label: 'Facebook',
            href:  'https://facebook.com',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                </svg>
            ),
        },
        {
            label: 'X',
            href:  'https://x.com',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4l11.733 16h4.267l-11.733-16z"/>
                    <path d="M4 20l6.768-6.768m2.464-2.464L20 4"/>
                </svg>
            ),
        },
        {
            label: 'Instagram',
            href:  'https://instagram.com',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
            ),
        },
    ];

    return (
        <main className="home-container">

            
            <section className="hero-section">
                <div className="hero-overlay">
                    <div className="hero-content">
                        <span className="hero-subtitle">
                            PREMIUM FLEET. UNMATCHED SERVICE.
                        </span>
                        <h1>Triple R &amp; A Transport Services</h1>
                        <p>
                            Experience the best car rental service with a wide range of vehicles to choose from.
                        </p>
                        <div className="hero-cta">
                            <Button onClick={() => navigate('/fleet')}>
                                View All Vehicles
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            
            <section className="info-section">
                <div className="section-header">
                    <h2>Why Choose Us?</h2>
                </div>
                <div className="info-grid">
                    <div className="info-card">
                        <h3>Well-Maintained Vehicles</h3>
                        <p>Every vehicle undergoes thorough inspection and routine maintenance before each rental.</p>
                    </div>
                    <div className="info-card">
                        <h3>Flexible Booking Options</h3>
                        <p>Choose from daily, weekly, or monthly rental plans tailored to your transportation needs.</p>
                    </div>
                    <div className="info-card">
                        <h3>Quality Customer Support</h3>
                        <p>Dedicated assistance and roadside support available throughout your rental period.</p>
                    </div>
                </div>
            </section>

            
            <section className="featured-section">
                <header className="section-header">
                    <h2>Featured Fleet</h2>
                    <p>Explore our most in-demand vehicles and book directly.</p>
                </header>

                <div className="car-grid">
                    {loading && <p className="status-message">Loading vehicles...</p>}
                    {error   && <p className="error-message">{error}</p>}

                    {!loading && !error && featuredCars.length === 0 && (
                        <p className="status-message">No vehicles available at the moment.</p>
                    )}

                    {!loading && !error && featuredCars.map(car => (
                        <Card
                            key={car._id}
                            {...car}
                            onRent={() => setSelectedCar(car)}
                        />
                    ))}
                </div>

                {!loading && !error && (
                    <div style={{ textAlign: 'center', marginTop: '4rem' }}>
                        <button
                            onClick={() => navigate('/fleet')}
                            style={{
                                background: 'transparent',
                                border: '2px solid #375d97',
                                color: '#375d97',
                                padding: '10px 32px',
                                borderRadius: '8px',
                                fontWeight: 600,
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                transition: 'background 0.2s, color 0.2s',
                            }}
                            onMouseEnter={e => {
                                e.target.style.background = '#375d97';
                                e.target.style.color = '#fff';
                            }}
                            onMouseLeave={e => {
                                e.target.style.background = 'transparent';
                                e.target.style.color = '#375d97';
                            }}
                        >
                            View Full Fleet 
                        </button>
                    </div>
                )}
            </section>

            
            <div className="socmed-btns-container">
                {SOCIAL_LINKS.map(s => (
                    <a
                        key={s.label}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="floating-btn"
                        aria-label={s.label}
                        title={s.label}
                    >
                        {s.icon}
                    </a>
                ))}
            </div>

            
            {selectedCar && (
                <RentModal
                    car={selectedCar}
                    allCars={allCars}
                    onClose={() => setSelectedCar(null)}
                    onConfirm={handleRentConfirm}
                />
            )}
        </main>
    );
}

export default Home;