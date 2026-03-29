import React, { useState, useEffect, useCallback, useRef } from 'react';
import './Adminpages.css';

const API_BASE_URL  = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const PER_PAGE      = 10;

const STATUS_FILTERS = ['All', 'Pending', 'Active', 'Completed', 'Cancelled'];

const STATUS_TRANSITIONS = {
    Pending:   ['Active', 'Cancelled'],
    Active:    ['Completed', 'Cancelled'],
    Completed: [],
    Cancelled: [],
};

const SORT_OPTIONS = [
    { value: 'newest',   label: 'Newest First' },
    { value: 'oldest',   label: 'Oldest First' },
    { value: 'cost_hi',  label: 'Cost: High to Low' },
    { value: 'cost_lo',  label: 'Cost: Low to High' },
    { value: 'start',    label: 'Start Date' },
];

const PAYMENT_METHODS = ['Cash', 'GCash', 'Bank Transfer', 'Other'];

const DELETE_STOCK_CONTEXT = {
    Pending:   'Stock will be restored — booking was holding reserved units.',
    Active:    'Stock will be restored — vehicle is currently marked as out.',
    Completed: 'No stock change needed — stock was already restored when completed.',
    Cancelled: 'No stock change needed — stock was already restored when cancelled.',
};

function getToken() {
    return localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
}

async function apiFetch(path, options = {}) {
    const token = getToken();
    const res   = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            ...(options.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error(`Server error (${res.status})`); }
    if (!res.ok) throw new Error(data.message || `Server error (${res.status})`);
    return data;
}

const fmt       = (iso) => iso
    ? new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
const fmtCur    = (n) => n != null ? `₱${Number(n).toLocaleString('en-PH')}` : '—';
const fmtCurNum = (n) => Number(n ?? 0);


function PaymentPill({ status }) {
    const map = {
        'Paid':           { background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' },
        'Partially Paid': { background: '#fef9c3', color: '#854d0e', border: '1px solid #fde68a' },
        'Unpaid':         { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' },
    };
    const s = map[status] || map['Unpaid'];
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '3px 10px', borderRadius: 999,
            fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap', ...s,
        }}>
            {status || 'Unpaid'}
        </span>
    );
}

function StatusBadge({ status }) {
    return <span className={`bp-badge bp-badge--${status?.toLowerCase()}`}>{status}</span>;
}


