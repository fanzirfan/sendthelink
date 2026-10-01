
import crypto from 'crypto';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'local-dev-password';

/**
 * Compare two strings without leaking length or content through timing.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
const safeCompare = (a, b) => {
    const bufferA = Buffer.from(String(a ?? ''));
    const bufferB = Buffer.from(String(b ?? ''));

    if (bufferA.length !== bufferB.length || bufferA.length === 0) {
        return false;
    }

    return crypto.timingSafeEqual(bufferA, bufferB);
};

/**
 * Generate a secure auth token
 * Format: base64(timestamp:signature)
 */
export const generateToken = () => {
    const timestamp = Date.now().toString();
    const signature = crypto
        .createHmac('sha256', ADMIN_PASSWORD)
        .update(timestamp)
        .digest('hex');

    return Buffer.from(`${timestamp}:${signature}`).toString('base64');
};

/**
 * Verify if the token is valid and not expired (24h)
 */
export const verifyToken = (token) => {
    if (!token) return false;

    try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const [timestamp, signature] = decoded.split(':');

        if (!timestamp || !signature) return false;

        // Check expiration (24 hours)
        const now = Date.now();
        const tokenTime = parseInt(timestamp, 10);
        if (isNaN(tokenTime) || now - tokenTime > 24 * 60 * 60 * 1000) {
            return false;
        }

        // Verify signature
        const expectedSignature = crypto
            .createHmac('sha256', ADMIN_PASSWORD)
            .update(timestamp)
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    } catch (e) {
        return false;
    }
};

/**
 * Shared secret for machine callers of /api/scan (cron, deploy hooks).
 * Falls back to ADMIN_PASSWORD so no extra env var is required to be safe.
 * @returns {string}
 */
export const getScanSecret = () =>
    process.env.SCAN_INTERNAL_SECRET || process.env.CRON_SECRET || ADMIN_PASSWORD;

/**
 * Authorize a /api/scan request. Accepts an admin token (interactive re-scan)
 * or the shared scan secret (cron / internal).
 * @param {Request} request
 * @returns {boolean}
 */
export const verifyScanRequest = (request) => {
    const secret = getScanSecret();
    if (!secret) return false;

    const authHeader = request.headers.get('authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const headerSecret = (request.headers.get('x-scan-secret') || '').trim();

    if (bearer && verifyToken(bearer)) return true;

    return safeCompare(bearer, secret) || safeCompare(headerSecret, secret);
};
