// app/api/admin/refresh-previews/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { collection, getDocs, updateDoc, doc, query } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { verifyToken } from '../../../../lib/adminAuth';
import * as cheerio from 'cheerio';

// Auth check
function isAuthenticated(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
    const token = authHeader.split(' ')[1];
    return verifyToken(token);
}

// Fetch preview metadata for a URL
async function fetchPreviewMetadata(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SendTheLink/1.0; +https://sendthelink.vercel.app)'
            }
        });
        clearTimeout(timeoutId);

        const html = await res.text();
        const $ = cheerio.load(html);

        const title = $('meta[property="og:title"]').attr('content') || $('title').text() || null;
        const image = $('meta[property="og:image"]').attr('content') || null;

        return { title, image };
    } catch (error) {
        console.error(`Failed to fetch preview for ${url}:`, error.message);
        return { title: null, image: null };
    }
}

// POST - Refresh all links with missing previews
export async function POST(request) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { linkIds } = body; // Optional: specific link IDs to refresh

        const q = query(collection(db, 'shared_links'));
        const snapshot = await getDocs(q);

        let refreshed = 0;
        let skipped = 0;
        let failed = 0;
        const results = [];

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const linkId = docSnap.id;

            // If specific IDs provided, only refresh those
            if (linkIds && linkIds.length > 0 && !linkIds.includes(linkId)) {
                continue;
            }

            // Check if preview is missing or broken
            const hasMissingPreview = !data.metaImage || 
                data.metaTitle === 'Link Preview Unavailable' ||
                data.metaTitle === 'No Title' ||
                !data.metaTitle;

            if (!hasMissingPreview && !linkIds) {
                skipped++;
                continue;
            }

            // Fetch new preview
            const { title, image } = await fetchPreviewMetadata(data.url);

            if (title || image) {
                const updates = {};
                if (title) updates.metaTitle = title;
                if (image) updates.metaImage = image;

                await updateDoc(doc(db, 'shared_links', linkId), updates);
                refreshed++;
                results.push({
                    id: linkId,
                    url: data.url,
                    status: 'refreshed',
                    newTitle: title,
                    newImage: image ? '(has image)' : null
                });
            } else {
                failed++;
                results.push({
                    id: linkId,
                    url: data.url,
                    status: 'failed',
                    reason: 'Could not fetch metadata'
                });
            }

            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 500));
        }

        return NextResponse.json({
            success: true,
            summary: {
                total: snapshot.docs.length,
                refreshed,
                skipped,
                failed
            },
            results
        });

    } catch (error) {
        console.error('Refresh previews error:', error);
        return NextResponse.json({ 
            error: 'Failed to refresh previews', 
            details: error.message 
        }, { status: 500 });
    }
}

// GET - Check status of links with missing previews
export async function GET(request) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const q = query(collection(db, 'shared_links'));
        const snapshot = await getDocs(q);

        const missingPreviews = [];
        let totalLinks = 0;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            totalLinks++;

            const hasMissingPreview = !data.metaImage || 
                data.metaTitle === 'Link Preview Unavailable' ||
                data.metaTitle === 'No Title' ||
                !data.metaTitle;

            if (hasMissingPreview) {
                missingPreviews.push({
                    id: docSnap.id,
                    url: data.url,
                    currentTitle: data.metaTitle || '(none)',
                    currentImage: data.metaImage ? '(has image)' : '(no image)'
                });
            }
        }

        return NextResponse.json({
            totalLinks,
            missingCount: missingPreviews.length,
            missingPreviews
        });

    } catch (error) {
        console.error('Check previews error:', error);
        return NextResponse.json({ 
            error: 'Failed to check previews', 
            details: error.message 
        }, { status: 500 });
    }
}
