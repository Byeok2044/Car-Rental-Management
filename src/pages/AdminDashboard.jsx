import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FleetPage from './FleetPage.jsx';
import BookingsPage from './BookingsPage.jsx';
import MessagesPage from './Messagespage.jsx';
import ForecastingPage from './ForecastingPage.jsx';
import ProfileModal from './ProfileModal.jsx'; // 1. Added import for the modal
import './AdminDashboard.css';
import Logo from '../assets/Logo.svg';
import LName from '../assets/LName.png';

const API_BASE_URL  = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const POLL_INTERVAL = 30_000;
// REMOVED from here: const [isProfileOpen, setIsProfileOpen] = useState(false);

function getToken() {
    return localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
}
function clearToken() {
    localStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminToken');
}

const formatCurrency = (n) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n);
const formatDate = (iso) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const shortDay = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });

const Icons = {
    Dashboard: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
    ),
    Fleet: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="2"/>
            <path d="M16 8h4l3 5v3h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
    ),
    Bookings: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
    ),
    Messages: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
        </svg>
    ),
    Forecasting: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6"  y1="20" x2="6"  y2="14"/>
            <polyline points="2 17 6 14 10 17 14 12 18 10 22 10"/>
        </svg>
    ),
    Revenue: () => (
<svg
  width="22"
  height="22"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth="2"
  strokeLinecap="round"
  strokeLinejoin="round"
>
  <path d="M8 21V3" />
  <path d="M8 3h6a4.5 4.5 0 0 1 0 9H8" />
  <path d="M5 6h13" />
  <path d="M5 9h13" />
</svg>
    ),
    Car: () => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="2"/>
            <path d="M16 8h4l3 5v3h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
    ),
    Garage: () => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
    ),
    Warning: () => (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9"   x2="12"   y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
    ),
    Refresh: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
    ),
    Logout: () => (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
    ),
    Spinner: () => (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: 'ad-spin 0.8s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
    ),
    LogoVehicle: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="2"/>
            <path d="M16 8h4l3 5v3h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
    ),
};

const NAV_LINKS = [
    { id: 'dashboard',   label: 'Dashboard',   Icon: Icons.Dashboard   },
    { id: 'fleet',       label: 'Fleet',       Icon: Icons.Fleet       },
    { id: 'bookings',    label: 'Bookings',    Icon: Icons.Bookings    },
    { id: 'messages',    label: 'Messages',    Icon: Icons.Messages    },
    { id: 'forecasting', label: 'Forecasting', Icon: Icons.Forecasting },
];

function StatusBadge({ status }) {
    return <span className={`ad-badge ad-badge--${status.toLowerCase()}`}>{status}</span>;
}

function StatCard({ title, value, subtitle, Icon, accent, index }) {
    return (
        <div className={`ad-stat-card ad-stat-card--${accent}`} style={{ animationDelay: `${index * 0.1}s` }}>
            <div className="ad-stat-card__icon">
                <Icon />
            </div>
            <div className="ad-stat-card__body">
                <p className="ad-stat-card__title">{title}</p>
                <p className="ad-stat-card__value">{value}</p>
                {subtitle && <p className="ad-stat-card__sub">{subtitle}</p>}
            </div>
            <div className="ad-stat-card__glow" />
        </div>
    );
}

function RevenueChart({ data }) {
    const max       = Math.max(...data.map(d => d.revenue), 1);
    const weekTotal = data.reduce((s, d) => s + d.revenue, 0);
    return (
        <div className="ad-chart">
            <div className="ad-chart__header">
                <div>
                    <h3 className="ad-chart__title">Revenue — Last 7 Days</h3>
                    <p className="ad-chart__sub">Completed bookings only</p>
                </div>
                <span className="ad-chart__total">{formatCurrency(weekTotal)}</span>
            </div>
            <div className="ad-chart__bars">
                {data.map((day, i) => {
                    const pct    = (day.revenue / max) * 100;
                    const isLast = i === data.length - 1;
                    return (
                        <div key={day.date} className="ad-chart__col">
                            <div className="ad-chart__bar-wrap">
                                <div className="ad-chart__tooltip">{formatCurrency(day.revenue)}</div>
                                <div
                                    className={`ad-chart__bar${isLast ? ' ad-chart__bar--today' : ''}`}
                                    style={{ height: `${Math.max(pct, 4)}%` }}
                                />
                            </div>
                            <span className={`ad-chart__label${isLast ? ' ad-chart__label--today' : ''}`}>
                                {shortDay(day.date)}
                            </span>
                        </div>
                    );
                })}
            </div>
            <div className="ad-chart__axis">
                <span>₱0</span>
                <span>{formatCurrency(max)}</span>
            </div>
        </div>
    );
}

