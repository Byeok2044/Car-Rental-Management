/**
 * backend/utils/cloudinary.js
 *
 * Centralises all Cloudinary interactions:
 *   - Configuration from env vars (CLOUDINARY_URL or individual keys)
 *   - generateUploadSignature()  → used by the /api/upload/sign endpoint
 *   - deleteImage()              → called when a car is deleted
 *   - extractPublicId()          → parses a Cloudinary URL → public_id
 *
 * SECURITY MODEL
 * ─────────────────────────────────────────────────────────────────────────────
 * We use *signed* uploads.  The client never sees the API secret.
 * Flow:
 *   1. Admin client calls  GET /api/upload/sign  (auth required)
 *   2. Server returns { signature, timestamp, api_key, cloud_name, folder }
 *   3. Client POSTs directly to Cloudinary's REST API with those params
 *   4. Cloudinary verifies the HMAC-SHA1 signature → accepts the upload
 *
 * This means:
 *   • CLOUDINARY_API_SECRET stays on the server
 *   • Upload preset is NOT needed (signed uploads bypass presets)
 *   • We can enforce folder, allowed_formats, max_bytes via signature params
 */

import { v2 as cloudinary } from 'cloudinary';
import crypto from 'node:crypto';

// ── Configuration ─────────────────────────────────────────────────────────────

/**
 * Supports both CLOUDINARY_URL (e.g. cloudinary://key:secret@cloud) and
 * individual env vars as a fallback.
 */
function configureCloudinary() {
    if (process.env.CLOUDINARY_URL) {
        // cloudinary SDK auto-reads CLOUDINARY_URL if set
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

/**
 * Extract Cloudinary public_id from a full secure URL.
 * e.g. https://res.cloudinary.com/cloud/image/upload/v123/car_rental/abc.jpg
 *      → "car_rental/abc"   (no extension)
 */
export function extractPublicId(url) {
    if (!url || typeof url !== 'string') return null;
    try {
        // Everything after /upload/ up to (but not including) the file extension
        const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

// ── Signed upload signature ───────────────────────────────────────────────────

const UPLOAD_FOLDER       = 'car_rental';
const ALLOWED_FORMATS     = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
const MAX_BYTES           = 10 * 1024 * 1024; // 10 MB
const SIGNATURE_TTL_SECS  = 5 * 60;           // signature valid for 5 min

/**
 * Generate the params + HMAC-SHA1 signature that Cloudinary requires for a
 * signed direct upload.
 *
 * @returns {{
 *   signature: string,
 *   timestamp: number,
 *   api_key: string,
 *   cloud_name: string,
 *   folder: string,
 *   allowed_formats: string,
 *   max_file_size: number
 * }}
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

    // All params that will be sent to Cloudinary MUST be included in the
    // signature string (sorted alphabetically, joined with &, no URL-encoding).
    const paramsToSign = {
        allowed_formats: ALLOWED_FORMATS.join(','),
        folder:          UPLOAD_FOLDER,
        max_file_size:   MAX_BYTES,
        timestamp,
    };

    // Build the string to sign: param1=val1&param2=val2...api_secret
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
        max_file_size:   MAX_BYTES,
    };
}

// ── Deletion ──────────────────────────────────────────────────────────────────

/**
 * Delete an image from Cloudinary by its public_id.
 * Fails silently (logs only) so a Cloudinary outage never blocks a car deletion.
 *
 * @param {string} publicIdOrUrl  Either a full Cloudinary URL or a public_id
 */
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