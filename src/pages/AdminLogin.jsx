import React, { useState, useId } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './AdminLogin.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const sanitize = (str) => str.replace(/<[^>]*>/g, '').trim();

const isValidIdentifier = (value) =>
    value.trim().length >= 3;

function AdminLogin() {
    const navigate  = useNavigate();
    const formId    = useId();

    const [formData, setFormData]         = useState({ identifier: '', password: '' });
    const [touched,  setTouched]          = useState({ identifier: false, password: false });
    const [showPassword, setShowPassword] = useState(false);
    const [loading,  setLoading]          = useState(false);
    const [error,    setError]            = useState(null);

    const identifierError =
        touched.identifier && !isValidIdentifier(formData.identifier)
            ? 'Enter a valid username or email address.'
            : null;

    const passwordError =
        touched.password && formData.password.length < 6
            ? 'Password must be at least 6 characters.'
            : null;

    const canSubmit =
        !loading &&
        isValidIdentifier(formData.identifier) &&
        formData.password.length >= 6;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (error) setError(null);
    };

    const handleBlur = (e) => {
        setTouched(prev => ({ ...prev, [e.target.name]: true }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setTouched({ identifier: true, password: true });

        if (!canSubmit) return;

        const payload = {
            identifier: sanitize(formData.identifier),
            password:   formData.password,
        };

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Invalid credentials. Please try again.');
            }

            if (data.token) {
                sessionStorage.setItem('adminToken', data.token);
            }

            navigate('/admin/dashboard');

        } catch (err) {
            if (err.name === 'TypeError') {
                setError('Network error — please check your connection and try again.');
            } else {
                setError(err.message || 'Login failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="al-root" aria-label="Admin login page">
            <div className="al-bg" aria-hidden="true">
                <div className="al-bg-overlay" />
            </div>

            <div className="al-card" role="region" aria-label="Sign in to admin portal">

                <header className="al-header">
                    <div className="al-logo" aria-hidden="true">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                    </div>
                    <p className="al-eyebrow">Triple R & A Transport Services</p>
                    <h1 className="al-title">Admin Portal</h1>
                    <p className="al-subtitle">Sign in to manage your fleet and bookings.</p>
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

                <form className="al-form" onSubmit={handleSubmit} noValidate aria-label="Login form">

                    <div className="al-field">
                        <label htmlFor={`${formId}-identifier`} className="al-label">
                            Username or Email
                        </label>
                        <div className={`al-input-wrap${identifierError ? ' al-input-wrap--error' : ''}`}>
                            <span className="al-input-icon" aria-hidden="true">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                                     stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                    <circle cx="12" cy="7" r="4"/>
                                </svg>
                            </span>
                            <input
                                id={`${formId}-identifier`}
                                name="identifier"
                                type="text"
                                className="al-input"
                                placeholder="username or email@example.com"
                                value={formData.identifier}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                autoComplete="username"
                                autoCapitalize="none"
                                spellCheck="false"
                                aria-required="true"
                                aria-invalid={!!identifierError}
                                aria-describedby={identifierError ? `${formId}-identifier-err` : undefined}
                                disabled={loading}
                            />
                        </div>
                        {identifierError && (
                            <p id={`${formId}-identifier-err`} className="al-field-error" role="alert">
                                {identifierError}
                            </p>
                        )}
                    </div>

                    <div className="al-field">
                        <div className="al-label-row">
                            <label htmlFor={`${formId}-password`} className="al-label">
                                Password
                            </label>
                            <Link to="/admin/forgot-password" className="al-forgot">
                                Forgot password?
                            </Link>
                        </div>
                        <div className={`al-input-wrap${passwordError ? ' al-input-wrap--error' : ''}`}>
                            <span className="al-input-icon" aria-hidden="true">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                                     stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                            </span>
                            <input
                                id={`${formId}-password`}
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                className="al-input al-input--pw"
                                placeholder="Enter your password"
                                value={formData.password}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                autoComplete="current-password"
                                aria-required="true"
                                aria-invalid={!!passwordError}
                                aria-describedby={passwordError ? `${formId}-password-err` : undefined}
                                disabled={loading}
                            />
                            <button
                                type="button"
                                className="al-pw-toggle"
                                onClick={() => setShowPassword(v => !v)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                aria-pressed={showPassword}
                                tabIndex={0}
                            >
                                {showPassword ? (
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                                         stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                                        <line x1="1" y1="1" x2="23" y2="23"/>
                                    </svg>
                                ) : (
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                                         stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                        <circle cx="12" cy="12" r="3"/>
                                    </svg>
                                )}
                            </button>
                        </div>
                        {passwordError && (
                            <p id={`${formId}-password-err`} className="al-field-error" role="alert">
                                {passwordError}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="al-submit"
                        disabled={!canSubmit}
                        aria-busy={loading}
                        aria-label={loading ? 'Signing in, please wait' : 'Sign in'}
                    >
                        {loading ? (
                            <>
                                <span className="al-spinner" aria-hidden="true" />
                                Signing in…
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>

                <footer className="al-footer">
                </footer>
            </div>
        </main>
    );
}

export default AdminLogin;