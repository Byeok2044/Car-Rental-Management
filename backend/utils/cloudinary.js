import { v2 as cloudinary } from 'cloudinary';
import crypto from 'node:crypto';

// ── Configuration ─────────────────────────────────────────────────────────────

function configureCloudinary() {
    if (process.env.CLOUDINARY_URL) {
        cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL });
    } else {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key:    process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
            secure:     true,
        });
    }
}

configureCloudinary();

// ── Helpers ───────────────────────────────────────────────────────────────────

export function extractPublicId(url) {
    if (!url || typeof url !== 'string') return null;
    try {
        const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

// ── Internal signature builder ────────────────────────────────────────────────
// NOTE: max_file_size is intentionally excluded from paramsToSign because
// Cloudinary does not treat it as a signable upload parameter — including it
// causes an "Invalid Signature" error.

function _buildSignature(paramsToSign) {
    const cfg = cloudinary.config();
    if (!cfg.api_secret) {
        throw new Error(
            'Cloudinary API secret is not configured. ' +
            'Set CLOUDINARY_URL or CLOUDINARY_API_SECRET in your .env file.'
        );
    }

    const stringToSign =
        Object.entries(paramsToSign)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('&') + cfg.api_secret;

    return crypto.createHash('sha1').update(stringToSign).digest('hex');
}

// ── Car image upload signature (admin only) ───────────────────────────────────

const CAR_FOLDER      = 'car_rental';
const CAR_FORMATS     = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
const CAR_MAX_BYTES   = 10 * 1024 * 1024; // 10 MB

export function generateUploadSignature() {
    const cfg       = cloudinary.config();
    const timestamp = Math.round(Date.now() / 1000);

    const paramsToSign = {
        allowed_formats: CAR_FORMATS.join(','),
        folder:          CAR_FOLDER,
        timestamp,
    };

    return {
        signature:       _buildSignature(paramsToSign),
        timestamp,
        api_key:         cfg.api_key,
        cloud_name:      cfg.cloud_name,
        folder:          CAR_FOLDER,
        allowed_formats: CAR_FORMATS.join(','),
        max_file_size:   CAR_MAX_BYTES, // returned for client-side UX only
    };
}

// ── KYC document upload signature (public — used by customers) ───────────────

const DOC_FOLDER    = 'kyc_docs';
const DOC_FORMATS   = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
const DOC_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function generateDocUploadSignature() {
    const cfg       = cloudinary.config();
    const timestamp = Math.round(Date.now() / 1000);

    const paramsToSign = {
        allowed_formats: DOC_FORMATS.join(','),
        folder:          DOC_FOLDER,
        timestamp,
    };

    return {
        signature:       _buildSignature(paramsToSign),
        timestamp,
        api_key:         cfg.api_key,
        cloud_name:      cfg.cloud_name,
        folder:          DOC_FOLDER,
        allowed_formats: DOC_FORMATS.join(','),
        max_file_size:   DOC_MAX_BYTES, // returned for client-side UX only
    };
}

// ── Deletion ──────────────────────────────────────────────────────────────────

export async function deleteImage(publicIdOrUrl) {
    if (!publicIdOrUrl) return;

    const publicId = publicIdOrUrl.startsWith('http')
        ? extractPublicId(publicIdOrUrl)
        : publicIdOrUrl;

    if (!publicId) {
        console.warn('[cloudinary] deleteImage: could not parse public_id from', publicIdOrUrl);
        return;
    }

    try {
        const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
        if (result.result !== 'ok' && result.result !== 'not found') {
            console.warn('[cloudinary] deleteImage unexpected result:', result);
        } else {
            console.log(`[cloudinary] deleted: ${publicId} (${result.result})`);
        }
    } catch (err) {
        console.error('[cloudinary] deleteImage error:', err.message);
    }
}

export default cloudinary;