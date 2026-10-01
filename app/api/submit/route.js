// app/api/submit/route.js
// Force Node.js runtime instead of Edge runtime for Firebase compatibility
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// The post-response scan polls the providers for a verdict.
export const maxDuration = 60;

import { NextResponse, after } from 'next/server';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { scanLinkById, resolvePendingLinks } from '../../../lib/linkScan';

export async function POST(request) {
    try {
        const { from, message, url, isAnonymous, metaTitle, metaImage, tags, verifyPassword } = await request.json();

        // Basic validation
        if (!message || !url) {
            return NextResponse.json({
                error: 'Missing required fields'
            }, { status: 400 });
        }

        // Validate tags (must be array with at least 1 item)
        if (!tags || !Array.isArray(tags) || tags.length === 0) {
            return NextResponse.json({
                error: 'At least one tag is required'
            }, { status: 400 });
        }

        // Simple URL validation - just check it starts with http/https
        const trimmedURL = url.trim();
        if (!trimmedURL.startsWith('http://') && !trimmedURL.startsWith('https://')) {
            return NextResponse.json({
                error: 'Invalid URL. Must start with http:// or https://'
            }, { status: 400 });
        }

        // Simple text sanitization - just trim and limit length
        const cleanFrom = isAnonymous ? 'Anonymous' : (from || 'Anonymous').trim().substring(0, 100);
        const cleanMessage = message.trim().substring(0, 500);
        const cleanURL = trimmedURL.substring(0, 2000);

        // Check if user is verified via password
        const verifiedPassword = process.env.VERIFIED_USER_PASSWORD;
        const isVerified = verifiedPassword && verifyPassword === verifiedPassword && !isAnonymous;

        // Create link document with security status pending
        const linkData = {
            from: cleanFrom,
            isAnonymous: !!isAnonymous,
            isVerified: isVerified, // NEW: Verified badge status
            message: cleanMessage,
            url: cleanURL,
            tags: tags,
            metaTitle: metaTitle || cleanURL,
            metaImage: metaImage || null,
            reportCount: 0,
            reportedBy: [],
            status: 'approved',
            // Security scan fields
            securityStatus: 'pending', // pending | safe | suspicious | malicious
            securityScan: null, // Will be populated after scan completes
            createdAt: new Date().toISOString(),
        };

        const docRef = await addDoc(collection(db, 'shared_links'), linkData);

        // Scan after the response is sent. `after` keeps the invocation alive
        // for the work, unlike a fire-and-forget fetch that a serverless host
        // may tear down before the request leaves the process.
        after(async () => {
            try {
                // Drain older stragglers first (cheap, no polling), then poll
                // this submission so under real traffic nothing stays pending.
                await resolvePendingLinks({ max: 2 });
                await scanLinkById(docRef.id, { poll: true });
            } catch (error) {
                console.error('Background security scan failed:', error);
            }
        });

        return NextResponse.json({
            success: true,
            linkId: docRef.id,
            securityStatus: 'pending' // Inform client that scan is in progress
        });

    } catch (error) {
        console.error('Submit error:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        return NextResponse.json({
            error: 'Failed to submit link',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }, { status: 500 });
    }
}

