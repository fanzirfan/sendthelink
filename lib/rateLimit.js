// lib/rateLimit.js
// Simple in-memory rate limiter (for Vercel, consider using Vercel KV or Upstash Redis for production)

const rateLimit = (options = {}) => {
    const {
        interval = 60 * 1000, // 1 minute default
        uniqueTokenPerInterval = 500, // Max 500 unique IPs per interval
    } = options;

    const tokenCache = new Map();

    return {
        check: (request, limit, token) =>
            new Promise((resolve, reject) => {
                const tokenCount = tokenCache.get(token) || [0];

                if (tokenCount[0] === 0) {
                    tokenCache.set(token, [1, Date.now() + interval]);
                    setTimeout(() => tokenCache.delete(token), interval);
                    resolve();
                } else if (tokenCount[0] < limit) {
                    tokenCache.set(token, [tokenCount[0] + 1, tokenCount[1]]);
                    resolve();
                } else {
                    const timeUntilReset = Math.ceil((tokenCount[1] - Date.now()) / 1000);
                    reject({
                        error: 'Rate limit exceeded',
                        retryAfter: timeUntilReset,
                    });
                }

                // Clean up old tokens
                if (tokenCache.size > uniqueTokenPerInterval) {
                    const firstKey = tokenCache.keys().next().value;
                    tokenCache.delete(firstKey);
                }
            }),
    };
};

// Helper to get IP address from request
export const getIP = (request) => {
    // Try various headers that might contain the real IP
    const forwarded = request.headers.get('x-forwarded-for');
    const real = request.headers.get('x-real-ip');
    const cfConnecting = request.headers.get('cf-connecting-ip'); // Cloudflare

    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }

    if (real) {
        return real;
    }

    if (cfConnecting) {
        return cfConnecting;
    }

    return 'localhost';
};

// Export limiter instances for different endpoints
export const submitLimiter = rateLimit({
    interval: 10 * 60 * 1000, // 10 minutes
    uniqueTokenPerInterval: 500,
});

export const reportLimiter = rateLimit({
    interval: 5 * 60 * 1000, // 5 minutes
    uniqueTokenPerInterval: 500,
});

export const adminLimiter = rateLimit({
    interval: 1 * 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 100,
});
