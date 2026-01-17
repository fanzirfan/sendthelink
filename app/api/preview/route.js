// app/api/preview/route.js
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// SSRF Protection: Block internal/private network access
// This uses a blocklist approach - allow all public internet, block internal networks
const BLOCKED_HOSTNAMES = [
    'localhost',
    'localhost.localdomain',
    'local',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '[::]',
    '[::1]',
];

const BLOCKED_DOMAIN_SUFFIXES = [
    '.local',
    '.localhost',
    '.localdomain',
    '.internal',
    '.intranet',
    '.corp',
    '.home',
    '.lan',
    '.private',
];

// Private IP ranges (RFC 1918, RFC 4193, RFC 6598, loopback, link-local)
function isPrivateIP(hostname) {
    // IPv4 patterns
    const ipv4Patterns = [
        /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,           // Loopback 127.0.0.0/8
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,            // Class A private 10.0.0.0/8
        /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/, // Class B private 172.16.0.0/12
        /^192\.168\.\d{1,3}\.\d{1,3}$/,              // Class C private 192.168.0.0/16
        /^169\.254\.\d{1,3}\.\d{1,3}$/,              // Link-local 169.254.0.0/16
        /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/, // CGN 100.64.0.0/10
        /^0\.0\.0\.0$/,                              // Default route
        /^255\.255\.255\.255$/,                      // Broadcast
    ];
    
    // Check if it's an IPv4 address
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
        return ipv4Patterns.some(pattern => pattern.test(hostname));
    }
    
    // IPv6 patterns - block loopback and private
    if (hostname.includes(':') || hostname.startsWith('[')) {
        const cleanIPv6 = hostname.replace(/^\[|\]$/g, '');
        // Loopback ::1
        if (cleanIPv6 === '::1' || cleanIPv6 === '0:0:0:0:0:0:0:1') return true;
        // Unspecified ::
        if (cleanIPv6 === '::' || cleanIPv6 === '0:0:0:0:0:0:0:0') return true;
        // Link-local fe80::/10
        if (/^fe[89ab]/i.test(cleanIPv6)) return true;
        // Unique local fc00::/7
        if (/^f[cd]/i.test(cleanIPv6)) return true;
    }
    
    return false;
}

function isHostnameBlocked(hostname) {
    const lowerHostname = hostname.toLowerCase();
    
    // Check explicit blocked hostnames
    if (BLOCKED_HOSTNAMES.includes(lowerHostname)) {
        return true;
    }
    
    // Check blocked domain suffixes
    if (BLOCKED_DOMAIN_SUFFIXES.some(suffix => lowerHostname.endsWith(suffix))) {
        return true;
    }
    
    // Check if it's a private/internal IP address
    if (isPrivateIP(hostname)) {
        return true;
    }
    
    // Check for cloud metadata endpoints (AWS, GCP, Azure, DigitalOcean, etc.)
    const metadataEndpoints = [
        '169.254.169.254',     // AWS/GCP/Azure metadata
        'metadata.google.internal',
        'metadata.goog',
        '169.254.170.2',       // AWS ECS task metadata
    ];
    if (metadataEndpoints.includes(lowerHostname)) {
        return true;
    }
    
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

        // SSRF Protection: Block internal/private network access
        const hostname = validUrl.hostname;

        if (isHostnameBlocked(hostname)) {
            return NextResponse.json({ 
                error: 'Access to internal/private networks is not allowed.' 
            }, { status: 403 });
        }

        // Block requests to non-standard ports commonly used for internal services
        const port = validUrl.port;
        const blockedPorts = ['22', '23', '25', '3306', '5432', '6379', '27017', '9200', '11211'];
        if (port && blockedPorts.includes(port)) {
            return NextResponse.json({ 
                error: 'Access to this port is not allowed.' 
            }, { status: 403 });
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
