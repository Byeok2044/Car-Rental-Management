import React, { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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

const formatDate = (iso) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const STATUS_TABS = ['All', 'Unread', 'Read', 'Archived'];

const SUBJECT_COLORS = {
    'General Inquiry': '#6366f1',
    'Booking Support':  '#f59e0b',
    'Fleet Questions':  '#10b981',
    'Feedback':         '#3b82f6',
};

const URGENCY_META = {
    high:   { bg: '#fee2e2', color: '#991b1b', dot: '#ef4444', border: '#fca5a5', label: 'HIGH',   full: 'High'   },
    medium: { bg: '#fef9c3', color: '#854d0e', dot: '#f59e0b', border: '#fde68a', label: 'MED',    full: 'Medium' },
    low:    { bg: '#f0fdf4', color: '#166534', dot: '#22c55e', border: '#bbf7d0', label: 'LOW',    full: 'Low'    },
};

function UrgencyBadge({ urgency, size = 'sm' }) {
    if (!urgency) return null;
    const s = URGENCY_META[urgency] || URGENCY_META.low;
    const isLg = size === 'lg';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: isLg ? 5 : 4,
            background: s.bg, color: s.color,
            fontSize: isLg ? '0.75rem' : '0.65rem',
            fontWeight: 800, letterSpacing: '0.06em',
            padding: isLg ? '4px 10px' : '2px 7px',
            borderRadius: 20,
            border: `1px solid ${s.border}`,
        }}>
            <span style={{
                width: isLg ? 7 : 5, height: isLg ? 7 : 5,
                borderRadius: '50%', background: s.dot, display: 'inline-block',
                flexShrink: 0,
            }} />
            {isLg ? s.full : s.label}
        </span>
    );
}

function UrgencySummaryBar({ messages, activeUrgency, onUrgencyFilter }) {
    const high   = messages.filter(m => m.urgency === 'high').length;
    const medium = messages.filter(m => m.urgency === 'medium').length;
    const low    = messages.filter(m => m.urgency === 'low').length;
    const highUnread = messages.filter(m => m.urgency === 'high' && m.status === 'Unread').length;

    if (messages.length === 0) return null;

    const cards = [
        {
            key:    'high',
            label:  'High urgency',
            count:  high,
            sub:    highUnread > 0 ? `${highUnread} unread` : 'all read',
            badge:  highUnread > 0 ? `⚠ ${highUnread} unread` : null,
            bg:     activeUrgency === 'high' ? '#fee2e2' : '#fff',
            border: activeUrgency === 'high' ? '#ef4444' : '#fca5a5',
            color:  '#991b1b',
            dot:    '#ef4444',
        },
        {
            key:    'medium',
            label:  'Medium urgency',
            count:  medium,
            sub:    'booking inquiries',
            badge:  null,
            bg:     activeUrgency === 'medium' ? '#fef9c3' : '#fff',
            border: activeUrgency === 'medium' ? '#f59e0b' : '#fde68a',
            color:  '#854d0e',
            dot:    '#f59e0b',
        },
        {
            key:    'low',
            label:  'Low urgency',
            count:  low,
            sub:    'feedback & general',
            badge:  null,
            bg:     activeUrgency === 'low' ? '#f0fdf4' : '#fff',
            border: activeUrgency === 'low' ? '#22c55e' : '#bbf7d0',
            color:  '#166534',
            dot:    '#22c55e',
        },
    ];

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            {cards.map(c => (
                <button
                    key={c.key}
                    onClick={() => onUrgencyFilter(activeUrgency === c.key ? null : c.key)}
                    style={{
                        background: c.bg,
                        border: `1.5px solid ${c.border}`,
                        borderRadius: 12,
                        padding: '16px 18px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                        boxShadow: activeUrgency === c.key
                            ? '0 4px 14px rgba(0,0,0,0.12)'
                            : '0 1px 4px rgba(0,0,0,0.05)',
                        transform: activeUrgency === c.key ? 'translateY(-2px)' : 'none',
                        fontFamily: 'inherit',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            {c.label}
                        </span>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, display: 'inline-block', flexShrink: 0 }} />
                    </div>
                    <p style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: c.color, lineHeight: 1 }}>
                        {c.count}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: c.color, opacity: 0.7 }}>
                        {c.sub}
                    </p>
                    {c.badge && (
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            marginTop: 8, fontSize: '0.7rem', fontWeight: 700,
                            padding: '2px 8px', borderRadius: 20,
                            background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b',
                        }}>
                            {c.badge}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}

