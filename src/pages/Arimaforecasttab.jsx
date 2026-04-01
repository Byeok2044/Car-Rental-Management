/**
 * ArimaForecastTab.jsx
 * Drop this component into ForecastingPage.jsx as the "ARIMA Forecast" tab.
 *
 * Usage inside ForecastingPage:
 *   import ArimaForecastTab from './ArimaForecastTab';
 *   // Add to TABS array:
 *   { id: 'arima', label: 'ARIMA Forecast', Icon: Icons.TrendUp }
 *   // Add to tab render:
 *   {activeTab === 'arima' && <ArimaForecastTab />}
 */

import React, { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getToken() {
    return localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
}

async function apiFetch(path) {
    const token = getToken();
    const res   = await fetch(`${API_BASE_URL}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error(`Server error (${res.status})`); }
    if (!res.ok) throw new Error(data.message || `Server error (${res.status})`);
    return data;
}

const fmtPeso = (n) => {
    const v = Number(n ?? 0);
    if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000)     return `₱${(v / 1_000).toFixed(1)}K`;
    return `₱${v.toLocaleString()}`;
};

const COLORS = {
    blue:   '#2563eb',
    green:  '#16a34a',
    amber:  '#d97706',
    red:    '#dc2626',
    purple: '#7c3aed',
    slate:  '#475569',
};

// ── Skeleton loader ────────────────────────────────────────────────────────────
function Skeleton({ h = 200, radius = 14 }) {
    return (
        <div style={{
            height: h, borderRadius: radius,
            background: 'linear-gradient(90deg,#f3f4f6 25%,#e9eaed 50%,#f3f4f6 75%)',
            backgroundSize: '200% 100%',
            animation: 'arima-shimmer 1.5s infinite',
        }} />
    );
}

// ── Confidence band bar chart ─────────────────────────────────────────────────
function ConfidenceBarChart({ data, valueKey = 'predicted', lowerKey = 'lower', upperKey = 'upper',
    labelKey = 'label', color = COLORS.blue, unit = '', formatValue = (v) => v }) {

    if (!data?.length) return <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No data</p>;

    const maxVal = Math.max(...data.map(d => d[upperKey] ?? d[valueKey]), 1);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.map((d, i) => {
                const pct      = (d[valueKey] / maxVal) * 100;
                const loPct    = ((d[lowerKey] ?? d[valueKey]) / maxVal) * 100;
                const hiPct    = ((d[upperKey] ?? d[valueKey]) / maxVal) * 100;
                const bandW    = hiPct - loPct;
                return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ width: 72, fontSize: '0.75rem', fontWeight: 600,
                            color: '#374151', flexShrink: 0, textAlign: 'right' }}>
                            {d[labelKey]}
                        </span>
                        <div style={{ flex: 1, height: 28, position: 'relative',
                            background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                            {/* Confidence band */}
                            <div style={{
                                position: 'absolute', top: 0, bottom: 0,
                                left: `${loPct}%`, width: `${Math.max(bandW, 1)}%`,
                                background: `${color}22`, borderRadius: 4,
                            }} />
                            {/* Predicted bar */}
                            <div style={{
                                position: 'absolute', top: '20%', bottom: '20%',
                                left: 0, width: `${pct}%`,
                                background: color, borderRadius: 4,
                                transition: 'width 0.6s ease',
                            }} />
                        </div>
                        <span style={{ width: 80, fontSize: '0.78rem', fontWeight: 700,
                            color, flexShrink: 0, textAlign: 'right' }}>
                            {formatValue(d[valueKey])}{unit}
                        </span>
                        <span style={{ width: 110, fontSize: '0.7rem', color: '#9ca3af', flexShrink: 0 }}>
                            [{formatValue(d[lowerKey] ?? 0)} – {formatValue(d[upperKey] ?? 0)}]
                        </span>
                    </div>
                );
            })}
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '4px 0 0' }}>
                Shaded area = 80 % confidence interval &nbsp;·&nbsp; Bar = predicted value
            </p>
        </div>
    );
}

// ── History sparkline ─────────────────────────────────────────────────────────
function Sparkline({ values, color = COLORS.blue, height = 50 }) {
    if (!values?.length) return null;
    const max = Math.max(...values, 1);
    const w   = 100 / values.length;
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', height, gap: 2 }}>
            {values.map((v, i) => (
                <div key={i} style={{
                    flex: 1, background: `${color}${i === values.length - 1 ? 'ff' : '66'}`,
                    height: `${Math.max((v / max) * 100, 4)}%`,
                    borderRadius: '3px 3px 0 0', minWidth: 4,
                    transition: 'height 0.4s ease',
                }} />
            ))}
        </div>
    );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ title, subtitle, accent = COLORS.blue, badge, badgeColor, children, style = {} }) {
    return (
        <div style={{
            background: '#fff', borderRadius: 14,
            border: '1px solid rgba(0,0,0,0.07)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
            overflow: 'hidden', ...style,
        }}>
            <div style={{ height: 3, background: accent }} />
            <div style={{ padding: '20px 24px 0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start',
                    justifyContent: 'space-between', marginBottom: 18 }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>{title}</h3>
                        {subtitle && <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>{subtitle}</p>}
                    </div>
                    {badge && (
                        <span style={{
                            background: badgeColor ? `${badgeColor}15` : '#f0fdf4',
                            color: badgeColor || '#16a34a',
                            border: `1px solid ${badgeColor ? badgeColor + '35' : '#bbf7d0'}`,
                            fontSize: '0.72rem', fontWeight: 700,
                            padding: '4px 12px', borderRadius: 999, whiteSpace: 'nowrap',
                        }}>{badge}</span>
                    )}
                </div>
            </div>
            <div style={{ padding: '0 24px 24px' }}>{children}</div>
        </div>
    );
}

// ── Next-month snapshot panel ─────────────────────────────────────────────────
function NextMonthSnapshot({ nextMonth }) {
    if (!nextMonth) return null;
    const cards = [
        { label: 'Revenue Forecast',  val: fmtPeso(nextMonth.revenue?.predicted),
          range: `${fmtPeso(nextMonth.revenue?.lower)} – ${fmtPeso(nextMonth.revenue?.upper)}`,
          color: COLORS.blue },
        { label: 'Booking Forecast',  val: `${nextMonth.bookings?.predicted ?? '—'} bookings`,
          range: `${nextMonth.bookings?.lower ?? '?'} – ${nextMonth.bookings?.upper ?? '?'} range`,
          color: COLORS.green },
    ];
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            {cards.map(c => (
                <div key={c.label} style={{
                    background: `${c.color}09`, borderRadius: 12,
                    border: `1.5px solid ${c.color}30`, padding: '16px 18px',
                }}>
                    <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700,
                        color: c.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {nextMonth.label} · {c.label}
                    </p>
                    <p style={{ margin: '8px 0 2px', fontSize: '1.4rem', fontWeight: 800, color: '#111827' }}>
                        {c.val}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>{c.range}</p>
                </div>
            ))}
        </div>
    );
}

// ── Vehicle type forecast panel ───────────────────────────────────────────────
function TypeForecastPanel({ typeForecast }) {
    const types = Object.entries(typeForecast || {}).filter(([, v]) => v.forecasts?.length > 0);
    if (!types.length) return (
        <Card title="Demand by Vehicle Type" accent={COLORS.purple}>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                Not enough per-type booking history for ARIMA.
            </p>
        </Card>
    );

    const typeColors = [COLORS.blue, COLORS.green, COLORS.amber, COLORS.red, COLORS.purple, COLORS.slate];

    return (
        <Card title="Demand Forecast by Vehicle Type"
            subtitle="ARIMA per-type booking projection"
            accent={COLORS.purple}
            badge={`${types.length} types`} badgeColor={COLORS.purple}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {types.map(([type, data], idx) => (
                    <div key={type}>
                        <p style={{ margin: '0 0 10px', fontSize: '0.85rem', fontWeight: 700,
                            color: typeColors[idx % typeColors.length] }}>
                            {type}
                        </p>
                        <ConfidenceBarChart
                            data={data.forecasts}
                            color={typeColors[idx % typeColors.length]}
                            formatValue={(v) => Math.round(v)}
                            unit=" bkgs"
                        />
                    </div>
                ))}
            </div>
        </Card>
    );
}

// ── Data quality banner ───────────────────────────────────────────────────────
function DataQualityBanner({ dq }) {
    if (!dq) return null;
    const ok     = dq.hasEnoughData && dq.arimaServiceAvailable;
    const color  = ok ? '#16a34a' : dq.monthsOfData < 3 ? '#dc2626' : '#d97706';
    const bg     = ok ? '#f0fdf4' : dq.monthsOfData < 3 ? '#fef2f2' : '#fffbeb';
    const border = ok ? '#bbf7d0' : dq.monthsOfData < 3 ? '#fecaca' : '#fde68a';
    return (
        <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10,
            padding: '12px 16px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1rem' }}>{ok ? '✅' : dq.monthsOfData < 3 ? '❌' : '⚠️'}</span>
            <div>
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color }}>
                    {dq.arimaServiceAvailable
                        ? `ARIMA active · ${dq.monthsOfData} month${dq.monthsOfData !== 1 ? 's' : ''} of training data`
                        : 'ARIMA service offline — showing trend-based estimates'}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#6b7280' }}>{dq.message}</p>
            </div>
        </div>
    );
}

// ── Model diagnostics panel ───────────────────────────────────────────────────
function DiagnosticsPanel({ diagnostics }) {
    if (!diagnostics?.revenue && !diagnostics?.bookings) return null;
    return (
        <div style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0',
            padding: '14px 18px', marginTop: 16 }}>
            <p style={{ margin: '0 0 8px', fontSize: '0.72rem', fontWeight: 700,
                color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Model Diagnostics
            </p>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {diagnostics.revenue && (
                    <div>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#374151', fontWeight: 600 }}>Revenue</p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                            Model: <code style={{ background: '#e5e7eb', padding: '1px 5px', borderRadius: 4 }}>
                                {diagnostics.revenue.model}
                            </code>
                            &nbsp;· {diagnostics.revenue.dataPoints} data points
                            {diagnostics.revenue.stationary ? ' · Stationary ✓' : ' · Differenced'}
                        </p>
                    </div>
                )}
                {diagnostics.bookings && (
                    <div>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#374151', fontWeight: 600 }}>Bookings</p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                            Model: <code style={{ background: '#e5e7eb', padding: '1px 5px', borderRadius: 4 }}>
                                {diagnostics.bookings.model}
                            </code>
                            &nbsp;· {diagnostics.bookings.dataPoints} data points
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ArimaForecastTab() {
    const [data,       setData]       = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState('');
    const [periods,    setPeriods]    = useState(6);
    const [updatedAt,  setUpdatedAt]  = useState('');

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const res = await apiFetch(`/api/dashboard/arima-forecast?periods=${periods}`);
            if (!res.success) throw new Error(res.message);
            setData(res.data);
            setUpdatedAt(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [periods]);

    useEffect(() => { load(); }, [load]);

    return (
        <div style={{ fontFamily: "'DM Sans','Inter',sans-serif" }}>
            <style>{`
                @keyframes arima-shimmer {
                    0%   { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>

            {/* Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#111827' }}>
                        ARIMA Revenue & Booking Forecast
                    </h3>
                    <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
                        Auto-Regressive Integrated Moving Average statistical model
                        {updatedAt && ` · Updated ${updatedAt}`}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 600 }}>Periods:</label>
                    <select value={periods} onChange={e => setPeriods(Number(e.target.value))}
                        style={{ padding: '7px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
                            fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
                        {[3, 6, 9, 12].map(n => <option key={n} value={n}>{n} months</option>)}
                    </select>
                    <button onClick={load} disabled={loading} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                        background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 8,
                        cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.82rem',
                        fontWeight: 600, color: '#475569', fontFamily: 'inherit',
                        opacity: loading ? 0.55 : 1,
                    }}>
                        {loading
                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                strokeWidth="2.5" style={{ animation: 'arima-shimmer 0.8s linear infinite' }}>
                                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                              </svg>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="23 4 23 10 17 10"/>
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                              </svg>}
                        Refresh
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca',
                    borderRadius: 10, padding: '14px 18px', marginBottom: 20, fontSize: '0.875rem' }}>
                    ⚠ {error} &nbsp;
                    <button onClick={load} style={{ textDecoration: 'underline', background: 'none',
                        border: 'none', cursor: 'pointer', color: '#b91c1c', fontFamily: 'inherit',
                        fontSize: '0.875rem' }}>Retry</button>
                </div>
            )}

            {/* Loading */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Skeleton h={88} /><Skeleton h={88} />
                    </div>
                    <Skeleton h={260} /><Skeleton h={260} />
                </div>
            ) : data && (
                <>
                    <DataQualityBanner dq={data.dataQuality} />
                    <NextMonthSnapshot nextMonth={data.nextMonth} />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                        {/* Revenue forecast */}
                        <Card title="Revenue Forecast"
                            subtitle={`Next ${periods} months · ARIMA statistical model`}
                            accent={COLORS.blue}
                            badge={data.diagnostics?.revenue?.model}
                            badgeColor={COLORS.blue}>
                            {data.revenueForecast?.length ? (
                                <ConfidenceBarChart
                                    data={data.revenueForecast}
                                    color={COLORS.blue}
                                    formatValue={fmtPeso}
                                />
                            ) : (
                                <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                                    Need ≥ 3 months of completed booking revenue to forecast.
                                </p>
                            )}
                            {/* History sparkline */}
                            {data.revenueHistory?.length > 0 && (
                                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                                    <p style={{ margin: '0 0 6px', fontSize: '0.72rem', fontWeight: 700,
                                        color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        Historical Revenue
                                    </p>
                                    <Sparkline values={data.revenueHistory.map(r => r.revenue)}
                                        color={COLORS.blue} height={48} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between',
                                        marginTop: 4, fontSize: '0.7rem', color: '#9ca3af' }}>
                                        <span>{data.revenueHistory[0]?.label}</span>
                                        <span>{data.revenueHistory.at(-1)?.label}</span>
                                    </div>
                                </div>
                            )}
                        </Card>

                        {/* Booking forecast */}
                        <Card title="Booking Forecast"
                            subtitle={`Next ${periods} months · booking count prediction`}
                            accent={COLORS.green}
                            badge={data.diagnostics?.bookings?.model}
                            badgeColor={COLORS.green}>
                            {data.bookingForecast?.length ? (
                                <ConfidenceBarChart
                                    data={data.bookingForecast}
                                    color={COLORS.green}
                                    formatValue={(v) => `${Math.round(v)}`}
                                    unit=" bkgs"
                                />
                            ) : (
                                <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                                    Need ≥ 3 months of booking history.
                                </p>
                            )}
                            {data.bookingHistory?.length > 0 && (
                                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                                    <p style={{ margin: '0 0 6px', fontSize: '0.72rem', fontWeight: 700,
                                        color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        Historical Bookings
                                    </p>
                                    <Sparkline values={data.bookingHistory.map(r => r.bookings)}
                                        color={COLORS.green} height={48} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between',
                                        marginTop: 4, fontSize: '0.7rem', color: '#9ca3af' }}>
                                        <span>{data.bookingHistory[0]?.label}</span>
                                        <span>{data.bookingHistory.at(-1)?.label}</span>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Type forecast */}
                    <TypeForecastPanel typeForecast={data.typeForecast} />

                    {/* Diagnostics */}
                    <DiagnosticsPanel diagnostics={data.diagnostics} />

                    {/* ARIMA explanation */}
                    <div style={{ marginTop: 20, background: '#f8fafc', borderRadius: 10,
                        border: '1px solid #e2e8f0', padding: '16px 20px' }}>
                        <p style={{ margin: '0 0 6px', fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>
                            About ARIMA Forecasting
                        </p>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.65 }}>
                            <strong>ARIMA</strong> (Auto-Regressive Integrated Moving Average) models your historical
                            revenue and booking trends to predict future values. The model automatically selects the
                            degree of differencing (<em>d</em>) needed to make the series stationary.
                            For 12+ months of data a <strong>SARIMA</strong> variant captures monthly seasonality.
                            Shaded bands show the 80 % confidence interval — actual values should fall inside
                            this range 80 % of the time.
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}