import React, { useState } from 'react';
import Button from '../components/Commons/Button';
import './ContactUs.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function Contact() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: ''
    });

    const [submitted, setSubmitted]   = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError]           = useState(null);

    // --- Strict Validation: Only updates state if input is non-numeric ---
    const handleNameChange = (e) => {
        const value = e.target.value;
        // Regex: Allows only letters, spaces, hyphens, and dots.
        const nameRegex = /^[a-zA-Z\s.\-]*$/;
        
        // If the new value matches the regex, update the state.
        // If it contains a number, the state remains as it was.
        if (nameRegex.test(value)) {
            setFormData({ ...formData, name: value });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const res = await fetch(`${API_BASE_URL}/api/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to send message.');

            setSubmitted(true);
            setFormData({ name: '', email: '', subject: '', message: '' });
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="contact-page">
            <header className="contact-header">
                <div className='contact-overlay'>   
                    <h1>HAVE QUESTIONS? CONTACT US.</h1>
                    <p>We're here to help you get on the road.</p>
                </div>
            </header>

            <div className="contact-container">
                <main className="contact-form-container">
                    {submitted ? (
                        <div className="success-message">
                            <h2>Thank you!</h2>
                            <p>Your message has been sent. Our team will get back to you shortly.</p>
                            <Button onClick={() => setSubmitted(false)}>Send Another Message</Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="contact-form">
                            {/* General API error display */}
                            {error && (
                                <div style={{
                                    background: '#fee2e2', color: '#b91c1c',
                                    border: '1px solid #fca5a5', borderRadius: 8,
                                    padding: '10px 14px', fontSize: '0.875rem', marginBottom: 15
                                }}>
                                    {error}
                                </div>
                            )}

                            <div className="form-group">
                                <label>Full Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Your Name"
                                    value={formData.name}
                                    onChange={handleNameChange}
                                />
                            </div>

                            <div className="form-group">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="email@example.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Subject</label>
                                <select
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    required
                                >
                                    <option value="">Select a topic</option>
                                    <option value="General Inquiry">General Inquiry</option>
                                    <option value="Booking Support">Booking Support</option>
                                    <option value="Fleet Questions">Fleet Questions</option>
                                    <option value="Feedback">Feedback</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Message</label>
                                <textarea
                                    required
                                    rows="5"
                                    placeholder="How can we help you?"
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                />
                            </div>

                            <Button type="submit" disabled={submitting}>
                                {submitting ? 'Sending…' : 'Send Message'}
                            </Button>
                        </form>
                    )}
                </main>

                <section className="map-section">
                    <div className="map-wrapper">
                        <iframe
                            title="Office Location"
                            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3860.3649663597666!2d121.02148317457362!3d14.63521237622937!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397b64fd908e0af%3A0xe04536d006e74a08!2sBen-Lor%20Building%2C%20Quezon%20Ave%2C%20Diliman%2C%20Quezon%20City%2C%201103%20Metro%20Manila!5e0!3m2!1sen!2sph!4v1776532521820!5m2!1sen!2sph"
                            width="100%"
                            height="450"
                            style={{ border: 0 }}
                            allowFullScreen=""
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade">
                        </iframe>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default Contact;