function StatusPill({ status }) {
    const map = {
        Unread:   { bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
        Read:     { bg: '#f0fdf4', color: '#166534', dot: '#22c55e' },
        Archived: { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
    };
    const s = map[status] || map.Unread;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: s.bg, color: s.color,
            fontSize: '0.72rem', fontWeight: 700,
            padding: '3px 10px', borderRadius: 20,
        }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
            {status}
        </span>
    );
}

function UrgencyPanel({ msg, onUrgencyCorrected }) {
    const [correcting,   setCorrecting]   = useState(false);
    const [saving,       setSavingLocal]  = useState(false);
    const [pickValue,    setPickValue]    = useState(msg.urgency || 'medium');
    const [saved,        setSaved]        = useState(false);

    useEffect(() => {
        setCorrecting(false);
        setPickValue(msg.urgency || 'medium');
        setSaved(false);
    }, [msg._id]);

    async function submitCorrection() {
        setSavingLocal(true);
        try {
            const data = await apiFetch(`/api/admin/messages/${msg._id}/urgency`, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ urgency: pickValue }),
            });
            onUrgencyCorrected(data.msg);
            setSaved(true);
            setCorrecting(false);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            alert(err.message);
        } finally {
            setSavingLocal(false);
        }
    }

    const u     = msg.urgency;
    const meta  = u ? URGENCY_META[u] : null;
    const score = msg.urgencyScore;
    const bd    = msg.urgencyBreakdown;

    return (
        <div style={{
            background: meta ? meta.bg : '#f8fafc',
            border: `1.5px solid ${meta ? meta.border : '#e2e8f0'}`,
            borderRadius: 10,
            padding: '14px 16px',
            marginBottom: 16,
        }}>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: meta?.color || '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Urgency Classification
                    </p>
                    {u ? <UrgencyBadge urgency={u} size="lg" /> : (
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>Not classified</span>
                    )}
                    {msg.urgencyConfirmed && (
                        <span style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#166534', padding: '1px 7px', borderRadius: 20, border: '1px solid #bbf7d0', fontWeight: 700 }}>
                            ✓ Confirmed
                        </span>
                    )}
                    {saved && (
                        <span style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#166534', padding: '1px 7px', borderRadius: 20, fontWeight: 700 }}>
                            Saved ✓
                        </span>
                    )}
                </div>
                {!correcting && (
                    <button
                        onClick={() => setCorrecting(true)}
                        style={{
                            padding: '4px 12px', borderRadius: 6,
                            border: '1.5px solid #e2e8f0',
                            background: '#fff', cursor: 'pointer',
                            fontSize: '0.72rem', fontWeight: 600,
                            color: '#475569', fontFamily: 'inherit',
                            transition: 'border-color 0.15s',
                        }}
                    >
                        Correct
                    </button>
                )}
            </div>

            
            {score != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: '0.72rem', color: meta?.color || '#64748b', fontWeight: 600 }}>
                        Score: {score}
                    </span>
                    <div style={{ flex: 1, height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${Math.min((score / 60) * 100, 100)}%`,
                            background: meta?.dot || '#94a3b8',
                            borderRadius: 3,
                            transition: 'width 0.4s ease',
                        }} />
                    </div>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                        {msg.urgencyMethod || 'rule-based'}
                    </span>
                </div>
            )}

            
            {bd && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {bd.highKeywords?.length > 0 && (
                        <KeywordRow
                         label="High signals"
                         color="#ef4444"
                         bg="#fee2e2"
                        items={bd.highKeywords}
                        />
                    )}
                    {bd.mediumKeywords?.length > 0 && (
                        <KeywordRow
                            label="Medium signals"
                            color="#f59e0b"
                            bg="#fef9c3"
                            items={bd.mediumKeywords}
                        />
                    )}
                    {bd.timeSignals?.length > 0 && (
                        <KeywordRow
                            label="Time signals"
                            color="#6366f1"
                            bg="#eef2ff"
                            items={bd.timeSignals}
                        />
                    )}
                    {bd.sentimentSignals?.length > 0 && (
                        <KeywordRow
                            label="Sentiment"
                            color="#8b5cf6"
                            bg="#f5f3ff"
                            items={bd.sentimentSignals}
                        />
                    )}
                    {bd.lowKeywords?.length > 0 && (
                        <KeywordRow
                            label="Low signals (−)"
                            color="#94a3b8"
                            bg="#f1f5f9"
                            items={bd.lowKeywords}
                        />
                    )}
                </div>
            )}

            
            {correcting && (
                <div style={{
                    marginTop: 12, paddingTop: 12,
                    borderTop: `1px solid ${meta?.border || '#e2e8f0'}`,
                }}>
                    <p style={{ margin: '0 0 8px', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Correct classification
                    </p>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        {['high', 'medium', 'low'].map(tier => {
                            const m  = URGENCY_META[tier];
                            const on = pickValue === tier;
                            return (
                                <button
                                    key={tier}
                                    onClick={() => setPickValue(tier)}
                                    style={{
                                        flex: 1, padding: '8px 0', borderRadius: 8,
                                        border: `2px solid ${on ? m.dot : m.border}`,
                                        background: on ? m.bg : '#fff',
                                        color: m.color, cursor: 'pointer',
                                        fontSize: '0.78rem', fontWeight: 700,
                                        fontFamily: 'inherit',
                                        transition: 'all 0.12s',
                                    }}
                                >
                                    {m.full}
                                </button>
                            );
                        })}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={submitCorrection}
                            disabled={saving}
                            style={{
                                flex: 1, padding: '9px 0',
                                background: '#2563eb', color: '#fff',
                                border: 'none', borderRadius: 8,
                                cursor: saving ? 'not-allowed' : 'pointer',
                                fontSize: '0.82rem', fontWeight: 700,
                                fontFamily: 'inherit', opacity: saving ? 0.6 : 1,
                            }}
                        >
                            {saving ? 'Saving...' : 'Save correction'}
                        </button>
                        <button
                            onClick={() => setCorrecting(false)}
                            disabled={saving}
                            style={{
                                padding: '9px 16px',
                                background: 'transparent',
                                border: '1.5px solid #e2e8f0',
                                borderRadius: 8, cursor: 'pointer',
                                fontSize: '0.82rem', color: '#64748b',
                                fontFamily: 'inherit',
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function KeywordRow({ label, color, bg, items }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color, minWidth: 80, paddingTop: 2, flexShrink: 0 }}>
                {label}:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {items.map((item, i) => (
                    <span key={i} style={{
                        background: bg, color,
                        fontSize: '0.65rem', fontWeight: 600,
                        padding: '1px 7px', borderRadius: 12,
                    }}>
                        {item}
                    </span>
                ))}
            </div>
        </div>
    );
}

function ReplyComposer({ msgId, msgSubject, onReplySent }) {
    const [open,    setOpen]    = useState(false);
    const [subject, setSubject] = useState(`Re: ${msgSubject || 'Your enquiry'}`);
    const [body,    setBody]    = useState('');
    const [sending, setSending] = useState(false);
    const [error,   setError]   = useState('');
    const [success, setSuccess] = useState(false);

    async function send() {
        if (!body.trim()) { setError('Reply body cannot be empty.'); return; }
        setSending(true); setError('');
        try {
            const data = await apiFetch(`/api/admin/messages/${msgId}/reply`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ subject, body }),
            });
            onReplySent(data.msg);
            setBody('');
            setSuccess(true);
            setTimeout(() => { setSuccess(false); setOpen(false); }, 1800);
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    }

    return (
        <div style={{ marginTop: 12 }}>
            {!open ? (
                <button
                    onClick={() => setOpen(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '9px 18px',
                        background: '#2563eb', color: '#fff',
                        border: 'none', borderRadius: 8,
                        cursor: 'pointer', fontSize: '0.84rem',
                        fontWeight: 700, fontFamily: 'inherit',
                    }}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                    </svg>
                    Reply
                </button>
            ) : (
                <div style={{
                    background: '#f8fafc', border: '1.5px solid #bfdbfe',
                    borderRadius: 10, padding: 16, marginTop: 8,
                }}>
                    <p style={{ margin: '0 0 10px', fontSize: '0.78rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Compose Reply
                    </p>

                    {success && (
                        <div style={{ background: '#dcfce7', color: '#166534', borderRadius: 7, padding: '8px 12px', marginBottom: 10, fontSize: '0.84rem', fontWeight: 600 }}>
                            Reply sent — email dispatched to customer.
                        </div>
                    )}
                    {error && (
                        <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 7, padding: '8px 12px', marginBottom: 10, fontSize: '0.84rem' }}>
                            {error}
                        </div>
                    )}

                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Subject
                    </label>
                    <input
                        type="text" value={subject}
                        onChange={e => setSubject(e.target.value)}
                        disabled={sending}
                        style={{
                            width: '100%', padding: '8px 12px', marginBottom: 10,
                            border: '1.5px solid #e2e8f0', borderRadius: 7,
                            fontSize: '0.875rem', fontFamily: 'inherit',
                            outline: 'none', boxSizing: 'border-box', background: '#fff',
                        }}
                    />
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Message *
                    </label>
                    <textarea
                        value={body} rows={5} disabled={sending}
                        onChange={e => { setBody(e.target.value); setError(''); }}
                        placeholder="Type your reply here..."
                        style={{
                            width: '100%', padding: '8px 12px', marginBottom: 10,
                            border: '1.5px solid #e2e8f0', borderRadius: 7,
                            fontSize: '0.875rem', fontFamily: 'inherit',
                            resize: 'vertical', outline: 'none', boxSizing: 'border-box', background: '#fff',
                        }}
                    />
                    <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0 0 10px' }}>
                        An email will be sent to the customer automatically.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={send} disabled={sending || success}
                            style={{
                                padding: '9px 20px',
                                background: sending ? '#93c5fd' : '#2563eb',
                                color: '#fff', border: 'none', borderRadius: 7,
                                cursor: sending ? 'not-allowed' : 'pointer',
                                fontSize: '0.85rem', fontWeight: 700, fontFamily: 'inherit',
                                opacity: sending ? 0.75 : 1,
                            }}>
                            {sending ? 'Sending...' : 'Send Reply'}
                        </button>
                        <button
                            onClick={() => { setOpen(false); setError(''); setBody(''); }}
                            disabled={sending}
                            style={{
                                padding: '9px 16px', background: 'transparent',
                                border: '1.5px solid #e2e8f0', borderRadius: 7,
                                cursor: 'pointer', fontSize: '0.85rem',
                                color: '#64748b', fontFamily: 'inherit',
                            }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function ReplyHistory({ replies }) {
    if (!replies || replies.length === 0) return null;
    return (
        <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
                Replies ({replies.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...replies].reverse().map((r, i) => (
                    <div key={r._id || i} style={{
                        background: '#eff6ff', borderLeft: '4px solid #2563eb',
                        borderRadius: '0 8px 8px 0', padding: '12px 14px',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e40af' }}>{r.subject || 'Reply'}</span>
                            <span style={{ fontSize: '0.72rem', color: '#93c5fd', whiteSpace: 'nowrap', marginLeft: 8 }}>
                                {r.sentAt ? `${formatDate(r.sentAt)} · ${formatTime(r.sentAt)}` : ''}
                            </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#1e3a8a', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                            {r.body}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function MessageDrawer({ msg: initialMsg, onClose, onStatusChange, onUrgencyCorrected, saving }) {
    const [msg, setMsg] = useState(initialMsg);
    useEffect(() => { setMsg(initialMsg); }, [initialMsg]);
    if (!msg) return null;

    const otherStatuses = ['Read', 'Unread', 'Archived'].filter(s => s !== msg.status);

    function handleUrgencyUpdate(updatedMsg) {
        setMsg(updatedMsg);
        onUrgencyCorrected(updatedMsg);
    }

    return (
        <>
            <div onClick={onClose} style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
                zIndex: 200, backdropFilter: 'blur(2px)',
            }} />
            <div style={{
                position: 'fixed', top: 0, right: 0, bottom: 0,
                width: '100%', maxWidth: 500,
                background: '#fff', zIndex: 201,
                display: 'flex', flexDirection: 'column',
                boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
                animation: 'mp-slideIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
                
                <div style={{
                    padding: '20px 24px 18px', background: '#111827',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    flexShrink: 0,
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <p style={{ color: '#ffc107', fontSize: '0.7rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>
                                Message Detail
                            </p>
                            <UrgencyBadge urgency={msg.urgency} />
                        </div>
                        <h2 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{msg.name}</h2>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', margin: '4px 0 0' }}>{msg.email}</p>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                        color: '#fff', width: 32, height: 32, borderRadius: '50%',
                        cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                    }}>×</button>
                </div>

                
                <div style={{
                    padding: '12px 24px', borderBottom: '1px solid #f1f5f9',
                    display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0,
                }}>
                    <span style={{
                        background: SUBJECT_COLORS[msg.subject] ? SUBJECT_COLORS[msg.subject] + '18' : '#f1f5f9',
                        color: SUBJECT_COLORS[msg.subject] || '#475569',
                        border: `1px solid ${SUBJECT_COLORS[msg.subject] || '#e2e8f0'}30`,
                        fontSize: '0.75rem', fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                    }}>{msg.subject || 'No subject'}</span>
                    <StatusPill status={msg.status} />
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginLeft: 'auto' }}>
                        {formatDate(msg.createdAt)} · {formatTime(msg.createdAt)}
                    </span>
                </div>

               
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px' }}>

                    
                    <UrgencyPanel msg={msg} onUrgencyCorrected={handleUrgencyUpdate} />

                    
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, marginTop: 0 }}>
                        Message
                    </p>
                    <div style={{
                        background: '#f8fafc', borderRadius: 10, padding: '16px 18px',
                        border: '1px solid #e2e8f0', lineHeight: 1.75,
                        fontSize: '0.92rem', color: '#1e293b', whiteSpace: 'pre-wrap',
                    }}>
                        {msg.message}
                    </div>

                    <ReplyHistory replies={msg.replies} />
                    <ReplyComposer
                        msgId={msg._id}
                        msgSubject={msg.subject}
                        onReplySent={(updatedMsg) => setMsg(updatedMsg)}
                    />
                </div>

                {}
                <div style={{
                    padding: '14px 24px', borderTop: '1px solid #f1f5f9',
                    display: 'flex', gap: 8, flexShrink: 0, background: '#f8fafc', flexWrap: 'wrap',
                }}>
                    {otherStatuses.map(s => (
                        <button key={s} onClick={() => onStatusChange(msg._id, s)} disabled={saving}
                            style={{
                                flex: 1, minWidth: 90, padding: '9px 0',
                                borderRadius: 8, cursor: 'pointer',
                                fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit',
                                border: s === 'Archived' ? '1.5px solid #e2e8f0' : 'none',
                                background: s === 'Read' ? '#2563eb' : s === 'Unread' ? '#f59e0b' : 'transparent',
                                color: s === 'Archived' ? '#64748b' : '#fff',
                                opacity: saving ? 0.6 : 1,
                            }}>
                            Mark {s}
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
}

export default function MessagesPage() {
    const [messages,       setMessages]       = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [error,          setError]          = useState(null);
    const [activeTab,      setActiveTab]      = useState('All');
    const [activeUrgency,  setActiveUrgency]  = useState(null);   
    const [search,         setSearch]         = useState('');
    const [selected,       setSelected]       = useState(null);
    const [saving,         setSaving]         = useState(false);

    const fetchMessages = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const data = await apiFetch('/api/admin/messages');
            setMessages(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchMessages(); }, [fetchMessages]);

    
    const openMessage = async (msg) => {
        setSelected(msg);
        if (msg.status === 'Unread') {
            try {
                await apiFetch(`/api/admin/messages/${msg._id}/status`, {
                    method:  'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ status: 'Read' }),
                });
                setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, status: 'Read' } : m));
                setSelected(prev => prev?._id === msg._id ? { ...prev, status: 'Read' } : prev);
            } catch {  }
        }
    };

    const handleStatusChange = async (id, status) => {
        setSaving(true);
        try {
            await apiFetch(`/api/admin/messages/${id}/status`, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ status }),
            });
            setMessages(prev => prev.map(m => m._id === id ? { ...m, status } : m));
            setSelected(prev => prev?._id === id ? { ...prev, status } : prev);
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this message? This cannot be undone.')) return;
        try {
            await apiFetch(`/api/admin/messages/${id}`, { method: 'DELETE' });
            setMessages(prev => prev.filter(m => m._id !== id));
            if (selected?._id === id) setSelected(null);
        } catch (err) {
            alert(err.message);
        }
    };

    
    const handleUrgencyCorrected = (updatedMsg) => {
        setMessages(prev => prev.map(m => m._id === updatedMsg._id ? updatedMsg : m));
    };

    const filtered = messages.filter(m => {
        const matchTab     = activeTab === 'All' || m.status === activeTab;
        const matchUrgency = activeUrgency === null
            ? true
            : activeUrgency === null
                ? true
                : m.urgency === activeUrgency;
        const term         = search.toLowerCase();
        const matchSearch  = !term || [m.name, m.email, m.subject, m.message]
            .some(f => f?.toLowerCase().includes(term));
        return matchTab && matchUrgency && matchSearch;
    });

    const unreadCount = messages.filter(m => m.status === 'Unread').length;
    const highUnread  = messages.filter(m => m.urgency === 'high' && m.status === 'Unread').length;

    return (
        <div style={{ minHeight: '100%', fontFamily: "'DM Sans','Inter',sans-serif" }}>
            <style>{`
                @keyframes mp-slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to   { transform: translateX(0);    opacity: 1; }
                }
                @keyframes mp-fadeUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .mp-row { animation: mp-fadeUp 0.3s ease both; cursor: pointer; }
                .mp-row:hover { background: #f8fafc !important; }
                .mp-del-btn { opacity: 0; transition: opacity 0.15s; }
                .mp-row:hover .mp-del-btn { opacity: 1; }
            `}</style>

            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                        Messages
                        {unreadCount > 0 && (
                            <span style={{
                                marginLeft: 10, background: '#2563eb', color: '#fff',
                                fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px',
                                borderRadius: 20, verticalAlign: 'middle',
                            }}>{unreadCount} new</span>
                        )}
                        {highUnread > 0 && (
                            <span style={{
                                marginLeft: 6, background: '#ef4444', color: '#fff',
                                fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px',
                                borderRadius: 20, verticalAlign: 'middle',
                            }}>⚠ {highUnread} urgent</span>
                        )}
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '4px 0 0' }}>
                        Contact form submissions from your website
                    </p>
                </div>
                <button onClick={fetchMessages} style={{
                    background: '#f1f5f9', border: '1.5px solid #e2e8f0',
                    borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                    fontSize: '0.82rem', fontWeight: 600, color: '#475569',
                    display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                    Refresh
                </button>
            </div>

            
            <UrgencySummaryBar
                messages={messages}
                activeUrgency={activeUrgency}
                onUrgencyFilter={setActiveUrgency}
            />

            
            {activeUrgency && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
                    padding: '8px 14px',
                    background: URGENCY_META[activeUrgency]?.bg,
                    border: `1.5px solid ${URGENCY_META[activeUrgency]?.border}`,
                    borderRadius: 8,
                }}>
                    <UrgencyBadge urgency={activeUrgency} size="lg" />
                    <span style={{ fontSize: '0.82rem', color: URGENCY_META[activeUrgency]?.color, fontWeight: 600 }}>
                        Filtering by {URGENCY_META[activeUrgency]?.full} urgency
                    </span>
                    <button
                        onClick={() => setActiveUrgency(null)}
                        style={{
                            marginLeft: 'auto', padding: '3px 10px',
                            background: 'transparent',
                            border: `1px solid ${URGENCY_META[activeUrgency]?.border}`,
                            borderRadius: 6, cursor: 'pointer',
                            fontSize: '0.72rem', fontWeight: 600,
                            color: URGENCY_META[activeUrgency]?.color,
                            fontFamily: 'inherit',
                        }}
                    >
                        Clear filter ×
                    </button>
                </div>
            )}

            
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, gap: 2 }}>
                    {STATUS_TABS.map(tab => {
                        const count = tab === 'All' ? messages.length
                            : messages.filter(m => m.status === tab).length;
                        return (
                            <button key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    padding: '6px 14px', borderRadius: 7, border: 'none',
                                    cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                                    fontFamily: 'inherit',
                                    background: activeTab === tab ? '#fff' : 'transparent',
                                    color: activeTab === tab ? '#111827' : '#64748b',
                                    boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                                    transition: 'all 0.15s',
                                }}>
                                {tab} {count > 0 && (
                                    <span style={{ color: activeTab === tab ? '#2563eb' : '#94a3b8' }}>
                                        ({count})
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
                <input
                    type="text"
                    placeholder="Search by name, email, subject..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                        flex: 1, minWidth: 200, padding: '9px 14px',
                        border: '1.5px solid #e2e8f0', borderRadius: 8,
                        fontSize: '0.875rem', outline: 'none', background: '#fff',
                        color: '#111827', fontFamily: 'inherit',
                    }}
                />
            </div>

            
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{
                            width: 32, height: 32,
                            border: '3px solid #e2e8f0', borderTopColor: '#2563eb',
                            borderRadius: '50%',
                            animation: 'mp-fadeUp 0.8s linear infinite',
                            margin: '0 auto 12px',
                        }} />
                        Loading messages...
                    </div>
                ) : error ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#ef4444' }}>
                        Error: {error}
                        <br/>
                        <button onClick={fetchMessages} style={{ marginTop: 12, padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Retry
                        </button>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" style={{ marginBottom: 12 }}>
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        <p style={{ margin: 0, fontWeight: 600 }}>No messages found</p>
                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
                            {search || activeUrgency ? 'Try clearing your filters' : 'Messages from your contact form will appear here'}
                        </p>
                        {(search || activeUrgency) && (
                            <button
                                onClick={() => { setSearch(''); setActiveUrgency(null); }}
                                style={{ marginTop: 12, padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                {['Sender', 'Subject', 'Preview', 'Status', 'Replies', 'Received', ''].map(h => (
                                    <th key={h} style={{
                                        padding: '12px 16px', textAlign: 'left',
                                        fontSize: '0.72rem', fontWeight: 700,
                                        color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px',
                                        background: '#fafafa',
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((msg, i) => (
                                <tr key={msg._id}
                                    className="mp-row"
                                    onClick={() => openMessage(msg)}
                                    style={{
                                        borderBottom: '1px solid #f1f5f9',
                                        animationDelay: `${i * 0.04}s`,
                                        background: msg.urgency === 'high' && msg.status === 'Unread'
                                            ? '#fff7f7'
                                            : msg.status === 'Unread'
                                                ? '#fffbeb'
                                                : '#fff',
                                    }}>
                                    
                                    <td style={{ padding: '14px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: '50%',
                                                background: msg.urgency === 'high' ? '#fee2e2' : '#eff6ff',
                                                color: msg.urgency === 'high' ? '#991b1b' : '#2563eb',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.9rem', fontWeight: 700, flexShrink: 0,
                                            }}>{msg.name.charAt(0).toUpperCase()}</div>
                                            <div>
                                                <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: msg.status === 'Unread' ? 700 : 500, color: '#111827' }}>
                                                    {msg.name}
                                                </p>
                                                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>{msg.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    
                                    <td style={{ padding: '14px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                background: SUBJECT_COLORS[msg.subject] ? SUBJECT_COLORS[msg.subject] + '15' : '#f1f5f9',
                                                color: SUBJECT_COLORS[msg.subject] || '#475569',
                                                fontSize: '0.75rem', fontWeight: 600,
                                                padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
                                            }}>{msg.subject || '—'}</span>
                                            <UrgencyBadge urgency={msg.urgency} />
                                        </div>
                                    </td>
                                    
                                    <td style={{ padding: '14px 16px', maxWidth: 220 }}>
                                        <p style={{
                                            margin: 0, fontSize: '0.85rem', color: '#475569',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            fontWeight: msg.status === 'Unread' ? 600 : 400,
                                        }}>{msg.message}</p>
                                    </td>
                                    
                                    <td style={{ padding: '14px 16px' }}>
                                        <StatusPill status={msg.status} />
                                    </td>
                                    
                                    <td style={{ padding: '14px 16px' }}>
                                        {msg.replies?.length > 0 ? (
                                            <span style={{
                                                background: '#eff6ff', color: '#2563eb',
                                                fontSize: '0.72rem', fontWeight: 700,
                                                padding: '3px 9px', borderRadius: 20,
                                                border: '1px solid #bfdbfe',
                                            }}>
                                                {msg.replies.length} sent
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '0.78rem', color: '#d1d5db' }}>—</span>
                                        )}
                                    </td>
                                    
                                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#374151' }}>{formatDate(msg.createdAt)}</p>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>{formatTime(msg.createdAt)}</p>
                                    </td>
                                    
                                    <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                                        <button
                                            className="mp-del-btn"
                                            onClick={() => handleDelete(msg._id)}
                                            title="Delete"
                                            style={{
                                                background: '#fee2e2', border: 'none', color: '#dc2626',
                                                width: 30, height: 30, borderRadius: 6,
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <polyline points="3 6 5 6 21 6"/>
                                                <path d="M19 6l-1 14H6L5 6"/>
                                                <path d="M10 11v6M14 11v6"/>
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <MessageDrawer
                msg={selected}
                onClose={() => setSelected(null)}
                onStatusChange={handleStatusChange}
                onUrgencyCorrected={handleUrgencyCorrected}
                saving={saving}
            />
        </div>
    );
}