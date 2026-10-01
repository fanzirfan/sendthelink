// lib/urlScanner.js
// Security URL scanning utility using VirusTotal and URLScan.io APIs
//
// Scanning is two-phase: submission is instant, verdicts arrive seconds later.
// `resolveSecurityScan` runs one resolution round, `runSecurityScan` optionally
// polls until a verdict lands or the budget runs out.
//
// Verdicts are fail-closed: any source that is unconfigured, still running, or
// errored keeps the link at 'pending' instead of reporting a false 'safe'.

const REQUEST_TIMEOUT_MS = 20000;
const DEFAULT_POLL_BUDGET_MS = 45000;
const DEFAULT_POLL_INTERVAL_MS = 5000;

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

/** Submit-form POST endpoint (used only when VirusTotal has no report yet). */
const submitToVirusTotal = async (url, apiKey) => {
    const formData = new URLSearchParams();
    formData.append('url', url);

    const res = await fetch('https://www.virustotal.com/api/v3/urls', {
        method: 'POST',
        headers: {
            'x-apikey': apiKey,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    if (res.status === 429) {
        return { error: 'Rate limit exceeded', status: 'rate_limited' };
    }

    if (!res.ok) {
        return { error: `Submission failed (HTTP ${res.status})`, status: 'error' };
    }

    const data = await res.json();
    return {
        status: 'pending',
        analysisId: data.data?.id,
        message: 'URL submitted for scanning'
    };
};

/**
 * Scan URL with VirusTotal API
 * Returns 'completed' only once an analysis has real detector results.
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
            },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });

        if (reportRes.ok) {
            const data = await reportRes.json();
            const stats = data.data?.attributes?.last_analysis_stats || {};
            const total = (stats.malicious || 0) + (stats.suspicious || 0) +
                (stats.harmless || 0) + (stats.undetected || 0);

            // A freshly queued analysis answers 200 with all-zero stats.
            // Treating that as 'safe' would clear unscanned URLs.
            if (total === 0) {
                return {
                    status: 'pending',
                    analysisId: data.data?.id,
                    message: 'Analysis not finished yet'
                };
            }

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
            return await submitToVirusTotal(url, apiKey);
        }

        // Handle rate limiting
        if (reportRes.status === 429) {
            return { error: 'Rate limit exceeded', status: 'rate_limited' };
        }

        return { error: `Failed to fetch report (HTTP ${reportRes.status})`, status: 'error' };

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
            }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
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
        return { error: errorData.message || `Submission failed (HTTP ${res.status})`, status: 'error' };

    } catch (error) {
        console.error('URLScan.io scan error:', error);
        return { error: error.message, status: 'error' };
    }
};

/**
 * Get URLScan.io result by UUID (requires polling)
 * The result endpoint is authenticated: without the API-Key header it answers
 * 403 "You're not logged in!" even for scans this key submitted.
 * @param {string} uuid - Scan UUID from initial submission
 * @returns {Promise<Object>} Scan result with verdict
 */
export const getURLScanResult = async (uuid) => {
    const apiKey = process.env.URLSCAN_API_KEY;

    if (!apiKey) {
        console.warn('URLScan.io API key not configured');
        return { error: 'API key not configured', status: 'skipped' };
    }

    if (!uuid) {
        return { status: 'error', error: 'Missing scan UUID' };
    }

    try {
        const res = await fetch(`https://urlscan.io/api/v1/result/${uuid}/`, {
            headers: {
                'API-Key': apiKey,
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });

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

        if (res.status === 429) {
            return { status: 'rate_limited', error: 'Rate limit exceeded' };
        }

        const body = await res.json().catch(() => ({}));
        return { status: 'error', error: body.message || `Result fetch failed (HTTP ${res.status})` };

    } catch (error) {
        console.error('URLScan.io result error:', error);
        return { status: 'error', error: error.message };
    }
};

/**
 * Determine overall security status based on scan results
 * Fails closed: a verdict of 'safe' requires a completed scan and no source
 * left pending, unconfigured, rate limited, or errored.
 * @param {Object} vtResult - VirusTotal result
 * @param {Object} usResult - URLScan.io result
 * @returns {string} 'safe' | 'suspicious' | 'malicious' | 'pending'
 */
export const determineSecurityStatus = (vtResult, usResult) => {
    // Malicious signals win regardless of the other source's state
    if ((vtResult?.malicious || 0) >= 3 || usResult?.malicious === true) {
        return 'malicious';
    }

    // Suspicious indicators
    if ((vtResult?.malicious || 0) >= 1 || (vtResult?.suspicious || 0) >= 2 || (usResult?.score || 0) >= 50) {
        return 'suspicious';
    }

    const isClean = (result) => result?.status === 'completed';
    const isSettled = (result) => isClean(result) || result?.status === 'expired';

    // 'expired' means the report is gone for good; it can never resolve, so it
    // does not block a clean verdict from the other source.
    if ((isClean(vtResult) || isClean(usResult)) && isSettled(vtResult) && isSettled(usResult)) {
        return 'safe';
    }

    return 'pending';
};

/**
 * Run one resolution round: keep what is already final, re-check what is not.
 * VirusTotal is re-read by URL (it is indexed once submitted) and URLScan.io is
 * polled by UUID so we do not resubmit a scan that is already queued.
 * @param {Object} params
 * @param {string} params.url - URL being scanned
 * @param {Object|null} [params.previousScan] - Prior securityScan payload
 * @returns {Promise<Object>} Combined scan results
 */
export const resolveSecurityScan = async ({ url, previousScan = null }) => {
    const startedAt = Date.now();
    const previousVt = previousScan?.virusTotal || null;
    const previousUs = previousScan?.urlScan || null;

    const vtTask = previousVt?.status === 'completed'
        ? Promise.resolve(previousVt)
        : scanWithVirusTotal(url);

    let usTask;
    const pollable = previousUs?.uuid &&
        ['submitted', 'pending', 'rate_limited'].includes(previousUs.status);

    if (previousUs?.status === 'completed' || previousUs?.status === 'expired') {
        usTask = Promise.resolve(previousUs);
    } else if (pollable) {
        usTask = getURLScanResult(previousUs.uuid).then((result) => ({ ...previousUs, ...result }));
    } else {
        usTask = scanWithURLScan(url);
    }

    const [vtResult, usResult] = await Promise.all([vtTask, usTask]);

    return {
        securityStatus: determineSecurityStatus(vtResult, usResult),
        scanDuration: Date.now() - startedAt,
        virusTotal: vtResult,
        urlScan: usResult,
        scannedAt: new Date().toISOString()
    };
};

/**
 * Scan a URL and optionally poll until a verdict lands.
 * @param {string} url - URL to scan
 * @param {Object} [options]
 * @param {Object|null} [options.previousScan] - Prior securityScan payload to resume from
 * @param {boolean} [options.poll] - Keep polling while the verdict is 'pending'
 * @param {number} [options.budgetMs] - Total polling budget
 * @param {number} [options.intervalMs] - Delay between polls
 * @returns {Promise<Object>} Combined scan results
 */
export const runSecurityScan = async (url, {
    previousScan = null,
    poll = false,
    budgetMs = DEFAULT_POLL_BUDGET_MS,
    intervalMs = DEFAULT_POLL_INTERVAL_MS
} = {}) => {
    let scan = await resolveSecurityScan({ url, previousScan });

    if (!poll) return scan;

    const deadline = Date.now() + budgetMs;
    while (scan.securityStatus === 'pending' && Date.now() < deadline) {
        const remaining = deadline - Date.now();
        await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remaining)));

        const next = await resolveSecurityScan({ url, previousScan: scan });
        if (next.securityStatus !== 'pending') return next;
        scan = next;
    }

    return scan;
};
