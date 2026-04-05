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
                {/* Header */}
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
                        <h3 style={{ color: '#fff', margin: 0, fontSize: '1.1rem', fontWeight: 700, }}>
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

                {/* Scrollable body */}
                <div style={{
                    flex: 1, overflowY: 'auto',
                    padding: '24px',
                    fontSize: '0.875rem', color: '#374151', lineHeight: 1.75,
                }}>
                    {[
                        {
                            title: '1. Eligibility & Identification',
                            body: "Renters must be at least 21 years of age and hold a valid government-issued driver's license. A secondary ID and a deposit may be required at the time of pick-up.",
                        },
                        {
                            title: '2. Reservation & Payment',
                            body: 'Bookings are confirmed only upon receipt of a quoted price from our team. Payment is accepted via Cash, GCash, or Bank Transfer. Rates are subject to change based on availability and seasonal demand.',
                        },
                        {
                            title: '3. Vehicle Use',
                            body: 'Vehicles may only be operated by the registered renter or an approved additional driver. Subletting, racing, off-road driving on unauthorized terrain, or use for commercial transport is strictly prohibited.',
                        },
                        {
                            title: '4. Fuel Policy',
                            body: 'Vehicles are provided with a full tank and must be returned with a full tank. Failure to do so will result in a refueling charge at market rates plus a service fee.',
                        },
                        {
                            title: '5. Damage & Liability',
                            body: 'The renter is liable for all damage to the vehicle during the rental period, including damage caused by third parties. Any incident must be reported to Triple R and A immediately. Do not admit liability to any third party.',
                        },
                        {
                            title: '6. Cancellation Policy',
                            body: 'Cancellations made more than 48 hours before the scheduled pick-up may be eligible for a full refund. Cancellations within 48 hours or no-shows forfeit any deposit paid.',
                        },
                        {
                            title: '7. Late Returns',
                            body: 'Vehicles returned after the agreed return time will incur additional charges at the applicable daily rate, prorated per hour. Please contact us if you anticipate a delay.',
                        },
                        {
                            title: '8. Traffic & Legal Violations',
                            body: 'All fines, penalties, tolls, and legal fees incurred during the rental period are the sole responsibility of the renter. These will be charged to the renter upon notification.',
                        },
                        {
                            title: '9. Prohibited Items',
                            body: 'Smoking, transporting illegal substances, or carrying firearms inside any rental vehicle is strictly prohibited and may result in immediate termination of the rental agreement without refund.',
                        },
                        {
                            title: '10. Privacy',
                            body: 'Personal information collected during the booking process is used solely for reservation and communication purposes. We do not sell or share your data with third parties.',
                        },
                    ].map((section, i) => (
                        <div key={i} style={{ marginBottom: 18, paddingBottom: 18, borderBottom: i < 9 ? '1px solid #f1f5f9' : 'none' }}>
                            <p style={{
                                margin: '0 0 5px',
                                fontWeight: 700,
                                color: '#111827',
                                fontSize: '0.875rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                            }}>
                                <span style={{
                                    width: 22, height: 22, borderRadius: 6,
                                    background: '#eff6ff', color: '#2563eb',
                                    fontSize: '0.7rem', fontWeight: 800,
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                }}>{i + 1}</span>
                                {section.title.replace(/^\d+\.\s/, '')}
                            </p>
                            <p style={{ margin: '0 0 0 30px', color: '#4b5563', fontSize: '0.85rem' }}>{section.body}</p>
                        </div>
                    ))}

                    <div style={{
                        marginTop: 4,
                        padding: '12px 14px',
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: 8,
                        fontSize: '0.82rem',
                        color: '#92400e',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                    }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        By checking the box in the booking form, you confirm that you have read, understood, and agree to all Terms &amp; Conditions above.
                    </div>
                </div>

                <div style={{
                    padding: '14px 24px',
                    borderTop: '1px solid #f1f5f9',
                    background: '#f8fafc',
                    flexShrink: 0,
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            width: '100%',
                            padding: '10px',
                            background: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            transition: 'background 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
                        onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
                    >
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

const ALL_LOCATIONS = LOCATION_GROUPS.flatMap(g =>
    g.locations.map(l => ({ ...l, group: g.group }))
);

function resolveLocation(id) {
    const loc = ALL_LOCATIONS.find(l => l.id === id);
    return loc ? `${loc.label} — ${loc.address}` : id;
}

function PinIcon({ size = 16, color = 'currentColor' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
            stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
        </svg>
    );
}

function ChevronIcon({ open }) {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
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
        ? ALL_LOCATIONS.filter(l =>
            l.label.toLowerCase().includes(query.toLowerCase()) ||
            l.address.toLowerCase().includes(query.toLowerCase()) ||
            l.group.toLowerCase().includes(query.toLowerCase())
          )
        : ALL_LOCATIONS;

    const grouped = LOCATION_GROUPS.map(g => ({
        group: g.group,
        locations: filtered.filter(l => l.group === g.group),
    })).filter(g => g.locations.length > 0);

    useEffect(() => {
        function handleClick(e) {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) {
                setOpen(false);
                setQuery('');
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    useEffect(() => {
        if (open) {
            setFocused(-1);
            setTimeout(() => inputRef.current?.focus(), 30);
        }
    }, [open]);

    function handleSelect(loc) {
        onChange(loc.id);
        setOpen(false);
        setQuery('');
    }

    function handleKeyDown(e) {
        if (!open) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); }
            return;
        }
        if (e.key === 'Escape') { setOpen(false); setQuery(''); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, filtered.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)); }
        else if (e.key === 'Enter' && focused >= 0) { e.preventDefault(); handleSelect(filtered[focused]); }
    }

    useEffect(() => {
        if (focused >= 0 && listRef.current) {
            listRef.current.querySelector(`[data-idx="${focused}"]`)?.scrollIntoView({ block: 'nearest' });
        }
    }, [focused]);

    let flatIdx = 0;

    return (
        <div
            ref={wrapRef}
            className={`lp-wrap${open ? ' lp-wrap--open' : ''}${disabled ? ' lp-wrap--disabled' : ''}`}
            onKeyDown={handleKeyDown}
        >
            <button
                type="button"
                className={`lp-trigger${selected ? ' lp-trigger--selected' : ''}${open ? ' lp-trigger--active' : ''}`}
                onClick={() => !disabled && setOpen(v => !v)}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className="lp-trigger__icon">
                    <PinIcon size={15} color={selected ? 'var(--primary-blue)' : '#9ca3af'} />
                </span>
                {selected ? (
                    <span className="lp-trigger__selected">
                        <span className="lp-trigger__label">{selected.label}</span>
                        <span className="lp-trigger__address">{selected.address}</span>
                    </span>
                ) : (
                    <span className="lp-trigger__placeholder">Select a pickup location…</span>
                )}
                <span className="lp-trigger__chevron"><ChevronIcon open={open} /></span>
            </button>

            {open && (
                <div className="lp-dropdown" role="listbox">
                    <div className="lp-search-wrap">
                        <div className="lp-search-inner">
                            <svg className="lp-search-icon" width="14" height="14" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" strokeWidth="2.5"
                                strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                            <input
                                ref={inputRef}
                                type="text"
                                className="lp-search"
                                placeholder="Search locations…"
                                value={query}
                                onChange={e => { setQuery(e.target.value); setFocused(-1); }}
                            />
                            {query && (
                                <button type="button" className="lp-search-clear" onClick={() => setQuery('')}>×</button>
                            )}
                        </div>
                    </div>
                    <div className="lp-list" ref={listRef}>
                        {grouped.length === 0 ? (
                            <p className="lp-empty">No locations match "<strong>{query}</strong>"</p>
                        ) : grouped.map(g => (
                            <div key={g.group}>
                                <p className="lp-group-label">{g.group}</p>
                                {g.locations.map(loc => {
                                    const idx = flatIdx++;
                                    return (
                                        <button key={loc.id} type="button" role="option" data-idx={idx}
                                            aria-selected={loc.id === value}
                                            className={`lp-option${loc.id === value ? ' lp-option--selected' : ''}${focused === idx ? ' lp-option--focused' : ''}`}
                                            onMouseEnter={() => setFocused(idx)}
                                            onClick={() => handleSelect(loc)}>
                                            <span className="lp-option__pin">
                                                <PinIcon size={13} color={loc.id === value ? 'var(--primary-blue)' : '#9ca3af'} />
                                            </span>
                                            <span className="lp-option__text">
                                                <span className="lp-option__label">{loc.label}</span>
                                                <span className="lp-option__address">{loc.address}</span>
                                            </span>
                                            {loc.id === value && (
                                                <svg className="lp-option__check" width="14" height="14"
                                                    viewBox="0 0 24 24" fill="none" stroke="var(--primary-blue)"
                                                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

// ─── Cart Item ────────────────────────────────────────────────────────────────
function CartItem({ item, allCars, onUpdate, onRemove, index }) {
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
                <div className="cart-item__details">
                    <div className="cart-item__cal">
                        <p className="cart-item__section-label">Rental Dates</p>
                        <BookingCalendar onDateSelect={handleDateChange} />
                    </div>
                    <div className="cart-item__loc">
                        <p className="cart-item__section-label">Pickup Location</p>
                        <LocationPicker
                            value={item.pickupLocation}
                            onChange={(id) => onUpdate({ pickupLocation: id })}
                        />
                    </div>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add another vehicle
                <ChevronIcon open={open} />
            </button>

            {open && (
                <div className="add-vehicle__list">
                    {available.map(car => (
                        <button key={car._id} type="button" className="add-vehicle__option"
                            onClick={() => { onAdd(car); setOpen(false); }}>
                            <img src={car.image} alt={car.title} className="add-vehicle__thumb" />
                            <div className="add-vehicle__info">
                                <span className="add-vehicle__title">{car.title}</span>
                                <span className="add-vehicle__meta">{car.type} · {car.stock} available</span>
                            </div>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                stroke="var(--primary-blue)" strokeWidth="2.5"
                                strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
function RentModal({ car, allCars = [], onClose, onConfirm }) {
    const [customer, setCustomer] = useState({
        fullName: '',
        phone:    '',
        email:    '',
    });

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
    const [submitting,     setSubmitting]      = useState(false);

    const updateItem = useCallback((index, patch) => {
        setCart(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item));
    }, []);

    const removeItem = useCallback((index) => {
        setCart(prev => prev.filter((_, i) => i !== index));
    }, []);

    const addVehicle = useCallback((newCar) => {
        setCart(prev => [...prev, {
            car:            newCar,
            qty:            1,
            pickupDate:     '',
            rentalDays:     1,
            pickupLocation: '',
        }]);
    }, []);

    const cartCarIds = cart.map(i => i.car._id);

    const totalCost = cart.reduce((sum, item) => {
        const rate = item.car.dailyRate ?? 0;
        return sum + rate * item.qty * item.rentalDays;
    }, 0);
    const totalVehicles = cart.reduce((sum, i) => sum + i.qty, 0);

    const handleSubmit = async (e) => {
        e.preventDefault();

        for (let i = 0; i < cart.length; i++) {
            const item = cart[i];
            if (!item.pickupDate) {
                alert(`Please select rental dates for: ${item.car.title}`);
                return;
            }
            if (!item.pickupLocation) {
                alert(`Please select a pickup location for: ${item.car.title}`);
                return;
            }
        }

        if (!agreedToTerms) {
            setTermsError(true);
            // Scroll the terms checkbox into view
            document.getElementById('terms-checkbox-area')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        setSubmitting(true);
        try {
            const bookings = cart.map(item => ({
                carId:          item.car._id,
                qty:            item.qty,
                customerName:   customer.fullName,
                customerEmail:  customer.email,
                customerPhone:  customer.phone,
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
                            <h2>Book Your Vehicles</h2>
                            <p className="modal-header__sub">
                                {totalVehicles} vehicle{totalVehicles !== 1 ? 's' : ''} · {cart.length} type{cart.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <button className="close-x" onClick={onClose} disabled={submitting}>&times;</button>
                    </div>

                    <div className="modal-body-split">
                        {/* LEFT: Cart */}
                        <div className="modal-left">
                            <p className="modal-section-label">Your Selection</p>

                            <div className="cart-list">
                                {cart.map((item, i) => (
                                    <CartItem
                                        key={item.car._id}
                                        item={item}
                                        allCars={allCars}
                                        index={i}
                                        onUpdate={(patch) => updateItem(i, patch)}
                                        onRemove={() => removeItem(i)}
                                    />
                                ))}
                            </div>

                            <AddVehiclePanel
                                allCars={allCars}
                                cartCarIds={cartCarIds}
                                onAdd={addVehicle}
                            />

                            {/* ── Terms & Conditions checkbox ── */}
                            <div
                                id="terms-checkbox-area"
                                style={{
                                    background: termsError ? '#fef2f2' : agreedToTerms ? '#f0fdf4' : '#f8fafc',
                                    border: `1.5px solid ${termsError ? '#fca5a5' : agreedToTerms ? '#bbf7d0' : '#e2e8f0'}`,
                                    borderRadius: 10,
                                    padding: '14px 16px',
                                    transition: 'all 0.2s',
                                }}
                            >
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 12,
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                }}>
                                    {/* Custom checkbox */}
                                    <div
                                        onClick={() => {
                                            setAgreedToTerms(v => !v);
                                            setTermsError(false);
                                        }}
                                        style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: 5,
                                            border: `2px solid ${termsError ? '#ef4444' : agreedToTerms ? '#16a34a' : '#d1d5db'}`,
                                            background: agreedToTerms ? '#16a34a' : '#fff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                            marginTop: 1,
                                            transition: 'all 0.18s',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {agreedToTerms && (
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"/>
                                            </svg>
                                        )}
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <p style={{
                                            margin: 0,
                                            fontSize: '0.85rem',
                                            color: termsError ? '#b91c1c' : '#374151',
                                            fontWeight: 500,
                                            lineHeight: 1.5,
                                        }}>
                                            I have read and agree to the{' '}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setShowTermsModal(true);
                                                }}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: 0,
                                                    color: '#2563eb',
                                                    fontWeight: 700,
                                                    fontSize: '0.85rem',
                                                    cursor: 'pointer',
                                                    textDecoration: 'underline',
                                                    fontFamily: 'inherit',
                                                    textUnderlineOffset: 2,
                                                }}
                                            >
                                                Terms &amp; Conditions
                                            </button>
                                            {' '}of Triple R and A Car Rental.
                                        </p>

                                        {termsError && (
                                            <p style={{
                                                margin: '5px 0 0',
                                                fontSize: '0.78rem',
                                                color: '#ef4444',
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4,
                                            }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10"/>
                                                    <line x1="12" y1="8" x2="12" y2="12"/>
                                                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                                                </svg>
                                                You must agree to the Terms &amp; Conditions to proceed.
                                            </p>
                                        )}

                                        {agreedToTerms && (
                                            <p style={{
                                                margin: '5px 0 0',
                                                fontSize: '0.78rem',
                                                color: '#16a34a',
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4,
                                            }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12"/>
                                                </svg>
                                                Terms agreed — you're good to go!
                                            </p>
                                        )}
                                    </div>
                                </label>
                            </div>

                            {/* ── Order Summary ── */}
                            <div className="order-summary">
                                <p className="order-summary__label">Order Summary</p>
                                {cart.map(item => (
                                    <div key={item.car._id} className="order-summary__row">
                                        <span>{item.car.title} × {item.qty} · {item.rentalDays}d</span>
                                        <span>
                                            {item.car.dailyRate
                                                ? `₱${(item.car.dailyRate * item.qty * item.rentalDays).toLocaleString()}`
                                                : '—'}
                                        </span>
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

                        {/* RIGHT: Customer details */}
                        <div className="modal-right">
                            <p className="modal-section-label">Your Details</p>

                            <form onSubmit={handleSubmit} className="rental-form">
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
                                    pattern="^(09\d{9}|(\+63)9\d{9})$"
                                    title="Enter a valid Philippine mobile number (e.g. 09123456789)"
                                    disabled={submitting} />
                                {customer.phone.length > 0 && !/^09\d{9}$/.test(customer.phone) && (
                                    <span className="field-error">
                                        Must be 11 digits starting with 09 (e.g. 09123456789)
                                    </span>
                                )}
                            </div>

                                <div className="form-group">
                                    <label>Email Address</label>
                                    <input type="email" required placeholder="juan@example.com"
                                        value={customer.email}
                                        onChange={e => setCustomer(p => ({ ...p, email: e.target.value }))}
                                        disabled={submitting} />
                                </div>

                                <div className="modal-actions">
                                    <button type="button" className="cancel-btn" onClick={onClose} disabled={submitting}>
                                        Cancel
                                    </button>
                                    <Button
                                        type="submit"
                                        className="confirm-btn"
                                        disabled={submitting || cart.length === 0}
                                    >
                                        {submitting ? 'Confirming…' : `Confirm ${totalVehicles} Vehicle${totalVehicles !== 1 ? 's' : ''}`}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default RentModal;