function FleetStatus({ fleet, bookingStats }) {
    if (!fleet.total) return null;
    const avPct    = (fleet.available / fleet.total) * 100;
    const rentPct  = (fleet.rented    / fleet.total) * 100;
    // Consistent Green Theme for Donut
    const gradient = `conic-gradient(
        #10b981 0% ${avPct}%,
        #059669 ${avPct}% ${avPct + rentPct}%,
        #374151 ${avPct + rentPct}% 100%
    )`;
    return (
        <div className="ad-fleet">
            <div className="ad-fleet__header">
                <h3 className="ad-chart__title">Fleet &amp; Bookings</h3>
                <span className="ad-fleet__total">{fleet.total} vehicles</span>
            </div>
            <div className="ad-fleet__body">
                <div className="ad-donut-wrap">
                    <div className="ad-donut" style={{ background: gradient }}>
                        <div className="ad-donut__hole">
                            <span className="ad-donut__num">{fleet.rented}</span>
                            <span className="ad-donut__lbl">Active</span>
                        </div>
                    </div>
                </div>
                <div className="ad-fleet__legend">
                    {[
                        { label: 'Available',   val: fleet.available,   color: '#ffe08a' },
                        { label: 'Rented',      val: fleet.rented,      color: '#059669' },
                    ].map(item => (
                        <div key={item.label} className="ad-fleet__legend-row">
                            <span className="ad-fleet__dot" style={{ backgroundColor: item.color }} />
                            <span className="ad-fleet__legend-label">{item.label}</span>
                            <span className="ad-fleet__legend-val">{item.val}</span>
                        </div>
                    ))}
                    <div className="ad-fleet__divider" />
                    {Object.entries(bookingStats).map(([key, val]) => (
                        <div key={key} className="ad-fleet__booking-row">
                            <StatusBadge status={key.charAt(0).toUpperCase() + key.slice(1)} />
                            <span className="ad-fleet__legend-val">{val}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function Skeleton() {
    return (
        <div className="ad-skeleton">
            <div className="ad-skeleton__row">
                {[1, 2, 3].map(i => <div key={i} className="ad-skeleton__card" />)}
            </div>
            <div className="ad-skeleton__row ad-skeleton__row--two">
                <div className="ad-skeleton__block" />
                <div className="ad-skeleton__block" />
            </div>
            <div className="ad-skeleton__block ad-skeleton__block--tall" />
        </div>
    );
}

function DashboardOverview({ data, loading, error, onRetry, onNav, lastRefreshed, isPolling }) {
    if (loading && !data) return <Skeleton />;

    if (error && !data) return (
        <div className="ad-error">
            <span className="ad-error__icon" style={{ color: '#f59e0b' }}>
                <Icons.Warning />
            </span>
            <h3>Failed to load dashboard</h3>
            <p>{error}</p>
            <button className="ad-error__btn" onClick={onRetry}>Retry</button>
        </div>
    );

    if (!data) return null;

    const stats = [
        {
            title:    'Total Revenue',
            value:    formatCurrency(data.revenue.total),
            subtitle: 'From completed bookings',
            Icon:     Icons.Revenue,
            accent:   'gold',
            index:    0,
        },
        {
            title:    'Active Rentals',
            value:    data.fleet.rented,
            subtitle: `${data.fleet.available} available`,
            Icon:     Icons.Car,
            accent:   'blue',
            index:    1,
        },
        {
            title:    'Total Fleet',
            value:    data.fleet.total,
            subtitle: `Varieties of Vehicles`,
            Icon:     Icons.Garage,
            accent:   'dark',
            index:    2,
        },
    ];

    return (
        <>
            <section className="ad-section">
                <p className="ad-section__label">Quick Stats</p>
                <div className="ad-stats-grid">
                    {stats.map(s => <StatCard key={s.title} {...s} />)}
                </div>
            </section>

            <section className="ad-section">
                <div className="ad-mid-grid">
                    <RevenueChart data={data.revenue.last7Days} />
                    <FleetStatus fleet={data.fleet} bookingStats={data.bookingStats} />
                </div>
            </section>

            <section className="ad-section">
                <div className="ad-table-header">
                    <div>
                        <p className="ad-section__label">Recent Bookings</p>
                        <p className="ad-table-sub">5 most recent transactions</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {isPolling && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                    width: 7, height: 7, borderRadius: '50%',
                                    background: '#10b981',
                                    boxShadow: '0 0 0 0 rgba(16,185,129,0.4)',
                                    animation: 'ad-pulse 2s infinite',
                                    display: 'inline-block',
                                }} />
                                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>Live</span>
                            </div>
                        )}
                        {lastRefreshed && (
                            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                Updated {lastRefreshed}
                            </span>
                        )}
                        <button className="ad-view-all-btn" onClick={() => onNav('bookings')}>
                            View all bookings 
                        </button>
                    </div>
                </div>
                <div className="ad-table-wrap">
                    <table className="ad-table">
                        <thead>
                            <tr>
                                {['Customer', 'Vehicle', 'Rental Period', 'Cost', 'Status', 'Booked'].map(h => (
                                    <th key={h}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.recentBookings.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>
                                        No bookings yet.
                                    </td>
                                </tr>
                            ) : data.recentBookings.map((b, i) => (
                                <tr key={b.id} style={{ animationDelay: `${i * 0.07}s` }}>
                                    <td>
                                        <div className="ad-table__customer">
                                            <div className="ad-table__avatar">{b.customerName.charAt(0)}</div>
                                            <div>
                                                <p className="ad-table__name">{b.customerName}</p>
                                                <p className="ad-table__email">{b.customerEmail}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <p className="ad-table__car">{b.car}</p>
                                        <p className="ad-table__plate">{b.licensePlate}</p>
                                    </td>
                                    <td>
                                        <p className="ad-table__date">{formatDate(b.startDate)}</p>
                                        <p className="ad-table__date ad-table__date--end">→ {formatDate(b.endDate)}</p>
                                    </td>
                                    <td><span className="ad-table__cost">{formatCurrency(b.totalCost)}</span></td>
                                    <td><StatusBadge status={b.status} /></td>
                                    <td><p className="ad-table__booked">{formatDate(b.createdAt)}</p></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    );
}

export default function AdminDashboard() {
    const navigate = useNavigate();

    // 2. MOVED state inside the functional component
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [avatarColor, setAvatarColor] = useState(
    () => localStorage.getItem('adminAvatarColor') || '#2563eb'
);

    const [data,           setData]           = useState(null);
    const [loading,        setLoading]        = useState(true);
    const [error,          setError]          = useState(null);
    const [activeNav,      setActiveNav]      = useState('dashboard');
    const [sidebarOpen,    setSidebarOpen]    = useState(false);
    const [loggingOut,     setLoggingOut]     = useState(false);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [lastRefreshed,  setLastRefreshed]  = useState(null);
    const [isPolling,      setIsPolling]      = useState(false);

    const pollTimerRef = useRef(null);
    const dataRef      = useRef(data);
    dataRef.current    = data;

    useEffect(() => {
        if (!getToken()) navigate('/admin/login', { replace: true });
    }, [navigate]);

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const token = getToken();
            const res = await fetch(`${API_BASE_URL}/api/dashboard/analytics`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (res.status === 401) { clearToken(); navigate('/admin/login', { replace: true }); return; }
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
            setData(json.data);
            setLastRefreshed(
                new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            );
            try {
                const msgRes = await fetch(`${API_BASE_URL}/api/admin/messages`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (msgRes.ok) {
                    const msgs = await msgRes.json();
                    setUnreadMessages(msgs.filter(m => m.status === 'Unread').length);
                }
            } catch {  }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const shouldPoll = useCallback(() => {
        const stats = dataRef.current?.bookingStats;
        return (stats?.active ?? 0) > 0 || (stats?.pending ?? 0) > 0;
    }, []);

    const stopPolling = useCallback(() => {
        if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
        setIsPolling(false);
    }, []);

    const startPolling = useCallback(() => {
        if (pollTimerRef.current) return;
        pollTimerRef.current = setInterval(() => {
            if (shouldPoll()) { fetchData(true); } else { stopPolling(); }
        }, POLL_INTERVAL);
        setIsPolling(true);
    }, [fetchData, shouldPoll, stopPolling]);

    useEffect(() => {
        if (shouldPoll()) { startPolling(); } else { stopPolling(); }
        return () => stopPolling();
    }, [data?.bookingStats?.active, data?.bookingStats?.pending, startPolling, stopPolling, shouldPoll]);

    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible' && shouldPoll()) fetchData(true);
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [fetchData, shouldPoll]);

    useEffect(() => {
        const handler = () => { if (window.innerWidth >= 1024) setSidebarOpen(false); };
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);

    const handleLogout = async () => {
        if (loggingOut) return;
        stopPolling();
        setLoggingOut(true);
        const token = getToken();
        try {
            if (token) await fetch(`${API_BASE_URL}/api/admin/logout`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
        } catch {  } finally {
            clearToken();
            navigate('/admin/login', { replace: true });
        }
    };

    function navTo(id) { 
        setActiveNav(id); 
        setSidebarOpen(false); 
    }

    const pendingCount = data?.bookingStats.pending ?? 0;

    return (
        <div className="ad-root">
            <style>{`
                @keyframes ad-pulse {
                    0%   { box-shadow: 0 0 0 0   rgba(16,185,129,0.5); }
                    70%  { box-shadow: 0 0 0 7px rgba(16,185,129,0);   }
                    100% { box-shadow: 0 0 0 0   rgba(16,185,129,0);   }
                }
                @keyframes ad-spin { to { transform: rotate(360deg); } }
            `}</style>

            {sidebarOpen && <div className="ad-overlay" onClick={() => setSidebarOpen(false)} />}

            <aside className={`ad-sidebar${sidebarOpen ? ' ad-sidebar--open' : ''}`}>
                <div className="ad-sidebar__logo">
                    <div className="ad-sidebar__logo-icon">
                        <img src={Logo} alt="Logo" className="ad-sidebar__logo-img"/>
                        
                    </div>
                    <div>
                        <img src={LName} alt="Brand Name" className="ad-sidebar__logo-name"/>
                        <p className="ad-sidebar__brand-sub">Admin Portal</p>
                    </div>
                </div>

                <nav className="ad-sidebar__nav">
                    <p className="ad-sidebar__nav-label">Main Menu</p>
                    {NAV_LINKS.map(link => {
                        const NavIcon = link.Icon;
                        return (
                            <button
                                key={link.id}
                                className={`ad-nav-btn${activeNav === link.id ? ' ad-nav-btn--active' : ''}`}
                                onClick={() => navTo(link.id)}
                            >
                                <span className="ad-nav-btn__icon"><NavIcon /></span>
                                {link.label}
                                {link.id === 'bookings'  && pendingCount    > 0 && <span className="ad-nav-btn__badge">{pendingCount}</span>}
                                {link.id === 'messages'  && unreadMessages  > 0 && <span className="ad-nav-btn__badge">{unreadMessages}</span>}
                            </button>
                        );
                    })}
                </nav>

                {data && (
                    <div className="ad-sidebar__mini-stats">
                        <p className="ad-sidebar__nav-label">Booking Metrics</p>
                        {[
                            { label: 'Active',    val: data.bookingStats.active,    cls: 'active'    },
                            { label: 'Pending',   val: data.bookingStats.pending,   cls: 'pending'   },
                            { label: 'Completed', val: data.bookingStats.completed, cls: 'completed' },
                        ].map(s => (
                            <div key={s.label} className="ad-sidebar__mini-row">
                                <span className={`ad-sidebar__mini-dot ad-sidebar__mini-dot--${s.cls}`} 
                                      style={s.cls === 'active' ? { backgroundColor: '#10b981' } : {}} />
                                <span className="ad-sidebar__mini-label">{s.label}</span>
                                <span className="ad-sidebar__mini-val">{s.val}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="ad-sidebar__footer">
                    <button
                        className="ad-sidebar__footer-btn ad-sidebar__footer-btn--logout"
                        onClick={handleLogout}
                        disabled={loggingOut}
                    >
                        {loggingOut ? <Icons.Spinner /> : <Icons.Logout />}
                        {loggingOut ? 'Logging out…' : 'Logout'}
                    </button>
                </div>
            </aside>

            <div className="ad-main">
                <header className="ad-header">
                    <div className="ad-header__left">
                        <button className="ad-hamburger" onClick={() => setSidebarOpen(v => !v)}>
                            <span /><span /><span />
                        </button>
                        <div>
                            <h1 className="ad-header__title">
                                {NAV_LINKS.find(n => n.id === activeNav)?.label}
                            </h1>
                            <p className="ad-header__date">
                                {new Date().toLocaleDateString('en-US', {
                                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                                })}
                            </p>
                        </div>
                    </div>

                    <div className="ad-header__right">
                        {activeNav === 'dashboard' && (
                            <button className="ad-refresh-btn" onClick={() => fetchData(false)} title="Refresh">
                                <Icons.Refresh />
                            </button>
                        )}
                        <div className="ad-avatar-group" style={{ cursor: 'pointer' }} onClick={() => setIsProfileOpen(true)}>
                           <div className="ad-avatar" style={{ background: avatarColor }}>AD</div>
                        </div>
                    </div>
                </header>

                <main className="ad-body">
                    {activeNav === 'dashboard'   && (
                        <DashboardOverview
                            data={data}
                            loading={loading}
                            error={error}
                            onRetry={() => fetchData(false)}
                            onNav={navTo}
                            lastRefreshed={lastRefreshed}
                            isPolling={isPolling}
                        />
                    )}
                    {activeNav === 'fleet'       && <FleetPage />}
                    {activeNav === 'bookings'    && <BookingsPage />}
                    {activeNav === 'messages'    && <MessagesPage />}
                    {activeNav === 'forecasting' && <ForecastingPage />}
                </main>
            </div>
            
            {/* 3. Added the Modal component rendering here */}
            <ProfileModal 
            isOpen={isProfileOpen} 
            onClose={() => setIsProfileOpen(false)}
            onColorChange={(color) => {
            setAvatarColor(color);
            localStorage.setItem('adminAvatarColor', color);
    }}
/>
        </div>
    );
}