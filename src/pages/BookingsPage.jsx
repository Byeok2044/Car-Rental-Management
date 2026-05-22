import React, { useState, useEffect, useCallback, useRef } from 'react';
import './Adminpages.css';
import KycDocsPanel from '../features/KycDocsPanel.jsx';

const API_BASE_URL  = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const PER_PAGE      = 10;

// Added 'Overdue' to the main filters
const STATUS_FILTERS = ['All', 'Unverified', 'Pending', 'Active', 'Overdue', 'Completed', 'Cancelled'];

// Added Overdue transitions so admins can manually resolve them or switch an active booking to overdue manually if needed.
const STATUS_TRANSITIONS = {
    Unverified: [],
    Pending:    ['Active', 'Cancelled'],
    Active:     ['Completed', 'Cancelled'],
    Overdue:    ['Completed', 'Cancelled'],
    Completed:  [],
    Cancelled:  [],
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
    Unverified: 'Stock will be restored — booking was holding reserved units.',
    Pending:    'Stock will be restored — booking was holding reserved units.',
    Active:     'Stock will be restored — vehicle is currently marked as out.',
    Overdue:    'Stock will be restored — vehicle is currently marked as out (overdue).', // Added
    Completed:  'No stock change needed — stock was already restored when completed.',
    Cancelled:  'No stock change needed — stock was already restored when cancelled.',
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

// ── Customer Type Badge ───────────────────────────────────────────────────────
function CustomerTypeBadge({ type }) {
    if (!type || type === 'individual') return null;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#ede9fe', color: '#6d28d9',
            border: '1px solid #c4b5fd',
            fontSize: '0.65rem', fontWeight: 700,
            padding: '2px 7px', borderRadius: 20,
            textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8L6 7h12z"/>
            </svg>
            Business
        </span>
    );
}

// ── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
    return <span className={`bp-badge bp-badge--${status?.toLowerCase()}`}>{status}</span>;
}

// ── Payment Pill ─────────────────────────────────────────────────────────────
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

