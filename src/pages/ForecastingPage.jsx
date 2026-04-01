import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ArimaForecastTab from './Arimaforecasttab';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getToken() {
    return localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
}

async function apiFetch(path) {
    const token = getToken();
    const res = await fetch(`${API_BASE_URL}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error(`Server error (${res.status})`); }
    if (!res.ok) throw new Error(data.message || `Server error (${res.status})`);
    return data;
}

const fmtPesoShort = (n) => {
    const v = Number(n ?? 0);
    if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `₱${(v / 1_000).toFixed(1)}K`;
    return `₱${v}`;
};

function buildForecast({ last7Days = [], pipeline = {}, upcoming = [], avgByType = [] }) {
    const completedRevDays   = (last7Days || []).filter(d => d.revenue > 0);
    const completedTotal     = (last7Days || []).reduce((s, d) => s + d.revenue, 0);
    const activeDays         = Math.max(completedRevDays.length, 1);
    const weeklyFromHist     = (completedTotal / activeDays) * 7;
    const scheduledTotal     = (upcoming || []).reduce((s, w) => s + w.scheduledRevenue, 0);
    const scheduledWeeks     = Math.max((upcoming || []).length, 1);
    const weeklyFromSched    = scheduledTotal / scheduledWeeks;
    const totalBookings      = avgByType.reduce((s, t) => s + t.bookings, 0);
    const overallAvgQuote    = totalBookings > 0
        ? avgByType.reduce((s, t) => s + t.avgPrice * t.bookings, 0) / totalBookings : 0;
    const estBookingsPerWk   = overallAvgQuote > 0
        ? (pipeline.outstanding || 0) / overallAvgQuote / 4 : 0;
    const weeklyFromPipeline = overallAvgQuote * estBookingsPerWk;
    const histWeight         = Math.min(completedRevDays.length / 7, 1) * 0.5;
    const schedWeight        = upcoming.length > 0 ? 0.4 : 0;
    const pipelineWeight     = Math.max(1 - histWeight - schedWeight, 0);
    let blendedWeekly =
        (weeklyFromHist * histWeight) +
        (weeklyFromSched * schedWeight) +
        (weeklyFromPipeline * pipelineWeight);
    if (blendedWeekly < 0) blendedWeekly = 0;
    const GROWTH         = { conservative: 0.97, baseline: 1.00, optimistic: 1.05 };
    const PIPELINE_SPREAD = [0.35, 0.30, 0.20, 0.15];
    const outstanding    = pipeline.outstanding || 0;
    const weeks = [1, 2, 3, 4].map((w, i) => ({
        week:         `Week ${w}`,
        conservative: Math.round(blendedWeekly * Math.pow(GROWTH.conservative, w)),
        baseline:     Math.round(blendedWeekly * Math.pow(GROWTH.baseline, w)),
        optimistic:   Math.round(blendedWeekly * Math.pow(GROWTH.optimistic, w) + outstanding * PIPELINE_SPREAD[i]),
    }));
    return { weeks, blendedWeekly };
}

const Icons = {
    
    Peak: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
            <polyline points="17 6 23 6 23 12"/>
        </svg>
    ),
    Normal: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
    ),
    Low: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
            <polyline points="17 18 23 18 23 12"/>
        </svg>
    ),
    
    Alert: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
    ),
    Check: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
    ),
    Box: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
    ),
    
    Calendar: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
    ),
    Package: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
    ),
  Tag: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 21V5h5a5 5 0 0 1 0 10H7" />
            <line x1="5" y1="8" x2="16" y2="8" />
            <line x1="5" y1="11" x2="16" y2="11" />
        </svg>
    ),
    
    TrendUp: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
            <polyline points="17 6 23 6 23 12"/>
        </svg>
    ),
    Refresh: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
    ),
};

function Skeleton({ h = 220 }) {
    return (
        <div style={{
            height: h, borderRadius: 14,
            background: 'linear-gradient(90deg,#f3f4f6 25%,#e9eaed 50%,#f3f4f6 75%)',
            backgroundSize: '200% 100%',
            animation: 'fp-shimmer 1.5s infinite',
        }} />
    );
}

function Card({ title, subtitle, children, accent = '#2563eb', badge, badgeColor, style = {} }) {
    return (
        <div style={{
            background: '#fff', borderRadius: 14,
            border: '1px solid rgba(0,0,0,0.07)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
            overflow: 'hidden', ...style,
        }}>
            <div style={{ height: 3, background: accent }} />
            <div style={{ padding: '20px 24px 0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
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

const TIER = {
    peak:   { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', bar: '#ef4444', Icon: Icons.Peak   },
    normal: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', bar: '#22c55e', Icon: Icons.Normal },
    low:    { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', bar: '#3b82f6', Icon: Icons.Low    },
};

function TierBadge({ tier, size = 'sm' }) {
    const t = TIER[tier] || TIER.normal;
    const lg = size === 'lg';
    const TierIcon = t.Icon;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: lg ? 5 : 4,
            background: t.bg, color: t.color, border: `1px solid ${t.border}`,
            fontSize: lg ? '0.75rem' : '0.65rem', fontWeight: 700,
            padding: lg ? '4px 10px' : '2px 7px', borderRadius: 6,
        }}>
            <TierIcon />
            {tier.toUpperCase()}
        </span>
    );
}

function SeasonalityHeatmap({ seasonality }) {
    const maxIdx    = Math.max(...seasonality.map(m => m.index), 1);
    const MONTH_ABR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const currentMo = new Date().getMonth();

    return (
        <Card
            title="Monthly Seasonality Index"
            subtitle="1.0 = average demand · ≥1.3 = peak · <0.9 = low season"
            accent="#2563eb"
            badge="12-month pattern"
            badgeColor="#2563eb"
        >
           
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 110, marginBottom: 8 }}>
                {seasonality.map((m, i) => {
                    const t   = TIER[m.tier] || TIER.normal;
                    const pct = (m.index / maxIdx) * 100;
                    const isCurrent = currentMo === i;
                    return (
                        <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
                            <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                <div
                                    title={`${m.monthName}: index ${m.index} · avg ${m.avgBookings} bookings`}
                                    style={{
                                        width: '100%',
                                        height: `${Math.max(pct, 6)}%`,
                                        background: isCurrent
                                            ? t.bar
                                            : `${t.bar}90`,
                                        borderRadius: '4px 4px 2px 2px',
                                        outline: isCurrent ? `2px solid ${t.color}` : 'none',
                                        outlineOffset: 1,
                                        cursor: 'default',
                                        minHeight: 5,
                                        transition: 'filter 0.18s',
                                        boxSizing: 'border-box',
                                    }}
                                    onMouseEnter={e => e.target.style.filter = 'brightness(1.12)'}
                                    onMouseLeave={e => e.target.style.filter = ''}
                                />
                            </div>
                            <span style={{
                                fontSize: '0.6rem',
                                color: isCurrent ? t.color : '#9ca3af',
                                fontWeight: isCurrent ? 800 : 500,
                                letterSpacing: isCurrent ? '0.02em' : 0,
                            }}>
                                {MONTH_ABR[i]}
                            </span>
                        </div>
                    );
                })}
            </div>

            
            <div style={{ display: 'flex', gap: 5, marginBottom: 18 }}>
                {seasonality.map(m => {
                    const t = TIER[m.tier] || TIER.normal;
                    return (
                        <div key={m.month} style={{ flex: 1, textAlign: 'center' }}>
                            <span style={{
                                fontSize: '0.6rem', fontWeight: 700,
                                color: m.tier !== 'normal' ? t.color : '#cbd5e1',
                            }}>
                                {m.index.toFixed(1)}
                            </span>
                        </div>
                    );
                })}
            </div>

            
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                {Object.entries(TIER).map(([key, t]) => {
                    const TierIcon = t.Icon;
                    return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 22, height: 22, borderRadius: 6,
                                background: t.bg, border: `1px solid ${t.border}`,
                                color: t.color,
                            }}>
                                <TierIcon />
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>
                                {key === 'peak' ? 'Peak (≥1.3)' : key === 'normal' ? 'Normal (0.9–1.3)' : 'Low (<0.9)'}
                            </span>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

function PricingSuggestions({ outlook, avgByType }) {
    const overallAvgRate = avgByType.length > 0
        ? avgByType.reduce((s, t) => s + t.avgPrice * t.bookings, 0) /
          Math.max(avgByType.reduce((s, t) => s + t.bookings, 0), 1)
        : 0;

    return (
        <Card
            title="Dynamic Pricing Suggestions"
            subtitle="Recommended rate adjustments for the next 6 months based on seasonal demand"
            accent="#f59e0b"
            badge="6-month outlook"
            badgeColor="#d97706"
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {outlook.map((m, i) => {
                    const t         = TIER[m.tier] || TIER.normal;
                    const mult      = m.pricingMultiplier;
                    const suggested = overallAvgRate > 0 ? Math.round(overallAvgRate * mult) : null;
                    const isFirst   = i === 0;
                    return (
                        <div key={`${m.year}-${m.month}`} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '11px 14px',
                            background: isFirst ? t.bg : '#fafafa',
                            borderRadius: 10,
                            border: `1px solid ${isFirst ? t.border : '#f1f5f9'}`,
                            transition: 'background 0.15s',
                        }}>
                            
                            <div style={{ minWidth: 96 }}>
                                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>
                                    {m.label}
                                </p>
                                <div style={{ marginTop: 4 }}>
                                    <TierBadge tier={m.tier} />
                                </div>
                            </div>

                            
                            <div style={{ flex: 1 }}>
                                <div style={{ height: 7, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${Math.min((m.index / 2) * 100, 100)}%`,
                                        background: t.bar, borderRadius: 999,
                                        transition: 'width 0.6s ease',
                                    }} />
                                </div>
                                <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#9ca3af' }}>
                                    Demand index: {m.index.toFixed(2)}
                                </p>
                            </div>

                            
                            <div style={{ textAlign: 'right', minWidth: 100 }}>
                                <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: t.color, lineHeight: 1.2 }}>
                                    ×{mult.toFixed(2)}
                                </p>
                                {suggested > 0 && (
                                  <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#6b7280' }}>
                                   ~{fmtPesoShort(suggested)}/booking  {/* This will now show ₱ */}
                                 </p>
                                )}
                                <p style={{ margin: '2px 0 0', fontSize: '0.65rem', color: t.color, fontWeight: 700 }}>
                                    {mult > 1
                                        ? `+${Math.round((mult - 1) * 100)}% premium`
                                        : mult < 1
                                        ? `−${Math.round((1 - mult) * 100)}% discount`
                                        : 'Standard rate'}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '14px 0 0', lineHeight: 1.5 }}>
                Multipliers apply to your current average quote. Adjust based on market conditions and operational costs.
            </p>
        </Card>
    );
}

