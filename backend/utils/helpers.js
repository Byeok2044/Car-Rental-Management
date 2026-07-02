import crypto from 'node:crypto';

export const BRAND = 'Triple R and A Transport Services';

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function clean(str) {
    return String(str ?? '').replace(/<[^>]*>/g, '').trim();
}

export function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-PH', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
}

export function fmtPeso(n) {
    return 'PHP ' + Number(n ?? 0).toLocaleString('en-PH');
}

export function hashToken(raw) {
    return crypto.createHash('sha256').update(raw).digest('hex');
}