// ── Confirm Dialog ────────────────────────────────────────────────────────────
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
                    <button className="bp-confirm__cancel" onClick={onCancel} disabled={loading}>Cancel</button>
                    <button className={`bp-confirm__ok ${confirmClass}`} onClick={onConfirm} disabled={loading}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {loading ? (
                            <>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                    style={{ animation: 'ad-spin 0.7s linear infinite', flexShrink: 0 }}>
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                </svg>
                                Processing…
                            </>
                        ) : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Document Verification Panel ───────────────────────────────────────────────
function DocVerificationPanel({ booking, onVerified, onRejected }) {
    const [verifying,      setVerifying]      = useState(false);
    const [rejecting,      setRejecting]      = useState(false);
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [rejectReason,   setRejectReason]   = useState('');
    const [error,          setError]          = useState('');

    const hasDocs    = booking.kycDocUrls?.length > 0;
    const isVerified = booking.docsVerified;
    const isRejected = booking.docsRejected;

    async function handleVerify() {
        setVerifying(true); setError('');
        try {
            const data = await apiFetch(`/api/admin/bookings/${booking._id}/verify-docs`, { method: 'POST' });
            onVerified(data.booking);
        } catch (err) {
            setError(err.message);
        } finally {
            setVerifying(false);
        }
    }

    async function handleReject() {
        setRejecting(true); setError('');
        try {
            const data = await apiFetch(`/api/admin/bookings/${booking._id}/reject-docs`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ reason: rejectReason.trim() }),
            });
            onRejected(data.booking);
            setShowRejectForm(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setRejecting(false);
        }
    }

    if (booking.status !== 'Unverified') {
        if (!isVerified && !isRejected) return null;
        return (
            <div className="bp-drawer__section">
                <p className="bp-drawer__label">Document Verification</p>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                    background: isVerified ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${isVerified ? '#bbf7d0' : '#fecaca'}`,
                    borderRadius: 10,
                }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke={isVerified ? '#16a34a' : '#dc2626'} strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        {isVerified
                            ? <polyline points="20 6 9 17 4 12"/>
                            : <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>
                        }
                    </svg>
                    <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: isVerified ? '#065f46' : '#991b1b' }}>
                            {isVerified ? 'Documents Verified' : 'Documents Rejected'}
                        </p>
                        {booking.docsVerifiedAt && (
                            <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#6b7280' }}>
                                {fmt(isVerified ? booking.docsVerifiedAt : booking.docsRejectedAt)}
                            </p>
                        )}
                        {isRejected && booking.docsRejectReason && (
                            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#7f1d1d', fontStyle: 'italic' }}>
                                Reason: {booking.docsRejectReason}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bp-drawer__section">
            <p className="bp-drawer__label">Document Verification</p>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                background: '#fffbeb', border: '1.5px solid #fde68a',
                borderRadius: 10, marginBottom: 14,
            }}>
                <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: '#fef9c3', border: '2px solid #fde68a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                </div>
                <div>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#92400e' }}>
                        Awaiting Document Review
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.73rem', color: '#6b7280' }}>
                        {hasDocs
                            ? `${booking.kycDocUrls.length} document${booking.kycDocUrls.length !== 1 ? 's' : ''} submitted`
                            : 'No documents submitted yet'}
                    </p>
                </div>
            </div>

            <div style={{
                background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 8,
                padding: '10px 14px', marginBottom: 14, fontSize: '0.78rem', color: '#1e40af', lineHeight: 1.6,
            }}>
                <strong>Verification workflow:</strong> Review the KYC documents below.
                Verifying moves the booking to <strong>Pending</strong>.
                Rejecting cancels the booking and restores vehicle stock.
                <br/><br/>
                <strong>⚠ Quoting and payment are locked until documents are verified.</strong>
            </div>

            {error && (
                <div style={{
                    background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8,
                    padding: '10px 14px', marginBottom: 12,
                    fontSize: '0.82rem', color: '#b91c1c', fontWeight: 500,
                }}>
                    {error}
                </div>
            )}

            {!showRejectForm ? (
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={handleVerify}
                        disabled={!hasDocs || verifying || rejecting}
                        style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                            padding: '10px 16px',
                            background: (!hasDocs || verifying) ? '#d1fae5' : '#065f46',
                            color: (!hasDocs || verifying) ? '#6b7280' : '#fff',
                            border: 'none', borderRadius: 8, cursor: (!hasDocs || verifying) ? 'not-allowed' : 'pointer',
                            fontSize: '0.85rem', fontWeight: 700, fontFamily: 'inherit',
                            opacity: (!hasDocs || verifying) ? 0.6 : 1,
                        }}
                        title={!hasDocs ? 'No documents to verify' : 'Verify documents and move to Pending'}
                    >
                        {verifying ? (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                    style={{ animation: 'ad-spin 0.8s linear infinite' }}>
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                </svg>
                                Verifying…
                            </>
                        ) : (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                Verify Documents
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => setShowRejectForm(true)}
                        disabled={verifying || rejecting}
                        style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                            padding: '10px 16px',
                            background: '#fef2f2', color: '#dc2626',
                            border: '1.5px solid #fecaca', borderRadius: 8,
                            cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'inherit',
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                        Reject & Cancel
                    </button>
                </div>
            ) : (
                <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, padding: 14 }}>
                    <p style={{ margin: '0 0 10px', fontSize: '0.82rem', fontWeight: 700, color: '#991b1b' }}>
                        Reject Documents — This will cancel the booking and restore stock
                    </p>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Reason for rejection (recommended)
                    </label>
                    <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        disabled={rejecting}
                        rows={3}
                        placeholder="e.g. ID image is blurry and unreadable."
                        style={{
                            width: '100%', padding: '9px 12px', marginBottom: 10,
                            border: '1.5px solid #fecaca', borderRadius: 7,
                            fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical',
                            outline: 'none', boxSizing: 'border-box', background: '#fff',
                        }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={handleReject} disabled={rejecting}
                            style={{
                                padding: '8px 18px', background: rejecting ? '#fecaca' : '#dc2626',
                                color: '#fff', border: 'none', borderRadius: 7,
                                cursor: rejecting ? 'not-allowed' : 'pointer',
                                fontSize: '0.85rem', fontWeight: 700, fontFamily: 'inherit',
                            }}>
                            {rejecting ? 'Rejecting…' : 'Confirm Rejection'}
                        </button>
                        <button onClick={() => { setShowRejectForm(false); setRejectReason(''); setError(''); }}
                            disabled={rejecting}
                            style={{
                                padding: '8px 14px', background: 'transparent',
                                border: '1.5px solid #fecaca', borderRadius: 7,
                                cursor: 'pointer', fontSize: '0.85rem', color: '#991b1b', fontFamily: 'inherit',
                            }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Payment Panel ─────────────────────────────────────────────────────────────
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

    // Allow Overdue bookings to be quoted (e.g., adding late fees before completion)
    const canQuote = booking.status === 'Pending' || booking.status === 'Active' || booking.status === 'Overdue';

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
                method:  'PUT', headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ quotedPrice: Number(quotedPrice), paymentNotes: quoteNotes }),
            });
            onUpdated(data.booking); setShowQuote(false);
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
                method:  'PUT', headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ amountPaid: Number(amountPaid), paymentMethod: payMethod, paymentNotes: payNotes }),
            });
            onUpdated(data.booking); setShowPayment(false); setPayNotes('');
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
    }

    const outstanding = booking.quotedPrice
        ? Math.max(0, booking.quotedPrice - (booking.amountPaid || 0))
        : null;

    const renderSummary = () => (
        <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
                <PaymentPill status={booking.paymentStatus || 'Unpaid'} />
                {booking.quotedPrice && <span style={{ fontSize: '0.85rem', color: '#111827', fontWeight: 600 }}>Quote: {fmtCur(booking.quotedPrice)}</span>}
                {booking.amountPaid > 0 && <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>Paid: {fmtCur(booking.amountPaid)}</span>}
                {outstanding > 0 && <span style={{ fontSize: '0.82rem', color: '#991b1b', fontWeight: 600 }}>Balance: {fmtCur(outstanding)}</span>}
            </div>
            {booking.paymentMethod && <p style={{ margin: 0, fontSize: '0.82rem', color: '#6b7280' }}>via <strong>{booking.paymentMethod}</strong></p>}
            {booking.paymentNotes  && <p style={{ fontSize: '0.82rem', color: '#374151', margin: '6px 0 0', background: '#f8fafc', padding: '8px 12px', borderRadius: 6, borderLeft: '3px solid #e2e8f0' }}>{booking.paymentNotes}</p>}
        </div>
    );

    return (
        <div className="bp-drawer__section">
            <p className="bp-drawer__label">Payment</p>

            {booking.status === 'Unverified' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f8fafc', border: '1px dashed #e2e8f0', borderRadius: 8, fontSize: '0.8rem', color: '#6b7280' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Quote &amp; payment are locked until documents are verified.
                </div>
            )}

            {(booking.status === 'Completed' || booking.status === 'Cancelled') && renderSummary()}

            {canQuote && (
                <>
                    {renderSummary()}
                    {error && <p style={{ color: '#991b1b', fontSize: '0.8rem', margin: '0 0 10px', background: '#fee2e2', padding: '6px 10px', borderRadius: 6 }}>{error}</p>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                        <button onClick={() => { setShowQuote(v => !v); setShowPayment(false); setError(''); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: showQuote ? '#f1f5f9' : '#1e40af', color: showQuote ? '#111827' : '#fff', border: showQuote ? '1.5px solid #e2e8f0' : 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit' }}>
                            {booking.quotedPrice ? 'Update Quote' : 'Set Quote'}
                        </button>
                        {booking.quotedPrice && (
                            <button onClick={() => { setShowPayment(v => !v); setShowQuote(false); setError(''); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: showPayment ? '#f1f5f9' : '#065f46', color: showPayment ? '#111827' : '#fff', border: showPayment ? '1.5px solid #e2e8f0' : 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit' }}>
                                Record Payment
                            </button>
                        )}
                    </div>

                    {showQuote && (
                        <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 10, padding: 14, marginTop: 8 }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quoted Price (₱) *</label>
                            <input type="number" min="1" value={quotedPrice} disabled={saving} onChange={e => { setQuotedPrice(e.target.value); setError(''); }} placeholder="e.g. 3500"
                                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #bfdbfe', borderRadius: 7, fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes (optional)</label>
                            <textarea value={quoteNotes} disabled={saving} rows={2} onChange={e => setQuoteNotes(e.target.value)} placeholder="e.g. Includes driver, airport pickup"
                                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #bfdbfe', borderRadius: 7, fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
                            <p style={{ fontSize: '0.75rem', color: '#3b82f6', margin: '0 0 10px' }}>A quote email will be sent to the customer automatically.</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={submitQuote} disabled={saving} style={{ padding: '8px 18px', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
                                    {saving ? 'Saving…' : 'Save & Email Customer'}
                                </button>
                                <button onClick={() => { setShowQuote(false); setError(''); }} style={{ padding: '8px 14px', background: 'transparent', border: '1.5px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', fontSize: '0.85rem', color: '#6b7280', fontFamily: 'inherit' }}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {showPayment && (
                        <div style={{ background: '#f0fdf4', border: '1.5px solid #a7f3d0', borderRadius: 10, padding: 14, marginTop: 8 }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Amount Received (₱)</label>
                            <input type="number" min="0" value={amountPaid} disabled={saving} onChange={e => { setAmountPaid(e.target.value); setError(''); }} placeholder={`e.g. ${booking.quotedPrice}`}
                                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #a7f3d0', borderRadius: 7, fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Payment Method</label>
                            <select value={payMethod} onChange={e => setPayMethod(e.target.value)} disabled={saving}
                                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #a7f3d0', borderRadius: 7, fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 8, background: 'white' }}>
                                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <textarea value={payNotes} onChange={e => setPayNotes(e.target.value)} disabled={saving} rows={2} placeholder="e.g. Paid via GCash ref #12345678"
                                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #a7f3d0', borderRadius: 7, fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 10, background: 'white' }} />
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={submitPayment} disabled={saving} style={{ padding: '8px 18px', background: '#065f46', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
                                    {saving ? 'Saving…' : 'Confirm Payment'}
                                </button>
                                <button onClick={() => { setShowPayment(false); setError(''); }} style={{ padding: '8px 14px', background: 'transparent', border: '1.5px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', fontSize: '0.85rem', color: '#6b7280', fontFamily: 'inherit' }}>Cancel</button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ── Adjust Booking Panel ──────────────────────────────────────────────────────
function AdjustBookingPanel({ booking, onAdjusted }) {
    const [open,      setOpen]      = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate,   setEndDate]   = useState('');
    const [reason,    setReason]    = useState('');
    const [saving,    setSaving]    = useState(false);
    const [error,     setError]     = useState('');
    const [success,   setSuccess]   = useState('');

    const isPending = booking.status === 'Pending';
    const isActive  = booking.status === 'Active';
    const isOverdue = booking.status === 'Overdue';
    
    // Admins can adjust Overdue bookings to extend the end date/calculate final days before completion
    const canAdjust = isPending || isActive || isOverdue;

    function toInputDate(isoOrDate) {
        if (!isoOrDate) return '';
        const d = new Date(isoOrDate);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    function fmtDisplay(isoOrDate) {
        if (!isoOrDate) return '—';
        return new Date(isoOrDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function calcDays(s, e) {
        if (!s || !e) return null;
        const diff = Math.round((new Date(e) - new Date(s)) / (1000 * 60 * 60 * 24)) + 1;
        return diff > 0 ? diff : null;
    }

    useEffect(() => { setOpen(false); setStartDate(''); setEndDate(''); setReason(''); setError(''); setSuccess(''); }, [booking._id]);

    function handleOpen() {
        setStartDate(toInputDate(booking.startDate));
        setEndDate(toInputDate(booking.endDate));
        setReason(''); setError(''); setSuccess('');
        setOpen(true);
    }

    async function submit() {
        setError('');
        if (!endDate) { setError('End date is required.'); return; }
        if (isPending && !startDate) { setError('Start date is required.'); return; }
        const s = new Date(isPending ? startDate : booking.startDate);
        const e = new Date(endDate);
        s.setHours(0,0,0,0); e.setHours(0,0,0,0);
        if (e <= s) { setError('End date must be after start date.'); return; }
        setSaving(true);
        try {
            const body = { endDate, reason: reason.trim() || undefined };
            if (isPending) body.startDate = startDate;
            const data = await apiFetch(`/api/admin/bookings/${booking._id}/adjust`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });
            const newDays = calcDays(isPending ? startDate : booking.startDate, endDate);
            setSuccess(`Dates adjusted. New period: ${fmtDisplay(isPending ? startDate : booking.startDate)} → ${fmtDisplay(endDate)} (${newDays} day${newDays !== 1 ? 's' : ''})`);
            setReason('');
            setTimeout(() => { setSuccess(''); setOpen(false); }, 2800);
            onAdjusted(data.booking);
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
    }

    const previewStart = isPending ? startDate : toInputDate(booking.startDate);
    const previewDays  = calcDays(previewStart, endDate);
    const dayDiff      = previewDays != null ? previewDays - (booking.rentalDays || 1) : null;

    return (
        <div className="bp-drawer__section">
            <p className="bp-drawer__label">{isPending ? 'Adjust Booking Dates' : 'Adjust Return Date'}</p>
            {!canAdjust ? (
                <p style={{ fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic', margin: 0 }}>Only Pending, Active, or Overdue bookings can be adjusted.</p>
            ) : !open ? (
                <button onClick={handleOpen} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#f0fdf4', border: '1.5px solid #bbf7d0', color: '#065f46', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit' }}>
                    {isPending ? 'Adjust Start & Return Dates' : 'Adjust Return Date'}
                </button>
            ) : (
                <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: 14 }}>
                    {isPending && (
                        <>
                            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>New Start Date *</label>
                            <input type="date" value={startDate} disabled={saving} onChange={e => { setStartDate(e.target.value); setError(''); }}
                                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #bbf7d0', borderRadius: 7, fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 10, background: 'white' }} />
                        </>
                    )}
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>New Return Date *</label>
                    <input type="date" value={endDate} disabled={saving} min={isPending && startDate ? startDate : toInputDate(booking.startDate)} onChange={e => { setEndDate(e.target.value); setError(''); }}
                        style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #bbf7d0', borderRadius: 7, fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 10, background: 'white' }} />
                    {previewDays != null && previewDays > 0 && (
                        <div style={{ background: '#ecfdf5', padding: '8px 12px', borderRadius: 6, marginBottom: 10, fontSize: '0.82rem', color: '#065f46', fontWeight: 600 }}>
                            New period: {previewDays} day{previewDays !== 1 ? 's' : ''}
                            {dayDiff !== 0 && dayDiff != null && <span style={{ marginLeft: 8, color: dayDiff > 0 ? '#065f46' : '#b45309' }}>({dayDiff > 0 ? `+${dayDiff}` : dayDiff}d)</span>}
                        </div>
                    )}
                    <textarea value={reason} disabled={saving} rows={2} onChange={e => setReason(e.target.value)} placeholder="e.g. Customer requested schedule change"
                        style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #bbf7d0', borderRadius: 7, fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 10, background: 'white' }} />
                    {error   && <p style={{ color: '#991b1b', fontSize: '0.8rem', margin: '0 0 10px', background: '#fee2e2', padding: '6px 10px', borderRadius: 6 }}>{error}</p>}
                    {success && <p style={{ color: '#065f46', fontSize: '0.82rem', margin: '0 0 10px', background: '#dcfce7', padding: '6px 10px', borderRadius: 6, fontWeight: 600 }}>✓ {success}</p>}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={submit} disabled={saving || !endDate || (isPending && !startDate)} style={{ padding: '8px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'inherit' }}>
                            {saving ? 'Saving…' : 'Confirm Adjustment'}
                        </button>
                        <button onClick={() => { setOpen(false); setError(''); }} style={{ padding: '8px 14px', background: 'transparent', border: '1.5px solid #bbf7d0', borderRadius: 7, cursor: 'pointer', fontSize: '0.85rem', color: '#065f46', fontFamily: 'inherit' }}>Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Booking Drawer ────────────────────────────────────────────────────────────
function BookingDrawer({ booking: initialBooking, onClose, onStatusChange, onBookingUpdate, onDelete }) {
    const [booking,  setBooking]  = useState(initialBooking);
    const [updating, setUpdating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirm,  setConfirm]  = useState(null);
    const next = STATUS_TRANSITIONS[booking.status] || [];

    useEffect(() => { setBooking(initialBooking); }, [initialBooking]);

    async function handleStatus(newStatus) {
        setConfirm(null); setUpdating(true);
        try { await onStatusChange(booking._id, newStatus); }
        finally { setUpdating(false); }
    }

    async function handleDelete() {
        setDeleting(true);
        try { await onDelete(booking._id, booking.status); onClose(); }
        catch { setDeleting(false); setConfirm(null); }
    }

    function handleDocVerified(updatedBooking)  { setBooking(updatedBooking); onBookingUpdate(updatedBooking); }
    function handleDocRejected(updatedBooking)  { setBooking(updatedBooking); onBookingUpdate(updatedBooking); }

    const handlePrint = async () => {
        try {
            const token    = getToken();
            const response = await fetch(`${API_BASE_URL}/api/admin/bookings/${booking._id}/receipt`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) throw new Error('Server failed to generate the receipt.');
            const blob        = await response.blob();
            const url         = window.URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');
            if (printWindow) setTimeout(() => window.URL.revokeObjectURL(url), 10000);
        } catch (err) {
            alert('Could not generate receipt: ' + err.message);
        }
    };

    const isBusinessBooking = booking.customerType === 'business';

    return (
        <>
            <div className="bp-drawer-overlay" onClick={onClose}>
                <div className="bp-drawer" onClick={e => e.stopPropagation()}>
                    <div className="bp-drawer__header">
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <h3>Booking Details</h3>
                                {isBusinessBooking && (
                                    <span style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd', fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        Business
                                    </span>
                                )}
                            </div>
                            <p className="bp-drawer__ref">#{String(booking._id).slice(-8).toUpperCase()}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {booking.status === 'Completed' && (
                                <button className="bp-drawer__action-btn" onClick={handlePrint} title="Print official receipt">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <polyline points="6 9 6 2 18 2 18 9"/>
                                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                                        <rect x="6" y="14" width="12" height="8"/>
                                    </svg>
                                    Print Receipt
                                </button>
                            )}
                            <button onClick={() => setConfirm({ type: 'delete' })} disabled={deleting}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.28)', color: '#f87171', borderRadius: 6, cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 600, opacity: deleting ? 0.5 : 1 }}>
                                Delete
                            </button>
                            <button className="bp-drawer__close" onClick={onClose}>×</button>
                        </div>
                    </div>

                    <div className={`bp-drawer__status-banner bp-drawer__status-banner--${booking.status.toLowerCase()}`}
    style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
    {/* Row 1: current status + payment badges */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <StatusBadge status={booking.status} />
        <PaymentPill status={booking.paymentStatus || 'Unpaid'} />
    </div>
    {/* Row 2: transition action buttons */}
    {next.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600 }}>
                Action:
            </span>
            {next.map(s => (
                <button key={s}
                    className={`bp-status-btn bp-status-btn--${s.toLowerCase()}`}
                    onClick={() => setConfirm({ type: 'status', status: s, label: `Mark as ${s}` })}
                    disabled={updating || deleting}>
                    {updating ? '…' : s}
                </button>
            ))}
        </div>
    )}
</div>

                    <div className="bp-drawer__body">
                        <DocVerificationPanel booking={booking} onVerified={handleDocVerified} onRejected={handleDocRejected} />
                        <PaymentPanel booking={booking} onUpdated={(u) => { setBooking(u); onBookingUpdate(u); }} />
                        <AdjustBookingPanel booking={booking} onAdjusted={(u) => { setBooking(u); onBookingUpdate(u); }} />

                        {/* ── Customer / Business Info ── */}
                        <div className="bp-drawer__section">
                            <p className="bp-drawer__label">
                                {isBusinessBooking ? 'Business Information' : 'Customer'}
                            </p>

                            {isBusinessBooking ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {/* Business name */}
                                    <div style={{ background: '#f5f3ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '12px 14px' }}>
                                        <p style={{ margin: '0 0 2px', fontSize: '0.7rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Company / Business</p>
                                        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#111827' }}>{booking.businessName || '—'}</p>
                                    </div>

                                    {/* Authorized person */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div className="bp-drawer__avatar" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                                            {(booking.authorizedPerson || booking.customerName || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Authorized Representative</p>
                                            <p className="bp-drawer__val">{booking.authorizedPerson || booking.customerName}</p>
                                            {booking.customerEmail && <a href={`mailto:${booking.customerEmail}`} className="bp-drawer__link">{booking.customerEmail}</a>}
                                            {booking.customerPhone && <a href={`tel:${booking.customerPhone}`} className="bp-drawer__link">{booking.customerPhone}</a>}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div className="bp-drawer__avatar">{booking.customerName?.charAt(0).toUpperCase()}</div>
                                    <div>
                                        <p className="bp-drawer__val">{booking.customerName}</p>
                                        {booking.customerEmail && <a href={`mailto:${booking.customerEmail}`} className="bp-drawer__link">{booking.customerEmail}</a>}
                                        {booking.customerPhone && <a href={`tel:${booking.customerPhone}`} className="bp-drawer__link">{booking.customerPhone}</a>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Vehicle */}
                        <div className="bp-drawer__section">
                            <p className="bp-drawer__label">Vehicle</p>
                            {booking.carId?.image && <img src={booking.carId.image} alt={booking.carId.title} className="bp-drawer__car-img" />}
                            <p className="bp-drawer__val">{booking.carId?.title || '—'}</p>
                            <p className="bp-drawer__sub">{booking.carId?.type  || '—'}</p>
                            {booking.qty > 1 && <span className="bp-drawer__qty-tag">× {booking.qty} units</span>}
                        </div>

                        <KycDocsPanel booking={booking} />

                        {/* Rental Period */}
                        <div className="bp-drawer__section">
                            <p className="bp-drawer__label">Rental Period</p>
                            <div className="bp-drawer__dates">
                                <div className="bp-drawer__date-box">
                                    <span className="bp-drawer__date-lbl">Pickup</span>
                                    <span className="bp-drawer__date-val">{fmt(booking.startDate)}</span>
                                </div>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                <div className="bp-drawer__date-box">
                                    <span className="bp-drawer__date-lbl">Return</span>
                                    <span className="bp-drawer__date-val">{fmt(booking.endDate)}</span>
                                </div>
                            </div>
                            <p className="bp-drawer__sub" style={{ marginTop: 8 }}>{booking.rentalDays} day{booking.rentalDays !== 1 ? 's' : ''}</p>
                        </div>

                        {booking.pickupLocation && (
                            <div className="bp-drawer__section">
                                <p className="bp-drawer__label">Pickup Location</p>
                                <p className="bp-drawer__val">{booking.pickupLocation}</p>
                            </div>
                        )}

                        <div className="bp-drawer__section">
                            <p className="bp-drawer__label">Booked On</p>
                            <p className="bp-drawer__val">{fmt(booking.createdAt)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {confirm?.type === 'status' && (
                <ConfirmDialog
                    message={`Change status to "${confirm.status}"?`}
                    subMessage={
                        confirm.status === 'Active' ? 'Booking must have at least a partial payment recorded to become Active.'
                        : confirm.status === 'Completed' ? 'Booking must be fully paid to complete. A receipt PDF will be emailed to the customer.'
                        : confirm.status === 'Cancelled' ? 'This will cancel the booking and restore vehicle stock.'
                        : undefined
                    }
                    confirmLabel={confirm.label}
                    confirmClass={confirm.status === 'Cancelled' ? 'bp-confirm__ok--danger' : 'bp-confirm__ok--primary'}
                    onConfirm={() => handleStatus(confirm.status)}
                    onCancel={() => setConfirm(null)}
                />
            )}

            {confirm?.type === 'delete' && (
                <ConfirmDialog
                    title="Delete this booking?"
                    message={`Booking #${String(booking._id).slice(-8).toUpperCase()} for ${booking.customerName} will be permanently removed.`}
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

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportCSV(bookings) {
    const headers = ['Ref','Type','Customer / Authorized Person','Business Name','Email','Phone','Vehicle','Qty','Start','End','Days','Location','Doc Status','Quoted Price','Amount Paid','Outstanding','Payment Status','Payment Method','Booking Status','Booked On'];
    const rows = bookings.map(b => [
        String(b._id).slice(-8).toUpperCase(),
        b.customerType || 'individual',
        b.authorizedPerson || b.customerName || '',
        b.businessName || '',
        b.customerEmail || '',
        b.customerPhone || '',
        b.carId?.title  || b.car || '',
        b.qty ?? 1,
        fmt(b.startDate),
        fmt(b.endDate),
        b.rentalDays,
        b.pickupLocation || '',
        b.docsVerified ? 'Verified' : b.docsRejected ? 'Rejected' : 'Pending Review',
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

// ── Toast ─────────────────────────────────────────────────────────────────────
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
            fontSize: '0.875rem', fontWeight: 600, maxWidth: 360,
        }}>
            {isErr
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
            {toast.msg}
            <button onClick={onDismiss} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.55, fontSize: '1rem', lineHeight: 1, padding: 0 }}>×</button>
        </div>
    );
}

