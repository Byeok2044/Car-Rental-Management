/**
 * KycDocsPanel
 * Drop this component into BookingsPage.jsx inside the BookingDrawer body.
 *
 * Usage (add inside <div className="bp-drawer__body"> after the Vehicle section):
 *   <KycDocsPanel booking={booking} />
 */

import React, { useState } from 'react';

// ── helpers ───────────────────────────────────────────────────────────────────

function isPdf(url) {
    if (!url) return false;
    // Cloudinary PDFs are uploaded as "image" resource type but the original
    // filename is preserved in the URL path — check for .pdf extension.
    return url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('/pdf/');
}

function docLabel(index, total, customerType) {
    if (customerType === 'business') {
        const labels = ['Business Registration', "Authorized Person's ID", 'Additional Document'];
        return labels[index] ?? `Document ${index + 1}`;
    }
    const labels = ["Driver's License / Gov't ID", 'Selfie with ID', 'Additional Document'];
    return labels[index] ?? `Document ${index + 1}`;
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({ url, label, onClose }) {
    const pdf = isPdf(url);
    return (
        <>
            {/* backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.82)',
                    backdropFilter: 'blur(6px)',
                    zIndex: 600,
                    animation: 'kyc-fade 0.18s ease',
                }}
            />
            {/* panel */}
            <div style={{
                position: 'fixed',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 601,
                width: pdf ? 'min(92vw, 860px)' : 'min(92vw, 780px)',
                maxHeight: '90vh',
                background: '#111827',
                borderRadius: 14,
                overflow: 'hidden',
                boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
                display: 'flex',
                flexDirection: 'column',
                animation: 'kyc-pop 0.22s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
                {/* header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {pdf ? (
                            <span style={{
                                background: '#fee2e2', color: '#dc2626',
                                fontSize: '0.65rem', fontWeight: 800,
                                padding: '2px 8px', borderRadius: 5,
                                letterSpacing: '0.06em',
                            }}>PDF</span>
                        ) : (
                            <span style={{
                                background: '#dbeafe', color: '#1e40af',
                                fontSize: '0.65rem', fontWeight: 800,
                                padding: '2px 8px', borderRadius: 5,
                                letterSpacing: '0.06em',
                            }}>IMG</span>
                        )}
                        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>
                            {label}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {/* open in new tab */}
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open in new tab"
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '6px 12px',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.18)',
                                borderRadius: 7,
                                color: 'rgba(255,255,255,0.8)',
                                fontSize: '0.75rem', fontWeight: 600,
                                textDecoration: 'none',
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                            Open full size
                        </a>
                        {/* close */}
                        <button
                            onClick={onClose}
                            style={{
                                width: 32, height: 32, borderRadius: '50%',
                                border: '1px solid rgba(255,255,255,0.2)',
                                background: 'rgba(255,255,255,0.08)',
                                color: 'rgba(255,255,255,0.7)',
                                fontSize: '1.2rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'background 0.15s, transform 0.2s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'rotate(0deg)'; }}
                        >×</button>
                    </div>
                </div>

                {/* content */}
                <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, minHeight: 200 }}>
                    {pdf ? (
                        <iframe
                            src={url}
                            title={label}
                            style={{ width: '100%', height: '70vh', border: 'none', borderRadius: 8, background: '#fff' }}
                        />
                    ) : (
                        <img
                            src={url}
                            alt={label}
                            style={{
                                maxWidth: '100%', maxHeight: '72vh',
                                borderRadius: 8,
                                objectFit: 'contain',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                            }}
                        />
                    )}
                </div>
            </div>
        </>
    );
}

// ── Doc Thumbnail ─────────────────────────────────────────────────────────────

