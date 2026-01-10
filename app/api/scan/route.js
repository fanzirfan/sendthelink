// app/api/scan/route.js
// Background security scan endpoint - Called async after link submission
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { checkURLSecurity } from '../../../lib/urlScanner';

export async function POST(request) {
    try {
        const { linkId, url } = await request.json();

        if (!linkId || !url) {
            return NextResponse.json({ error: 'Missing linkId or url' }, { status: 400 });
        }

        console.log(`[Security Scan] Starting scan for link ${linkId}: ${url}`);

        // Run the security scan
        const scanResult = await checkURLSecurity(url);

        console.log('[Security Scan] Result for link:', linkId, {
            status: scanResult.securityStatus,
            duration: scanResult.scanDuration
        });

        // Determine the final status based on security scan
        // If malicious or suspicious, change link status to 'pending_review' so it won't show publicly
        let newStatus = 'approved';
        if (scanResult.securityStatus === 'malicious' || scanResult.securityStatus === 'suspicious') {
            newStatus = 'pending_review'; // Admin needs to review
        }

        // Update the link document with scan results
        const linkRef = doc(db, 'shared_links', linkId);
        await updateDoc(linkRef, {
            securityStatus: scanResult.securityStatus,
            securityScan: {
                virusTotal: scanResult.virusTotal || null,
                urlScan: scanResult.urlScan || null,
                scannedAt: scanResult.scannedAt,
                duration: scanResult.scanDuration
            },
            // Update status if security concern found
            ...(newStatus !== 'approved' && { status: newStatus })
        });

        console.log(`[Security Scan] Updated link ${linkId} with status: ${scanResult.securityStatus}`);

        return NextResponse.json({
            success: true,
            linkId,
            securityStatus: scanResult.securityStatus,
            linkStatus: newStatus
        });

    } catch (error) {
        console.error('[Security Scan] Error:', error);

        // Even on error, try to update the link to mark scan as failed
        try {
            const { linkId } = await request.clone().json();
            if (linkId) {
                const linkRef = doc(db, 'shared_links', linkId);
                await updateDoc(linkRef, {
                    securityStatus: 'error',
                    securityScan: {
                        error: error.message,
                        scannedAt: new Date().toISOString()
                    }
                });
            }
        } catch (updateError) {
            console.error('[Security Scan] Failed to update error status:', updateError);
        }

        return NextResponse.json({
            error: 'Security scan failed',
            details: error.message
        }, { status: 500 });
    }
}
