import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './AdminLogin.css'; // Importing the shared CSS

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ResetPassword() {
    const navigate = useNavigate();
    const [searchParams]  = useSearchParams();
    const token           = searchParams.get('token');

    const [password,  setPassword]  = useState('');
    const [confirm,   setConfirm]   = useState('');
    const [loading,   setLoading]   = useState(false);
    const [done,      setDone]      = useState(false);
    const [error,     setError]     = useState('');

    async function handleSubmit(e) {
        e.preventDefault();
        if (password !== confirm) { setError('Passwords do not match.'); return; }
        if (password.length < 8)  { setError('Password must be at least 8 characters.'); return; }

        setLoading(true); 
        setError('');
        
        try {
            const res  = await fetch(`${API_BASE_URL}/api/admin/reset-password`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ token, newPassword: password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setDone(true);
        } catch (err) {
            setError(err.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    }

    // ── Invalid Token State ───────────────────────────────────────────
    if (!token) {
        return (
            <main className="al-root" aria-label="Invalid reset link">
                <div className="al-bg" aria-hidden="true">
                    <div className="al-bg-overlay" />
                </div>
                <div className="al-card">
                    <header className="al-header">
                        <div className="al-logo" aria-hidden="true" style={{ background: 'var(--al-red)' }}>
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="12"/>
                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                        </div>
                        <p className="al-eyebrow">Triple R and A Car Rental</p>
                        <h1 className="al-title">Invalid Link</h1>
                        <p className="al-subtitle">This password reset link is invalid or has expired.</p>
                    </header>
                    <footer className="al-footer">
                        <button
                            type="button"
                            className="al-back"
                            onClick={() => navigate('/admin/login')}
                            aria-label="Go back to login"
                        >
                            Back to Login
                        </button>
                    </footer>
                </div>
            </main>
        );
    }

    // ── Success State ─────────────────────────────────────────────────
    if (done) {
        return (
            <main className="al-root" aria-label="Password reset confirmation">
                <div className="al-bg" aria-hidden="true">
                    <div className="al-bg-overlay" />
                </div>
                <div className="al-card">
                    <header className="al-header">
                        <div className="al-logo" aria-hidden="true" style={{ background: '#10b981' }}>
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                        </div>
                        <p className="al-eyebrow">Triple R and A Car Rental</p>
                        <h1 className="al-title">Password Reset!</h1>
                        <p className="al-subtitle">Your password has been updated successfully.</p>
                    </header>
                    <footer className="al-footer">
                        <button
                            type="button"
                            className="al-back"
                            onClick={() => navigate('/admin/login')}
                            aria-label="Go back to login"
                        >
                            Go to Login
                        </button>
                    </footer>
                </div>
            </main>
        );
    }

    // ── Form State ────────────────────────────────────────────────────
    return (
        <main className="al-root" aria-label="Reset password page">
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
                    <p className="al-eyebrow">Triple R and A Car Rental</p>
                    <h1 className="al-title">Reset Password</h1>
                    <p className="al-subtitle">Enter a new password for your admin account.</p>
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
                        <label htmlFor="rp-password" className="al-label">
                            New Password
                        </label>
                        <div className="al-input-wrap">
                            <span className="al-input-icon" aria-hidden="true">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                            </span>
                            <input
                                id="rp-password"
                                type="password"
                                required
                                className="al-input"
                                placeholder="Min. 8 characters"
                                value={password}
                                onChange={e => { setPassword(e.target.value); setError(''); }}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="al-field">
                        <label htmlFor="rp-confirm" className="al-label">
                            Confirm Password
                        </label>
                        <div className="al-input-wrap">
                            <span className="al-input-icon" aria-hidden="true">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                            </span>
                            <input
                                id="rp-confirm"
                                type="password"
                                required
                                className="al-input"
                                placeholder="Repeat your new password"
                                value={confirm}
                                onChange={e => { setConfirm(e.target.value); setError(''); }}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="al-submit"
                        disabled={loading || !password || !confirm}
                        aria-busy={loading}
                        aria-label={loading ? 'Resetting password, please wait' : 'Reset Password'}
                    >
                        {loading ? (
                            <>
                                <span className="al-spinner" aria-hidden="true" />
                                Resetting…
                            </>
                        ) : (
                            'Reset Password'
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
                        Back to Login
                    </button>
                </footer>
            </div>
        </main>
    );
}