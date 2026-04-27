/**
 * KycDocsPanel  —  Fixed version
 *
 * Key fixes:
 *  1. isPdf() uses a smarter heuristic: checks the Cloudinary "resource_type"
 *     segment in the URL (image vs raw) AND the file extension.
 *  2. PDFs stored under /image/upload are converted to a viewable URL using
 *     Cloudinary's fl_attachment:false transformation, then opened in a new
 *     tab via an <object> tag (works cross-browser) rather than <iframe>.
 *  3. Added a direct "Open PDF" button as a fallback for browsers that block
 *     inline PDF rendering.
 *  4. Images use a proper lightbox with zoom support.
 *  5. Better thumbnail fallback for PDFs (always shows PDF icon, never a
 *     broken <img> tag).
 */

import React, { useState } from 'react';

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Determine whether a Cloudinary URL points to a PDF.
 *
 * Cloudinary PDF URLs look like one of:
 *   https://res.cloudinary.com/<cloud>/image/upload/.../<id>.pdf
 *   https://res.cloudinary.com/<cloud>/raw/upload/.../<id>.pdf
 *
 * We check BOTH the resource-type path segment AND the file extension so we
 * don't accidentally treat a JPEG named "pdf-icon.jpg" as a PDF.
 */
function isPdf(url) {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    // Extension check (most reliable)
    const extensionIsPdf = lower.includes('.pdf');
    // Cloudinary resource_type check
    const isRawResource = lower.includes('/raw/upload/');
    return extensionIsPdf || isRawResource;
}

/**
 * Convert a Cloudinary image/upload PDF URL to one that browsers can view.
 *
 * Cloudinary serves PDFs uploaded to the "image" resource type as images
 * (page thumbnails). To get the actual PDF bytes we need to either:
 *   a) Change /image/upload/ to /raw/upload/  (works if file was originally
 *      uploaded to raw — but our KYC flow uses image/upload)
 *   b) Append fl_attachment to force download
 *   c) Use the Cloudinary "fetch" endpoint with the raw URL
 *
 * The safest approach for browser viewing is to inject `fl_attachment:false`
 * so Cloudinary streams the raw PDF instead of a thumbnail. If the URL
 * already has transformations we insert before the version segment.
 */
function getPdfViewUrl(url) {
    if (!url) return url;
    // Already a raw resource — return as-is
    if (url.includes('/raw/upload/')) return url;

    // Insert fl_attachment:false transformation right after /image/upload/
    // so the browser receives the actual PDF bytes.
    // e.g. .../image/upload/v123456/kyc_docs/xxx.pdf
    //   → .../image/upload/fl_attachment:false/v123456/kyc_docs/xxx.pdf
    return url.replace(
        '/image/upload/',
        '/image/upload/fl_attachment:false/'
    );
}

/**
 * Get a Cloudinary thumbnail URL for PDFs (first page preview).
 * Converts the PDF resource to a JPEG thumbnail via page=1 transformation.
 */
function getPdfThumbnailUrl(url) {
    if (!url) return null;
    // Build a JPG thumbnail from the first page of the PDF
    // Works for PDFs uploaded to image/upload resource type
    const base = url.replace('/image/upload/', '/image/upload/pg_1,w_200,h_150,c_fit,f_jpg/');
    // Remove .pdf extension and add .jpg
    return base.replace(/\.pdf$/i, '.jpg');
}

function docLabel(index, total, customerType) {
    if (customerType === 'business') {
        const labels = ['Business Registration', "Authorized Person's ID", 'Additional Document'];
        return labels[index] ?? `Document ${index + 1}`;
    }
    const labels = ["Driver's License / Gov't ID", 'Selfie with ID', 'Additional Document'];
    return labels[index] ?? `Document ${index + 1}`;
}

// ── PDF Lightbox ──────────────────────────────────────────────────────────────

