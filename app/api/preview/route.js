// app/api/preview/route.js
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(request) {
    try {
        const { url } = await request.json();

        // Strict URL validation
        let validUrl;
        try {
            validUrl = new URL(url);
            if (validUrl.protocol !== 'http:' && validUrl.protocol !== 'https:') {
                throw new Error('Invalid protocol');
            }
        } catch (e) {
            return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
        }

        // SSRF Protection: Block private/local IP ranges and localhost
        const hostname = validUrl.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' ||
            hostname.startsWith('10.') ||
            hostname.startsWith('192.168.') ||
            (hostname.startsWith('172.') && parseInt(hostname.split('.')[1], 10) >= 16 && parseInt(hostname.split('.')[1], 10) <= 31)) {
            return NextResponse.json({ error: 'Internal/Private URLs are not allowed' }, { status: 403 });
        }

        // Special handling for X.com/Twitter (they block scraping)
        if (hostname === 'x.com' || hostname === 'www.x.com' ||
            hostname === 'twitter.com' || hostname === 'www.twitter.com') {
            return handleTwitterPreview(url);
        }

        // Fetch HTML dari link target dengan timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const res = await fetch(validUrl.toString(), {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SendTheLink/1.0; +https://sendthelink.vercel.app)'
            }
        });
        clearTimeout(timeoutId);

        const html = await res.text();
        const $ = cheerio.load(html);

        // Ambil Metadata (OG Tags)
        const title = $('meta[property="og:title"]').attr('content') || $('title').text() || 'No Title';
        const image = $('meta[property="og:image"]').attr('content') || null;
        const description = $('meta[property="og:description"]').attr('content') || '';

        return NextResponse.json({ title, image, description });
    } catch (error) {
        console.error('Preview fetch error:', error);

        // Return minimal preview instead of error
        return NextResponse.json({
            title: 'Link Preview Unavailable',
            image: null,
            description: 'Unable to fetch preview. Click to view the link.'
        });
    }
}

// Special handler for Twitter/X links
function handleTwitterPreview(url) {
    try {
        // Extract username and tweet ID from URL
        // Format: https://x.com/USERNAME/status/TWEET_ID or https://twitter.com/USERNAME/status/TWEET_ID
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(p => p);

        let title = '𝕏 Post';
        let description = 'View post on X (formerly Twitter)';

        if (pathParts.length >= 1) {
            const username = pathParts[0];
            title = `Post by @${username}`;

            if (pathParts.length >= 3 && pathParts[1] === 'status') {
                description = `View this post on X`;
            }
        }

        return NextResponse.json({
            title: title,
            image: 'https://abs.twimg.com/icons/apple-touch-icon-192x192.png', // X logo
            description: description
        });
    } catch (error) {
        return NextResponse.json({
            title: '𝕏 Post',
            image: null,
            description: 'View post on X (formerly Twitter)'
        });
    }
}
