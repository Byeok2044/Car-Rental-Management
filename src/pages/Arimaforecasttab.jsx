/**
 * ArimaForecastTab.jsx  — professional ARIMA forecast panel
 * Drop-in replacement; same props/import surface as the original.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

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

const T = {
    blue:   '#185FA5',
    blueFg: '#E6F1FB',
    green:  '#3B6D11',
    greenFg:'#EAF3DE',
    amber:  '#854F0B',
    amberFg:'#FAEEDA',
    red:    '#A32D2D',
    redFg:  '#FCEBEB',
    purple: '#534AB7',
    purpleFg:'#EEEDFE',
    teal:   '#0F6E56',
    tealFg: '#E1F5EE',
    chartBlue:      '#378ADD',
    chartBlueBand:  'rgba(55,138,221,0.15)',
    chartGreen:     '#639922',
    chartGreenBand: 'rgba(99,153,34,0.15)',
    chartAmber:     '#BA7517',
    chartRed:       '#E24B4A',
    chartPurple:    '#7F77DD',
    chartTeal:      '#1D9E75',
    chartGray:      '#888780',
};

function Skeleton({ h = 200 }) {
    return (
        <div style={{
            height: h, borderRadius: 12,
            background: 'var(--color-background-secondary)',
            animation: 'arima-pulse 1.6s ease-in-out infinite',
        }} />
    );
}

function MetricCard({ label, value, sub, accent }) {
    return (
        <div style={{
            background: 'var(--color-background-secondary)',
            borderRadius: 'var(--border-radius-md)',
            padding: '16px 18px',
        }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 500,
                color: accent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {label}
            </p>
            <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 500,
                color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
                {value}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>{sub}</p>
        </div>
    );
}

function SectionCard({ title, subtitle, badge, badgeAccent, children, accentColor, style = {} }) {
    return (
        <div style={{
            background: 'var(--color-background-primary)',
            borderRadius: 'var(--border-radius-lg)',
            border: '0.5px solid var(--color-border-tertiary)',
            overflow: 'hidden',
            ...style,
        }}>
            <div style={{ height: 3, background: accentColor || T.blue }} />
            <div style={{ padding: '18px 22px 0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start',
                    justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 500,
                            color: 'var(--color-text-primary)' }}>{title}</p>
                        {subtitle && (
                            <p style={{ margin: '3px 0 0', fontSize: 12,
                                color: 'var(--color-text-secondary)' }}>{subtitle}</p>
                        )}
                    </div>
                    {badge && (
                        <span style={{
                            background: badgeAccent ? `${badgeAccent}18` : T.blueFg,
                            color: badgeAccent || T.blue,
                            border: `0.5px solid ${badgeAccent ? badgeAccent + '40' : T.blue + '40'}`,
                            fontSize: 11, fontWeight: 500,
                            padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap',
                        }}>{badge}</span>
                    )}
                </div>
            </div>
            <div style={{ padding: '0 22px 22px' }}>{children}</div>
        </div>
    );
}

function ForecastBarChart({ id, forecasts, historyData, historyKey, color, bandColor, formatTick, chartHeight = 260 }) {
    const canvasRef   = useRef(null);
    const chartRef    = useRef(null);

    const buildChart = useCallback(() => {
        if (!canvasRef.current || !forecasts?.length) return;
        const ctx = canvasRef.current.getContext('2d');

        if (chartRef.current) { chartRef.current.destroy(); }

        const labels    = forecasts.map(d => d.label);
        const predicted = forecasts.map(d => Math.round(d.predicted));
        const lower     = forecasts.map(d => Math.round(d.lower ?? d.predicted));
        const upper     = forecasts.map(d => Math.round(d.upper ?? d.predicted));

        const confidenceBandPlugin = {
            id: `ci-band-${id}`,
            afterDatasetsDraw(chart) {
                const { ctx: c, scales: { x, y } } = chart;
                const n = labels.length;
                if (n < 2) return;

                c.save();
                c.beginPath();
                for (let i = 0; i < n; i++) {
                    const xp = x.getPixelForValue(i);
                    const yp = y.getPixelForValue(upper[i]);
                    i === 0 ? c.moveTo(xp, yp) : c.lineTo(xp, yp);
                }
                for (let i = n - 1; i >= 0; i--) {
                    const xp = x.getPixelForValue(i);
                    const yp = y.getPixelForValue(lower[i]);
                    c.lineTo(xp, yp);
                }
                c.closePath();
                c.fillStyle = bandColor;
                c.fill();

                c.strokeStyle = color + '55';
                c.lineWidth   = 1;
                c.setLineDash([3, 3]);
                [upper, lower].forEach(arr => {
                    c.beginPath();
                    arr.forEach((v, i) => {
                        const xp = x.getPixelForValue(i);
                        const yp = y.getPixelForValue(v);
                        i === 0 ? c.moveTo(xp, yp) : c.lineTo(xp, yp);
                    });
                    c.stroke();
                });
                c.setLineDash([]);
                c.restore();
            },
        };

        const maxVal = Math.max(...upper, 1);

        chartRef.current = new window.Chart(ctx, {
            type: 'bar',
            plugins: [confidenceBandPlugin],
            data: {
                labels,
                datasets: [{
                    label: 'Forecast',
                    data: predicted,
                    backgroundColor: color + 'cc',
                    borderColor: color,
                    borderWidth: 1.5,
                    borderRadius: 5,
                    borderSkipped: 'bottom',
                    barPercentage: 0.55,
                    categoryPercentage: 0.7,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 600, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e2128',
                        titleColor: '#e5e7eb',
                        bodyColor: '#9ca3af',
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label(ctx) {
                                const i = ctx.dataIndex;
                                return [
                                    `  Forecast: ${formatTick(predicted[i])}`,
                                    `  Range:    ${formatTick(lower[i])} – ${formatTick(upper[i])}`,
                                ];
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                            color: '#888780',
                            font: { size: 11 },
                            autoSkip: false,
                            maxRotation: 0,
                        },
                    },
                    y: {
                        min: 0,
                        max: Math.ceil(maxVal * 1.18),
                        grid: { color: 'rgba(136,135,128,0.12)', lineWidth: 1 },
                        border: { display: false, dash: [3, 3] },
                        ticks: {
                            color: '#888780',
                            font: { size: 11 },
                            maxTicksLimit: 5,
                            callback: (v) => formatTick(v),
                        },
                    },
                },
            },
        });
    }, [forecasts, color, bandColor, formatTick, id]);

    useEffect(() => {
        if (window.Chart) { buildChart(); return; }
        if (document.getElementById('chartjs-cdn')) {
            const wait = setInterval(() => {
                if (window.Chart) { clearInterval(wait); buildChart(); }
            }, 80);
            return () => clearInterval(wait);
        }
        const s  = document.createElement('script');
        s.id     = 'chartjs-cdn';
        s.src    = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
        s.onload = () => buildChart();
        document.head.appendChild(s);
    }, [buildChart]);

    useEffect(() => () => { chartRef.current?.destroy(); }, []);

    const histValues = historyData?.map(d => d[historyKey]) ?? [];

    return (
        <div>
            <div style={{ position: 'relative', width: '100%', height: chartHeight }}>
                <canvas
                    ref={canvasRef}
                    id={id}
                    role="img"
                    aria-label={`Bar chart showing ${forecasts?.length ?? 0} months of forecast data`}
                />
            </div>

            <div style={{ display: 'flex', gap: 20, marginTop: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3,
                        background: color, display: 'inline-block' }} />
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Forecast</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3,
                        background: bandColor, border: `1px dashed ${color}55`,
                        display: 'inline-block' }} />
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>80% confidence interval</span>
                </div>
            </div>

            {histValues.length > 0 && (
                <div style={{ marginTop: 18, paddingTop: 16,
                    borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 500,
                        color: 'var(--color-text-secondary)',
                        textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Historical data
                    </p>
                    <HistorySparkline values={histValues} color={color} />
                    <div style={{ display: 'flex', justifyContent: 'space-between',
                        marginTop: 4, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                        <span>{historyData[0]?.label}</span>
                        <span>{historyData.at(-1)?.label}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

function HistorySparkline({ values, color, height = 44 }) {
    if (!values?.length) return null;
    const max  = Math.max(...values, 1);
    const W    = 600;
    const H    = height;
    const step = W / Math.max(values.length - 1, 1);

    const pts  = values.map((v, i) => [
        i * step,
        H - (v / max) * (H - 4) - 2,
    ]);

    const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const areaD = `${pathD} L${pts.at(-1)[0]},${H} L0,${H} Z`;

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height, display: 'block' }}
            role="img" aria-label="Historical trend sparkline">
            <defs>
                <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <path d={areaD} fill={`url(#sg-${color.replace('#', '')})`} />
            <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
            {pts.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 3.5 : 2}
                    fill={color} opacity={i === pts.length - 1 ? 1 : 0.45} />
            ))}
        </svg>
    );
}

function DataQualityBanner({ dq }) {
    if (!dq) return null;
    const ok   = dq.hasEnoughData && dq.arimaServiceAvailable;
    const warn = !dq.arimaServiceAvailable || (!ok && dq.monthsOfData >= 3);

    const [bg, border, iconColor, textColor, icon] = ok
        ? ['var(--color-background-success)', 'var(--color-border-success)', 'var(--color-text-success)', 'var(--color-text-success)', 'ti-circle-check']
        : warn
        ? ['var(--color-background-warning)', 'var(--color-border-warning)', 'var(--color-text-warning)', 'var(--color-text-warning)', 'ti-alert-triangle']
        : ['var(--color-background-danger)',  'var(--color-border-danger)',  'var(--color-text-danger)',  'var(--color-text-danger)',  'ti-circle-x'];

    return (
        <div style={{ background: bg, border: `0.5px solid ${border}`, borderRadius: 'var(--border-radius-md)',
            padding: '12px 16px', marginBottom: 20,
            display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <i className={`ti ${icon}`} aria-hidden="true"
                style={{ fontSize: 16, color: iconColor, flexShrink: 0, marginTop: 1 }} />
            <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: textColor }}>
                    {dq.arimaServiceAvailable
                        ? `ARIMA active · ${dq.monthsOfData} month${dq.monthsOfData !== 1 ? 's' : ''} of training data`
                        : 'ARIMA service offline — showing trend-based estimates'}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {dq.message}
                </p>
            </div>
        </div>
    );
}

function DiagnosticsPanel({ diagnostics }) {
    if (!diagnostics?.revenue && !diagnostics?.bookings) return null;
    return (
        <div style={{ background: 'var(--color-background-secondary)',
            borderRadius: 'var(--border-radius-md)',
            border: '0.5px solid var(--color-border-tertiary)',
            padding: '14px 18px', marginTop: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 500,
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Model diagnostics
            </p>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                {[['Revenue', diagnostics.revenue], ['Bookings', diagnostics.bookings]].map(([label, d]) =>
                    d ? (
                        <div key={label}>
                            <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 500,
                                color: 'var(--color-text-primary)' }}>{label}</p>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                                <code style={{ background: 'var(--color-background-primary)',
                                    border: '0.5px solid var(--color-border-tertiary)',
                                    padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)',
                                    fontSize: 11 }}>
                                    {d.model}
                                </code>
                                <span style={{ marginLeft: 8 }}>
                                    {d.dataPoints} pts{d.stationary !== undefined && (d.stationary ? ' · stationary' : ' · differenced')}
                                </span>
                            </p>
                        </div>
                    ) : null
                )}
            </div>
        </div>
    );
}

const PERIOD_OPTIONS = [
    { value: 3,  label: '3 months',  sub: 'Short-term' },
    { value: 6,  label: '6 months',  sub: 'Mid-term'   },
    { value: 9,  label: '9 months',  sub: 'Extended'   },
    { value: 12, label: '12 months', sub: 'Full year'  },
];

function PeriodDropdown({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const ref             = useRef(null);
    const selected        = PERIOD_OPTIONS.find(o => o.value === value) ?? PERIOD_OPTIONS[1];

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div ref={ref} style={{ position: 'relative', userSelect: 'none' }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 12px 7px 14px',
                    background: 'var(--color-background-primary)',
                    border: `0.5px solid ${open ? T.blue : 'var(--color-border-secondary)'}`,
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    transition: 'border-color 0.15s',
                    minWidth: 152,
                }}
            >
                <div style={{ flex: 1, textAlign: 'left' }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 500,
                        color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
                        {selected.label}
                    </p>
                    <p style={{ margin: 0, fontSize: 10,
                        color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>
                        {selected.sub}
                    </p>
                </div>
                <span style={{ width: '0.5px', height: 24,
                    background: 'var(--color-border-tertiary)', flexShrink: 0 }} />
                <i
                    className="ti ti-chevron-down"
                    aria-hidden="true"
                    style={{
                        fontSize: 14,
                        color: 'var(--color-text-secondary)',
                        flexShrink: 0,
                        display: 'inline-block',
                        transition: 'transform 0.2s',
                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                />
            </button>

            {open && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    minWidth: 180,
                    background: 'var(--color-background-primary)',
                    border: '0.5px solid var(--color-border-secondary)',
                    borderRadius: 12,
                    padding: 4,
                    zIndex: 50,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                }}>
                    <p style={{ margin: '6px 10px 6px', fontSize: 10, fontWeight: 500,
                        color: 'var(--color-text-secondary)',
                        textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        Forecast period
                    </p>
                    <div style={{ height: '0.5px', background: 'var(--color-border-tertiary)',
                        margin: '0 4px 4px' }} />
                    {PERIOD_OPTIONS.map(opt => {
                        const active = opt.value === value;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setOpen(false); }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    width: '100%',
                                    padding: '8px 10px',
                                    border: 'none',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-sans)',
                                    background: active ? `${T.blue}12` : 'transparent',
                                    transition: 'background 0.12s',
                                    gap: 8,
                                }}
                                onMouseEnter={e => {
                                    if (!active) e.currentTarget.style.background = 'var(--color-background-secondary)';
                                }}
                                onMouseLeave={e => {
                                    if (!active) e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <div style={{ textAlign: 'left' }}>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: active ? 500 : 400,
                                        color: active ? T.blue : 'var(--color-text-primary)',
                                        lineHeight: 1.3 }}>
                                        {opt.label}
                                    </p>
                                    <p style={{ margin: 0, fontSize: 11,
                                        color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>
                                        {opt.sub}
                                    </p>
                                </div>
                                {active && (
                                    <i className="ti ti-check" aria-hidden="true"
                                        style={{ fontSize: 14, color: T.blue, flexShrink: 0 }} />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function ArimaForecastTab() {
    const [data,      setData]      = useState(null);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState('');
    const [periods,   setPeriods]   = useState(6);
    const [updatedAt, setUpdatedAt] = useState('');

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
        <div style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>
            <style>{`
                @keyframes arima-pulse {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0.45; }
                }
            `}</style>

            {/* Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500,
                        color: 'var(--color-text-primary)' }}>
                        ARIMA revenue & booking forecast
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: 12,
                        color: 'var(--color-text-secondary)' }}>
                        Auto-regressive integrated moving average statistical model
                        {updatedAt && (
                            <span style={{ marginLeft: 8, color: 'var(--color-text-secondary)', opacity: 0.6 }}>
                                · Updated {updatedAt}
                            </span>
                        )}
                    </p>
                </div>
                <PeriodDropdown value={periods} onChange={setPeriods} />
            </div>

            {/* Error */}
            {error && (
                <div style={{ background: 'var(--color-background-danger)',
                    color: 'var(--color-text-danger)',
                    border: '0.5px solid var(--color-border-danger)',
                    borderRadius: 'var(--border-radius-md)',
                    padding: '12px 16px', marginBottom: 20,
                    display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <i className="ti ti-alert-circle" aria-hidden="true" style={{ fontSize: 15 }} />
                    {error}
                    <button onClick={load}
                        style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 12px' }}>
                        Retry
                    </button>
                </div>
            )}

            {/* Loading */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Skeleton h={82} /><Skeleton h={82} />
                    </div>
                    <Skeleton h={300} /><Skeleton h={300} />
                </div>
            ) : data && (
                <>
                    <DataQualityBanner dq={data.dataQuality} />

                    {/* Next-month snapshot */}
                    {data.nextMonth && (
                        <div style={{ display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 12, marginBottom: 24 }}>
                            <MetricCard
                                label={`${data.nextMonth.label} · revenue forecast`}
                                value={fmtPeso(data.nextMonth.revenue?.predicted)}
                                sub={`Range: ${fmtPeso(data.nextMonth.revenue?.lower)} – ${fmtPeso(data.nextMonth.revenue?.upper)}`}
                                accent={T.blue}
                            />
                            <MetricCard
                                label={`${data.nextMonth.label} · booking forecast`}
                                value={`${data.nextMonth.bookings?.predicted ?? '—'} bookings`}
                                sub={`Range: ${data.nextMonth.bookings?.lower ?? '?'} – ${data.nextMonth.bookings?.upper ?? '?'}`}
                                accent={T.green}
                            />
                        </div>
                    )}

                    {/* Revenue & Booking charts */}
                    <div style={{ display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                        gap: 20, marginBottom: 20 }}>

                        <SectionCard
                            title="Revenue forecast"
                            subtitle={`Next ${periods} months · ARIMA statistical model`}
                            accentColor={T.chartBlue}
                            badge={data.diagnostics?.revenue?.model}
                            badgeAccent={T.blue}
                        >
                            {data.revenueForecast?.length ? (
                                <ForecastBarChart
                                    id="arima-revenue-chart"
                                    forecasts={data.revenueForecast}
                                    historyData={data.revenueHistory}
                                    historyKey="revenue"
                                    color={T.chartBlue}
                                    bandColor={T.chartBlueBand}
                                    formatTick={fmtPeso}
                                    chartHeight={260}
                                />
                            ) : (
                                <div style={{ padding: '24px 0', textAlign: 'center' }}>
                                    <i className="ti ti-chart-bar-off" aria-hidden="true"
                                        style={{ fontSize: 28, color: 'var(--color-text-secondary)',
                                            display: 'block', marginBottom: 8 }} />
                                    <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                        Need 3+ months of completed booking revenue to forecast
                                    </p>
                                </div>
                            )}
                        </SectionCard>

                        <SectionCard
                            title="Booking forecast"
                            subtitle={`Next ${periods} months · booking count prediction`}
                            accentColor={T.chartGreen}
                            badge={data.diagnostics?.bookings?.model}
                            badgeAccent={T.green}
                        >
                            {data.bookingForecast?.length ? (
                                <ForecastBarChart
                                    id="arima-bookings-chart"
                                    forecasts={data.bookingForecast}
                                    historyData={data.bookingHistory}
                                    historyKey="bookings"
                                    color={T.chartGreen}
                                    bandColor={T.chartGreenBand}
                                    formatTick={(v) => `${Math.round(v)}`}
                                    chartHeight={260}
                                />
                            ) : (
                                <div style={{ padding: '24px 0', textAlign: 'center' }}>
                                    <i className="ti ti-chart-bar-off" aria-hidden="true"
                                        style={{ fontSize: 28, color: 'var(--color-text-secondary)',
                                            display: 'block', marginBottom: 8 }} />
                                    <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                        Need 3+ months of booking history
                                    </p>
                                </div>
                            )}
                        </SectionCard>
                    </div>

                    {/* Diagnostics */}
                    <DiagnosticsPanel diagnostics={data.diagnostics} />

                    {/* About box */}
                    <div style={{ marginTop: 16,
                        background: 'var(--color-background-secondary)',
                        borderRadius: 'var(--border-radius-md)',
                        border: '0.5px solid var(--color-border-tertiary)',
                        padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <i className="ti ti-info-circle" aria-hidden="true"
                                style={{ fontSize: 15, color: 'var(--color-text-secondary)' }} />
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 500,
                                color: 'var(--color-text-primary)' }}>
                                About ARIMA forecasting
                            </p>
                        </div>
                        <p style={{ margin: 0, fontSize: 12,
                            color: 'var(--color-text-secondary)', lineHeight: 1.65 }}>
                            ARIMA (Auto-Regressive Integrated Moving Average) models your historical revenue
                            and booking trends to predict future values. The model automatically selects the
                            degree of differencing (<em>d</em>) needed to make the series stationary.
                            For 12+ months of data a SARIMA variant captures monthly seasonality.
                            Shaded bands show the 80% confidence interval — actual values should fall
                            inside this range 80% of the time.
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}