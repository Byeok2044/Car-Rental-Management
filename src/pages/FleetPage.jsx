/**
 * src/pages/FleetPage.jsx  (UPDATED)
 *
 * Security improvements:
 *  1. uploadImage() now calls GET /api/upload/sign first → gets a server-signed
 *     token → POSTs to Cloudinary using that signature (no API secret on client)
 *  2. Client-side validation: file type whitelist + 10 MB size cap before network
 *  3. No more public unsigned upload preset in env vars (VITE_CLOUDINARY_UPLOAD_PRESET
 *     is no longer used here — it can be removed from the frontend .env)
 *  4. All other logic is identical to the original
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import './Adminpages.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const CAR_TYPES    = ['Sedan', 'SUV', 'Van', 'Bus', 'Coaster', 'MPV'];

// ── Client-side upload constraints (mirrors server constraints) ───────────────
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
const MAX_FILE_SIZE_MB   = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function getToken() {
    return localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
}

async function apiFetch(path, options = {}) {
    const token = getToken();
    const res = await fetch(`${API_BASE_URL}${path}`, {
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

// ── Secure Cloudinary upload ──────────────────────────────────────────────────

/**
 * Validates the file on the client, then:
 *   1. Fetches a short-lived signed token from our own server
 *   2. POSTs the file directly to Cloudinary with that signature
 *
 * The Cloudinary API secret is NEVER sent to or stored on the client.
 *
 * @param {File}   file           - The image File object from <input type="file">
 * @param {string} adminToken     - JWT for the /api/upload/sign call
 * @returns {Promise<string>}     - The secure_url of the uploaded image
 */
async function uploadImageSecure(file, adminToken) {
    // ── 1. Client-side validation ─────────────────────────────────────────────
    if (!file) throw new Error('No file selected.');

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new Error(
            `File type "${file.type}" is not allowed. ` +
            `Please upload a JPEG, PNG, WebP, or AVIF image.`
        );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        throw new Error(
            `File size (${sizeMB} MB) exceeds the ${MAX_FILE_SIZE_MB} MB limit.`
        );
    }

    // ── 2. Get signed upload params from our server ───────────────────────────
    const signRes = await fetch(`${API_BASE_URL}/api/upload/sign`, {
        headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (!signRes.ok) {
        const errData = await signRes.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to get upload signature from server.');
    }

    const {
        signature,
        timestamp,
        api_key,
        cloud_name,
        folder,
        allowed_formats,
        max_file_size,
    } = await signRes.json();

    // ── 3. Upload directly to Cloudinary (signed, no preset needed) ───────────
    const formData = new FormData();
    formData.append('file',            file);
    formData.append('api_key',         api_key);
    formData.append('timestamp',       timestamp);
    formData.append('signature',       signature);
    formData.append('folder',          folder);
    formData.append('allowed_formats', allowed_formats);
    formData.append('max_file_size',   max_file_size);

    const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
        { method: 'POST', body: formData }
    );

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok || uploadData.error) {
        throw new Error(uploadData.error?.message || 'Cloudinary upload failed.');
    }

    return uploadData.secure_url;
}

// ── Car Form Modal ────────────────────────────────────────────────────────────

