import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Commons/Button.jsx';
import './About.css';

function About() {
    const navigate = useNavigate();

    return (
        <main className="about-container">
            <section className="hero-section about-hero">
                <div className="hero-overlay">
                    <div className="hero-content">
                        <span className="hero-subtitle">ESTABLISHED 2014</span>
                        <h1>Our Journey at Triple R and A</h1>
                        <p>
                           From a small local fleet to a premier rental service, we've spent the last decade perfecting the art of the journey.
                         <br />We don't just rent cars; we provide the keys to your next adventure.
                        </p>
                    </div>
                </div>
            </section>

            <section className="mission-section">
                <div className="mission-grid-container">
                    <div className="mission-header">
                        <span className="accent-line"></span>
                        <h2>Our Mission</h2>
                    </div>
                    <div className="mission-content-box">
                        <p>
                            Our mission is to make car rental <strong>easy and accessible</strong> for everyone. 
                            Whether you're traveling for business, planning a family vacation, 
                            or need a vehicle for a special occasion, we have the perfect solution for you. 
                        </p>
                        <p>
                            We strive to offer a seamless rental experience with a focus on 
                            uncompromising customer satisfaction and reliable transportation.
                        </p>
                    </div>
                </div>
                
                <div className="facts-bar">
                    <div className="fact-item"><strong>10+</strong> Years Experience</div>
                    <div className="fact-item"><strong>5000+</strong> Happy Clients</div>
                    <div className="fact-item"><strong>24/7</strong> Support</div>
                    <div className="fact-item"><strong>50+</strong> Luxury Models</div>
                </div>
            </section>

            <section className="info-section alternate-bg">
                <header className="section-header">
                    <h2>The Triple R and A Fleet</h2>
                    <p>Meticulously maintained vehicles for your absolute comfort.</p>
                </header>
                <div className="info-grid">
                    <div className="info-card">
                        <h3>Economy & Compact</h3>
                        <p>Fuel-efficient options perfect for city driving and budget-conscious travelers.</p>
                    </div>
                    <div className="info-card">
                        <h3>Luxury Sedans</h3>
                        <p>Travel in style with premium leather interiors and advanced tech features.</p>
                    </div>
                    <div className="info-card">
                        <h3>SUVs & Vans</h3>
                        <p>Spacious 5-to-12 seaters for family road trips or group excursions.</p>
                    </div>
                    <div className="info-card">
                        <h3>Specialty Vehicles</h3>
                        <p>Unique models for weddings, film shoots, or making a grand entrance.</p>
                    </div>
                </div>
            </section>

            <section className="split-section">
                <div className="split-content">
                    <div className="why-us-block">
                        <div className="block-label">BENEFITS</div>
                        <h2>Why Choose Us?</h2>
                        <ul className="benefits-list-simple">
                            <li><strong>Wide Range:</strong> From city cars to rugged off-roaders.</li>
                            <li><strong>Fair Pricing:</strong> Competitive rates for long-term rentals.</li>
                            <li><strong>Convenience:</strong> Multiple pickup points and delivery.</li>
                            <li><strong>Expertise:</strong> Real humans ready to help you 24/7.</li>
                        </ul>
                    </div>
                    <div className="team-block">
                        <div className="block-label">OUR PEOPLE</div>
                        <h2>Professional Team</h2>
                        <p>
                            Our team of experienced professionals is dedicated to making your rental 
                            process as easy as possible. From vehicle selection to logistical support, 
                            we are here every step of the way.
                        </p>
                    </div>
                </div>
            </section>

            <section className="info-section testimonials-bg">
                <div className="section-header">
                    <h2>Customer Voices</h2>
                </div>
                <div className="info-grid">
                    <blockquote className="info-card testimonial">
                        <p>"Triple R and A made my trip so much easier. The booking process was simple, and the car was in excellent condition."</p>
                        <cite>— Jane Doe</cite>
                    </blockquote>
                    <blockquote className="info-card testimonial">
                        <p>"Great service and affordable rates. I will definitely use Triple R and A again for my next trip."</p>
                        <cite>— John Smith</cite>
                    </blockquote>
                </div>
            </section>

            <section className="final-cta-section">
                <div className="cta-banner">
                    <div className="cta-text">
                        <h2>Ready to Hit the Road?</h2>
                        <p>Experience high-quality car rentals with 24/7 support.</p>
                    </div>
                    <div className="cta-actions">
                        <Button onClick={() => 
                            window.scrollTo({ top: 0, behavior: 'smooth' }) || 
                            navigate('/fleet')} className="btn-primary-large">
                            Our Fleet
                        </Button>
                        <button onClick={() => 
                            window.scrollTo({ top: 0, behavior: 'smooth' }) || 
                            navigate('/contact')} className="btn-outline-white">
                            Contact
                        </button>
                    </div>
                </div>
            </section>
        </main>
    );
}

export default About;