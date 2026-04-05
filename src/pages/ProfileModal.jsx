import React, { useState, useEffect, useCallback } from 'react';
import './ProfileModal.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getToken() {
    return localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
}

async function apiFetch(path, options = {}) {
    const token = getToken();
    const res = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
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

const AVATAR_COLORS = [
    '#2563eb', '#7c3aed', '#db2777', '#059669',
    '#d97706', '#dc2626', '#0891b2', '#65a30d',
];

const FIELDS = [
    { key: 'fullName',  label: 'Full Name',        placeholder: 'e.g. Maria Santos',         type: 'text',  icon: PersonIcon  },
    { key: 'role',      label: 'Job Title / Role',  placeholder: 'e.g. Fleet Administrator',  type: 'text',  icon: BadgeIcon   },
    { key: 'email',     label: 'Contact Email',     placeholder: 'admin@example.com',          type: 'email', icon: MailIcon    },
    { key: 'phone',     label: 'Phone Number',      placeholder: '+63 912 345 6789',           type: 'tel',   icon: PhoneIcon   },
    { key: 'location',  label: 'Location / Branch', placeholder: 'e.g. Makati, Metro Manila',  type: 'text',  icon: PinIcon     },
];

function PersonIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function BadgeIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8l-2 4h12z"/></svg>; }
function MailIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>; }
function PhoneIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6 19.79 19.79 0 0 1 1.62 5a2 2 0 0 1 1.99-2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.09a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>; }
function PinIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>; }
function CheckIcon()  { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>; }
function SaveIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>; }
function CloseIcon()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }

const EMPTY = {
    fullName: '', bio: '', phone: '', email: '',
    role: 'Administrator', location: '', avatarColor: '#2563eb',
};

/**
 * Props:
 *   isOpen          — boolean
 *   onClose         — () => void
 *   onProfileSaved  — (profile: object) => void   ← called after successful save
 *   currentColor    — string (optimistic initial color from parent)
 */
