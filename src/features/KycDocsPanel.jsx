/**
 * KycDocsPanel — PDF viewing fixed
 *
 * ROOT CAUSE OF THE BUG:
 *   fl_attachment:false does NOT serve the PDF inline — Cloudinary ignores it for
 *   image/upload resources and still returns a page thumbnail (JPEG).
 *   Browsers therefore received a JPEG with Content-Type: image/jpeg and the
 *   <object> tag showed a blank/broken viewer.
 *
 * FIXES APPLIED:
 *   1. getPdfViewUrl() now rewrites /image/upload/ → /raw/upload/ so Cloudinary
 *      serves the actual PDF bytes (Content-Type: application/pdf).  This is the
 *      correct Cloudinary pattern for viewing a PDF that was uploaded to image/upload.
 *   2. PdfLightbox uses Google Docs Viewer as the primary embed URL.
 *      Google Docs Viewer works cross-browser (Chrome, Firefox, Safari, mobile) and
 *      bypasses all inline-PDF-blocking policies.  It only needs a publicly
 *      accessible URL, which Cloudinary provides.
 *   3. Added a plain <iframe> behind the Google Docs Viewer URL as the embed
 *      strategy — <object> had silent fallback failures; <iframe> gives a visible
 *      error state we can detect.
 *   4. Added an onLoad/onError guard on the iframe to show a fallback panel if
 *      the embed still fails (e.g. private Cloudinary account with signed URLs).
 *   5. Download button now correctly uses fl_attachment (no :false) to force
 *      a browser download of the raw PDF.
 *   6. PDF thumbnail now gracefully falls back to the icon-only state without
 *      attempting a broken image load when Cloudinary thumbnail generation is
 *      unavailable.
 */

import React, { useState, useRef } from 'react';

// ── helpers ───────────────────────────────────────────────────────────────────

function isPdf(url) {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return lower.includes('.pdf') || lower.includes('/raw/upload/');
}

/**
 * FIX #1 — Convert Cloudinary image/upload PDF URL to a viewable raw URL.
 *
 * Cloudinary stores the same file under two resource types:
 *   /image/upload/ — serves page thumbnails (images), NOT the PDF
 *   /raw/upload/   — serves the original file bytes (the actual PDF)
 *
 * Swapping the path segment is all that's needed.  The file ID and version
 * segment are identical; only the resource_type changes.
 *
 * If the URL is already /raw/upload/ (e.g. explicitly uploaded as raw), return as-is.
 */
function getPdfViewUrl(url) {
    if (!url) return url;
    if (url.includes('/raw/upload/')) return url;
    // Rewrite image/upload → raw/upload to get actual PDF bytes
    return url.replace('/image/upload/', '/raw/upload/');
}

/**
 * FIX #2 — Wrap the raw PDF URL in Google Docs Viewer.
 *
 * Google Docs Viewer renders PDFs inline in any browser, including mobile and
 * browsers with inline-PDF policies disabled.  Works as long as the Cloudinary
 * URL is publicly accessible (no signed URL required for most accounts).
 *
 * Format: https://docs.google.com/viewer?url=<encoded-url>&embedded=true
 */
