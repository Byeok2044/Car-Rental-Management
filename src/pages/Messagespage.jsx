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

function MessageDrawer({ msg: initialMsg, onClose, onStatusChange, saving }) {
    const [msg, setMsg] = useState(initialMsg);
    useEffect(() => { setMsg(initialMsg); }, [initialMsg]);
    if (!msg) return null;

    const otherStatuses = ['Read', 'Unread', 'Archived'].filter(s => s !== msg.status);

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
                {/* Header */}
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

                {/* Subject & meta strip */}
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

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px' }}>
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

                {/* Status actions */}
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
    const [messages,  setMessages]  = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState(null);
    const [activeTab, setActiveTab] = useState('All');
    const [search,    setSearch]    = useState('');
    const [selected,  setSelected]  = useState(null);
    const [saving,    setSaving]    = useState(false);

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
            } catch { /* non-fatal */ }
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

    const filtered = messages.filter(m => {
        const matchTab    = activeTab === 'All' || m.status === activeTab;
        const term        = search.toLowerCase();
        const matchSearch = !term || [m.name, m.email, m.subject, m.message]
            .some(f => f?.toLowerCase().includes(term));
        return matchTab && matchSearch;
    });

    const unreadCount = messages.filter(m => m.status === 'Unread').length;

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

            {/* Page header */}
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

            {/* Status tabs + search */}
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

            {/* Table */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
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
                            {search ? 'Try clearing your search' : 'Messages from your contact form will appear here'}
                        </p>
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
                                        background: msg.status === 'Unread' ? '#fffbeb' : '#fff',
                                    }}>

                                    {/* Sender */}
                                    <td style={{ padding: '14px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: '50%',
                                                background: '#eff6ff', color: '#2563eb',
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

                                    {/* Subject */}
                                    <td style={{ padding: '14px 16px' }}>
                                        <span style={{
                                            display: 'inline-block',
                                            background: SUBJECT_COLORS[msg.subject] ? SUBJECT_COLORS[msg.subject] + '15' : '#f1f5f9',
                                            color: SUBJECT_COLORS[msg.subject] || '#475569',
                                            fontSize: '0.75rem', fontWeight: 600,
                                            padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
                                        }}>{msg.subject || '—'}</span>
                                    </td>

                                    {/* Preview */}
                                    <td style={{ padding: '14px 16px', maxWidth: 220 }}>
                                        <p style={{
                                            margin: 0, fontSize: '0.85rem', color: '#475569',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            fontWeight: msg.status === 'Unread' ? 600 : 400,
                                        }}>{msg.message}</p>
                                    </td>

                                    {/* Status */}
                                    <td style={{ padding: '14px 16px' }}>
                                        <StatusPill status={msg.status} />
                                    </td>

                                    {/* Replies */}
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

                                    {/* Received */}
                                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#374151' }}>{formatDate(msg.createdAt)}</p>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>{formatTime(msg.createdAt)}</p>
                                    </td>

                                    {/* Delete */}
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
                saving={saving}
            />
        </div>
    );
}