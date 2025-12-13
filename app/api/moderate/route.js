// app/api/moderate/route.js
import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SAFE_BROWSING_API_KEY = process.env.SAFE_BROWSING_API_KEY;
const WHITELIST_MODE = process.env.FILTER_WHITELIST_MODE === 'true';

export async function POST(request) {
    try {
        const { url, message } = await request.json();

        if (!url || !url.startsWith('http')) {
            return NextResponse.json({
                safe: false,
                reason: 'Invalid URL format'
            }, { status: 400 });
        }

        // Step 0: Keyword + Pattern filter
        const simpleCheckResult = simpleUrlCheck(url, message || '');
        if (!simpleCheckResult.safe) {
            console.log('🚫 Blocked:', simpleCheckResult.reason);
            return NextResponse.json(simpleCheckResult);
        }

        // Step 1: Safe Browsing
        if (SAFE_BROWSING_API_KEY) {
            const safeBrowsingResult = await checkSafeBrowsing(url);
            if (!safeBrowsingResult.safe) {
                return NextResponse.json({
                    safe: false,
                    reason: `Blocked by Safe Browsing: ${safeBrowsingResult.threat}`
                });
            }
        }

        // Step 2: Gemini AI
        if (!GEMINI_API_KEY) {
            return NextResponse.json({ safe: true });
        }

        const aiResult = await checkWithGemini(url);
        return NextResponse.json(aiResult);

    } catch (error) {
        console.error('Moderation error:', error);
        return NextResponse.json({ safe: true, reason: 'Service unavailable' });
    }
}