function ConfirmDialog({ title, message, subMessage, confirmLabel, confirmClass, onConfirm, onCancel, loading }) {
    return (
        <div className="bp-confirm-overlay" onClick={!loading ? onCancel : undefined}>
            <div className="bp-confirm" onClick={e => e.stopPropagation()}>
                {title && (
                    <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827', margin: '0 0 8px' }}>
                        {title}
                    </p>
                )}
                <p className="bp-confirm__msg">{message}</p>
                {subMessage && (
                    <p style={{
                        fontSize: '0.8rem', color: '#6b7280',
                        margin: '-4px 0 16px',
                        background: '#f9fafb', padding: '8px 12px',
                        borderRadius: 6, borderLeft: '3px solid #e5e7eb',
                    }}>
                        {subMessage}
                    </p>
                )}
                <div className="bp-confirm__actions">
                    <button className="bp-confirm__cancel" onClick={onCancel} disabled={loading}>
                        Cancel
                    </button>
                    <button className={`bp-confirm__ok ${confirmClass}`} onClick={onConfirm} disabled={loading}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {loading ? (
                            <>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                    style={{ animation: 'ad-spin 0.7s linear infinite', flexShrink: 0 }}>
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                </svg>
                                Deleting…
                            </>
                        ) : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}


function PaymentPanel({ booking, onUpdated }) {
    const [showQuote,   setShowQuote]   = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [quotedPrice, setQuotedPrice] = useState(booking.quotedPrice  || '');
    const [quoteNotes,  setQuoteNotes]  = useState(booking.paymentNotes || '');
    const [amountPaid,  setAmountPaid]  = useState(booking.amountPaid   || '');
    const [payMethod,   setPayMethod]   = useState(booking.paymentMethod || 'Cash');
    const [payNotes,    setPayNotes]    = useState('');
    const [saving,      setSaving]      = useState(false);
    const [error,       setError]       = useState('');

    useEffect(() => {
        setQuotedPrice(booking.quotedPrice  || '');
        setQuoteNotes(booking.paymentNotes  || '');
        setAmountPaid(booking.amountPaid    || '');
        setPayMethod(booking.paymentMethod  || 'Cash');
    }, [booking._id]);

    async function submitQuote() {
        if (!quotedPrice || isNaN(quotedPrice) || Number(quotedPrice) <= 0) {
            setError('Enter a valid price greater than 0.'); return;
        }
        setSaving(true); setError('');
        try {
            const data = await apiFetch(`/api/admin/bookings/${booking._id}/quote`, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ quotedPrice: Number(quotedPrice), paymentNotes: quoteNotes }),
            });
            onUpdated(data.booking);
            setShowQuote(false);
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
    }

    async function submitPayment() {
        if (amountPaid === '' || isNaN(amountPaid) || Number(amountPaid) < 0) {
            setError('Enter a valid amount (0 or greater).'); return;
        }
        setSaving(true); setError('');
        try {
            const data = await apiFetch(`/api/admin/bookings/${booking._id}/payment`, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ amountPaid: Number(amountPaid), paymentMethod: payMethod, paymentNotes: payNotes }),
            });
            onUpdated(data.booking);
            setShowPayment(false);
            setPayNotes('');
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
    }

    const outstanding = booking.quotedPrice
        ? Math.max(0, booking.quotedPrice - (booking.amountPaid || 0))
        : null;

    return (
        <div className="bp-drawer__section">
            <p className="bp-drawer__label">Payment</p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
                <PaymentPill status={booking.paymentStatus || 'Unpaid'} />
                {booking.quotedPrice && (
                    <span style={{ fontSize: '0.85rem', color: '#111827', fontWeight: 600 }}>
                        Quote: {fmtCur(booking.quotedPrice)}
                    </span>
                )}
                {booking.amountPaid > 0 && (
                    <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>
                        Paid: {fmtCur(booking.amountPaid)}
                    </span>
                )}
                {outstanding > 0 && (
                    <span style={{ fontSize: '0.82rem', color: '#991b1b', fontWeight: 600 }}>
                        Balance: {fmtCur(outstanding)}
                    </span>
                )}
            </div>

            {booking.paymentMethod && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>via</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827', background: '#f3f4f6', padding: '2px 10px', borderRadius: 20 }}>
                        {booking.paymentMethod}
                    </span>
                </div>
            )}

            {booking.paymentNotes && (
                <p style={{ fontSize: '0.82rem', color: '#374151', margin: '0 0 10px', background: '#f8fafc', padding: '8px 12px', borderRadius: 6, borderLeft: '3px solid #e2e8f0' }}>
                    {booking.paymentNotes}
                </p>
            )}

            {error && (
                <p style={{ color: '#991b1b', fontSize: '0.8rem', margin: '0 0 10px', background: '#fee2e2', padding: '6px 10px', borderRadius: 6 }}>
                    {error}
                </p>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <button onClick={() => { setShowQuote(v => !v); setShowPayment(false); setError(''); }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                        background: showQuote ? '#f1f5f9' : '#1e40af',
                        color: showQuote ? '#111827' : '#fff',
                        border: showQuote ? '1.5px solid #e2e8f0' : 'none',
                        borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem',
                        fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.15s',
                    }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                    {booking.quotedPrice ? 'Update Quote' : 'Set Quote'}
                </button>

                {booking.quotedPrice && (
                    <button onClick={() => { setShowPayment(v => !v); setShowQuote(false); setError(''); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                            background: showPayment ? '#f1f5f9' : '#065f46',
                            color: showPayment ? '#111827' : '#fff',
                            border: showPayment ? '1.5px solid #e2e8f0' : 'none',
                            borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem',
                            fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.15s',
                        }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Record Payment
                    </button>
                )}
            </div>

            {showQuote && (
                <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 10, padding: 14, marginTop: 4 }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Quoted Price (₱) *
                    </label>
                    <input type="number" min="1" step="1" value={quotedPrice} disabled={saving}
                        onChange={e => { setQuotedPrice(e.target.value); setError(''); }}
                        placeholder="e.g. 3500"
                        style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #bfdbfe', borderRadius: 7, fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
                    />
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Notes (optional)
                    </label>
                    <textarea value={quoteNotes} disabled={saving} rows={2}
                        onChange={e => setQuoteNotes(e.target.value)}
                        placeholder="e.g. Includes driver, airport pickup"
                        style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #bfdbfe', borderRadius: 7, fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
                    />
                    <p style={{ fontSize: '0.75rem', color: '#3b82f6', margin: '0 0 10px' }}>
                        A quote email will be sent to the customer automatically.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={submitQuote} disabled={saving}
                            style={{ padding: '8px 18px', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
                            {saving ? 'Saving…' : 'Save & Email Customer'}
                        </button>
                        <button onClick={() => { setShowQuote(false); setError(''); }}
                            style={{ padding: '8px 14px', background: 'transparent', border: '1.5px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', fontSize: '0.85rem', color: '#6b7280', fontFamily: 'inherit' }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {showPayment && (
                <div style={{ background: '#f0fdf4', border: '1.5px solid #a7f3d0', borderRadius: 10, padding: 14, marginTop: 4 }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Amount Received (₱) — Quote: {fmtCur(booking.quotedPrice)}
                    </label>
                    <input type="number" min="0" step="1" value={amountPaid} disabled={saving}
                        onChange={e => { setAmountPaid(e.target.value); setError(''); }}
                        placeholder={`e.g. ${booking.quotedPrice}`}
                        style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #a7f3d0', borderRadius: 7, fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
                    />
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Payment Method
                    </label>
                    <select value={payMethod} onChange={e => setPayMethod(e.target.value)} disabled={saving}
                        style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #a7f3d0', borderRadius: 7, fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 8, background: 'white' }}>
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Notes (optional)
                    </label>
                    <textarea value={payNotes} onChange={e => setPayNotes(e.target.value)} disabled={saving} rows={2}
                        placeholder="e.g. Paid via GCash ref #12345678"
                        style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #a7f3d0', borderRadius: 7, fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
                    />
                    {amountPaid !== '' && !isNaN(amountPaid) && booking.quotedPrice && (
                        <div style={{ background: '#ecfdf5', padding: '8px 12px', borderRadius: 6, marginBottom: 10, fontSize: '0.82rem', color: '#065f46', fontWeight: 600 }}>
                            Status will be set to: {Number(amountPaid) >= booking.quotedPrice ? 'Paid' : Number(amountPaid) > 0 ? 'Partially Paid' : 'Unpaid'}
                            {Number(amountPaid) > 0 && Number(amountPaid) < booking.quotedPrice &&
                                ` (Balance: ${fmtCur(booking.quotedPrice - Number(amountPaid))})`}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={submitPayment} disabled={saving}
                            style={{ padding: '8px 18px', background: saving ? '#86efac' : '#065f46', color: '#fff', border: 'none', borderRadius: 7, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
                            {saving ? 'Saving…' : 'Confirm Payment'}
                        </button>
                        <button onClick={() => { setShowPayment(false); setError(''); }}
                            style={{ padding: '8px 14px', background: 'transparent', border: '1.5px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', fontSize: '0.85rem', color: '#6b7280', fontFamily: 'inherit' }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}


// ─── NEW: Extend Booking Panel ────────────────────────────────────────────────
function ExtendPanel({ booking, onExtended }) {
    const [open,      setOpen]      = useState(false);
    const [extraDays, setExtraDays] = useState('');
    const [reason,    setReason]    = useState('');
    const [saving,    setSaving]    = useState(false);
    const [error,     setError]     = useState('');
    const [success,   setSuccess]   = useState('');

    useEffect(() => {
        setOpen(false);
        setExtraDays('');
        setReason('');
        setError('');
        setSuccess('');
    }, [booking._id]);

    const canExtend = ['Pending', 'Active'].includes(booking.status);
    const presets   = [1, 3, 7, 14, 30];

    async function submit() {
        const days = Number(extraDays);
        if (!days || isNaN(days) || days < 1) {
            setError('Enter a valid number of days (minimum 1).'); return;
        }
        setSaving(true); setError(''); setSuccess('');
        try {
            const data = await apiFetch(`/api/admin/bookings/${booking._id}/extend`, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ extraDays: days, reason: reason.trim() || undefined }),
            });
            const newReturn = fmt(data.booking.endDate);
            setSuccess(`Extended by ${days} day${days !== 1 ? 's' : ''}. New return: ${newReturn}`);
            setExtraDays('');
            setReason('');
            setTimeout(() => { setSuccess(''); setOpen(false); }, 2500);
            onExtended(data.booking);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="bp-drawer__section">
            <p className="bp-drawer__label">Extend Booking</p>

            {!canExtend ? (
                <p style={{ fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic', margin: 0 }}>
                    Only Pending or Active bookings can be extended.
                </p>
            ) : !open ? (
                <button
                    onClick={() => setOpen(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px',
                        background: '#f0fdf4',
                        border: '1.5px solid #bbf7d0',
                        color: '#065f46',
                        borderRadius: 8, cursor: 'pointer',
                        fontSize: '0.82rem', fontWeight: 700,
                        fontFamily: 'inherit', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#dcfce7'}
                    onMouseLeave={e => e.currentTarget.style.background = '#f0fdf4'}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                        <line x1="12" y1="14" x2="12" y2="18"/>
                        <line x1="10" y1="16" x2="14" y2="16"/>
                    </svg>
                    Extend Return Date
                </button>
            ) : (
                <div style={{
                    background: '#f0fdf4',
                    border: '1.5px solid #bbf7d0',
                    borderRadius: 10,
                    padding: 14,
                }}>
                    {/* Current return info */}
                    <div style={{
                        background: '#dcfce7', borderRadius: 7,
                        padding: '8px 12px', marginBottom: 12,
                        display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <span style={{ fontSize: '0.78rem', color: '#065f46', fontWeight: 600 }}>
                            Current return: <strong>{fmt(booking.endDate)}</strong>
                            &nbsp;·&nbsp; {booking.rentalDays} day{booking.rentalDays !== 1 ? 's' : ''} total
                        </span>
                    </div>

                    {/* Quick-select presets */}
                    <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>
                        Quick add
                    </p>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                        {presets.map(d => (
                            <button
                                key={d}
                                type="button"
                                onClick={() => { setExtraDays(String(d)); setError(''); }}
                                style={{
                                    padding: '4px 10px', borderRadius: 20,
                                    border: `1.5px solid ${extraDays === String(d) ? '#16a34a' : '#bbf7d0'}`,
                                    background: extraDays === String(d) ? '#16a34a' : 'white',
                                    color: extraDays === String(d) ? 'white' : '#065f46',
                                    fontSize: '0.75rem', fontWeight: 700,
                                    cursor: 'pointer', fontFamily: 'inherit',
                                    transition: 'all 0.12s',
                                }}
                            >
                                +{d}d
                            </button>
                        ))}
                    </div>

                    {/* Custom days input */}
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Days to add *
                    </label>
                    <input
                        type="number" min="1" max="365" step="1"
                        value={extraDays} disabled={saving}
                        onChange={e => { setExtraDays(e.target.value); setError(''); }}
                        placeholder="e.g. 3"
                        style={{
                            width: '100%', padding: '9px 12px',
                            border: '1.5px solid #bbf7d0', borderRadius: 7,
                            fontSize: '0.9rem', fontFamily: 'inherit',
                            outline: 'none', boxSizing: 'border-box', marginBottom: 8, background: 'white',
                        }}
                    />

                    {/* Preview new return date */}
                    {extraDays && Number(extraDays) > 0 && (
                        <div style={{
                            background: '#ecfdf5', padding: '8px 12px',
                            borderRadius: 6, marginBottom: 8,
                            fontSize: '0.82rem', color: '#065f46', fontWeight: 600,
                        }}>
                            {(() => {
                                const d = new Date(booking.endDate);
                                d.setDate(d.getDate() + Number(extraDays));
                                const newReturn = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
                                const newTotal  = (booking.rentalDays || 1) + Number(extraDays);
                                return `New return: ${newReturn} · ${newTotal} days total`;
                            })()}
                        </div>
                    )}

                    {/* Reason */}
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Reason (optional)
                    </label>
                    <textarea
                        value={reason} disabled={saving} rows={2}
                        onChange={e => setReason(e.target.value)}
                        placeholder="e.g. Customer requested additional days"
                        style={{
                            width: '100%', padding: '9px 12px',
                            border: '1.5px solid #bbf7d0', borderRadius: 7,
                            fontSize: '0.875rem', fontFamily: 'inherit',
                            resize: 'vertical', outline: 'none',
                            boxSizing: 'border-box', marginBottom: 8, background: 'white',
                        }}
                    />

                    <p style={{ fontSize: '0.72rem', color: '#16a34a', margin: '0 0 10px' }}>
                        {booking.customerEmail
                            ? 'An extension confirmation email will be sent to the customer.'
                            : 'No customer email on file — extension note saved internally only.'}
                    </p>

                    {error && (
                        <p style={{ color: '#991b1b', fontSize: '0.8rem', margin: '0 0 10px', background: '#fee2e2', padding: '6px 10px', borderRadius: 6 }}>
                            {error}
                        </p>
                    )}
                    {success && (
                        <p style={{ color: '#065f46', fontSize: '0.82rem', margin: '0 0 10px', background: '#dcfce7', padding: '6px 10px', borderRadius: 6, fontWeight: 600 }}>
                            ✓ {success}
                        </p>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={submit}
                            disabled={saving || !extraDays || Number(extraDays) < 1}
                            style={{
                                padding: '8px 18px',
                                background: saving || !extraDays ? '#86efac' : '#16a34a',
                                color: '#fff', border: 'none', borderRadius: 7,
                                cursor: saving || !extraDays ? 'not-allowed' : 'pointer',
                                fontSize: '0.85rem', fontWeight: 700,
                                fontFamily: 'inherit',
                                opacity: saving || !extraDays ? 0.7 : 1,
                                transition: 'all 0.15s',
                            }}
                        >
                            {saving ? 'Saving…' : 'Confirm Extension'}
                        </button>
                        <button
                            onClick={() => { setOpen(false); setError(''); setExtraDays(''); setReason(''); }}
                            disabled={saving}
                            style={{
                                padding: '8px 14px', background: 'transparent',
                                border: '1.5px solid #bbf7d0', borderRadius: 7,
                                cursor: 'pointer', fontSize: '0.85rem',
                                color: '#065f46', fontFamily: 'inherit',
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
// ─────────────────────────────────────────────────────────────────────────────


function BookingDrawer({ booking: initialBooking, onClose, onStatusChange, onBookingUpdate, onDelete }) {
    const [booking,  setBooking]  = useState(initialBooking);
    const [updating, setUpdating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirm,  setConfirm]  = useState(null);
    const next = STATUS_TRANSITIONS[booking.status] || [];

    useEffect(() => { setBooking(initialBooking); }, [initialBooking]);

    async function handleStatus(newStatus) {
        setConfirm(null);
        setUpdating(true);
        try { await onStatusChange(booking._id, newStatus); }
        finally { setUpdating(false); }
    }

    async function handleDelete() {
        setDeleting(true);
        try {
            await onDelete(booking._id, booking.status);
            onClose();
        } catch {
            setDeleting(false);
            setConfirm(null);
        }
    }

    const handlePrint = () => {
        const w = window.open('', '_blank', 'width=700,height=700');
        w.document.write(`
            <html><head><title>Booking #${String(booking._id).slice(-8).toUpperCase()}</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 32px; color: #111; }
                h1   { font-size: 1.4rem; margin-bottom: 4px; }
                .ref { color: #6b7280; font-size: 0.85rem; margin-bottom: 24px; }
                table { width: 100%; border-collapse: collapse; margin-top: 16px; }
                td   { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; }
                td:first-child { font-weight: 600; color: #374151; width: 36%; }
                .total { font-size: 1.1rem; font-weight: 800; color: #2563eb; }
                @media print { body { padding: 16px; } }
            </style></head><body>
            <h1>Booking Receipt</h1>
            <p class="ref">Ref: ${String(booking._id).slice(-8).toUpperCase()} &nbsp;·&nbsp; ${fmt(booking.createdAt)}</p>
            <table>
                <tr><td>Status</td><td>${booking.status}</td></tr>
                <tr><td>Payment</td><td>${booking.paymentStatus || 'Unpaid'}</td></tr>
                <tr><td>Customer</td><td>${booking.customerName}</td></tr>
                <tr><td>Email</td><td>${booking.customerEmail || '—'}</td></tr>
                <tr><td>Phone</td><td>${booking.customerPhone || '—'}</td></tr>
                <tr><td>Vehicle</td><td>${booking.carId?.title || '—'}</td></tr>
                ${booking.qty > 1 ? `<tr><td>Quantity</td><td>${booking.qty}</td></tr>` : ''}
                <tr><td>Pickup Date</td><td>${fmt(booking.startDate)}</td></tr>
                <tr><td>Return Date</td><td>${fmt(booking.endDate)}</td></tr>
                <tr><td>Rental Days</td><td>${booking.rentalDays}</td></tr>
                ${booking.pickupLocation ? `<tr><td>Pickup Location</td><td>${booking.pickupLocation}</td></tr>` : ''}
                ${booking.quotedPrice    ? `<tr><td>Quoted Price</td><td class="total">${fmtCur(booking.quotedPrice)}</td></tr>` : ''}
                ${booking.amountPaid > 0 ? `<tr><td>Amount Paid</td><td>${fmtCur(booking.amountPaid)}</td></tr>` : ''}
                ${booking.paymentMethod  ? `<tr><td>Payment Method</td><td>${booking.paymentMethod}</td></tr>` : ''}
                ${booking.paymentNotes   ? `<tr><td>Notes</td><td>${booking.paymentNotes}</td></tr>` : ''}
            </table>
            <script>window.onload=()=>{window.print();}<\/script>
            </body></html>`);
        w.document.close();
    };

    return (
        <>
            <div className="bp-drawer-overlay" onClick={onClose}>
                <div className="bp-drawer" onClick={e => e.stopPropagation()}>

                    <div className="bp-drawer__header">
                        <div>
                            <h3>Booking Details</h3>
                            <p className="bp-drawer__ref">#{String(booking._id).slice(-8).toUpperCase()}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button className="bp-drawer__action-btn" onClick={handlePrint} title="Print receipt">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="6 9 6 2 18 2 18 9"/>
                                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                                    <rect x="6" y="14" width="12" height="8"/>
                                </svg>
                                Print
                            </button>

                            <button
                                onClick={() => setConfirm({ type: 'delete' })}
                                disabled={deleting}
                                title="Permanently delete this booking"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 5,
                                    padding: '6px 12px',
                                    background: 'rgba(239,68,68,0.14)',
                                    border: '1px solid rgba(239,68,68,0.28)',
                                    color: '#f87171',
                                    borderRadius: 6, cursor: deleting ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600,
                                    opacity: deleting ? 0.5 : 1, transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => { if (!deleting) e.currentTarget.style.background = 'rgba(239,68,68,0.26)'; }}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.14)'}
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                    <path d="M10 11v6M14 11v6"/>
                                    <path d="M9 6V4h6v2"/>
                                </svg>
                                Delete
                            </button>

                            <button className="bp-drawer__close" onClick={onClose}>×</button>
                        </div>
                    </div>

                    <div className={`bp-drawer__status-banner bp-drawer__status-banner--${booking.status.toLowerCase()}`}>
                        <StatusBadge status={booking.status} />
                        <PaymentPill status={booking.paymentStatus || 'Unpaid'} />
                        {next.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                                {next.map(s => (
                                    <button key={s}
                                        className={`bp-status-btn bp-status-btn--${s.toLowerCase()}`}
                                        onClick={() => setConfirm({ type: 'status', status: s, label: `Mark as ${s}` })}
                                        disabled={updating || deleting}>
                                        {updating ? '…' : ` ${s}`}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bp-drawer__body">

                        <PaymentPanel
                            booking={booking}
                            onUpdated={(updated) => { setBooking(updated); onBookingUpdate(updated); }}
                        />

                        {/* ── NEW: Extend Panel ── */}
                        <ExtendPanel
                            booking={booking}
                            onExtended={(updated) => { setBooking(updated); onBookingUpdate(updated); }}
                        />

                        <div className="bp-drawer__section">
                            <p className="bp-drawer__label">Customer</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div className="bp-drawer__avatar">{booking.customerName?.charAt(0).toUpperCase()}</div>
                                <div>
                                    <p className="bp-drawer__val">{booking.customerName}</p>
                                    {booking.customerEmail && <a href={`mailto:${booking.customerEmail}`} className="bp-drawer__link">{booking.customerEmail}</a>}
                                    {booking.customerPhone && <a href={`tel:${booking.customerPhone}`}   className="bp-drawer__link">{booking.customerPhone}</a>}
                                </div>
                            </div>
                        </div>

                        <div className="bp-drawer__section">
                            <p className="bp-drawer__label">Vehicle</p>
                            {booking.carId?.image && <img src={booking.carId.image} alt={booking.carId.title} className="bp-drawer__car-img" />}
                            <p className="bp-drawer__val">{booking.carId?.title || '—'}</p>
                            <p className="bp-drawer__sub">{booking.carId?.type  || '—'}</p>
                            {booking.qty > 1 && <span className="bp-drawer__qty-tag">× {booking.qty} units</span>}
                        </div>

                        <div className="bp-drawer__section">
                            <p className="bp-drawer__label">Rental Period</p>
                            <div className="bp-drawer__dates">
                                <div className="bp-drawer__date-box">
                                    <span className="bp-drawer__date-lbl">Pickup</span>
                                    <span className="bp-drawer__date-val">{fmt(booking.startDate)}</span>
                                </div>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                                </svg>
                                <div className="bp-drawer__date-box">
                                    <span className="bp-drawer__date-lbl">Return</span>
                                    <span className="bp-drawer__date-val">{fmt(booking.endDate)}</span>
                                </div>
                            </div>
                            <p className="bp-drawer__sub" style={{ marginTop: 8 }}>
                                {booking.rentalDays} day{booking.rentalDays !== 1 ? 's' : ''}
                            </p>
                        </div>

                        {booking.pickupLocation && (
                            <div className="bp-drawer__section">
                                <p className="bp-drawer__label">Pickup Location</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                        <circle cx="12" cy="10" r="3"/>
                                    </svg>
                                    <p className="bp-drawer__val">{booking.pickupLocation}</p>
                                </div>
                            </div>
                        )}

                        <div className="bp-drawer__section">
                            <p className="bp-drawer__label">Booked On</p>
                            <p className="bp-drawer__val">{fmt(booking.createdAt)}</p>
                            <p className="bp-drawer__sub">
                                {new Date(booking.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {confirm?.type === 'status' && (
                <ConfirmDialog
                    message={`Change status to "${confirm.status}"?`}
                    subMessage={confirm.status === 'Cancelled' ? 'This will restore the vehicle stock.' : undefined}
                    confirmLabel={confirm.label}
                    confirmClass={confirm.status === 'Cancelled' ? 'bp-confirm__ok--danger' : 'bp-confirm__ok--primary'}
                    onConfirm={() => handleStatus(confirm.status)}
                    onCancel={() => setConfirm(null)}
                />
            )}

            {confirm?.type === 'delete' && (
                <ConfirmDialog
                    title="Delete this booking?"
                    message={`Booking #${String(booking._id).slice(-8).toUpperCase()} for ${booking.customerName} will be permanently removed from the database. This cannot be undone.`}
                    subMessage={DELETE_STOCK_CONTEXT[booking.status]}
                    confirmLabel="Delete Permanently"
                    confirmClass="bp-confirm__ok--danger"
                    onConfirm={handleDelete}
                    onCancel={() => !deleting && setConfirm(null)}
                    loading={deleting}
                />
            )}
        </>
    );
}


function exportCSV(bookings) {
    const headers = ['Ref','Customer','Email','Phone','Vehicle','Qty','Start','End','Days','Location','Quoted Price','Amount Paid','Outstanding','Payment Status','Payment Method','Booking Status','Booked On'];
    const rows = bookings.map(b => [
        String(b._id).slice(-8).toUpperCase(),
        b.customerName  || '',
        b.customerEmail || '',
        b.customerPhone || '',
        b.carId?.title  || b.car || '',
        b.qty ?? 1,
        fmt(b.startDate),
        fmt(b.endDate),
        b.rentalDays,
        b.pickupLocation || '',
        b.quotedPrice ?? '',
        b.amountPaid  ?? 0,
        b.quotedPrice ? Math.max(0, b.quotedPrice - (b.amountPaid || 0)) : '',
        b.paymentStatus  || 'Unpaid',
        b.paymentMethod  || '',
        b.status,
        fmt(b.createdAt),
    ]);
    const csv  = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `bookings_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}


function Toast({ toast, onDismiss }) {
    if (!toast) return null;
    const isErr = toast.type === 'error';
    return (
        <div style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
            display: 'flex', alignItems: 'center', gap: 10,
            background: isErr ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${isErr ? '#fecaca' : '#a7f3d0'}`,
            color: isErr ? '#991b1b' : '#065f46',
            padding: '12px 18px', borderRadius: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            fontSize: '0.875rem', fontWeight: 600,
            animation: 'ad-fade-down 0.2s ease',
            maxWidth: 360,
        }}>
            {isErr
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            }
            {toast.msg}
            <button onClick={onDismiss}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.55, fontSize: '1rem', lineHeight: 1, padding: 0 }}>
                ×
            </button>
        </div>
    );
}



export default function BookingsPage() {
    const [bookings, setBookings] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState('');
    const [filter,   setFilter]   = useState('All');
    const [search,   setSearch]   = useState('');
    const [sort,     setSort]     = useState('newest');
    const [selected, setSelected] = useState(null);
    const [page,     setPage]     = useState(1);
    const [toast,    setToast]    = useState(null);
    const searchRef  = useRef(null);
    const toastTimer = useRef(null);

    function showToast(msg, type = 'success') {
        clearTimeout(toastTimer.current);
        setToast({ msg, type });
        toastTimer.current = setTimeout(() => setToast(null), 3400);
    }

    const fetchBookings = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const data = await apiFetch('/api/bookings');
            setBookings(Array.isArray(data) ? data : []);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchBookings(); }, [fetchBookings]);

    useEffect(() => {
        const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); searchRef.current?.focus(); } };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, []);

    async function handleStatusChange(id, newStatus) {
        try {
            const res = await apiFetch(`/api/admin/bookings/${id}/status`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            const updated = res.booking;
            setBookings(prev => prev.map(b => b._id === id ? { ...b, ...updated } : b));
            setSelected(prev => prev?._id === id ? { ...prev, ...updated } : prev);
            showToast(`Booking marked as ${newStatus}.`);
        } catch (err) { showToast(err.message, 'error'); }
    }

    function handleBookingUpdate(updatedBooking) {
        setBookings(prev => prev.map(b => b._id === updatedBooking._id ? updatedBooking : b));
        setSelected(updatedBooking);
    }

    async function handleDeleteBooking(id, status) {
        try {
            await apiFetch(`/api/admin/bookings/${id}`, { method: 'DELETE' });
            setBookings(prev => prev.filter(b => b._id !== id));
            const stockNote = ['Pending', 'Active'].includes(status) ? ' Stock restored.' : '';
            showToast(`Booking deleted permanently.${stockNote}`);
        } catch (err) {
            showToast(err.message, 'error');
            throw err;
        }
    }

    const filtered = bookings
        .filter(b => filter === 'All' || b.status === filter)
        .filter(b => {
            const term = search.toLowerCase();
            return !term ||
                b.customerName?.toLowerCase().includes(term)  ||
                b.customerEmail?.toLowerCase().includes(term) ||
                (b.carId?.title || b.car || '').toLowerCase().includes(term) ||
                String(b._id).slice(-8).toLowerCase().includes(term);
        })
        .sort((a, b) => {
            if (sort === 'newest')  return new Date(b.createdAt) - new Date(a.createdAt);
            if (sort === 'oldest')  return new Date(a.createdAt) - new Date(b.createdAt);
            if (sort === 'cost_hi') return fmtCurNum(b.quotedPrice || b.totalCost) - fmtCurNum(a.quotedPrice || a.totalCost);
            if (sort === 'cost_lo') return fmtCurNum(a.quotedPrice || a.totalCost) - fmtCurNum(b.quotedPrice || b.totalCost);
            if (sort === 'start')   return new Date(a.startDate) - new Date(b.startDate);
            return 0;
        });

    const totalPages = Math.ceil(filtered.length / PER_PAGE);
    const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const counts = STATUS_FILTERS.reduce((acc, s) => {
        acc[s] = s === 'All' ? bookings.length : bookings.filter(b => b.status === s).length;
        return acc;
    }, {});

    function changeFilter(f) { setFilter(f); setPage(1); }
    function changeSearch(v) { setSearch(v);  setPage(1); }

    return (
        <div className="bp-root">
            <Toast toast={toast} onDismiss={() => setToast(null)} />

            <div className="bp-tabs">
                {STATUS_FILTERS.map(s => (
                    <button key={s} className={`bp-tab${filter === s ? ' bp-tab--active' : ''}`} onClick={() => changeFilter(s)}>
                        {s}<span className="bp-tab__count">{counts[s]}</span>
                    </button>
                ))}
            </div>

            <div className="bp-toolbar">
                <div className="bp-search-wrap">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input ref={searchRef} className="bp-search"
                        placeholder="Search customer, vehicle, ref… (Ctrl+F)"
                        value={search} onChange={e => changeSearch(e.target.value)} />
                    {search && <button className="bp-search-clear" onClick={() => changeSearch('')}>×</button>}
                </div>

                <select className="bp-sort-select" value={sort} onChange={e => setSort(e.target.value)}>
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                <button className="bp-export-btn" onClick={() => exportCSV(filtered)} disabled={filtered.length === 0} title="Export filtered bookings as CSV">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <span>Export CSV</span>
                </button>

                <button className="bp-refresh-btn" onClick={fetchBookings} title="Refresh">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                </button>

                <span className="bp-count">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {error && <div className="bp-banner bp-banner--error">{error}</div>}

            <div className="bp-table-wrap">
                <table className="bp-table">
                    <thead>
                        <tr>
                            <th>Ref</th>
                            <th>Customer</th>
                            <th>Vehicle</th>
                            <th>Dates</th>
                            <th>Quote</th>
                            <th>Payment</th>
                            <th>Status</th>
                            <th>Booked</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <tr key={i}><td colSpan={9}><div className="bp-row-skeleton" /></td></tr>
                            ))
                        ) : paginated.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="bp-empty-cell">
                                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" style={{ marginBottom: 8 }}>
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                    </svg>
                                    <p style={{ margin: 0, fontWeight: 600 }}>No bookings found</p>
                                    {search && <p style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>Try a different search term</p>}
                                </td>
                            </tr>
                        ) : paginated.map((b, i) => (
                            <tr key={b._id} className="bp-row"
                                style={{ animationDelay: `${i * 0.03}s` }}
                                onClick={() => setSelected(b)}>
                                <td><span className="bp-ref">#{String(b._id).slice(-8).toUpperCase()}</span></td>
                                <td>
                                    <div className="bp-customer">
                                        <div className="bp-avatar">{b.customerName?.[0] || '?'}</div>
                                        <div>
                                            <p className="bp-name">{b.customerName}</p>
                                            <p className="bp-email">{b.customerEmail || '—'}</p>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <p className="bp-car">{b.carId?.title || b.car || '—'}</p>
                                    {b.qty > 1 && <p className="bp-qty">× {b.qty} units</p>}
                                </td>
                                <td>
                                    <p className="bp-date">{fmt(b.startDate)}</p>
                                    <p className="bp-date bp-date--end">→ {fmt(b.endDate)}</p>
                                </td>
                                <td>
                                    {b.quotedPrice
                                        ? <span className="bp-cost">{fmtCur(b.quotedPrice)}</span>
                                        : <span style={{ fontSize: '0.78rem', color: '#9ca3af', fontStyle: 'italic' }}>Not quoted</span>
                                    }
                                </td>
                                <td><PaymentPill status={b.paymentStatus || 'Unpaid'} /></td>
                                <td><StatusBadge status={b.status} /></td>
                                <td><p className="bp-booked">{fmt(b.createdAt)}</p></td>

                                <td onClick={e => e.stopPropagation()}>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <button className="bp-view-btn" onClick={() => setSelected(b)}>
                                            View 
                                        </button>
                                        <button
                                            className="bp-inline-delete"
                                            title="Delete booking"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelected(b);
                                                setTimeout(() => {
                                                    document.querySelector('.bp-drawer-delete-trigger')?.click();
                                                }, 50);
                                            }}
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"/>
                                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                                <path d="M10 11v6M14 11v6"/>
                                            </svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="bp-pagination">
                    <button className="bp-pg-btn" onClick={() => setPage(1)}           disabled={page === 1}>«</button>
                    <button className="bp-pg-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹ Prev</button>
                    <div className="bp-pg-numbers">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                            .reduce((acc, n, idx, arr) => {
                                if (idx > 0 && n - arr[idx - 1] > 1) acc.push('…');
                                acc.push(n);
                                return acc;
                            }, [])
                            .map((n, i) => n === '…'
                                ? <span key={`e${i}`} className="bp-pg-ellipsis">…</span>
                                : <button key={n} className={`bp-pg-num${page === n ? ' bp-pg-num--active' : ''}`}
                                    onClick={() => setPage(n)}>{n}</button>
                            )}
                    </div>
                    <button className="bp-pg-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Next ›</button>
                    <button className="bp-pg-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
                    <span className="bp-pg-info">{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}</span>
                </div>
            )}

            {selected && (
                <BookingDrawer
                    booking={selected}
                    onClose={() => setSelected(null)}
                    onStatusChange={handleStatusChange}
                    onBookingUpdate={handleBookingUpdate}
                    onDelete={handleDeleteBooking}
                />
            )}

            <style>{`
                .bp-inline-delete {
                    width: 28px; height: 28px;
                    display: flex; align-items: center; justify-content: center;
                    background: #fee2e2; border: none;
                    color: #dc2626; border-radius: 6px;
                    cursor: pointer; opacity: 0;
                    transition: opacity 0.15s, background 0.15s;
                    flex-shrink: 0;
                }
                .bp-inline-delete:hover { background: #fecaca; }
                .bp-row:hover .bp-inline-delete { opacity: 1; }
            `}</style>
        </div>
    );
}