function InventoryRecommendations({ inventoryRecs, nextPeak }) {
    if (!inventoryRecs || inventoryRecs.length === 0) {
        return (
            <Card title="Inventory Optimization" subtitle="Stock recommendations per vehicle type" accent="#7c3aed">
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>No vehicle data yet</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>Complete bookings to generate recommendations</p>
                </div>
            </Card>
        );
    }

    const STATUS_META = {
        understocked: {
            bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', bar: '#ef4444',
            Icon: Icons.Alert, label: 'Add units',
        },
        optimal: {
            bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', bar: '#22c55e',
            Icon: Icons.Check, label: 'Optimal',
        },
        overstocked: {
            bg: '#fffbeb', color: '#b45309', border: '#fde68a', bar: '#f59e0b',
            Icon: Icons.Box,  label: 'Surplus',
        },
    };

    const alertCount = inventoryRecs.filter(r => r.status === 'understocked').length;

    return (
        <Card
            title="Inventory Optimization"
            subtitle={`Stock recommendations for ${nextPeak?.label || 'upcoming peak season'}`}
            accent="#7c3aed"
            badge={alertCount > 0 ? `${alertCount} type${alertCount !== 1 ? 's' : ''} need attention` : 'All types optimal'}
            badgeColor={alertCount > 0 ? '#7c3aed' : '#15803d'}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {inventoryRecs.map(rec => {
                    const s    = STATUS_META[rec.status] || STATUS_META.optimal;
                    const StatusIcon = s.Icon;
                    const fillPct = Math.min((rec.currentStock / Math.max(rec.recommendedStock, 1)) * 100, 100);
                    return (
                        <div key={rec.type} style={{
                            background: s.bg,
                            border: `1px solid ${s.border}`,
                            borderRadius: 10, padding: '14px 16px',
                        }}>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                                        <span style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            width: 24, height: 24, borderRadius: 6,
                                            background: '#fff', border: `1px solid ${s.border}`,
                                            color: s.color, flexShrink: 0,
                                        }}>
                                            <StatusIcon />
                                        </span>
                                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.925rem', color: '#111827' }}>
                                            {rec.type}
                                        </p>
                                        <span style={{
                                            background: '#fff', color: s.color,
                                            border: `1px solid ${s.border}`,
                                            fontSize: '0.65rem', fontWeight: 700,
                                            padding: '1px 8px', borderRadius: 5,
                                        }}>
                                            {s.label}
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                                        Avg {rec.avgMonthlyDemand} bookings/mo &nbsp;·&nbsp; avg {fmtPesoShort(rec.avgRevenue)}/booking
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>
                                        {rec.currentStock}
                                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#9ca3af' }}>
                                            &nbsp;/&nbsp;{rec.recommendedStock}
                                        </span>
                                    </p>
                                    <p style={{ margin: '3px 0 0', fontSize: '0.68rem', color: '#9ca3af' }}>
                                        current / recommended
                                    </p>
                                </div>
                            </div>

                            
                            <div style={{ height: 6, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden', marginBottom: 7 }}>
                                <div style={{
                                    height: '100%', width: `${fillPct}%`,
                                    background: s.bar, borderRadius: 999,
                                    transition: 'width 0.6s ease',
                                }} />
                            </div>

                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                                    Peak projection: {rec.peakProjection} booking{rec.peakProjection !== 1 ? 's' : ''}
                                </span>
                                {rec.stockGap !== 0 && (
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: s.color }}>
                                        {rec.stockGap > 0
                                            ? `Need ${rec.stockGap} more unit${rec.stockGap !== 1 ? 's' : ''}`
                                            : `${Math.abs(rec.stockGap)} unit${Math.abs(rec.stockGap) !== 1 ? 's' : ''} surplus`}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

function ProjectionPanel({ last7Days, pipeline, upcoming, avgByType }) {
    const { weeks, blendedWeekly } = useMemo(() =>
        buildForecast({ last7Days, pipeline, upcoming, avgByType }),
        
        [JSON.stringify({ last7Days, pipeline, upcoming, avgByType })]
    );
    const maxVal    = Math.max(...weeks.map(w => w.optimistic), 1);
    const SCENARIOS = [
        { key: 'conservative', label: 'Conservative (−3%/wk)', color: '#94a3b8', track: '#e2e8f0' },
        { key: 'baseline',     label: 'Baseline',               color: '#2563eb', track: '#dbeafe' },
        { key: 'optimistic',   label: 'Optimistic (+5%/wk)',    color: '#15803d', track: '#dcfce7' },
    ];
    return (
        <Card
            title="4-Week Revenue Projection"
            subtitle="Multi-signal: completed history · scheduled bookings · pipeline"
            accent="#2563eb"
            badge={blendedWeekly > 0 ? `~${fmtPesoShort(blendedWeekly)}/wk baseline` : 'Awaiting data'}
            badgeColor="#2563eb"
        >
            <div style={{ marginBottom: 16 }}>
                {weeks.map((w, wi) => (
                    <div key={wi} style={{ marginBottom: 18 }}>
                        <p style={{ margin: '0 0 7px', fontSize: '0.78rem', fontWeight: 700, color: '#374151' }}>{w.week}</p>
                        {SCENARIOS.map(s => (
                            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                                <div style={{ flex: 1, height: 7, borderRadius: 999, background: s.track, overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%',
                                        width: maxVal > 0 ? `${(w[s.key] / maxVal) * 100}%` : '0%',
                                        background: s.color, borderRadius: 999,
                                        transition: 'width 0.7s ease',
                                    }} />
                                </div>
                                <span style={{
                                    fontSize: '0.72rem', fontWeight: 700,
                                    color: w[s.key] > 0 ? s.color : '#d1d5db',
                                    minWidth: 52, textAlign: 'right',
                                }}>
                                    {fmtPesoShort(w[s.key])}
                                </span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                {SCENARIOS.map(s => (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                        <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>{s.label}</span>
                    </div>
                ))}
            </div>
        </Card>
    );
}

function SummaryBanner({ nextPeak, seasonality, inventoryRecs }) {
    const alertCount     = inventoryRecs?.filter(r => r.status === 'understocked').length ?? 0;
    const currentMo      = new Date().getMonth();
    const currentMonthData = seasonality?.[currentMo];
    const currentTier    = currentMonthData?.tier ?? 'normal';
    const currentIdx     = currentMonthData?.index ?? 1;
    const t              = TIER[currentTier] || TIER.normal;
    const CurrentIcon    = t.Icon;

    const stats = [
        {
            label: 'This Month',
            value: currentTier.charAt(0).toUpperCase() + currentTier.slice(1),
            sub: `Demand index: ${currentIdx.toFixed(2)}`,
            color: t.color,
            bg: t.bg,
            border: t.border,
            Icon: CurrentIcon,
        },
        {
            label: 'Next Peak Month',
            value: nextPeak?.label || 'None detected',
            sub: nextPeak ? `Index ×${nextPeak.index?.toFixed(2)}` : 'Patterns need more data',
            color: TIER.peak.color,
            bg: TIER.peak.bg,
            border: TIER.peak.border,
            Icon: Icons.Peak,
        },
        {
            label: 'Stock Alerts',
            value: alertCount > 0 ? `${alertCount} type${alertCount !== 1 ? 's' : ''}` : 'All optimal',
            sub: alertCount > 0 ? 'Understocked for peak season' : 'Inventory well-positioned',
            color: alertCount > 0 ? '#b91c1c' : '#15803d',
            bg: alertCount > 0 ? '#fef2f2' : '#f0fdf4',
            border: alertCount > 0 ? '#fecaca' : '#bbf7d0',
            Icon: alertCount > 0 ? Icons.Alert : Icons.Check,
        },
        {
            label: 'Next Month Pricing',
            value: (() => {
                const next = seasonality?.[(currentMo + 1) % 12];
                if (!next) return '—';
                const m = next.pricingMultiplier;
                return m > 1 ? `+${Math.round((m - 1) * 100)}%` : m < 1 ? `−${Math.round((1 - m) * 100)}%` : 'Standard';
            })(),
            sub: (() => {
                const next = seasonality?.[(currentMo + 1) % 12];
                if (!next) return '';
                return next.monthName + ' · ' + next.tier + ' season';
            })(),
            color: '#d97706',
            bg: '#fffbeb',
            border: '#fde68a',
            Icon: Icons.Tag,
        },
    ];

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 24 }}>
            {stats.map(s => {
                const StatIcon = s.Icon;
                return (
                    <div key={s.label} style={{
                        background: s.bg, borderRadius: 12,
                        border: `1px solid ${s.border}`,
                        padding: '14px 16px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                {s.label}
                            </p>
                            <span style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 26, height: 26, borderRadius: 6,
                                background: '#fff', border: `1px solid ${s.border}`,
                                color: s.color,
                            }}>
                                <StatIcon />
                            </span>
                        </div>
                        <p style={{ margin: '0 0 3px', fontSize: '1.05rem', fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>
                            {s.value}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#9ca3af', lineHeight: 1.4 }}>{s.sub}</p>
                    </div>
                );
            })}
        </div>
    );
}

export default function ForecastingPage() {
    const [analyticsData, setAnalyticsData] = useState(null);
    const [seasonalData,  setSeasonalData]  = useState(null);
    const [loading,       setLoading]       = useState(true);
    const [error,         setError]         = useState('');
    const [activeTab,     setActiveTab]     = useState('seasonal');
    const [lastUpdated,   setLastUpdated]   = useState(null);

    const fetchAll = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const [analyticsRes, seasonalRes] = await Promise.all([
                apiFetch('/api/dashboard/analytics'),
                apiFetch('/api/dashboard/seasonal'),
            ]);
            if (!analyticsRes.success) throw new Error(analyticsRes.message);
            if (!seasonalRes.success)  throw new Error(seasonalRes.message);
            setAnalyticsData(analyticsRes.data);
            setSeasonalData(seasonalRes.data);
            setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const TABS = [
        { id: 'seasonal',  label: 'Seasonal Demand', Icon: Icons.Calendar },
        { id: 'inventory', label: 'Inventory',        Icon: Icons.Package  },
        { id: 'pricing',   label: 'Pricing',          Icon: Icons.Tag      },
        { id: 'forecast',  label: '4-Week Forecast',  Icon: Icons.TrendUp  },
        { id: 'arima', label: 'ARIMA Forecast', Icon: Icons.TrendUp },
    ];

    return (
        <div style={{ padding: '0px', minHeight: '100%', fontFamily: "'DM Sans','Inter',sans-serif" }}>
            <style>{`
                @keyframes fp-shimmer {
                    0%   { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>

            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#111827' }}>
                        Forecasting & Optimization
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                        Seasonal demand · inventory recommendations · dynamic pricing
                        {lastUpdated && (
                            <span style={{ marginLeft: 8, color: '#cbd5e1' }}>· Updated {lastUpdated}</span>
                        )}
                    </p>
                </div>
                <button onClick={fetchAll} disabled={loading} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                    background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 8,
                    cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.82rem',
                    fontWeight: 600, color: '#475569', fontFamily: 'inherit',
                    opacity: loading ? 0.55 : 1, transition: 'background 0.15s',
                }}>
                    <Icons.Refresh />
                    Refresh
                </button>
            </div>

            
            {error && (
                <div style={{
                    background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca',
                    borderRadius: 10, padding: '14px 18px', marginBottom: 20, fontSize: '0.875rem',
                    display: 'flex', alignItems: 'center', gap: 10,
                }}>
                    <Icons.Alert />
                    {error}
                    <button onClick={fetchAll} style={{
                        marginLeft: 'auto', textDecoration: 'underline', background: 'none',
                        border: 'none', cursor: 'pointer', color: '#b91c1c', fontFamily: 'inherit', fontSize: '0.875rem',
                    }}>
                        Retry
                    </button>
                </div>
            )}

            
            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={88} />)}
                </div>
            ) : seasonalData && (
                <SummaryBanner
                    nextPeak={seasonalData.nextPeak}
                    seasonality={seasonalData.seasonality}
                    inventoryRecs={seasonalData.inventoryRecs}
                />
            )}

            
            <div style={{
                display: 'flex', gap: 3, marginBottom: 20,
                background: '#f1f5f9', borderRadius: 10, padding: '4px',
                flexWrap: 'wrap',
            }}>
                {TABS.map(tab => {
                    const TabIcon = tab.Icon;
                    const active  = activeTab === tab.id;
                    return (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                            flex: 1, minWidth: 120, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', gap: 7,
                            padding: '8px 14px', borderRadius: 7, border: 'none',
                            cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                            fontFamily: 'inherit',
                            background: active ? '#fff' : 'transparent',
                            color: active ? '#111827' : '#64748b',
                            boxShadow: active ? '0 1px 4px rgba(0,0,0,0.09)' : 'none',
                            transition: 'all 0.15s', whiteSpace: 'nowrap',
                        }}>
                            <TabIcon />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            
            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(420px,1fr))', gap: 20 }}>
                    {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} h={380} />)}
                </div>
            ) : (
                <>
                    {activeTab === 'seasonal' && seasonalData && (
                        <SeasonalityHeatmap seasonality={seasonalData.seasonality} />
                    )}
                    {activeTab === 'inventory' && seasonalData && (
                        <InventoryRecommendations
                            inventoryRecs={seasonalData.inventoryRecs}
                            nextPeak={seasonalData.nextPeak}
                        />
                    )}
                    {activeTab === 'pricing' && seasonalData && analyticsData && (
                        <PricingSuggestions
                            outlook={seasonalData.outlook}
                            avgByType={analyticsData.avgByType}
                        />
                    )}
                    {activeTab === 'forecast' && analyticsData && (
                        <ProjectionPanel
                            last7Days={analyticsData.revenue?.last7Days}
                            pipeline={analyticsData.pipeline}
                            upcoming={analyticsData.upcoming}
                            avgByType={analyticsData.avgByType}
                        />
                    )}
                    {activeTab === 'arima' && <ArimaForecastTab />}
                </>
            )}
        </div>
    );
}