function getGoogleDocsViewerUrl(rawPdfUrl) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(rawPdfUrl)}&embedded=true`;
}

/**
 * Download URL — fl_attachment (without :false) tells Cloudinary to send
 * Content-Disposition: attachment so the browser downloads the file.
 */
function getPdfDownloadUrl(url) {
    if (!url) return url;
    if (url.includes('/raw/upload/')) {
        return url.replace('/raw/upload/', '/raw/upload/fl_attachment/');
    }
    return url.replace('/image/upload/', '/image/upload/fl_attachment/');
}

/**
 * Thumbnail — first-page JPEG preview for PDFs.
 * Only works when the file was uploaded to image/upload resource type.
 */
function getPdfThumbnailUrl(url) {
    if (!url || url.includes('/raw/upload/')) return null;
    const base = url.replace(
        '/image/upload/',
        '/image/upload/pg_1,w_200,h_150,c_fit,f_jpg/'
    );
    return base.replace(/\.pdf$/i, '.jpg');
}

function docLabel(index, _total, customerType) {
    if (customerType === 'business') {
        const labels = ['Business Registration', "Authorized Person's ID", 'Additional Document'];
        return labels[index] ?? `Document ${index + 1}`;
    }
    const labels = ["Driver's License / Gov't ID", 'Selfie with ID', 'Additional Document'];
    return labels[index] ?? `Document ${index + 1}`;
}

// ── PDF Lightbox ──────────────────────────────────────────────────────────────

function PdfLightbox({ url, label, onClose }) {
    const rawUrl       = getPdfViewUrl(url);           // /raw/upload/ URL
    const embedUrl     = getGoogleDocsViewerUrl(rawUrl); // Google Docs Viewer
    const downloadUrl  = getPdfDownloadUrl(url);

    // FIX #4 — track whether the iframe loaded or failed
    const [embedState, setEmbedState] = useState('loading'); // 'loading' | 'loaded' | 'failed'
    const iframeRef = useRef(null);

    function handleIframeLoad() {
        // Google Docs Viewer returns a proper page, so onLoad firing = success
        setEmbedState('loaded');
    }

    function handleIframeError() {
        setEmbedState('failed');
    }

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
                        {/* Open raw PDF in new tab */}
                        <a
                            href={rawUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '6px 14px',
                                background: '#2563eb',
                                borderRadius: 7,
                                color: '#fff',
                                fontSize: '0.78rem', fontWeight: 700,
                                textDecoration: 'none',
                            }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15 3 21 3 21 9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                            Open in New Tab
                        </a>

                        {/* Download */}
                        <a
                            href={downloadUrl}
                            download
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '6px 12px',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.18)',
                                borderRadius: 7,
                                color: 'rgba(255,255,255,0.8)',
                                fontSize: '0.78rem', fontWeight: 600,
                                textDecoration: 'none',
                            }}
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

                {/* Viewer body */}
                <div style={{ flex: 1, position: 'relative', background: '#1f2937', overflow: 'hidden' }}>

                    {/* Loading spinner — shown until iframe fires onLoad */}
                    {embedState === 'loading' && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            gap: 14, color: 'rgba(255,255,255,0.5)',
                            fontSize: '0.85rem',
                            zIndex: 2,
                            pointerEvents: 'none',
                        }}>
                            <div style={{
                                width: 36, height: 36,
                                border: '3px solid rgba(255,255,255,0.15)',
                                borderTop: '3px solid #2563eb',
                                borderRadius: '50%',
                                animation: 'kyc-spin 0.8s linear infinite',
                            }} />
                            Loading PDF…
                        </div>
                    )}

                    {/* FIX #3 — iframe with Google Docs Viewer URL */}
                    {embedState !== 'failed' && (
                        <iframe
                            ref={iframeRef}
                            src={embedUrl}
                            title={label}
                            onLoad={handleIframeLoad}
                            onError={handleIframeError}
                            style={{
                                width: '100%',
                                height: '100%',
                                border: 'none',
                                display: 'block',
                                // Keep invisible until loaded to avoid FOUC
                                opacity: embedState === 'loaded' ? 1 : 0,
                                transition: 'opacity 0.3s',
                            }}
                            // Allow scripts needed by Google Docs Viewer
                            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                        />
                    )}

                    {/* FIX #4 — fallback when embed fails */}
                    {embedState === 'failed' && (
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
                            <svg width="56" height="56" viewBox="0 0 24 24" fill="none"
                                stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="9" y1="13" x2="15" y2="13"/>
                                <line x1="9" y1="17" x2="15" y2="17"/>
                            </svg>
                            <div>
                                <p style={{ color: '#e5e7eb', fontWeight: 700, margin: '0 0 8px', fontSize: '1rem' }}>
                                    Inline preview unavailable
                                </p>
                                <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: '0 0 20px' }}>
                                    The PDF could not be embedded. Use the buttons above to open or download it.
                                </p>
                                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                                    <a
                                        href={rawUrl}
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
                                        Open PDF in New Tab
                                    </a>
                                    <a
                                        href={downloadUrl}
                                        download
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 8,
                                            padding: '10px 24px',
                                            background: 'rgba(255,255,255,0.1)',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            color: '#e5e7eb',
                                            borderRadius: 8, textDecoration: 'none',
                                            fontWeight: 600, fontSize: '0.9rem',
                                        }}
                                    >
                                        Download PDF
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}
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
    // FIX #6 — only attempt thumbnail for image/upload PDFs, not raw/upload
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
                    <>
                        {thumbUrl && !thumbError ? (
                            <>
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

                        {/* PDF icon fallback — shown immediately for raw/upload or when thumb fails */}
                        {(!thumbUrl || thumbError || !imgLoaded) && (
                            <div style={{
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', gap: 6, padding: 12,
                                position: thumbUrl && !thumbError ? 'absolute' : 'static',
                                opacity: imgLoaded ? 0 : 1,
                                transition: 'opacity 0.2s',
                                pointerEvents: 'none',
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
                    <>
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
                        {docIsPdf ? 'View PDF' : 'View Image'}
                    </div>
                </div>
            </div>

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
    const [lightbox, setLightbox] = useState(null);

    const docs     = booking?.kycDocUrls ?? [];
    const custType = booking?.customerType ?? 'individual';
    const hasAny   = docs.length > 0;

    const status     = booking?.status;
    const isVerified = ['Active', 'Completed'].includes(status);
    const isPending  = status === 'Pending';

    return (
        <>
            <style>{`
                @keyframes kyc-fade    { from { opacity:0 } to { opacity:1 } }
                @keyframes kyc-pop     {
                    from { opacity:0; transform:translate(-50%,-50%) scale(0.94) }
                    to   { opacity:1; transform:translate(-50%,-50%) scale(1) }
                }
                @keyframes kyc-shimmer {
                    0%   { background-position:200% 0 }
                    100% { background-position:-200% 0 }
                }
                @keyframes kyc-spin    {
                    from { transform: rotate(0deg) }
                    to   { transform: rotate(360deg) }
                }
                .kyc-thumb-wrap:hover .kyc-thumb-overlay { background: rgba(37,99,235,0.15) !important; }
                .kyc-thumb-wrap:hover .kyc-thumb-btn     { opacity: 1 !important; }
            `}</style>

            <div className="bp-drawer__section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <p className="bp-drawer__label" style={{ margin: 0 }}>KYC Documents</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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

                {hasAny && (
                    <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: '#9ca3af' }}>
                        {docs.length} document{docs.length !== 1 ? 's' : ''} · click any thumbnail to view
                        {docs.some(u => isPdf(u)) && ' · PDFs open in a viewer with a download option'}
                    </p>
                )}
            </div>

            {lightbox && (
                isPdf(lightbox.url)
                    ? <PdfLightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />
                    : <ImageLightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />
            )}
        </>
    );
}