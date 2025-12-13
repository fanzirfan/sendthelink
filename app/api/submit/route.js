// app/api/submit/route.js
// Force Node.js runtime instead of Edge runtime for Firebase compatibility
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export async function POST(request) {
    try {
        const { from, message, url, isAnonymous, metaTitle, metaImage, tags } = await request.json();

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

        // Create link document
        const linkData = {
            from: cleanFrom,
            isAnonymous: !!isAnonymous,
            message: cleanMessage,
            url: cleanURL,
            tags: tags,
            metaTitle: metaTitle || cleanURL,
            metaImage: metaImage || null,
            reportCount: 0,
            reportedBy: [],
            status: 'approved',
            createdAt: new Date().toISOString(), // Use ISO string instead of serverTimestamp
        };

        const docRef = await addDoc(collection(db, 'shared_links'), linkData);

        return NextResponse.json({
            success: true,
            linkId: docRef.id
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
