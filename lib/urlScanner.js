// lib/urlScanner.js
// Security URL scanning utility using VirusTotal and URLScan.io APIs

/**
 * Encode URL to VirusTotal URL identifier format (base64 without padding)
 * @param {string} url - URL to encode
 * @returns {string} Base64 encoded URL identifier
 */
const encodeURLForVirusTotal = (url) => {
    const base64 = Buffer.from(url).toString('base64');
    // Remove padding and replace characters per VT spec
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

/**
 * Scan URL with VirusTotal API
 * @param {string} url - URL to scan
 * @returns {Promise<Object>} Scan result with malicious/suspicious counts
 */
export const scanWithVirusTotal = async (url) => {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;

    if (!apiKey) {
        console.warn('VirusTotal API key not configured');
        return { error: 'API key not configured', status: 'skipped' };
    }

    try {
        // First, try to get existing report using URL identifier
        const urlId = encodeURLForVirusTotal(url);

        // Validate urlId (Base64URL format: alphanumeric, -, _)
        if (!/^[a-zA-Z0-9\-_]+$/.test(urlId)) {
            throw new Error('Invalid URL identifier generation');
        }

        const reportRes = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
            headers: {
                'x-apikey': apiKey,
                'Accept': 'application/json'
            }
        });

        if (reportRes.ok) {
            const data = await reportRes.json();
            const stats = data.data?.attributes?.last_analysis_stats || {};

            return {
                status: 'completed',
                malicious: stats.malicious || 0,
                suspicious: stats.suspicious || 0,
                harmless: stats.harmless || 0,
                undetected: stats.undetected || 0,
                lastScan: data.data?.attributes?.last_analysis_date
                    ? new Date(data.data.attributes.last_analysis_date * 1000).toISOString()
                    : null
            };
        }

        // If not found (404), submit for scanning
        if (reportRes.status === 404) {
            const formData = new URLSearchParams();
            formData.append('url', url);

            const scanRes = await fetch('https://www.virustotal.com/api/v3/urls', {
                method: 'POST',
                headers: {
                    'x-apikey': apiKey,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData.toString()
            });

            if (scanRes.ok) {
                const scanData = await scanRes.json();
                return {
                    status: 'pending',
                    analysisId: scanData.data?.id,
                    message: 'URL submitted for scanning'
                };
            }
        }

        // Handle rate limiting
        if (reportRes.status === 429) {
            return { error: 'Rate limit exceeded', status: 'rate_limited' };
        }

        return { error: 'Failed to scan URL', status: 'error' };

    } catch (error) {
        console.error('VirusTotal scan error:', error);
        return { error: error.message, status: 'error' };
    }
};

/**
 * Scan URL with URLScan.io API
 * @param {string} url - URL to scan
 * @returns {Promise<Object>} Scan result with UUID for polling
 */
export const scanWithURLScan = async (url) => {
    const apiKey = process.env.URLSCAN_API_KEY;

    if (!apiKey) {
        console.warn('URLScan.io API key not configured');
        return { error: 'API key not configured', status: 'skipped' };
    }

    try {
        const res = await fetch('https://urlscan.io/api/v1/scan/', {
            method: 'POST',
            headers: {
                'API-Key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                visibility: 'unlisted',
                tags: ['sendthelink', 'auto-scan']
            })
        });

        if (res.ok) {
            const data = await res.json();
            return {
                status: 'submitted',
                uuid: data.uuid,
                resultUrl: data.result,
                apiUrl: data.api
            };
        }

        if (res.status === 429) {
            return { error: 'Rate limit exceeded', status: 'rate_limited' };
        }

        const errorData = await res.json().catch(() => ({}));
        return { error: errorData.message || 'Failed to submit scan', status: 'error' };

    } catch (error) {
        console.error('URLScan.io scan error:', error);
        return { error: error.message, status: 'error' };
    }
};

/**
 * Get URLScan.io result by UUID (requires polling)
 * @param {string} uuid - Scan UUID from initial submission
 * @returns {Promise<Object>} Scan result with verdict
 */
export const getURLScanResult = async (uuid) => {
    try {
        const res = await fetch(`https://urlscan.io/api/v1/result/${uuid}/`);

        if (res.ok) {
            const data = await res.json();
            const verdict = data.verdicts?.overall || {};

            return {
                status: 'completed',
                malicious: verdict.malicious || false,
                score: verdict.score || 0,
                categories: verdict.categories || [],
                brands: verdict.brands || [],
                screenshot: data.task?.screenshotURL || null
            };
        }

        if (res.status === 404) {
            return { status: 'pending', message: 'Scan still in progress' };
        }

        if (res.status === 410) {
            return { status: 'expired', message: 'Scan result no longer available' };
        }

        return { status: 'error', error: 'Failed to get result' };

    } catch (error) {
        console.error('URLScan.io result error:', error);
        return { status: 'error', error: error.message };
    }
};

/**
 * Determine overall security status based on scan results
 * @param {Object} vtResult - VirusTotal result
 * @param {Object} usResult - URLScan.io result
 * @returns {string} 'safe' | 'suspicious' | 'malicious' | 'pending'
 */
export const determineSecurityStatus = (vtResult, usResult) => {
    // If either scan found malicious content
    if (vtResult?.malicious >= 3 || usResult?.malicious === true) {
        return 'malicious';
    }

    // If suspicious indicators found
    if (vtResult?.malicious >= 1 || vtResult?.suspicious >= 2 || (usResult?.score || 0) >= 50) {
        return 'suspicious';
    }

    // If scans are still pending
    if (vtResult?.status === 'pending' || usResult?.status === 'pending') {
        return 'pending';
    }

    // If scans had errors, keep as pending for manual review
    if (vtResult?.status === 'error' || usResult?.status === 'error') {
        return 'pending';
    }

    return 'safe';
};

/**
 * Run full security scan on a URL (async, non-blocking)
 * @param {string} url - URL to scan
 * @returns {Promise<Object>} Combined scan results
 */
export const checkURLSecurity = async (url) => {
    const startTime = Date.now();

    // Run both scans in parallel
    const [vtResult, usResult] = await Promise.all([
        scanWithVirusTotal(url),
        scanWithURLScan(url)
    ]);

    const securityStatus = determineSecurityStatus(vtResult, usResult);

    return {
        securityStatus,
        scanDuration: Date.now() - startTime,
        virusTotal: vtResult,
        urlScan: usResult,
        scannedAt: new Date().toISOString()
    };
};