function simpleUrlCheck(url, message = '') {
    const urlLower = url.toLowerCase();
    const messageLower = message.toLowerCase();
    const combinedText = `${urlLower} ${messageLower}`;

    if (WHITELIST_MODE) {
        const whitelist = [
            'youtube.com', 'youtu.be', 'google.com', 'drive.google.com',
            'github.com', 'stackoverflow.com', 'wikipedia.org',
            'medium.com', 'dev.to', 'reddit.com', 'twitter.com',
            'linkedin.com', 'facebook.com', 'instagram.com'
        ];

        const isWhitelisted = whitelist.some(domain => urlLower.includes(domain));
        if (!isWhitelisted) {
            return { safe: false, reason: 'Not in whitelist' };
        }
    }

    const adultKeywords = [
        'porn', 'xxx', 'sex', 'adult', 'nsfw', 'hentai', '18+', 'erotic', 'nude',
        'pornhub', 'xvideos', 'xnxx', 'redtube', 'youporn', 'tube8',
        'spankbang', 'xhamster', 'beeg', 'txxx', 'tnaflix',
        'jav', 'javhd', 'javmost', 'javdoe', 'dmm', 'fc2',  // Removed 'av' - too generic
        'chaturbate', 'cam4', 'stripchat', 'bongacams', 'myfreecams',
        'onlyfans', 'fansly', 'rule34', 'e621', 'gelbooru'
    ];

    // Gambling keywords
    const gamblingKeywords = [
        'casino', 'poker', 'betting', 'slot', 'jackpot', 'gamble', 'lottery',
        'bingo', 'roulette', 'blackjack', 'judi', 'taruhan', 'togel',
        'gacor', 'maxwin', 'jp', 'slot88', 'slotgacor', 'pragmaticplay',
        'rtpslot', 'rtp', 'bocoran', 'pola', 'olympus', 'gates', 'zeus',
        'starlight', 'bonanza', 'aztec',
        'bet365', '1xbet', 'betway', 'unibet', 'bwin', '888casino',
        'sbobet', 'sbotop', 'sbo', 'maxbet', 'ibcbet', 'cmd368',
        'w88', 'm88', 'fun88', '12bet', 'dafabet', '96ace',
        'jduol', 'judol', 'judikartu', 'bandarceme', 'pkv', 'dominoqq',
        'bandarq', 'pokerv', 'aduq', 'capsa', 'ceme', 'sakong',
        'stake', 'roobet', 'rollbit', 'duelbits',
        'pragmatic', 'pgsoft', 'joker123', 'habanero', 'spadegaming',
        'pokerstars', 'partypoker', 'ggpoker', '888poker'
    ];

    // Scam keywords
    const scamKeywords = [
        'get-rich', 'make-money-fast', 'free-money', 'win-prize',
        'claim-reward', 'phishing', 'fake', 'scam', 'fraud', 'ponzi'
    ];

    // SPAM PATTERNS (from screenshot)
    const SPAM_PATTERNS = [
        /\b[A-Z]{4,}\d{2,}/g,  // 4+ CAPS + digits (MANTAP77, GACOR88)
        /\b(gacor|zeus|slot|maxwin|casino|poker|judi|bonus|deposit|daftar|link)\s*\d{2,}/gi,
        /(judi\s+online|link\s+alternatif|bonus\s+deposit|daftar\s+sekarang|terpercaya)/gi
    ];

    // Calculate spam score
    let spamScore = 0;
    for (const pattern of SPAM_PATTERNS) {
        const matches = combinedText.match(pattern);
        if (matches) {
            spamScore += matches.length;
        }
    }

    // If spam score >= 2, likely gambling spam
    if (spamScore >= 2) {
        return { safe: false, reason: 'Spam pattern detected' };
    }

    // Only block clearly gambling TLDs (not .xyz/.site)
    const obviousGamblingTLDs = ['.bet', '.casino', '.poker', '.xxx', '.adult', '.sex'];
    for (const tld of obviousGamblingTLDs) {
        if (urlLower.includes(tld)) {
            return { safe: false, reason: `Gambling TLD (${tld})` };
        }
    }

    // Domain patterns (e.g., slot88.com, gacor77.net)
    const domainPatterns = [
        /slot\d{2,}\./i,
        /gacor\d{2,}\./i,
        /maxwin\d{2,}\./i,
        /(judi|taruhan|togel)\d{2,}\./i
    ];

    for (const pattern of domainPatterns) {
        if (pattern.test(urlLower)) {
            return { safe: false, reason: 'Gambling domain pattern' };
        }
    }

    // Check adult keywords
    for (const keyword of adultKeywords) {
        if (combinedText.includes(keyword)) {
            return { safe: false, reason: `Adult content (${keyword})` };
        }
    }

    // Check gambling keywords
    for (const keyword of gamblingKeywords) {
        if (combinedText.includes(keyword)) {
            return { safe: false, reason: `Gambling (${keyword})` };
        }
    }

    // Check scam keywords
    for (const keyword of scamKeywords) {
        if (combinedText.includes(keyword)) {
            return { safe: false, reason: `Scam (${keyword})` };
        }
    }

    return { safe: true };
}

async function checkSafeBrowsing(url) {
    try {
        const response = await fetch(
            `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${SAFE_BROWSING_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client: { clientId: 'sendthelink', clientVersion: '1.0.0' },
                    threatInfo: {
                        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
                        platformTypes: ['ANY_PLATFORM'],
                        threatEntryTypes: ['URL'],
                        threatEntries: [{ url }]
                    }
                })
            }
        );

        const data = await response.json();

        if (data.matches && data.matches.length > 0) {
            return { safe: false, threat: data.matches[0].threatType };
        }

        return { safe: true };
    } catch (error) {
        console.error('Safe Browsing error:', error);
        return { safe: true };
    }
}

async function checkWithGemini(url) {
    try {
        const prompt = `Analyze URL: ${url}. Is it safe (YouTube, Google, news) or unsafe (porn, gambling, scam)? JSON only: {"safe":true/false,"reason":""}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
                })
            }
        );

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const jsonMatch = text?.match(/\{[\s\S]*\}/);

        if (!jsonMatch) throw new Error('No JSON');

        const result = JSON.parse(jsonMatch[0]);
        return { safe: result.safe !== false, reason: result.reason || '' };

    } catch (error) {
        console.error('Gemini error:', error);
        return { safe: true, reason: 'AI unavailable' };
    }
}