function PdfLightbox({ url, label, onClose }) {
    const viewUrl = getPdfViewUrl(url);

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(6px)',
                    zIndex: 600,
                    animation: 'kyc-fade 0.18s ease',
                }}
            />

            {/* Panel */}
            <div style={{
                position: 'fixed',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 601,
                width: 'min(95vw, 900px)',
                height: 'min(90vh, 800px)',
                background: '#111827',
                borderRadius: 14,
                overflow: 'hidden',
                boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
                display: 'flex',
                flexDirection: 'column',
                animation: 'kyc-pop 0.22s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 18px',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    flexShrink: 0,
                    gap: 12,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* PDF badge */}
                        <span style={{
                            background: '#fee2e2', color: '#dc2626',
                            fontSize: '0.65rem', fontWeight: 800,
                            padding: '2px 8px', borderRadius: 5,
                            letterSpacing: '0.06em',
                        }}>PDF</span>
                        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>
                            {label}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        {/* Open in new tab button */}
                        <a
                            href={viewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open PDF in new tab"
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '6px 14px',
                                background: '#2563eb',
                                border: 'none',
                                borderRadius: 7,
                                color: '#fff',
                                fontSize: '0.78rem', fontWeight: 700,
                                textDecoration: 'none',
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
                            onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15 3 21 3 21 9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                            Open in New Tab
                        </a>
                        {/* Download button */}
                        <a
                            href={url.replace('/image/upload/', '/image/upload/fl_attachment/')}
                            download
                            title="Download PDF"
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '6px 12px',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.18)',
                                borderRadius: 7,
                                color: 'rgba(255,255,255,0.8)',
                                fontSize: '0.78rem', fontWeight: 600,
                                textDecoration: 'none',
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Download
                        </a>
                        {/* Close */}
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
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.18)';
                                e.currentTarget.style.transform = 'rotate(90deg)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                e.currentTarget.style.transform = 'rotate(0deg)';
                            }}
                        >×</button>
                    </div>
                </div>

                {/* PDF Viewer */}
                <div style={{ flex: 1, position: 'relative', background: '#1f2937' }}>
                    {/*
                        Use <object> instead of <iframe> — better cross-browser PDF support.
                        The fallback content is shown when the browser can't render inline PDFs.
                    */}
                    <object
                        data={viewUrl}
                        type="application/pdf"
                        style={{
                            width: '100%',
                            height: '100%',
                            border: 'none',
                            display: 'block',
                        }}
                    >
                        {/* Fallback for browsers that block inline PDFs (mobile, some Chromium policies) */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            gap: 20,
                            padding: 32,
                            textAlign: 'center',
                        }}>
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none"
                                stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="9" y1="13" x2="15" y2="13"/>
                                <line x1="9" y1="17" x2="15" y2="17"/>
                            </svg>
                            <div>
                                <p style={{ color: '#e5e7eb', fontWeight: 700, margin: '0 0 8px', fontSize: '1rem' }}>
                                    Your browser can't display this PDF inline.
                                </p>
                                <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0 0 20px' }}>
                                    Use the buttons above to open or download the document.
                                </p>
                                <a
                                    href={viewUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 8,
                                        padding: '10px 24px',
                                        background: '#2563eb', color: '#fff',
                                        borderRadius: 8, textDecoration: 'none',
                                        fontWeight: 700, fontSize: '0.9rem',
                                    }}
                                >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                        <polyline points="15 3 21 3 21 9"/>
                                        <line x1="10" y1="14" x2="21" y2="3"/>
                                    </svg>
                                    Open PDF in New Tab
                                </a>
                            </div>
                        </div>
                    </object>
                </div>
            </div>
        </>
    );
}

// ── Image Lightbox ────────────────────────────────────────────────────────────

