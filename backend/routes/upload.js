import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { generateUploadSignature, generateDocUploadSignature } from '../utils/cloudinary.js';

const router = Router();

/**
 * GET /api/upload/sign
 * Returns a short-lived Cloudinary signed-upload token for car images.
 * Requires admin JWT.
 */
router.get('/sign', requireAdmin, (req, res) => {
    try {
        const signaturePayload = generateUploadSignature();
        return res.json(signaturePayload);
    } catch (err) {
        console.error('[upload] car signature generation failed:', err.message);
        return res.status(500).json({
            message: 'Could not generate upload signature. Check Cloudinary configuration.',
        });
    }
});

/**
 * GET /api/upload/sign-doc
 * Returns a short-lived Cloudinary signed-upload token for KYC documents.
 * PUBLIC — no auth required (customers upload their own ID documents).
 *
 * Uploads go to the "kyc_docs" folder which should have restricted viewing
 * in your Cloudinary settings (set delivery type to "authenticated" if needed).
 */
router.get('/sign-doc', (req, res) => {
    try {
        const signaturePayload = generateDocUploadSignature();
        return res.json(signaturePayload);
    } catch (err) {
        console.error('[upload] doc signature generation failed:', err.message);
        return res.status(500).json({
            message: 'Could not generate document upload signature.',
        });
    }
});

export default router;