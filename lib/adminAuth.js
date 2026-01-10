
import crypto from 'crypto';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'local-dev-password';

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
