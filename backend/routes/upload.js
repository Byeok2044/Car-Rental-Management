/**
 * backend/routes/upload.js
 *
 * GET /api/upload/sign
 *   Returns a short-lived Cloudinary signed-upload token.
 *   Requires admin JWT (requireAdmin middleware).
 *
 * Why this approach?
 *   • The Cloudinary API secret never leaves the server
 *   • Each signature is timestamped and expires in 5 minutes
 *   • Cloudinary enforces folder, file type, and size on its end
 *   • No unsigned upload preset is needed — eliminates the biggest
 *     attack surface (anyone uploading arbitrary files to your account)
 */

import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { generateUploadSignature } from '../utils/cloudinary.js';

const router = Router();

/**
 * GET /api/upload/sign
 *
 * Response 200:
 * {
 *   signature:       "a1b2c3...",   // HMAC-SHA1
 *   timestamp:       1712345678,    // Unix seconds
 *   api_key:         "419...",
 *   cloud_name:      "ddrzd4x2d",
 *   folder:          "car_rental",
 *   allowed_formats: "jpg,jpeg,png,webp,avif",
 *   max_file_size:   10485760        // 10 MB in bytes
 * }
 *
 * The client uses these params + the file to POST directly to:
 *   https://api.cloudinary.com/v1_1/<cloud_name>/image/upload
 */
router.get('/sign', requireAdmin, (req, res) => {
    try {
        const signaturePayload = generateUploadSignature();
        return res.json(signaturePayload);
    } catch (err) {
        console.error('[upload] signature generation failed:', err.message);
        return res.status(500).json({
            message: 'Could not generate upload signature. Check Cloudinary configuration.',
        });
    }
});

export default router;