export default function ProfileModal({ isOpen, onClose, onProfileSaved, currentColor }) {
    const [form, setForm] = useState({ ...EMPTY, avatarColor: currentColor || '#2563eb' });
    const [saved, setSaved] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    
    // 1. ADD THIS STATE (NEW)
    const [isEditing, setIsEditing] = useState(false);

    const fetchProfile = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const data = await apiFetch('/api/admin/profile');
            if (data) {
                const profile = {
                    fullName:    data.fullName    || '',
                    bio:         data.bio         || '',
                    phone:       data.phone       || '',
                    email:       data.email       || '',
                    role:        data.role        || 'Administrator',
                    location:    data.location    || '',
                    avatarColor: data.avatarColor || currentColor || '#2563eb',
                };
                setForm(profile);
                setSaved(profile);
            }
        } catch (err) {
            setError('Failed to load profile: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, [currentColor]);

    useEffect(() => {
        if (isOpen) {
            fetchProfile();
            setIsEditing(false); // Reset to locked mode when modal opens
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
            setSuccess(false);
            setError('');
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen, fetchProfile]);

    const handleChange = (key, value) => {
        setForm(prev => ({ ...prev, [key]: value }));
        setSuccess(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true); setError(''); setSuccess(false);
        try {
            const response = await apiFetch('/api/admin/profile', {
                method: 'POST',
                body: JSON.stringify(form),
            });
            const savedProfile = response.profile || form;
            setSaved({ ...form });
            setSuccess(true);
            setIsEditing(false); // 2. LOCK THE FORM AGAIN AFTER SUCCESSFUL SAVE

            if (onProfileSaved) onProfileSaved(savedProfile);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const initials = form.fullName
        ? form.fullName.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
        : 'AD';

    const isDirty = saved && JSON.stringify(form) !== JSON.stringify(saved);

    return (
        <div className="pm-overlay" onClick={onClose}>
            <div className="pm-modal" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit} className="pm-page">
                    <div className="pm-header-strip">
                        <div className="pm-title-group">
                            <h2 className="pm-page-title">Admin Profile</h2>
                            <p className="pm-page-sub">Manage your personal details and contact information.</p>
                        </div>
                        <button type="button" className="pm-close-btn" onClick={onClose}>
                            <CloseIcon />
                        </button>
                    </div>

                    {loading ? (
                        <div>
                            {[120, 80, 60, 60, 60, 60].map((h, i) => (
                                <div key={i} className="pm-skeleton" style={{ height: h }} />
                            ))}
                        </div>
                    ) : (
                        <>
                            {error   && <div className="pm-error-banner">{error}</div>}
                            {success && (
                                <div className="pm-success-banner">
                                    <CheckIcon /> Profile updated successfully!
                                </div>
                            )}

                            <div className="pm-grid">
                                <div className="pm-card">
                                    <p className="pm-card-label">Avatar &amp; Appearance</p>
                                    <div className="pm-avatar-wrap">
                                        <div className="pm-avatar" style={{ background: form.avatarColor }}>
                                            {initials}
                                        </div>
                                        <div>
                                            <p className="pm-avatar-name">{form.fullName || 'Your Name'}</p>
                                            <p className="pm-avatar-role">{form.role || 'Administrator'}</p>
                                        </div>
                                    </div>

                                    {/* 3. ONLY SHOW COLOR PICKER IF EDITING */}
                                    {isEditing && (
                                        <>
                                            <p className="pm-color-label">Avatar color</p>
                                            <div className="pm-color-grid">
                                                {AVATAR_COLORS.map(c => (
                                                    <button
                                                        key={c} type="button"
                                                        className="pm-color-dot"
                                                        onClick={() => handleChange('avatarColor', c)}
                                                        title={c}
                                                        style={{
                                                            background: c,
                                                            outline: form.avatarColor === c ? `3px solid ${c}` : 'none',
                                                            transform: form.avatarColor === c ? 'scale(1.15)' : 'scale(1)',
                                                        }}
                                                    >
                                                        {form.avatarColor === c && <span className="pm-color-dot-check">✓</span>}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                </div>

                                <div className="pm-fields-column">
                                    {FIELDS.map(({ key, label, placeholder, type, icon: Icon }) => (
                                        <div key={key} className="pm-card" style={{ padding: '12px 16px' }}>
                                            <label className="pm-field-label">
                                                <span className="pm-field-label-icon"><Icon /></span>
                                                {label}
                                            </label>
                                            <input
                                                type={type}
                                                value={form[key]}
                                                onChange={e => handleChange(key, e.target.value)}
                                                placeholder={placeholder}
                                                // 4. DISABLE INPUTS IF NOT EDITING
                                                disabled={saving || !isEditing}
                                                className={`pm-input ${!isEditing ? 'pm-input--locked' : ''}`}
                                            />
                                        </div>
                                    ))}

                                    <div className="pm-card" style={{ padding: '12px 16px' }}>
                                        <label className="pm-field-label">
                                            <span className="pm-field-label-icon">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                                                </svg>
                                            </span>
                                            Professional Bio
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={form.bio}
                                            onChange={e => handleChange('bio', e.target.value)}
                                            placeholder="Write a short bio about yourself..."
                                            // 5. DISABLE TEXTAREA IF NOT EDITING
                                            disabled={saving || !isEditing}
                                            className={`pm-textarea ${!isEditing ? 'pm-input--locked' : ''}`}
                                        />
                                        <p className="pm-char-count">{form.bio.length} / 500 characters</p>
                                    </div>
                                </div>
                            </div>

                            <div className="pm-bottom-bar">
                                {/* 6. SWAP BUTTONS BASED ON EDIT STATE */}
                                {!isEditing ? (
                                    <button 
                                        type="button" 
                                        className="pm-edit-toggle-btn" 
                                        onClick={() => setIsEditing(true)}
                                    >
                                        Edit Profile
                                    </button>
                                ) : (
                               <div style={{ display: 'flex', gap: '12px', width: '100%', justifyContent: 'center', alignItems: 'center' }}>
                                <button 
                                    type="button" 
                                    className="pm-cancel-btn" 
                                    disabled={saving}
                                    onClick={() => {
                                        setIsEditing(false);
                                        setForm(saved); 
                                    }}
                                >
                                    Cancel
                                </button>
                                
                                <button 
                                    type="submit" 
                                    disabled={saving} 
                                    className="pm-save-btn"
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    {saving ? (
                                        <>
                                            <span className="pm-spinner" />
                                            Saving…
                                        </>
                                    ) : success ? (
                                        <>Saved</>
                                    ) : (
                                        <>Save Changes</>
                                    )}
                                </button>
                            </div>
                                )}
                            </div>
                        </>
                    )}
                </form>
            </div>
        </div>
    );
}