import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminLogin.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ForgotPassword() {
    const navigate = useNavigate();
    const [email,     setEmail]     = useState('');
    const [loading,   setLoading]   = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error,     setError]     = useState('');

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res  = await fetch(`${API_BASE_URL}/api/admin/forgot-password`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setSubmitted(true);
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    if (submitted) {
        return (
            <main className="al-root" aria-label="Email sent confirmation">
                <div className="al-bg" aria-hidden="true">
                    <div className="al-bg-overlay" />
                </div>
                <div className="al-card">
                    <header className="al-header">
                        <div className="al-logo" aria-hidden="true">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                <polyline points="22,6 12,13 2,6"/>
                            </svg>
                        </div>
                        <p className="al-eyebrow">Triple R and A Car Rental</p>
                        <h1 className="al-title">Check your email</h1>
                        <p className="al-subtitle">
                            If that email is registered, a reset link has been sent.
                            Check your spam folder if you don't see it within a few minutes.
                        </p>
                    </header>
                    <footer className="al-footer">
                        <button
                            type="button"
                            className="al-back"
                            onClick={() => navigate('/admin/login')}
                            aria-label="Go back to login"
                        >
                            ← Back to Login
                        </button>
                    </footer>
                </div>
            </main>
        );
    }

    
    return (
        <main className="al-root" aria-label="Forgot password page">
            <div className="al-bg" aria-hidden="true">
                <div className="al-bg-overlay" />
            </div>

            <div className="al-card">
                <header className="al-header">
                    <div className="al-logo" aria-hidden="true">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                    </div>
                    <p className="al-eyebrow">Triple R and A Transport Services</p>
                    <h1 className="al-title">Forgot Password</h1>
                    <p className="al-subtitle">
                        Enter your admin email and we'll send you a link to reset your password.
                    </p>
                </header>

                {error && (
                    <div className="al-error" role="alert" aria-live="assertive">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        {error}
                    </div>
                )}

                <form className="al-form" onSubmit={handleSubmit} noValidate>
                    <div className="al-field">
                        <label htmlFor="fp-email" className="al-label">
                            Email Address
                        </label>
                        <div className="al-input-wrap">
                            <span className="al-input-icon" aria-hidden="true">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                    <polyline points="22,6 12,13 2,6"/>
                                </svg>
                            </span>
                            <input
                                id="fp-email"
                                type="email"
                                required
                                className="al-input"
                                placeholder="admin@example.com"
                                value={email}
                                onChange={e => { setEmail(e.target.value); setError(''); }}
                                autoComplete="email"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="al-submit"
                        disabled={loading || !email.trim()}
                        aria-busy={loading}
                        aria-label={loading ? 'Sending reset link, please wait' : 'Send reset link'}
                    >
                        {loading ? (
                            <>
                                <span className="al-spinner" aria-hidden="true" />
                                Sending…
                            </>
                        ) : (
                            'Send Reset Link'
                        )}
                    </button>
                </form>

                <footer className="al-footer">
                    <button
                        type="button"
                        className="al-back"
                        onClick={() => navigate('/admin/login')}
                        aria-label="Go back to login"
                    >
                        ← Back to Login
                    </button>
                </footer>
            </div>
        </main>
    );
}