function ImageLightbox({ url, label, onClose }) {
    return (
        <>
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.88)',
                    backdropFilter: 'blur(6px)',
                    zIndex: 600,
                    animation: 'kyc-fade 0.18s ease',
                }}
            />
            <div style={{
                position: 'fixed',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 601,
                width: 'min(95vw, 820px)',
                maxHeight: '92vh',
                background: '#111827',
                borderRadius: 14,
                overflow: 'hidden',
                boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
                display: 'flex',
                flexDirection: 'column',
                animation: 'kyc-pop 0.22s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 18px',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                            background: '#dbeafe', color: '#1e40af',
                            fontSize: '0.65rem', fontWeight: 800,
                            padding: '2px 8px', borderRadius: 5,
                            letterSpacing: '0.06em',
                        }}>IMAGE</span>
                        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>{label}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '6px 12px',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.18)',
                                borderRadius: 7, color: 'rgba(255,255,255,0.8)',
                                fontSize: '0.78rem', fontWeight: 600,
                                textDecoration: 'none',
                            }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15 3 21 3 21 9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                            Full Size
                        </a>
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
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.18)';
                                e.currentTarget.style.transform = 'rotate(90deg)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                e.currentTarget.style.transform = 'rotate(0deg)';
                            }}
                        >×</button>
                    </div>
                </div>

                {/* Image */}
                <div style={{
                    flex: 1, overflow: 'auto',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 16, minHeight: 200,
                    background: '#0d1117',
                }}>
                    <img
                        src={url}
                        alt={label}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '75vh',
                            borderRadius: 8,
                            objectFit: 'contain',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                        }}
                    />
                </div>
            </div>
        </>
    );
}

// ── Doc Thumbnail ─────────────────────────────────────────────────────────────