// ── Main BookingsPage ─────────────────────────────────────────────────────────
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
            const data = await apiFetch('/api/admin/bookings');
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
            // Ensure Overdue deletes also notify admin that stock was correctly restored
            const stockNote = ['Unverified', 'Pending', 'Active', 'Overdue'].includes(status) ? ' Stock restored.' : '';
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
                b.customerName?.toLowerCase().includes(term) ||
                b.customerEmail?.toLowerCase().includes(term) ||
                b.businessName?.toLowerCase().includes(term) ||
                b.authorizedPerson?.toLowerCase().includes(term) ||
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

    const unverifiedCount = counts['Unverified'] || 0;

    function changeFilter(f) { setFilter(f); setPage(1); }
    function changeSearch(v) { setSearch(v); setPage(1); }

    return (
        <div className="bp-root">
            <Toast toast={toast} onDismiss={() => setToast(null)} />

            {unverifiedCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10, marginBottom: 4 }}>
                    <div style={{ width: 32, height: 32, background: '#fef9c3', border: '2px solid #fde68a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#92400e' }}>
                            {unverifiedCount} booking{unverifiedCount !== 1 ? 's' : ''} awaiting document verification
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#6b7280' }}>
                            Review submitted KYC documents and verify or reject. Quoting is locked until verified.
                        </p>
                    </div>
                    <button onClick={() => changeFilter('Unverified')}
                        style={{ padding: '7px 16px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                        Review Now
                    </button>
                </div>
            )}

            {/* Status tabs */}
            <div className="bp-tabs">
                {STATUS_FILTERS.map(s => (
                    <button key={s} className={`bp-tab${filter === s ? ' bp-tab--active' : ''}`} onClick={() => changeFilter(s)}>
                        {s}<span className="bp-tab__count">{counts[s]}</span>
                    </button>
                ))}
            </div>

            {/* Toolbar */}
            <div className="bp-toolbar">
                <div className="bp-search-wrap">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input ref={searchRef} className="bp-search"
                        placeholder="Search by name, business, vehicle, ref… (Ctrl+F)"
                        value={search} onChange={e => changeSearch(e.target.value)} />
                    {search && <button className="bp-search-clear" onClick={() => changeSearch('')}>×</button>}
                </div>
                <select className="bp-sort-select" value={sort} onChange={e => setSort(e.target.value)}>
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button className="bp-export-btn" onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
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

            {/* Table */}
            <div className="bp-table-wrap">
                <table className="bp-table">
                    <thead>
                        <tr>
                            <th>Ref</th>
                            <th>Customer / Company</th>
                            <th>Vehicle</th>
                            <th>Dates</th>
                            <th>Docs</th>
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
                                <tr key={i}><td colSpan={10}><div className="bp-row-skeleton" /></td></tr>
                            ))
                        ) : paginated.length === 0 ? (
                            <tr>
                                <td colSpan={10}>
                                    <div style={{ 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        padding: '60px 20px', 
                                        width: '100%',
                                        color: '#9ca3af' 
                                    }}>
                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.5 }}>
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                            <polyline points="14 2 14 8 20 8"/>
                                        </svg>
                                        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#4b5563' }}>
                                            No bookings found
                                        </p>
                                        {search && (
                                            <p style={{ margin: '4px 0 0', fontSize: '0.875rem' }}>
                                                No results match "{search}"
                                            </p>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ) : paginated.map((b, i) => {
                            const isBusinessBooking = b.customerType === 'business';
                            return (
                                <tr key={b._id} className="bp-row" style={{ animationDelay: `${i * 0.03}s` }} onClick={() => setSelected(b)}>
                                    <td><span className="bp-ref">#{String(b._id).slice(-8).toUpperCase()}</span></td>
                                    <td>
                                        <div className="bp-customer">
                                            <div className="bp-avatar" style={{ background: isBusinessBooking ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'linear-gradient(135deg,#2563eb,#7c3aed)' }}>
                                                {isBusinessBooking
                                                    ? (b.businessName?.[0] || b.customerName?.[0] || '?').toUpperCase()
                                                    : (b.customerName?.[0] || '?').toUpperCase()}
                                            </div>
                                            <div>
                                                {isBusinessBooking ? (
                                                    <>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                            <p className="bp-name">{b.businessName || '—'}</p>
                                                            <CustomerTypeBadge type={b.customerType} />
                                                        </div>
                                                        <p className="bp-email">{b.authorizedPerson || b.customerName} · {b.customerEmail || '—'}</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="bp-name">{b.customerName}</p>
                                                        <p className="bp-email">{b.customerEmail || '—'}</p>
                                                    </>
                                                )}
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
                                        {b.docsVerified ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#d1fae5', color: '#065f46', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, border: '1px solid #a7f3d0' }}>
                                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                Verified
                                            </span>
                                        ) : b.docsRejected ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fee2e2', color: '#991b1b', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, border: '1px solid #fecaca' }}>
                                                Rejected
                                            </span>
                                        ) : (b.kycDocUrls?.length > 0) ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fef9c3', color: '#854d0e', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, border: '1px solid #fde68a' }}>
                                                Review
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '0.75rem', color: '#d1d5db', fontStyle: 'italic' }}>None</span>
                                        )}
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
                                        <button className="bp-view-btn" onClick={() => setSelected(b)}>View</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="bp-pagination">
                    <button className="bp-pg-btn" onClick={() => setPage(1)} disabled={page === 1}>«</button>
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
                                : <button key={n} className={`bp-pg-num${page === n ? ' bp-pg-num--active' : ''}`} onClick={() => setPage(n)}>{n}</button>
                            )}
                    </div>
                    <button className="bp-pg-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Next ›</button>
                    <button className="bp-pg-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
                    <span className="bp-pg-info">{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}</span>
                </div>
            )}

            <style>{`
                .bp-badge--unverified { background: #fef9c3; color: #854d0e; border: 1px solid #fde68a; }
                .bp-badge--overdue { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; animation: pulse-border 2s infinite; }
                .bp-drawer__status-banner--unverified { background: #fffbeb; }
                .bp-drawer__status-banner--overdue { background: #fff8e1; }
                .bp-status-btn--pending { background: #dbeafe; color: #1e40af; }
                .bp-status-btn--overdue { background: #fff3e0; color: #e65100; }
                @keyframes ad-spin { to { transform: rotate(360deg); } }
                @keyframes pulse-border { 
                    0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); } 
                    70% { box-shadow: 0 0 0 4px rgba(220, 38, 38, 0); } 
                    100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); } 
                }
            `}</style>

            {selected && (
                <BookingDrawer
                    booking={selected}
                    onClose={() => setSelected(null)}
                    onStatusChange={handleStatusChange}
                    onBookingUpdate={handleBookingUpdate}
                    onDelete={handleDeleteBooking}
                />
            )}
        </div>
    );
}