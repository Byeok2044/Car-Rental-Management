// src/hooks/useAdminProfile.js
import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getToken() {
    return localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
}

const DEFAULT_PROFILE = {
    fullName:    '',
    avatarColor: '#2563eb',
    role:        'Administrator',
    bio:         '',
    phone:       '',
    email:       '',
    location:    '',
};

export function useAdminProfile() {
    const [profile,  setProfile]  = useState(() => {
        // Optimistic init from localStorage to avoid flash
        const cached = localStorage.getItem('adminProfile');
        try { return cached ? { ...DEFAULT_PROFILE, ...JSON.parse(cached) } : DEFAULT_PROFILE; }
        catch { return DEFAULT_PROFILE; }
    });
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState('');

    const fetchProfile = useCallback(async () => {
        const token = getToken();
        if (!token) { setLoading(false); return; }
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/profile`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data) {
                const merged = { ...DEFAULT_PROFILE, ...data };
                setProfile(merged);
                // Cache for next load to avoid flash
                localStorage.setItem('adminProfile', JSON.stringify({
                    fullName:    merged.fullName,
                    avatarColor: merged.avatarColor,
                    role:        merged.role,
                }));
            }
        } catch (err) {
            setError(err.message);
            // Fall back to cache silently
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchProfile(); }, [fetchProfile]);

    /** Call this after a successful save in ProfileModal */
    const updateProfile = useCallback((updated) => {
        const merged = { ...DEFAULT_PROFILE, ...updated };
        setProfile(merged);
        localStorage.setItem('adminProfile', JSON.stringify({
            fullName:    merged.fullName,
            avatarColor: merged.avatarColor,
            role:        merged.role,
        }));
    }, []);

    const avatarInitials = profile.fullName
        ? profile.fullName.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
        : 'AD';

    return { profile, loading, error, fetchProfile, updateProfile, avatarInitials };
}