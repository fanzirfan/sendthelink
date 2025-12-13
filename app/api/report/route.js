// app/api/report/route.js
import { NextResponse } from 'next/server';
import { doc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { reportLimiter, getIP } from '../../../lib/rateLimit';
import { sanitizeInput } from '../../../lib/sanitize';

export async function POST(request) {
    // Rate limit reports (5 per 5 minutes per IP)
    const ip = getIP(request);
    try {
        await reportLimiter.check(request, 5, ip);
    } catch (rateLimitError) {
        return NextResponse.json(
            { error: 'Too many reports. Please try again later.', retryAfter: rateLimitError.retryAfter },
            { status: 429, headers: { 'Retry-After': String(rateLimitError.retryAfter) } }
        );
    }

    try {
        const { linkId, reporterId, reason } = await request.json();

        if (!linkId || !reporterId) {
            return NextResponse.json({
                error: 'Missing required fields'
            }, { status: 400 });
        }

        // Sanitize reason input
        const sanitizedReason = reason ? sanitizeInput(reason) : '';

        const linkRef = doc(db, 'shared_links', linkId);
        const linkDoc = await getDoc(linkRef);

        if (!linkDoc.exists()) {
            return NextResponse.json({
                error: 'Link not found'
            }, { status: 404 });
        }

        const linkData = linkDoc.data();
        const reportedBy = linkData.reportedBy || [];

        // Check if this reporter already reported this link
        if (reportedBy.includes(reporterId)) {
            return NextResponse.json({
                error: 'You have already reported this link',
                alreadyReported: true
            }, { status: 400 });
        }

        // Update the link with new report
        await updateDoc(linkRef, {
            reportCount: (linkData.reportCount || 0) + 1,
            reportedBy: arrayUnion(reporterId),
            // Auto-flag if reports exceed threshold
            status: (linkData.reportCount || 0) + 1 >= 3 ? 'flagged' : linkData.status || 'approved'
        });

        return NextResponse.json({
            success: true,
            reportCount: (linkData.reportCount || 0) + 1
        });

    } catch (error) {
        console.error('Report error:', error);
        return NextResponse.json({
            error: 'Failed to submit report'
        }, { status: 500 });
    }
}