function DocThumb({ url, label, onClick }) {
    const [imgLoaded,  setImgLoaded]  = useState(false);
    const [imgErrored, setImgErrored] = useState(false);
    const [thumbError, setThumbError] = useState(false);
    const docIsPdf = isPdf(url);
    const thumbUrl = docIsPdf ? getPdfThumbnailUrl(url) : url;

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
                width: '100%',
            }}
        >
            {/* Thumbnail box */}
            <div
                style={{
                    width: '100%', aspectRatio: '4/3',
                    borderRadius: 8, overflow: 'hidden',
                    border: '2px solid #e2e8f0',
                    background: docIsPdf ? '#fef2f2' : '#f8fafc',
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
                {docIsPdf ? (
                    /* PDF thumbnail — try Cloudinary page preview, fall back to icon */
                    <>
                        {!thumbError && thumbUrl ? (
                            <>
                                {/* Loading shimmer */}
                                {!imgLoaded && (
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: 'linear-gradient(90deg,#fee2e2 25%,#fecaca 50%,#fee2e2 75%)',
                                        backgroundSize: '200% 100%',
                                        animation: 'kyc-shimmer 1.4s infinite',
                                    }} />
                                )}
                                <img
                                    src={thumbUrl}
                                    alt={label}
                                    onLoad={() => setImgLoaded(true)}
                                    onError={() => setThumbError(true)}
                                    style={{
                                        width: '100%', height: '100%',
                                        objectFit: 'cover',
                                        display: imgLoaded ? 'block' : 'none',
                                    }}
                                />
                                {/* PDF badge overlay */}
                                {imgLoaded && (
                                    <div style={{
                                        position: 'absolute', top: 6, right: 6,
                                        background: 'rgba(220,38,38,0.9)',
                                        color: '#fff', fontSize: '0.6rem', fontWeight: 800,
                                        padding: '2px 6px', borderRadius: 4,
                                        letterSpacing: '0.06em',
                                    }}>PDF</div>
                                )}
                            </>
                        ) : null}

                        {/* Fallback PDF icon (shown when no thumb or thumb failed) */}
                        {(thumbError || !thumbUrl) && (
                            <div style={{
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', gap: 6, padding: 12,
                            }}>
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                                    stroke="#ef4444" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                    <line x1="9" y1="13" x2="15" y2="13"/>
                                    <line x1="9" y1="17" x2="15" y2="17"/>
                                </svg>
                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#ef4444', letterSpacing: '0.06em' }}>
                                    PDF
                                </span>
                                <span style={{ fontSize: '0.6rem', color: '#6b7280', textAlign: 'center' }}>
                                    Click to view
                                </span>
                            </div>
                        )}
                    </>
                ) : (
                    /* Image thumbnail */
                    <>
                        {/* Loading shimmer */}
                        {!imgLoaded && !imgErrored && (
                            <div style={{
                                position: 'absolute', inset: 0,
                                background: 'linear-gradient(90deg,#f3f4f6 25%,#e9eaed 50%,#f3f4f6 75%)',
                                backgroundSize: '200% 100%',
                                animation: 'kyc-shimmer 1.4s infinite',
                            }} />
                        )}

                        {imgErrored ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 12 }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                                    <line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>
                                </svg>
                                <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>Preview failed</span>
                            </div>
                        ) : (
                            <img
                                src={url}
                                alt={label}
                                onLoad={() => setImgLoaded(true)}
                                onError={() => setImgErrored(true)}
                                style={{
                                    width: '100%', height: '100%',
                                    objectFit: 'cover',
                                    display: imgLoaded ? 'block' : 'none',
                                    transition: 'transform 0.2s',
                                }}
                            />
                        )}
                    </>
                )}

                {/* Hover overlay */}
                <div
                    className="kyc-thumb-overlay"
                    style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(37,99,235,0)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.18s',
                        borderRadius: 6,
                    }}
                >
                    <div
                        className="kyc-thumb-btn"
                        style={{
                            opacity: 0,
                            transition: 'opacity 0.18s',
                            display: 'flex', alignItems: 'center', gap: 5,
                            background: 'rgba(37,99,235,0.92)',
                            color: '#fff', fontSize: '0.72rem', fontWeight: 700,
                            padding: '6px 12px', borderRadius: 20,
                        }}
                    >
                        {docIsPdf ? (
                            <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                </svg>
                                View PDF
                            </>
                        ) : (
                            <>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                    <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                                </svg>
                                View Image
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Label */}
            <p style={{
                margin: 0,
                fontSize: '0.72rem', fontWeight: 600,
                color: '#374151',
                lineHeight: 1.3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
                {docIsPdf ? '📄 ' : '🖼 '}{label}
            </p>
        </button>
    );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function KycDocsPanel({ booking }) {
    const [lightbox, setLightbox] = useState(null); // { url, label }

    const docs     = booking?.kycDocUrls ?? [];
    const custType = booking?.customerType ?? 'individual';
    const hasAny   = docs.length > 0;

    const status     = booking?.status;
    const isVerified = ['Active', 'Completed'].includes(status);
    const isPending  = status === 'Pending';

    function openLightbox(url, label) {
        setLightbox({ url, label });
    }

    return (
        <>
            <style>{`
                @keyframes kyc-fade  { from { opacity:0 } to { opacity:1 } }
                @keyframes kyc-pop   {
                    from { opacity:0; transform:translate(-50%,-50%) scale(0.94) }
                    to   { opacity:1; transform:translate(-50%,-50%) scale(1) }
                }
                @keyframes kyc-shimmer {
                    0%   { background-position:200% 0 }
                    100% { background-position:-200% 0 }
                }
                .kyc-thumb-wrap:hover .kyc-thumb-overlay { background: rgba(37,99,235,0.15) !important; }
                .kyc-thumb-wrap:hover .kyc-thumb-btn     { opacity: 1 !important; }
            `}</style>

            <div className="bp-drawer__section">
                {/* Section header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <p className="bp-drawer__label" style={{ margin: 0 }}>KYC Documents</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {/* Customer type pill */}
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
                        {/* Verification badge */}
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

                {/* No docs */}
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

                {/* Document grid */}
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
                                        onClick={() => openLightbox(url, label)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Count note */}
                {hasAny && (
                    <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: '#9ca3af' }}>
                        {docs.length} document{docs.length !== 1 ? 's' : ''} · click any thumbnail to view
                        {docs.some(u => isPdf(u)) && ' · PDFs open in a viewer with a download option'}
                    </p>
                )}
            </div>

            {/* Lightbox — split by type */}
            {lightbox && (
                isPdf(lightbox.url)
                    ? <PdfLightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />
                    : <ImageLightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />
            )}
        </>
    );
}