import React, { useState, useRef, useEffect, useCallback } from 'react';
import Button from '../components/Commons/Button';
import BookingCalendar from '../components/Layout/BookingCalendar';
import './RentModal.css';

// ─── Terms & Conditions Modal ─────────────────────────────────────────────────
function TermsModal({ onClose }) {
    return (
        <>
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(10,14,26,0.75)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 1100,
                }}
            />
            <div style={{
                position: 'fixed',
                top: '10%', left: '35%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1101,
                background: '#fff',
                borderRadius: 16,
                width: '100%',
                maxWidth: 560,
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
                overflow: 'hidden',
                animation: 'modalIn 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
                <div style={{
                    background: '#111827',
                    padding: '18px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        position: 'absolute', top: 0, right: -40,
                        width: 200, height: '100%',
                        background: '#2563eb',
                        transform: 'skewX(-14deg)',
                        opacity: 0.15,
                        pointerEvents: 'none',
                    }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 24, width: 36, height: 3, background: '#ffc107', borderRadius: 2 }} />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <h3 style={{ color: '#fff', margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                            Terms &amp; Conditions
                        </h3>
                        <p style={{ color: 'rgba(255,255,255,0.45)', margin: '3px 0 0', fontSize: '0.75rem' }}>
                            Triple R and A Car Rental — Please read carefully before booking
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            position: 'relative', zIndex: 1,
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#fff', width: 32, height: 32,
                            borderRadius: '50%', cursor: 'pointer',
                            fontSize: '1.2rem', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            lineHeight: 1, fontFamily: 'inherit',
                            transition: 'background 0.2s, transform 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'rotate(0deg)'; }}
                    >×</button>
                </div>

                <div style={{
                    flex: 1, overflowY: 'auto',
                    padding: '24px',
                    fontSize: '0.875rem', color: '#374151', lineHeight: 1.75,
                }}>
                    {[
                        { title: '1. Eligibility & Identification', body: "Renters must be at least 21 years of age and hold a valid government-issued driver's license. A secondary ID and a deposit may be required at the time of pick-up." },
                        { title: '2. Reservation & Payment', body: 'Bookings are confirmed only upon receipt of a quoted price from our team. Payment is accepted via Cash, GCash, or Bank Transfer. Rates are subject to change based on availability and seasonal demand.' },
                        { title: '3. Vehicle Use', body: 'Vehicles may only be operated by the registered renter or an approved additional driver. Subletting, racing, off-road driving on unauthorized terrain, or use for commercial transport is strictly prohibited.' },
                        { title: '4. Fuel Policy', body: 'Vehicles are provided with a full tank and must be returned with a full tank. Failure to do so will result in a refueling charge at market rates plus a service fee.' },
                        { title: '5. Damage & Liability', body: 'The renter is liable for all damage to the vehicle during the rental period, including damage caused by third parties. Any incident must be reported to Triple R and A immediately.' },
                        { title: '6. Cancellation Policy', body: 'Cancellations made more than 48 hours before the scheduled pick-up may be eligible for a full refund. Cancellations within 48 hours or no-shows forfeit any deposit paid.' },
                        { title: '7. Late Returns', body: 'Vehicles returned after the agreed return time will incur additional charges at the applicable daily rate, prorated per hour.' },
                        { title: '8. Traffic & Legal Violations', body: 'All fines, penalties, tolls, and legal fees incurred during the rental period are the sole responsibility of the renter.' },
                        { title: '9. Prohibited Items', body: 'Smoking, transporting illegal substances, or carrying firearms inside any rental vehicle is strictly prohibited.' },
                        { title: '10. Privacy', body: 'Personal information collected during the booking process is used solely for reservation and communication purposes. We do not sell or share your data with third parties.' },
                    ].map((section, i) => (
                        <div key={i} style={{ marginBottom: 18, paddingBottom: 18, borderBottom: i < 9 ? '1px solid #f1f5f9' : 'none' }}>
                            <p style={{ margin: '0 0 5px', fontWeight: 700, color: '#111827', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 22, height: 22, borderRadius: 6, background: '#eff6ff', color: '#2563eb', fontSize: '0.7rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                                {section.title.replace(/^\d+\.\s/, '')}
                            </p>
                            <p style={{ margin: '0 0 0 30px', color: '#4b5563', fontSize: '0.85rem' }}>{section.body}</p>
                        </div>
                    ))}
                    <div style={{ marginTop: 4, padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: '0.82rem', color: '#92400e', fontWeight: 500, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        By checking the box in the booking form, you confirm that you have read, understood, and agree to all Terms &amp; Conditions above.
                    </div>
                </div>

                <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', flexShrink: 0 }}>
                    <button onClick={onClose} style={{ width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
                        onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}>
                        I've Read the Terms
                    </button>
                </div>
            </div>
        </>
    );
}

// ─── Location Picker ──────────────────────────────────────────────────────────
const LOCATION_GROUPS = [
    {
        group: 'Metro Manila',
        locations: [
            { id: 'makati',  label: 'Makati',       address: 'Ayala Ave, Makati City' },
            { id: 'bgc',     label: 'BGC',           address: '9th Ave, Bonifacio Global City' },
            { id: 'ortigas', label: 'Ortigas',       address: 'Emerald Ave, Pasig City' },
            { id: 'qc',      label: 'Quezon City',   address: 'Commonwealth Ave, QC' },
            { id: 'manila',  label: 'Manila',        address: 'Roxas Blvd, Ermita' },
        ],
    },
    {
        group: 'Airport',
        locations: [
            { id: 'naia1', label: 'NAIA Terminal 1', address: 'Paranaque City' },
            { id: 'naia3', label: 'NAIA Terminal 3', address: 'Paranaque City' },
        ],
    },
    {
        group: 'Nearby Provinces',
        locations: [
            { id: 'cavite',  label: 'Cavite',  address: "Governor's Drive, Cavite City" },
            { id: 'laguna',  label: 'Laguna',  address: 'National Rd, Calamba, Laguna' },
            { id: 'bulacan', label: 'Bulacan', address: 'McArthur Hwy, Malolos, Bulacan' },
        ],
    },
];

const ALL_LOCATIONS = LOCATION_GROUPS.flatMap(g => g.locations.map(l => ({ ...l, group: g.group })));

function resolveLocation(id) {
    const loc = ALL_LOCATIONS.find(l => l.id === id);
    return loc ? `${loc.label} — ${loc.address}` : id;
}

function PinIcon({ size = 16, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
    );
}

function ChevronIcon({ open }) {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <polyline points="6 9 12 15 18 9"/>
        </svg>
    );
}

function LocationPicker({ value, onChange, disabled }) {
    const [open, setOpen]       = useState(false);
    const [query, setQuery]     = useState('');
    const wrapRef               = useRef(null);
    const inputRef              = useRef(null);
    const listRef               = useRef(null);
    const [focused, setFocused] = useState(-1);

    const selected = ALL_LOCATIONS.find(l => l.id === value) || null;

    const filtered = query.trim()
        ? ALL_LOCATIONS.filter(l => l.label.toLowerCase().includes(query.toLowerCase()) || l.address.toLowerCase().includes(query.toLowerCase()) || l.group.toLowerCase().includes(query.toLowerCase()))
        : ALL_LOCATIONS;

    const grouped = LOCATION_GROUPS.map(g => ({
        group: g.group,
        locations: filtered.filter(l => l.group === g.group),
    })).filter(g => g.locations.length > 0);

    useEffect(() => {
        function handleClick(e) {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setQuery(''); }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    useEffect(() => {
        if (open) { setFocused(-1); setTimeout(() => inputRef.current?.focus(), 30); }
    }, [open]);

    function handleSelect(loc) { onChange(loc.id); setOpen(false); setQuery(''); }

    function handleKeyDown(e) {
        if (!open) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); } return; }
        if (e.key === 'Escape') { setOpen(false); setQuery(''); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, filtered.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)); }
        else if (e.key === 'Enter' && focused >= 0) { e.preventDefault(); handleSelect(filtered[focused]); }
    }

    useEffect(() => {
        if (focused >= 0 && listRef.current) listRef.current.querySelector(`[data-idx="${focused}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [focused]);

    let flatIdx = 0;

    return (
        <div ref={wrapRef} className={`lp-wrap${open ? ' lp-wrap--open' : ''}${disabled ? ' lp-wrap--disabled' : ''}`} onKeyDown={handleKeyDown}>
            <button type="button" className={`lp-trigger${selected ? ' lp-trigger--selected' : ''}${open ? ' lp-trigger--active' : ''}`}
                onClick={() => !disabled && setOpen(v => !v)} disabled={disabled} aria-haspopup="listbox" aria-expanded={open}>
                <span className="lp-trigger__icon"><PinIcon size={15} color={selected ? 'var(--primary-blue)' : '#9ca3af'} /></span>
                {selected ? (
                    <span className="lp-trigger__selected">
                        <span className="lp-trigger__label">{selected.label}</span>
                        <span className="lp-trigger__address">{selected.address}</span>
                    </span>
                ) : <span className="lp-trigger__placeholder">Select a pickup location…</span>}
                <span className="lp-trigger__chevron"><ChevronIcon open={open} /></span>
            </button>

            {open && (
                <div className="lp-dropdown" role="listbox">
                    <div className="lp-search-wrap">
                        <div className="lp-search-inner">
                            <svg className="lp-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                            <input ref={inputRef} type="text" className="lp-search" placeholder="Search locations…" value={query}
                                onChange={e => { setQuery(e.target.value); setFocused(-1); }} />
                            {query && <button type="button" className="lp-search-clear" onClick={() => setQuery('')}>×</button>}
                        </div>
                    </div>
                    <div className="lp-list" ref={listRef}>
                        {grouped.length === 0 ? <p className="lp-empty">No locations match "<strong>{query}</strong>"</p>
                            : grouped.map(g => (
                                <div key={g.group}>
                                    <p className="lp-group-label">{g.group}</p>
                                    {g.locations.map(loc => {
                                        const idx = flatIdx++;
                                        return (
                                            <button key={loc.id} type="button" role="option" data-idx={idx}
                                                aria-selected={loc.id === value}
                                                className={`lp-option${loc.id === value ? ' lp-option--selected' : ''}${focused === idx ? ' lp-option--focused' : ''}`}
                                                onMouseEnter={() => setFocused(idx)} onClick={() => handleSelect(loc)}>
                                                <span className="lp-option__pin"><PinIcon size={13} color={loc.id === value ? 'var(--primary-blue)' : '#9ca3af'} /></span>
                                                <span className="lp-option__text">
                                                    <span className="lp-option__label">{loc.label}</span>
                                                    <span className="lp-option__address">{loc.address}</span>
                                                </span>
                                                {loc.id === value && (
                                                    <svg className="lp-option__check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary-blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12"/>
                                                    </svg>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Document Upload Component ────────────────────────────────────────────────
function DocUpload({ label, hint, accept = 'image/*,.pdf', value, onChange, required = false }) {
    const fileRef = useRef(null);
    const [preview, setPreview] = useState(null);
    const [dragging, setDragging] = useState(false);

    function handleFile(file) {
        if (!file) return;
        onChange(file);
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = e => setPreview(e.target.result);
            reader.readAsDataURL(file);
        } else {
            setPreview('pdf');
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }

    function handleRemove(e) {
        e.stopPropagation();
        onChange(null);
        setPreview(null);
        if (fileRef.current) fileRef.current.value = '';
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                {label}
                {required && <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>*</span>}
            </label>

            <div
                onClick={() => !value && fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                style={{
                    position: 'relative',
                    border: `1.5px dashed ${dragging ? '#2563eb' : value ? '#22c55e' : '#d1d5db'}`,
                    borderRadius: 10,
                    background: dragging ? '#eff6ff' : value ? '#f0fdf4' : '#fafafa',
                    padding: value ? '10px 12px' : '16px 12px',
                    cursor: value ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    minHeight: 56,
                }}
            >
                {/* Preview / placeholder */}
                {!value && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, pointerEvents: 'none' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <span style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: 500, textAlign: 'center' }}>
                            {hint || 'Click or drag file here'}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#c4c9d4' }}>JPG, PNG, or PDF · Max 5MB</span>
                    </div>
                )}

                {value && preview === 'pdf' && (
                    <>
                        <div style={{ width: 38, height: 38, background: '#fee2e2', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                            </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#166534', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value.name}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#9ca3af' }}>{(value.size / 1024).toFixed(0)} KB · PDF</p>
                        </div>
                    </>
                )}

                {value && preview && preview !== 'pdf' && (
                    <>
                        <img src={preview} alt="preview" style={{ width: 52, height: 38, objectFit: 'cover', borderRadius: 6, border: '1px solid #d1fae5', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: '#166534', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value.name}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#9ca3af' }}>{(value.size / 1024).toFixed(0)} KB</p>
                        </div>
                    </>
                )}

                {value && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button type="button" onClick={() => fileRef.current?.click()}
                            style={{ padding: '5px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, color: '#2563eb', fontFamily: 'inherit' }}>
                            Change
                        </button>
                        <button type="button" onClick={handleRemove}
                            style={{ padding: '5px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                )}

                <input ref={fileRef} type="file" accept={accept} style={{ display: 'none' }}
                    onChange={e => handleFile(e.target.files[0])} />
            </div>

            {value && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>Uploaded successfully</span>
                </div>
            )}
        </div>
    );
}

// ─── Customer Type Toggle ─────────────────────────────────────────────────────
function CustomerTypeToggle({ value, onChange }) {
    return (
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, gap: 3, marginBottom: 4 }}>
            {[
                { key: 'individual', label: 'Individual', icon: (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                )},
                { key: 'business', label: 'Business', icon: (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8L6 7h12z"/>
                    </svg>
                )},
            ].map(({ key, label, icon }) => (
                <button key={key} type="button" onClick={() => onChange(key)}
                    style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '8px 12px', borderRadius: 7, border: 'none',
                        cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600,
                        fontFamily: 'inherit',
                        background: value === key ? '#fff' : 'transparent',
                        color: value === key ? '#111827' : '#64748b',
                        boxShadow: value === key ? '0 1px 4px rgba(0,0,0,0.09)' : 'none',
                        transition: 'all 0.15s',
                    }}>
                    {icon}
                    {label}
                </button>
            ))}
        </div>
    );
}

// ─── Cart Item ────────────────────────────────────────────────────────────────
function CartItem({ item, allCars, onUpdate, onRemove, index, error }) {
    const [calOpen, setCalOpen] = useState(index === 0);
    const maxQty = item.car.stock;

    function handleDateChange({ start, end }) {
        if (start && end) {
            const days = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
            onUpdate({ pickupDate: start.toISOString().split('T')[0], rentalDays: days });
        } else if (start) {
            onUpdate({ pickupDate: start.toISOString().split('T')[0], rentalDays: 1 });
        } else {
            onUpdate({ pickupDate: '', rentalDays: 1 });
        }
    }

    return (
        <div className="cart-item">
            <div className="cart-item__header">
                <div className="cart-item__vehicle">
                    <img src={item.car.image} alt={item.car.title} className="cart-item__thumb" />
                    <div>
                        <p className="cart-item__title">{item.car.title}</p>
                        <span className="cart-item__type">{item.car.type}</span>
                    </div>
                </div>
                <div className="cart-item__controls">
                    <div className="qty-control">
                        <button type="button" className="qty-btn"
                            onClick={() => onUpdate({ qty: Math.max(1, item.qty - 1) })}
                            disabled={item.qty <= 1}>−</button>
                        <span className="qty-value">{item.qty}</span>
                        <button type="button" className="qty-btn"
                            onClick={() => onUpdate({ qty: Math.min(maxQty, item.qty + 1) })}
                            disabled={item.qty >= maxQty}>+</button>
                        <span className="qty-stock">/ {maxQty} avail.</span>
                    </div>
                    <button type="button" className="cart-item__remove" onClick={onRemove} title="Remove">
                        <TrashIcon />
                    </button>
                </div>
            </div>
            <button type="button" className="cart-item__toggle" onClick={() => setCalOpen(v => !v)}>
                <span>
                    {item.pickupDate
                        ? `${item.pickupDate}  ·  ${item.rentalDays} day${item.rentalDays > 1 ? 's' : ''}`
                        : 'Select dates'}
                    {item.pickupLocation ? `  ·  ${ALL_LOCATIONS.find(l => l.id === item.pickupLocation)?.label}` : ''}
                </span>
                <ChevronIcon open={calOpen} />
            </button>

            {calOpen && (
                <div className="cart-item__details" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div className="cart-item__cal">
                        <p className="cart-item__section-label">Rental Dates</p>
                        <BookingCalendar onDateSelect={handleDateChange} savedStartDate={item.pickupDate} savedDays={item.rentalDays} />
                    </div>
                    <div className="cart-item__loc">
                        <p className="cart-item__section-label">Pickup Location</p>
                        <LocationPicker value={item.pickupLocation} onChange={(id) => onUpdate({ pickupLocation: id })} />
                    </div>

                    {error && (
                        <div style={{ marginTop: '5px', padding: '10px 12px', background: '#fff1f2', borderRadius: '6px', color: '#9f1239', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
                            <span>{error}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Add Vehicle Panel ────────────────────────────────────────────────────────
function AddVehiclePanel({ allCars, cartCarIds, onAdd }) {
    const [open, setOpen] = useState(false);
    const available = allCars.filter(c => c.stock > 0 && !cartCarIds.includes(c._id));
    if (available.length === 0) return null;

    return (
        <div className="add-vehicle">
            <button type="button" className="add-vehicle__trigger" onClick={() => setOpen(v => !v)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add another vehicle
                <ChevronIcon open={open} />
            </button>

            {open && (
                <div className="add-vehicle__list" style={{ position: 'absolute', top: '100%', left: 0, width: '100%', zIndex: 9999, background: 'white', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', maxHeight: '300px', overflowY: 'auto', borderRadius: '8px', marginTop: '8px' }}>
                    {available.map(car => (
                        <button key={car._id} type="button" className="add-vehicle__option" onClick={() => { onAdd(car); setOpen(false); }}>
                            <img src={car.image} alt={car.title} className="add-vehicle__thumb" />
                            <div className="add-vehicle__info">
                                <span className="add-vehicle__title">{car.title}</span>
                                <span className="add-vehicle__meta">{car.type} · {car.stock} available</span>
                            </div>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary-blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Section Divider ──────────────────────────────────────────────────────────
function SectionLabel({ children, icon }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, background: '#eff6ff', borderRadius: 6, color: '#2563eb', flexShrink: 0 }}>
                {icon}
            </div>
            <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280' }}>{children}</p>
            <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
        </div>
    );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
function RentModal({ car, allCars = [], onClose, onConfirm }) {
    const [customerType, setCustomerType] = useState('individual'); // 'individual' | 'business'

    const [customer, setCustomer] = useState({
        fullName: '',
        phone:    '',
        email:    '',
    });

    // Individual docs
    const [idFile,      setIdFile]      = useState(null); // Driver's License or Valid ID
    const [selfieFile,  setSelfieFile]  = useState(null); // Optional selfie with ID

    // Business docs
    const [busName,     setBusName]     = useState('');   // Business/company name
    const [authPerson,  setAuthPerson]  = useState('');   // Name of authorized person
    const [authPhone,   setAuthPhone]   = useState('');   // Company contact number
    const [authEmail,   setAuthEmail]   = useState('');   // Company contact email
    const [bizRegFile,  setBizRegFile]  = useState(null); // Business registration doc
    const [authIdFile,  setAuthIdFile]  = useState(null); // Authorized person's ID

    const [cart, setCart] = useState([{
        car,
        qty:            1,
        pickupDate:     '',
        rentalDays:     1,
        pickupLocation: '',
    }]);

    const [agreedToTerms,  setAgreedToTerms]  = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [termsError,     setTermsError]     = useState(false);
    const [submitting,     setSubmitting]     = useState(false);
    const [submitted,      setSubmitted]      = useState(false);
    const [errorMap,       setErrorMap]       = useState({});
    const [docError,       setDocError]       = useState('');

    const updateItem = useCallback((index, patch) => {
        setCart(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item));
    }, []);

    const removeItem  = useCallback((index) => { setCart(prev => prev.filter((_, i) => i !== index)); }, []);
    const addVehicle  = useCallback((newCar) => {
        setCart(prev => [...prev, { car: newCar, qty: 1, pickupDate: '', rentalDays: 1, pickupLocation: '' }]);
    }, []);

    const cartCarIds    = cart.map(i => i.car._id);
    const totalVehicles = cart.reduce((sum, i) => sum + i.qty, 0);
    const totalCost     = cart.reduce((sum, item) => sum + (item.car.dailyRate ?? 0) * item.qty * item.rentalDays, 0);

    function resetForm() {
        setSubmitted(false);
        setCart([]);
        setErrorMap({});
        setDocError('');
        setTermsError(false);
        setAgreedToTerms(false);
        setCustomer({ fullName: '', phone: '', email: '' });
        setIdFile(null); setSelfieFile(null);
        setBusName(''); setAuthPerson(''); setAuthPhone(''); setAuthEmail('');
        setBizRegFile(null); setAuthIdFile(null);
        setCustomerType('individual');
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMap({});
        setDocError('');

        // Cart validation
        const newErrors = {};
        cart.forEach(item => {
            const missing = [];
            if (!item.pickupDate)     missing.push('date');
            if (!item.pickupLocation) missing.push('pickup location');
            if (missing.length > 0) newErrors[item.car._id] = `Please select a ${missing.join(' and ')}.`;
        });
        if (Object.keys(newErrors).length > 0) { setErrorMap(newErrors); return; }

        // Document validation
        if (customerType === 'individual') {
            if (!idFile) { setDocError("Please upload your Driver's License or valid government ID."); return; }
        } else {
            if (!bizRegFile) { setDocError('Please upload your Business Registration document.'); return; }
            if (!authIdFile) { setDocError("Please upload the authorized person's valid ID."); return; }
            if (!authPerson.trim()) { setDocError('Please enter the name of the authorized person.'); return; }
        }

        if (!agreedToTerms) {
            setTermsError(true);
            document.getElementById('terms-checkbox-area')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        setSubmitting(true);
        try {
            const bookings = cart.map(item => ({
                carId:          item.car._id,
                qty:            item.qty,
                customerName:   customerType === 'business'
                    ? `${authPerson.trim()} (${busName.trim() || 'Business'})`
                    : customer.fullName,
                customerEmail:  customerType === 'business' ? authEmail : customer.email,
                customerPhone:  customerType === 'business' ? authPhone : customer.phone,
                startDate:      new Date(item.pickupDate).toISOString(),
                endDate:        (() => {
                    const d = new Date(item.pickupDate);
                    d.setDate(d.getDate() + item.rentalDays - 1);
                    return d.toISOString();
                })(),
                rentalDays:     item.rentalDays,
                pickupLocation: resolveLocation(item.pickupLocation),
            }));

            await onConfirm(bookings);
            setSubmitted(true);
        } catch (err) {
            console.error('Booking failed', err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            {showTermsModal && <TermsModal onClose={() => setShowTermsModal(false)} />}

            <div className="modal-overlay">
                <div className="modal-content booking-modal booking-modal--wide">
                    <div className="modal-header">
                        <div>
                            {submitted ? (
                                <>
                                    <h2>Booking Confirmed</h2>
                                    <p className="modal-header__sub">{totalVehicles} vehicle{totalVehicles !== 1 ? 's' : ''} · {cart.length} type{cart.length !== 1 ? 's' : ''}</p>
                                </>
                            ) : (
                                <>
                                    <h2>Book Your Vehicles</h2>
                                    <p className="modal-header__sub">{totalVehicles} vehicle{totalVehicles !== 1 ? 's' : ''} · {cart.length} type{cart.length !== 1 ? 's' : ''}</p>
                                </>
                            )}
                        </div>
                        <button className="close-x" onClick={onClose} disabled={submitting}>&times;</button>
                    </div>

                    <div className="modal-body-split">
                        {submitted ? (
                            <div style={{ gridColumn: '1 / -1', width: '100%', padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f0fdf4', border: '2px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                </div>
                                <h2 style={{ color: 'black', marginBottom: '10px' }}>Thank You!</h2>
                                <p style={{ fontSize: '1.1rem', marginBottom: '25px', color: '#6b7280' }}>
                                    Your booking request has been received. Our team will review your documents and get back to you.
                                </p>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <Button onClick={resetForm}>Book Another</Button>
                                    <button className="cancel-btn" onClick={onClose}>Close Window</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* ── LEFT: Cart ── */}
                                <div className="modal-left">
                                    <p className="modal-section-label">Your Selection</p>

                                    <div className="cart-list">
                                        {cart.map((item, i) => (
                                            <CartItem key={item.car._id} item={item} allCars={allCars} index={i}
                                                onUpdate={(patch) => updateItem(i, patch)}
                                                onRemove={() => removeItem(i)}
                                                error={errorMap[item.car._id]} />
                                        ))}
                                    </div>

                                    <div style={{ position: 'relative', zIndex: 50, marginTop: '3px' }}>
                                        <AddVehiclePanel allCars={allCars} cartCarIds={cartCarIds} onAdd={addVehicle} />
                                    </div>

                                    {/* Terms */}
                                    <div id="terms-checkbox-area" style={{
                                        background: termsError ? '#fef2f2' : agreedToTerms ? '#f0fdf4' : '#f8fafc',
                                        border: `1.5px solid ${termsError ? '#fca5a5' : agreedToTerms ? '#bbf7d0' : '#e2e8f0'}`,
                                        borderRadius: 10, padding: '14px 16px', transition: 'all 0.2s',
                                    }}>
                                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
                                            <div onClick={() => { setAgreedToTerms(v => !v); setTermsError(false); }}
                                                style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${termsError ? '#ef4444' : agreedToTerms ? '#16a34a' : '#d1d5db'}`, background: agreedToTerms ? '#16a34a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, transition: 'all 0.18s', cursor: 'pointer' }}>
                                                {agreedToTerms && (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12"/>
                                                    </svg>
                                                )}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ margin: 0, fontSize: '0.85rem', color: termsError ? '#b91c1c' : '#374151', fontWeight: 500, lineHeight: 1.5 }}>
                                                    I have read and agree to the{' '}
                                                    <button type="button" onClick={e => { e.preventDefault(); setShowTermsModal(true); }}
                                                        style={{ background: 'none', border: 'none', padding: 0, color: '#2563eb', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', textUnderlineOffset: 2 }}>
                                                        Terms &amp; Conditions
                                                    </button>
                                                    {' '}of Triple R and A Car Rental.
                                                </p>
                                                {termsError && (
                                                    <p style={{ margin: '5px 0 0', fontSize: '0.78rem', color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                                        You must agree to the Terms &amp; Conditions to proceed.
                                                    </p>
                                                )}
                                                {agreedToTerms && (
                                                    <p style={{ margin: '5px 0 0', fontSize: '0.78rem', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                        Terms agreed — you're good to go!
                                                    </p>
                                                )}
                                            </div>
                                        </label>
                                    </div>

                                    {/* Order Summary */}
                                    <div className="order-summary">
                                        <p className="order-summary__label">Order Summary</p>
                                        {cart.map(item => (
                                            <div key={item.car._id} className="order-summary__row">
                                                <span>{item.car.title} × {item.qty} · {item.rentalDays}d</span>
                                                <span>{item.car.dailyRate ? `₱${(item.car.dailyRate * item.qty * item.rentalDays).toLocaleString()}` : '—'}</span>
                                            </div>
                                        ))}
                                        {totalCost > 0 && (
                                            <div className="order-summary__total">
                                                <span>Total</span>
                                                <span>₱{totalCost.toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ── RIGHT: Form ── */}
                                <div className="modal-right">
                                    <form onSubmit={handleSubmit} className="rental-form">

                                        {/* Customer Type Toggle */}
                                        <div>
                                            <p className="modal-section-label" style={{ marginBottom: 8 }}>Customer Type</p>
                                            <CustomerTypeToggle value={customerType} onChange={(v) => { setCustomerType(v); setDocError(''); }} />
                                        </div>

                                        {/* ── INDIVIDUAL ── */}
                                        {customerType === 'individual' && (
                                            <>
                                                <SectionLabel icon={
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                                                    </svg>
                                                }>Personal Information</SectionLabel>

                                                <div className="form-group">
                                                    <label>Full Name</label>
                                                    <input type="text" required placeholder="Juan Dela Cruz"
                                                        value={customer.fullName}
                                                        onChange={e => setCustomer(p => ({ ...p, fullName: e.target.value }))}
                                                        disabled={submitting} />
                                                </div>

                                                <div className="form-group">
                                                    <label>Phone Number</label>
                                                    <input type="tel" required placeholder="0912 345 6789"
                                                        value={customer.phone}
                                                        onChange={e => {
                                                            const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
                                                            setCustomer(p => ({ ...p, phone: raw }));
                                                        }}
                                                        pattern="^09\d{9}$"
                                                        title="Enter a valid Philippine mobile number (e.g. 09123456789)"
                                                        disabled={submitting} />
                                                    {customer.phone.length > 0 && !/^09\d{9}$/.test(customer.phone) && (
                                                        <span className="field-error">Must be 11 digits starting with 09</span>
                                                    )}
                                                </div>

                                                <div className="form-group">
                                                    <label>Email Address</label>
                                                    <input type="email" required placeholder="juan@example.com"
                                                        value={customer.email}
                                                        onChange={e => setCustomer(p => ({ ...p, email: e.target.value }))}
                                                        disabled={submitting} />
                                                </div>

                                                <SectionLabel icon={
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="7" y1="15" x2="10" y2="15"/>
                                                    </svg>
                                                }>Identity Verification (KYC)</SectionLabel>

                                                {/* KYC info banner */}
                                                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                                                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                                    </svg>
                                                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#92400e', lineHeight: 1.5 }}>
                                                        Before renting, we verify customer identity. Please upload a clear photo or scan of your ID.
                                                    </p>
                                                </div>

                                                <DocUpload
                                                    label="Driver's License or Valid Government ID"
                                                    hint="Upload Driver's License, Passport, SSS, PhilHealth, or any gov't ID"
                                                    accept="image/*,.pdf"
                                                    value={idFile}
                                                    onChange={setIdFile}
                                                    required
                                                />

                                                <DocUpload
                                                    label="Selfie Holding Your ID (Optional)"
                                                    hint="A photo of you holding your ID for faster verification"
                                                    accept="image/*"
                                                    value={selfieFile}
                                                    onChange={setSelfieFile}
                                                />
                                            </>
                                        )}

                                        {/* ── BUSINESS ── */}
                                        {customerType === 'business' && (
                                            <>
                                                <SectionLabel icon={
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8L6 7h12z"/>
                                                    </svg>
                                                }>Business Information</SectionLabel>

                                                <div className="form-group">
                                                    <label>Company / Business Name</label>
                                                    <input type="text" required placeholder="Acme Corporation"
                                                        value={busName}
                                                        onChange={e => setBusName(e.target.value)}
                                                        disabled={submitting} />
                                                </div>

                                                <SectionLabel icon={
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                                                    </svg>
                                                }>Authorized Representative</SectionLabel>

                                                <div className="form-group">
                                                    <label>Name of Authorized Person</label>
                                                    <input type="text" required placeholder="Maria Santos"
                                                        value={authPerson}
                                                        onChange={e => setAuthPerson(e.target.value)}
                                                        disabled={submitting} />
                                                </div>

                                                <div className="form-group">
                                                    <label>Company Contact Number</label>
                                                    <input type="tel" required placeholder="0912 345 6789"
                                                        value={authPhone}
                                                        onChange={e => {
                                                            const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
                                                            setAuthPhone(raw);
                                                        }}
                                                        disabled={submitting} />
                                                    {authPhone.length > 0 && !/^09\d{9}$/.test(authPhone) && (
                                                        <span className="field-error">Must be 11 digits starting with 09</span>
                                                    )}
                                                </div>

                                                <div className="form-group">
                                                    <label>Company Email Address</label>
                                                    <input type="email" required placeholder="info@company.com"
                                                        value={authEmail}
                                                        onChange={e => setAuthEmail(e.target.value)}
                                                        disabled={submitting} />
                                                </div>

                                                <SectionLabel icon={
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                                        <polyline points="14 2 14 8 20 8"/>
                                                    </svg>
                                                }>Business Documents (KYC)</SectionLabel>

                                                {/* KYC info banner for business */}
                                                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                                                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                                    </svg>
                                                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#92400e', lineHeight: 1.5 }}>
                                                        Business clients must provide registration documents and the authorized representative's valid ID.
                                                    </p>
                                                </div>

                                                <DocUpload
                                                    label="Business Registration Document"
                                                    hint="DTI Certificate, SEC Registration, or Business Permit"
                                                    accept="image/*,.pdf"
                                                    value={bizRegFile}
                                                    onChange={setBizRegFile}
                                                    required
                                                />

                                                <DocUpload
                                                    label="Authorized Person's Valid ID"
                                                    hint="Driver's License, Passport, or any government-issued ID"
                                                    accept="image/*,.pdf"
                                                    value={authIdFile}
                                                    onChange={setAuthIdFile}
                                                    required
                                                />
                                            </>
                                        )}

                                        {/* Document error */}
                                        {docError && (
                                            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                                                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                                </svg>
                                                <p style={{ margin: 0, fontSize: '0.82rem', color: '#b91c1c', fontWeight: 500 }}>{docError}</p>
                                            </div>
                                        )}

                                        <div className="modal-actions">
                                            <button type="button" className="cancel-btn" onClick={onClose} disabled={submitting}>Cancel</button>
                                            <Button type="submit" className="confirm-btn" disabled={submitting || cart.length === 0}>
                                                {submitting ? 'Confirming…' : `Confirm ${totalVehicles} Vehicle${totalVehicles !== 1 ? 's' : ''}`}
                                            </Button>
                                        </div>
                                    </form>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export default RentModal;