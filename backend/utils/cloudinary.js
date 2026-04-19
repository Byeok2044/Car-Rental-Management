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

// ── Signed upload signature ───────────────────────────────────────────────────

const UPLOAD_FOLDER      = 'car_rental';
const ALLOWED_FORMATS    = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
const MAX_BYTES          = 10 * 1024 * 1024; // 10 MB — enforced client-side only
const SIGNATURE_TTL_SECS = 5 * 60;

/**
 * Generate a Cloudinary signed-upload payload.
 *
 * IMPORTANT: `max_file_size` is NOT included in the signature string because
 * Cloudinary does not treat it as a signable upload parameter — including it
 * causes an "Invalid Signature" error. It is returned so the client can show
 * a friendly size cap, but the real enforcement happens on the client before
 * the upload is attempted.
 */
export function generateUploadSignature() {
    const cfg = cloudinary.config();

    if (!cfg.api_secret) {
        throw new Error(
            'Cloudinary API secret is not configured. ' +
            'Set CLOUDINARY_URL or CLOUDINARY_API_SECRET in your .env file.'
        );
    }

    const timestamp = Math.round(Date.now() / 1000);

    // Only include parameters that Cloudinary actually signs.
    // max_file_size is intentionally excluded — it is NOT a signable param.
    const paramsToSign = {
        allowed_formats: ALLOWED_FORMATS.join(','),
        folder:          UPLOAD_FOLDER,
        timestamp,
    };

    // Build "param1=val1&param2=val2...{api_secret}" sorted alphabetically
    const stringToSign =
        Object.entries(paramsToSign)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('&') + cfg.api_secret;

    const signature = crypto
        .createHash('sha1')
        .update(stringToSign)
        .digest('hex');

    return {
        signature,
        timestamp,
        api_key:         cfg.api_key,
        cloud_name:      cfg.cloud_name,
        folder:          UPLOAD_FOLDER,
        allowed_formats: ALLOWED_FORMATS.join(','),
        max_file_size:   MAX_BYTES,   // returned for client-side UX only
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