// lib/sanitize.js
// Simplified sanitization WITHOUT DOMPurify for Vercel Edge Runtime compatibility

/**
 * Simple HTML escape to prevent XSS
 * @param {string} str - Raw string
 * @returns {string} Escaped string
 */
const escapeHtml = (str) => {
    if (!str || typeof str !== 'string') return '';

    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

/**
 * Sanitize user input to prevent XSS attacks
 * @param {string} input - Raw user input
 * @param {boolean} allowBasicHTML - Ignored in this version
 * @returns {string} Sanitized string
 */
export const sanitizeInput = (input, allowBasicHTML = false) => {
    if (!input || typeof input !== 'string') {
        return '';
    }

    // Strip HTML tags and escape special characters
    let sanitized = input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/<[^>]+>/g, ''); // Remove all HTML tags

    // Escape remaining special characters
    sanitized = escapeHtml(sanitized);

    // Limit length
    return sanitized.substring(0, 1000);
};

/**
 * Sanitize URL to prevent javascript: and data: URLs
 * @param {string} url - URL to sanitize
 * @returns {string|null} Sanitized URL or null if invalid
 */
export const sanitizeURL = (url) => {
    if (!url || typeof url !== 'string') {
        return null;
    }

    // Remove whitespace
    url = url.trim();

    // Check for dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:'];
    const lowerURL = url.toLowerCase();

    for (const protocol of dangerousProtocols) {
        if (lowerURL.startsWith(protocol)) {
            return null;
        }
    }

    // Must start with http:// or https://
    if (!lowerURL.startsWith('http://') && !lowerURL.startsWith('https://')) {
        return null;
    }

    try {
        // Validate URL structure
        const urlObj = new URL(url);

        // Additional checks
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
            return null;
        }

        return url;
    } catch (e) {
        return null;
    }
};

/**
 * Validate and sanitize search query
 * @param {string} query - Search query
 * @returns {string} Sanitized query
 */
export const sanitizeSearchQuery = (query) => {
    if (!query || typeof query !== 'string') {
        return '';
    }

    // Remove HTML and limit length
    let sanitized = query
        .replace(/<[^>]+>/g, '') // Remove HTML tags
        .substring(0, 200);

    return escapeHtml(sanitized.trim());
};

/**
 * Sanitize all fields in form data
 * @param {Object} formData - Form data object
 * @returns {Object} Sanitized form data
 */
export const sanitizeFormData = (formData) => {
    const sanitized = {};

    for (const [key, value] of Object.entries(formData)) {
        if (typeof value === 'string') {
            if (key === 'url') {
                sanitized[key] = sanitizeURL(value);
            } else {
                sanitized[key] = sanitizeInput(value, false);
            }
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
};
