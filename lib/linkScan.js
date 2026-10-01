// lib/linkScan.js
// Scan a stored link and persist the verdict.
// Shared by the submit flow (post-response hook), the manual re-scan endpoint,
// and the cron resolver that drains links left in 'pending'.
import { doc, getDoc, updateDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from './firebase';
import { runSecurityScan } from './urlScanner';

// A scan that never settles (unknown URL the providers never finish) stops
// being retried after this many rounds and is recorded as 'error'.
const MAX_ATTEMPTS = 10;

const isFlagged = (status) => status === 'malicious' || status === 'suspicious';

/**
 * Scan the link document with the given id and write the result back.
 * Never throws: scan and persistence failures are recorded on the document so a
 * link cannot sit in 'pending' without a trace.
 * @param {string} linkId - Firestore document id in shared_links
 * @param {Object} [options]
 * @param {boolean} [options.poll] - Poll until a verdict lands or the budget runs out
 * @param {number} [options.budgetMs] - Polling budget for this link
 * @returns {Promise<{ok: boolean, summary?: Object, error?: string, status?: number}>}
 */
export const scanLinkById = async (linkId, { poll = false, budgetMs } = {}) => {
    const linkRef = doc(db, 'shared_links', linkId);
    const snapshot = await getDoc(linkRef);

    if (!snapshot.exists()) {
        return { ok: false, error: 'Link not found', status: 404 };
    }

    const link = snapshot.data();
    if (!link.url) {
        return { ok: false, error: 'Link has no URL to scan', status: 400 };
    }

    const attempts = (link.securityScan?.attempts || 0) + 1;

    try {
        const scan = await runSecurityScan(link.url, {
            previousScan: link.securityScan,
            poll,
            ...(budgetMs ? { budgetMs } : {})
        });

        const securityStatus = scan.securityStatus === 'pending' && attempts >= MAX_ATTEMPTS
            ? 'error'
            : scan.securityStatus;

        await updateDoc(linkRef, {
            securityStatus,
            securityScan: {
                virusTotal: scan.virusTotal || null,
                urlScan: scan.urlScan || null,
                scannedAt: scan.scannedAt,
                duration: scan.scanDuration,
                attempts
            },
            ...(isFlagged(securityStatus) && { status: 'pending_review' })
        });

        console.log(`[Security Scan] Link ${linkId} -> ${securityStatus} (attempt ${attempts})`);

        return {
            ok: true,
            summary: {
                linkId,
                securityStatus,
                linkStatus: isFlagged(securityStatus) ? 'pending_review' : 'approved',
                attempts
            }
        };

    } catch (error) {
        console.error(`[Security Scan] Failed for link ${linkId}:`, error);

        try {
            await updateDoc(linkRef, {
                securityStatus: 'error',
                securityScan: {
                    ...(link.securityScan || {}),
                    error: error.message,
                    scannedAt: new Date().toISOString(),
                    attempts
                }
            });
        } catch (persistError) {
            console.error(`[Security Scan] Could not record failure for link ${linkId}:`, persistError);
        }

        return { ok: false, error: error.message, status: 500 };
    }
};

/**
 * Resolve links still awaiting a verdict.
 * Only reads links with securityStatus 'pending', so a link leaves this set as
 * soon as it gets a real verdict or is recorded as 'error'.
 * @param {Object} [options]
 * @param {number} [options.max] - Maximum links to process per run
 * @param {boolean} [options.poll] - Poll each link until it settles
 * @param {number} [options.budgetMs] - Polling budget per link
 * @returns {Promise<{checked: number, resolved: number, results: Array}>}
 */
export const resolvePendingLinks = async ({ max = 10, poll = false, budgetMs } = {}) => {
    const pendingQuery = query(
        collection(db, 'shared_links'),
        where('securityStatus', '==', 'pending'),
        limit(max)
    );

    const snapshot = await getDocs(pendingQuery);
    const results = [];

    for (const pendingDoc of snapshot.docs) {
        // Sequential on purpose: the scan providers rate limit per account.
        const result = await scanLinkById(pendingDoc.id, { poll, budgetMs });
        results.push({ linkId: pendingDoc.id, ...result });
    }

    return {
        checked: snapshot.size,
        resolved: results.filter((r) => r.ok && r.summary.securityStatus !== 'pending').length,
        results
    };
};
