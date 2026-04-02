import React, { useState, useRef, useEffect, useCallback } from 'react';
import Button from '../components/Commons/Button';
import BookingCalendar from '../components/Layout/BookingCalendar';
import './RentModal.css';

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

function PlusIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
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

function CartItem({ item, allCars, onUpdate, onRemove, index }) {
    const [calOpen, setCalOpen] = useState(index === 0);

    const maxQty = item.car.stock;

    function handleDateChange({ start, end }) {
        function toLocalDateStr(date) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        if (start && end) {
            const days = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
            onUpdate({ pickupDate: toLocalDateStr(start), rentalDays: days });
        } else if (start) {
            onUpdate({ pickupDate: toLocalDateStr(start), rentalDays: 1 });
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

// ── AddVehiclePanel supports two display modes:
//    - default: dashed border block below cart (legacy)
//    - inline:  compact button shown in the section header
function AddVehiclePanel({ allCars, cartCarIds, onAdd, inline = false }) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const available = allCars.filter(c => c.stock > 0 && !cartCarIds.includes(c._id));

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClick(e) {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    if (available.length === 0) return null;

    if (inline) {
        return (
            <div ref={wrapRef} style={{ position: 'relative' }}>
                <button
                    type="button"
                    onClick={() => setOpen(v => !v)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '5px 12px',
                        background: open ? '#eff6ff' : '#f8fafc',
                        border: `1.5px solid ${open ? '#bfdbfe' : '#e2e8f0'}`,
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: open ? 'var(--primary-blue)' : '#475569',
                        fontFamily: 'inherit',
                        transition: 'all 0.15s',
                        whiteSpace: 'nowrap',
                    }}
                >
                    <PlusIcon />
                    Add vehicle
                    <ChevronIcon open={open} />
                </button>

                {open && (
                    <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        right: 0,
                        zIndex: 50,
                        background: '#fff',
                        border: '1.5px solid #bfdbfe',
                        borderRadius: 10,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                        minWidth: 240,
                        maxHeight: 240,
                        overflowY: 'auto',
                        padding: '6px 0',
                        animation: 'lpDrop 0.16s cubic-bezier(0.4,0,0.2,1) both',
                    }}>
                        {available.map(car => (
                            <button
                                key={car._id}
                                type="button"
                                onClick={() => { onAdd(car); setOpen(false); }}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '9px 14px',
                                    border: 'none',
                                    background: 'transparent',
                                    fontFamily: 'inherit',
                                    fontSize: '0.85rem',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #f9fafb',
                                    transition: 'background 0.12s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <img src={car.image} alt={car.title} style={{
                                    width: 44, height: 30, borderRadius: 5,
                                    objectFit: 'cover', flexShrink: 0,
                                    border: '1px solid #e2e8f0',
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ display: 'block', fontWeight: 600, color: '#111827', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {car.title}
                                    </span>
                                    <span style={{ display: 'block', fontSize: '0.72rem', color: '#9ca3af', marginTop: 1 }}>
                                        {car.type} · {car.stock} available
                                    </span>
                                </div>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                                    stroke="var(--primary-blue)" strokeWidth="2.5"
                                    strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Legacy block mode (kept for backwards compatibility)
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

// Regex: letters (including accented), spaces, hyphens, apostrophes, and periods
const NAME_REGEX = /^[a-zA-ZÀ-ÖØ-öø-ÿ\s\-'.]+$/;

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

    const [submitting, setSubmitting] = useState(false);

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

    const isNameValid = customer.fullName.length === 0 || NAME_REGEX.test(customer.fullName);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!NAME_REGEX.test(customer.fullName)) {
            alert('Please enter a valid name (letters, spaces, hyphens, and apostrophes only).');
            return;
        }

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

        setSubmitting(true);
        try {
            const bookings = cart.map(item => ({
                carId:          item.car._id,
                qty:            item.qty,
                customerName:   customer.fullName,
                customerEmail:  customer.email,
                customerPhone:  customer.phone,
                startDate:      new Date(`${item.pickupDate}T00:00:00`).toISOString(),
                endDate:        (() => {
                    const d = new Date(`${item.pickupDate}T00:00:00`);
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
                    <div className="modal-left">
                        {/* Section header with inline Add Vehicle button */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <p className="modal-section-label" style={{ margin: 0 }}>Your Selection</p>
                            <AddVehiclePanel
                                allCars={allCars}
                                cartCarIds={cartCarIds}
                                onAdd={addVehicle}
                                inline
                            />
                        </div>

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

                    <div className="modal-right">
                        <p className="modal-section-label">Your Details</p>

                        <form onSubmit={handleSubmit} className="rental-form">
                            <div className="form-group">
                                <label>Full Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Juan Dela Cruz"
                                    value={customer.fullName}
                                    onChange={e => {
                                        const raw = e.target.value.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ\s\-'.]/g, '');
                                        setCustomer(p => ({ ...p, fullName: raw }));
                                    }}
                                    pattern="^[a-zA-ZÀ-ÖØ-öø-ÿ\s\-'.]+$"
                                    title="Name may only contain letters, spaces, hyphens, and apostrophes"
                                    disabled={submitting}
                                />
                                {!isNameValid && (
                                    <span className="field-error">
                                        Name may only contain letters, spaces, hyphens, and apostrophes
                                    </span>
                                )}
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
                                <Button type="submit" className="confirm-btn" disabled={submitting || cart.length === 0}>
                                    {submitting ? 'Confirming…' : `Confirm ${totalVehicles} Vehicle${totalVehicles !== 1 ? 's' : ''}`}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RentModal;