function DocThumb({ url, label, onClick }) {
    const [loaded, setLoaded] = useState(false);
    const [errored, setErrored] = useState(false);
    const pdf = isPdf(url);

    return (
        <button
            type="button"
            onClick={onClick}
            title={`View ${label}`}
            style={{
                display: 'flex', flexDirection: 'column',
                gap: 6, border: 'none', background: 'none',
                cursor: 'pointer', padding: 0,
                textAlign: 'left', fontFamily: 'inherit',
            }}
        >
            {/* thumbnail box */}
            <div style={{
                width: '100%', aspectRatio: '4/3',
                borderRadius: 8,
                overflow: 'hidden',
                border: '2px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
                transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
                onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#2563eb';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(37,99,235,0.18)';
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = 'none';
                }}
            >
                {pdf ? (
                    /* PDF placeholder */
                    <div style={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 6, padding: 12,
                    }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="9" y1="13" x2="15" y2="13"/>
                            <line x1="9" y1="17" x2="15" y2="17"/>
                        </svg>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#ef4444', letterSpacing: '0.06em' }}>PDF</span>
                    </div>
                ) : errored ? (
                    /* failed to load */
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 12 }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>
                        </svg>
                        <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>Preview failed</span>
                    </div>
                ) : (
                    <>
                        {/* loading shimmer */}
                        {!loaded && (
                            <div style={{
                                position: 'absolute', inset: 0,
                                background: 'linear-gradient(90deg,#f3f4f6 25%,#e9eaed 50%,#f3f4f6 75%)',
                                backgroundSize: '200% 100%',
                                animation: 'kyc-shimmer 1.4s infinite',
                            }} />
                        )}
                        <img
                            src={url}
                            alt={label}
                            onLoad={() => setLoaded(true)}
                            onError={() => setErrored(true)}
                            style={{
                                width: '100%', height: '100%',
                                objectFit: 'cover',
                                display: loaded ? 'block' : 'none',
                                transition: 'transform 0.2s',
                            }}
                        />
                    </>
                )}

                {/* hover overlay */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(37,99,235,0)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.18s',
                    borderRadius: 6,
                }}
                    className="kyc-thumb-overlay"
                >
                    <div style={{
                        opacity: 0,
                        transition: 'opacity 0.18s',
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'rgba(37,99,235,0.9)',
                        color: '#fff', fontSize: '0.72rem', fontWeight: 700,
                        padding: '6px 12px', borderRadius: 20,
                    }}
                        className="kyc-thumb-btn"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                        </svg>
                        View
                    </div>
                </div>
            </div>

            {/* label */}
            <p style={{
                margin: 0,
                fontSize: '0.72rem', fontWeight: 600,
                color: '#374151',
                lineHeight: 1.3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
                {label}
            </p>
        </button>
    );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function KycDocsPanel({ booking }) {
    const [lightbox, setLightbox] = useState(null); // { url, label }

    const docs      = booking?.kycDocUrls ?? [];
    const custType  = booking?.customerType ?? 'individual';
    const hasAny    = docs.length > 0;

    // Determine verification status badge
    const status = booking?.status;
    const isVerified  = ['Active', 'Completed'].includes(status);
    const isPending   = status === 'Pending';

    return (
        <>
            <style>{`
                @keyframes kyc-fade  { from { opacity:0 } to { opacity:1 } }
                @keyframes kyc-pop   { from { opacity:0; transform:translate(-50%,-50%) scale(0.94) } to { opacity:1; transform:translate(-50%,-50%) scale(1) } }
                @keyframes kyc-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
                .kyc-thumb-wrap:hover .kyc-thumb-overlay { background: rgba(37,99,235,0.15) !important; }
                .kyc-thumb-wrap:hover .kyc-thumb-btn     { opacity: 1 !important; }
            `}</style>

            <div className="bp-drawer__section">
                {/* Section header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <p className="bp-drawer__label" style={{ margin: 0 }}>KYC Documents</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {/* customer type pill */}
                        <span style={{
                            fontSize: '0.65rem', fontWeight: 700,
                            padding: '2px 8px', borderRadius: 20,
                            background: custType === 'business' ? '#ede9fe' : '#dbeafe',
                            color:      custType === 'business' ? '#6d28d9' : '#1e40af',
                            border:     custType === 'business' ? '1px solid #c4b5fd' : '1px solid #bfdbfe',
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}>
                            {custType}
                        </span>
                        {/* verification badge */}
                        {isVerified && (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: '0.65rem', fontWeight: 700,
                                padding: '2px 8px', borderRadius: 20,
                                background: '#d1fae5', color: '#065f46',
                                border: '1px solid #a7f3d0',
                            }}>
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                Verified
                            </span>
                        )}
                        {isPending && hasAny && (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: '0.65rem', fontWeight: 700,
                                padding: '2px 8px', borderRadius: 20,
                                background: '#fef9c3', color: '#854d0e',
                                border: '1px solid #fde68a',
                            }}>
                                Awaiting Review
                            </span>
                        )}
                    </div>
                </div>

                {/* No docs submitted */}
                {!hasAny && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 14px',
                        background: '#f9fafb',
                        border: '1.5px dashed #e2e8f0',
                        borderRadius: 10,
                    }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#6b7280' }}>No documents uploaded</p>
                            <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#9ca3af' }}>
                                Customer did not submit KYC documents with this booking.
                            </p>
                        </div>
                    </div>
                )}

                {/* Thumbnails grid */}
                {hasAny && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${Math.min(docs.length, 3)}, 1fr)`,
                        gap: 10,
                    }}>
                        {docs.map((url, i) => {
                            const label = docLabel(i, docs.length, custType);
                            return (
                                <div key={url} className="kyc-thumb-wrap">
                                    <DocThumb
                                        url={url}
                                        label={label}
                                        onClick={() => setLightbox({ url, label })}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Count note */}
                {hasAny && (
                    <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: '#9ca3af' }}>
                        {docs.length} document{docs.length !== 1 ? 's' : ''} · click any thumbnail to enlarge
                    </p>
                )}
            </div>

            {/* Lightbox portal */}
            {lightbox && (
                <Lightbox
                    url={lightbox.url}
                    label={lightbox.label}
                    onClose={() => setLightbox(null)}
                />
            )}
        </>
    );
}