function CarFormModal({ car, onClose, onSaved }) {
    const isEdit  = !!car;
    const fileRef = useRef(null);

    const [form, setForm] = useState({
        title:       car?.title       || '',
        description: car?.description || '',
        type:        car?.type        || CAR_TYPES[0],
        stock:       car?.stock       ?? 1,
        image:       car?.image       || '',
    });

    const [imagePreview, setImagePreview] = useState(car?.image || '');
    const [imageFile,    setImageFile]    = useState(null);
    const [uploading,    setUploading]    = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [saving,       setSaving]       = useState(false);
    const [error,        setError]        = useState('');
    const [fileError,    setFileError]    = useState('');

    function handleField(e) {
        const { name, value } = e.target;
        setForm(p => ({ ...p, [name]: name === 'stock' ? Number(value) : value }));
    }

    function handleFileChange(e) {
        const file = e.target.files[0];
        if (!file) return;

        setFileError('');

        // Client-side pre-validation for instant UX feedback
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            setFileError(`"${file.name}" is not a supported image type. Please use JPG, PNG, WebP, or AVIF.`);
            e.target.value = '';
            return;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            setFileError(`"${file.name}" (${sizeMB} MB) is too large. Maximum allowed is ${MAX_FILE_SIZE_MB} MB.`);
            e.target.value = '';
            return;
        }

        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        setError('');
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setFileError('');

        let imageUrl = form.image;

        if (imageFile) {
            setUploading(true);
            setUploadProgress('Getting secure upload token…');
            try {
                const token = getToken();
                setUploadProgress('Uploading image to Cloudinary…');
                imageUrl = await uploadImageSecure(imageFile, token);
                setUploadProgress('');
            } catch (err) {
                setError(err.message);
                setUploading(false);
                setUploadProgress('');
                return;
            }
            setUploading(false);
        }

        if (!imageUrl) {
            setError('Please upload a vehicle image.');
            return;
        }

        setSaving(true);
        try {
            const payload = { ...form, image: imageUrl };
            if (isEdit) {
                await apiFetch(`/api/admin/cars/${car._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            } else {
                await apiFetch('/api/admin/cars', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            }
            onSaved();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    const busy = uploading || saving;

    return (
        <div className="fm-overlay">
            <div className="fm-modal">
                <div className="fm-header">
                    <h2>{isEdit ? 'Edit Vehicle' : 'Add New Vehicle'}</h2>
                    <button className="fm-close" onClick={onClose} disabled={busy}>×</button>
                </div>

                <form onSubmit={handleSubmit} className="fm-form">
                    {error && <div className="fm-error">{error}</div>}

                    {/* Image Upload Area */}
                    <div>
                        <div
                            className="fm-img-upload"
                            onClick={() => !busy && fileRef.current?.click()}
                            style={{ cursor: busy ? 'not-allowed' : 'pointer' }}
                        >
                            {imagePreview ? (
                                <img src={imagePreview} alt="preview" className="fm-img-preview" />
                            ) : (
                                <div className="fm-img-placeholder">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                                        strokeLinejoin="round">
                                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                                        <circle cx="8.5" cy="8.5" r="1.5"/>
                                        <polyline points="21 15 16 10 5 21"/>
                                    </svg>
                                    <p>Click to upload image</p>
                                    <span>JPG, PNG, WebP, AVIF · Max {MAX_FILE_SIZE_MB} MB</span>
                                </div>
                            )}
                            {imagePreview && !busy && (
                                <div className="fm-img-overlay">Change Image</div>
                            )}
                        </div>

                        {/* File validation error */}
                        {fileError && (
                            <div style={{
                                marginTop: 8,
                                padding: '8px 12px',
                                background: '#fee2e2',
                                color: '#991b1b',
                                border: '1px solid #fecaca',
                                borderRadius: 8,
                                fontSize: '0.82rem',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 8,
                            }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                                    strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="12" y1="8" x2="12" y2="12"/>
                                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                                {fileError}
                            </div>
                        )}

                        {/* Upload progress */}
                        {uploading && uploadProgress && (
                            <div style={{
                                marginTop: 8,
                                padding: '8px 12px',
                                background: '#eff6ff',
                                color: '#1e40af',
                                border: '1px solid #bfdbfe',
                                borderRadius: 8,
                                fontSize: '0.82rem',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                            }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2.5"
                                    style={{ animation: 'ad-spin 0.8s linear infinite', flexShrink: 0 }}>
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                </svg>
                                {uploadProgress}
                            </div>
                        )}

                        {/* Allowed formats hint */}
                        {!imagePreview && (
                            <p style={{
                                marginTop: 6,
                                fontSize: '0.72rem',
                                color: '#9ca3af',
                                textAlign: 'center',
                            }}>
                                Accepted: JPG · JPEG · PNG · WebP · AVIF &nbsp;|&nbsp; Max {MAX_FILE_SIZE_MB} MB
                            </p>
                        )}
                    </div>

                    <input
                        ref={fileRef}
                        type="file"
                        accept={ALLOWED_EXTENSIONS.join(',')}
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                        disabled={busy}
                    />

                    <div className="fm-row">
                        <div className="fm-group">
                            <label>Vehicle Title *</label>
                            <input
                                name="title"
                                required
                                placeholder="2024 Toyota Camry"
                                value={form.title}
                                onChange={handleField}
                                disabled={busy}
                            />
                        </div>
                        <div className="fm-group">
                            <label>Type *</label>
                            <select name="type" value={form.type} onChange={handleField} disabled={busy}>
                                {CAR_TYPES.map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="fm-group">
                        <label>Description *</label>
                        <textarea
                            name="description"
                            required
                            rows={3}
                            placeholder="Brief vehicle description…"
                            value={form.description}
                            onChange={handleField}
                            disabled={busy}
                        />
                    </div>

                    <div className="fm-group">
                        <label>Stock (units)</label>
                        <input
                            type="number"
                            name="stock"
                            min={0}
                            value={form.stock}
                            onChange={handleField}
                            disabled={busy}
                        />
                    </div>

                    {/* Pricing note */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: 8,
                        padding: '10px 14px',
                    }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                            stroke="#2563eb" strokeWidth="2" strokeLinecap="round"
                            strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#1e40af', lineHeight: 1.5 }}>
                            Pricing is quoted per booking by the admin in the Bookings tab. No rate is set here.
                        </p>
                    </div>

                    <div className="fm-actions">
                        <button
                            type="button"
                            className="fm-btn-cancel"
                            onClick={onClose}
                            disabled={busy}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="fm-btn-save"
                            disabled={busy || !!fileError}
                        >
                            {uploading
                                ? 'Uploading image…'
                                : saving
                                ? 'Saving…'
                                : isEdit
                                ? 'Save Changes'
                                : 'Add Vehicle'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Booking Stats Badges (unchanged) ─────────────────────────────────────────

function BookingStatsBadges({ stats }) {
    if (!stats) return null;
    const items = [
        { label: 'Active',  val: stats.active,  bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' },
        { label: 'Pending', val: stats.pending, bg: '#fef9c3', color: '#854d0e', border: '#fde68a' },
        { label: 'Total',   val: stats.total,   bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
    ].filter(i => i.val > 0);

    if (items.length === 0)
        return <span style={{ fontSize: '0.72rem', color: '#d1d5db', fontStyle: 'italic' }}>No bookings yet</span>;

    return (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {items.map(item => (
                <span key={item.label} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: item.bg, color: item.color,
                    border: `1px solid ${item.border}`,
                    fontSize: '0.68rem', fontWeight: 700,
                    padding: '2px 8px', borderRadius: 20,
                }}>
                    {item.val} {item.label}
                </span>
            ))}
        </div>
    );
}

// ── Main Fleet Page (unchanged logic) ────────────────────────────────────────

export default function FleetPage() {
    const [cars,       setCars]       = useState([]);
    const [bookingMap, setBookingMap] = useState({});
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState('');
    const [search,     setSearch]     = useState('');
    const [modalCar,   setModalCar]   = useState(undefined);
    const [deleting,   setDeleting]   = useState(null);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [carsData, bookingsData] = await Promise.all([
                apiFetch('/api/admin/cars'),
                apiFetch('/api/bookings'),
            ]);

            const cars = Array.isArray(carsData) ? carsData : [];
            setCars(cars);

            const map = {};
            if (Array.isArray(bookingsData)) {
                for (const b of bookingsData) {
                    const id = b.carId?._id || b.carId;
                    if (!id) continue;
                    if (!map[id]) map[id] = { active: 0, pending: 0, total: 0 };
                    map[id].total++;
                    if (b.status === 'Active')  map[id].active++;
                    if (b.status === 'Pending') map[id].pending++;
                }
            }
            setBookingMap(map);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    async function handleDelete(car) {
        if (!window.confirm(`Delete "${car.title}"? This cannot be undone.`)) return;
        setDeleting(car._id);
        try {
            await apiFetch(`/api/admin/cars/${car._id}`, { method: 'DELETE' });
            setCars(prev => prev.filter(c => c._id !== car._id));
        } catch (err) {
            alert(err.message);
        } finally {
            setDeleting(null);
        }
    }

    async function handleStockChange(car, delta) {
        const newStock = Math.max(0, car.stock + delta);
        try {
            await apiFetch(`/api/admin/cars/${car._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stock: newStock }),
            });
            setCars(prev => prev.map(c => c._id === car._id ? { ...c, stock: newStock } : c));
        } catch (err) {
            alert(err.message);
        }
    }

    const filtered = cars.filter(c =>
        [c.title, c.type, c.description].some(f =>
            f?.toLowerCase().includes(search.toLowerCase())
        )
    );

    return (
        <div className="fp-root">
            {/* Toolbar */}
            <div className="fp-toolbar">
                <div className="fp-search-wrap">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                        strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                        className="fp-search"
                        placeholder="Search fleet…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <button className="fp-add-btn" onClick={() => setModalCar(null)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                        strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Add Vehicle
                </button>
            </div>

            {error && <div className="fp-banner fp-banner--error">{error}</div>}

            {loading ? (
                <div className="fp-grid">
                    {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="fp-skeleton" />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="fp-empty">
                    <p>{search ? `No vehicles matching "${search}"` : 'No vehicles in fleet yet.'}</p>
                    {!search && (
                        <button className="fp-add-btn" onClick={() => setModalCar(null)}>
                            Add your first vehicle
                        </button>
                    )}
                </div>
            ) : (
                <div className="fp-grid">
                    {filtered.map(car => {
                        const stats  = bookingMap[car._id] || null;
                        const isLive = stats?.active > 0;
                        return (
                            <div key={car._id} className="fp-card">
                                <div className="fp-card__img-wrap">
                                    <img src={car.image} alt={car.title} className="fp-card__img" />
                                    <span className="fp-card__type">{car.type}</span>
                                    {isLive && (
                                        <span style={{
                                            position: 'absolute', top: 8, left: 8,
                                            display: 'flex', alignItems: 'center', gap: 5,
                                            background: 'rgba(5,150,105,0.92)',
                                            backdropFilter: 'blur(4px)',
                                            color: '#fff', fontSize: '0.65rem', fontWeight: 700,
                                            padding: '3px 9px', borderRadius: 20,
                                            letterSpacing: '0.04em',
                                        }}>
                                            <span style={{
                                                width: 6, height: 6, borderRadius: '50%',
                                                background: '#6ee7b7',
                                                animation: 'fp-pulse 2s infinite',
                                                display: 'inline-block', flexShrink: 0,
                                            }} />
                                            IN USE
                                        </span>
                                    )}
                                </div>
                                <div className="fp-card__body">
                                    <p className="fp-card__title">{car.title}</p>
                                    <p className="fp-card__desc">{car.description}</p>
                                    <div style={{ marginBottom: 8 }}>
                                        <BookingStatsBadges stats={stats} />
                                    </div>
                                    <div className="fp-card__meta">
                                        <span style={{
                                            fontSize: '0.75rem', color: '#9ca3af',
                                            display: 'flex', alignItems: 'center', gap: 5,
                                        }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                                stroke="currentColor" strokeWidth="2">
                                                <line x1="12" y1="1" x2="12" y2="23"/>
                                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                                            </svg>
                                            Quoted per booking
                                        </span>
                                        <div className="fp-stock-ctrl">
                                            <button
                                                className="fp-stock-btn"
                                                onClick={() => handleStockChange(car, -1)}
                                                disabled={car.stock === 0}
                                            >−</button>
                                            <span className={`fp-stock-val${car.stock === 0 ? ' fp-stock-val--empty' : ''}`}>
                                                {car.stock}
                                            </span>
                                            <button
                                                className="fp-stock-btn"
                                                onClick={() => handleStockChange(car, 1)}
                                            >+</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="fp-card__actions">
                                    <button
                                        className="fp-action-btn fp-action-btn--edit"
                                        onClick={() => setModalCar(car)}
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                                            stroke="currentColor" strokeWidth="2.5">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                        </svg>
                                        Edit
                                    </button>
                                    <button
                                        className="fp-action-btn fp-action-btn--delete"
                                        onClick={() => handleDelete(car)}
                                        disabled={deleting === car._id}
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                                            stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="3 6 5 6 21 6"/>
                                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                            <path d="M10 11v6M14 11v6"/>
                                            <path d="M9 6V4h6v2"/>
                                        </svg>
                                        {deleting === car._id ? '…' : 'Delete'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <style>{`
                @keyframes fp-pulse {
                    0%   { box-shadow: 0 0 0 0   rgba(110,231,183,0.5); }
                    70%  { box-shadow: 0 0 0 6px rgba(110,231,183,0);   }
                    100% { box-shadow: 0 0 0 0   rgba(110,231,183,0);   }
                }
                @keyframes ad-spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>

            {modalCar !== undefined && (
                <CarFormModal
                    car={modalCar}
                    onClose={() => setModalCar(undefined)}
                    onSaved={() => { setModalCar(undefined); fetchAll(); }}
                />
            )}
        </div>
    );
}