// app/api/preview/route.js
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// SSRF protection: restrict outgoing requests to a controlled set of domains.
// Adjust these lists according to the domains you actually want to support.
const ALLOWED_HOSTNAMES = [
    // Exact hostnames explicitly allowed for link previews.
    // Example: your own app domains or other trusted services.
    'sendthelink.vercel.app',
    'www.sendthelink.vercel.app',
];
const ALLOWED_DOMAIN_SUFFIXES = [
    // Public suffixes you consider safe to allow, e.g. '.example.com'
    // This allows any subdomain of the listed suffixes.
    '.sendthelink.vercel.app',
];

function isHostnameAllowed(hostname) {
    if (ALLOWED_HOSTNAMES.length > 0 && ALLOWED_HOSTNAMES.includes(hostname)) {
        return true;
    }
    if (ALLOWED_DOMAIN_SUFFIXES.length > 0) {
        return ALLOWED_DOMAIN_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
    }
    // If no allow-list entries are configured, deny by default.
    return false;
}

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

        // SSRF Protection: Strict Domain Validation
        // We reject any URL that looks like an IP address (IPv4 or IPv6) or local domain
        const hostname = validUrl.hostname;

        const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.startsWith('[') || hostname.includes(':');
        const isLocal = hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal');

        if (isIpAddress || isLocal) {
            return NextResponse.json({ error: 'Direct IP access and local domains are not allowed. Please use a valid public domain.' }, { status: 403 });
        }

        // Enforce allow-list: only fetch from explicitly permitted hostnames/domains
        if (!isHostnameAllowed(hostname)) {
            return NextResponse.json({ error: 'Preview for this domain is not allowed.' }, { status: 403 });
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
