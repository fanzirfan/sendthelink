// app/api/scan/route.js
// Security scan endpoint.
//   POST { linkId } - scan one link now (admin token or scan secret required).
//   GET             - drain links left in 'pending' (cron target).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Scanning polls the providers for a verdict; allow the full function budget.
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { verifyScanRequest } from '../../../lib/adminAuth';
import { scanLinkById, resolvePendingLinks } from '../../../lib/linkScan';
import { getIP, scanLimiter } from '../../../lib/rateLimit';

export async function POST(request) {
    if (!verifyScanRequest(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await scanLimiter.check(request, 15, getIP(request));
    } catch (rateLimitError) {
        return NextResponse.json(
            { error: 'Too many scan requests', retryAfter: rateLimitError.retryAfter },
            { status: 429, headers: { 'Retry-After': String(rateLimitError.retryAfter) } }
        );
    }

    // Read the body once: the handler must not consume the stream twice.
    let payload;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const linkId = payload?.linkId;
    if (!linkId || typeof linkId !== 'string') {
        return NextResponse.json({ error: 'Missing linkId' }, { status: 400 });
    }

    // The URL is read from the stored document, never from the caller, so this
    // endpoint cannot be used to scan arbitrary third-party URLs.
    const result = await scanLinkById(linkId, { poll: true });

    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({ success: true, ...result.summary });
}

export async function GET(request) {
    if (!verifyScanRequest(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = request.nextUrl?.searchParams;
    const requestedMax = Number(params?.get('max')) || 10;
    const max = Math.min(Math.max(requestedMax, 1), 25);
    // `poll=1` waits for a verdict per link, so split the function budget
    // across the batch instead of letting one link eat the whole invocation.
    const poll = params?.get('poll') === '1';

    try {
        const report = await resolvePendingLinks({
            max,
            poll,
            ...(poll ? { budgetMs: Math.floor(50000 / max) } : {})
        });
        return NextResponse.json({ success: true, ...report });
    } catch (error) {
        console.error('[Security Scan] Pending resolution failed:', error);
        return NextResponse.json({ error: 'Failed to resolve pending scans' }, { status: 500 });
    }
}
