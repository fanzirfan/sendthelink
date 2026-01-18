# 🤖 AGENTS.md

> This document describes the autonomous agents and AI services powering **SendTheLink**'s security and moderation systems.

**Last Updated:** January 2026

---

## 📋 Overview

SendTheLink uses a multi-layer agent architecture to ensure link safety and content quality. These agents work together to:

1. **Detect malicious URLs** before they reach users
2. **Moderate content** to prevent spam, adult content, and scams
3. **Verify user trust** through a badge system
4. **Provide real-time security analysis** for all submitted links

---

## 🔒 Security Agents

### 1. VirusTotal Agent

**Role:** Multi-antivirus engine scanner

**Description:** Scans URLs against 70+ antivirus engines simultaneously to detect known malware, phishing, and malicious sites.

**Implementation:** `/lib/urlScanner.js`

**Key Features:**
- Queries VirusTotal API v3
- Returns malicious score (0-100)
- Categorizes threats (malware, phishing, trojan, etc.)
- Async processing for fast response

**Configuration:**
```bash
VIRUSTOTAL_API_KEY=your_api_key
```

**Response Format:**
```javascript
{
  malicious: boolean,
  score: number,
  engineCount: number,
  maliciousEngines: string[],
  lastAnalysis: timestamp
}
```

**Limitations:**
- Free tier: 500 requests/day
- Rate limiting: 4 requests/minute
- Latency: 1-3 seconds per scan

---

### 2. URLScan.io Agent

**Role:** Real-time URL behavioral analysis

**Description:** Performs live browser-based scanning to analyze URL behavior, server responses, and page content.

**Implementation:** `/lib/urlScanner.js`, `/app/api/scan/route.js`

**Key Features:**
- Live rendering and DOM analysis
- Screenshot capture
- Request/response tracking
- Country-based server selection
- Categorization (phishing, malware, parked, etc.)

**Configuration:**
```bash
URLSCAN_API_KEY=your_api_key
```

**Scan Options:**
```javascript
{
  url: string,
  visibility: "public" | "unlisted" | "private",
  tags: string[],
  customagent: string  // Custom User-Agent header
}
```

**Response Format:**
```javascript
{
  uuid: string,
  result: string,  // URL to fetch full results
  api: string,
  visibility: string,
  status: number
}
```

**Visibility Levels:**

| Level | Description |
|-------|-------------|
| Public | Visible on urlscan.io frontpage and search |
| Unlisted | Not public, visible to researchers |
| Private | Only visible to submitter (recommended for user submissions) |

**Rate Limits:**
- Free tier: 200 requests/day
- Rate limiting enforced via HTTP 429 headers
- Poll results until HTTP 200 received

---

### 3. Google Safe Browsing Agent

**Role:** Malware and phishing blacklist

**Description:** Checks URLs against Google's constantly updated threat intelligence database.

**Implementation:** `/app/api/moderate/route.js`

**Key Features:**
- Real-time threat detection
- Google Chrome/Google Safe Browsing integration
- Phishing and malware protection
- Social engineering detection

**Configuration:**
```bash
SAFE_BROWSING_API_KEY=your_api_key
```

**Response Format:**
```javascript
{
  safe: boolean,
  threats: string[],
  threatTypes: string[]
}
```

---

## 🤖 AI Moderation Agent

### 4. Gemini Content Moderation Agent

**Role:** Intelligent content analysis

**Description:** Uses Google's Gemini 2.0 Flash model to analyze URLs and messages for safety, categorization, and quality.

**Implementation:** `/app/api/moderate/route.js`

**Model:** `gemini-2.0-flash-exp`

**Key Features:**
- Natural language understanding
- Content categorization
- Safety classification
- Context-aware analysis
- Multi-language support

**Prompt Template:**
```
Analyze URL: ${url}
Message: ${message}

Is it safe (YouTube, Google, news, tutorials, tools) or unsafe (porn, gambling, scam, malicious)?

Respond in JSON format only:
{
  "safe": true/false,
  "reason": "brief explanation",
  "category": "Design | Code | Tools | Tutorial | AI | Other",
  "confidence": 0.0-1.0
}
```

**Response Format:**
```javascript
{
  safe: boolean,
  reason: string,
  category: string,
  confidence: number
}
```

**Use Cases:**
1. URL safety classification
2. Spam detection
3. Adult content filtering
4. Scam and fraud detection
5. Content categorization

**Configuration:**
```bash
GEMINI_API_KEY=your_api_key
```

**Cost Considerations:**
- Free tier available
- Charged per 1,000 tokens
- Optimized for fast responses (flash model)

---

## 🛡️ Defense in Depth

### Agent Execution Order

The agents execute in a specific sequence to maximize efficiency and minimize false positives:

```
1. Regex Pattern Filter (Instant)
   ↓
2. Google Safe Browsing (Fast)
   ↓
3. Gemini AI Moderation (Smart)
   ↓
4. VirusTotal Scanner (Thorough)
   ↓
5. URLScan.io Analysis (Behavioral)
```

**Why This Order?**

1. **Regex First** - Instant rejection of obvious spam (0ms)
2. **Safe Browsing Second** - Quick threat check (100-500ms)
3. **Gemini Third** - Smart classification before expensive scans (1-2s)
4. **VirusTotal Fourth** - Known threat detection (1-3s)
5. **URLScan.io Last** - Deep behavioral analysis (10-30s, async)

### Decision Matrix

| Agent | Safe | Suspicious | Malicious |
|-------|------|------------|-----------|
| Regex Pattern | ✅ Pass | ⚠️ Flag | 🚫 Block |
| Safe Browsing | ✅ Pass | ⚠️ Flag | 🚫 Block |
| Gemini AI | ✅ Pass | ⚠️ Review | 🚫 Block |
| VirusTotal | ✅ Score > 50 | ⚠️ Score 20-50 | 🚫 Score < 20 |
| URLScan.io | ✅ Pass | ⚠️ Review | 🚫 Block |

**Final Security Status:**
- **Safe ✅** - All agents pass
- **Suspicious ⚠️** - One or more agents flag issues (requires admin review)
- **Malicious 🚨** - Multiple agents block (auto-reject)
- **Pending 🔄** - Scanning in progress (async agents)

---

## 🔧 Configuration

### Environment Variables

```bash
# Security APIs
VIRUSTOTAL_API_KEY=
URLSCAN_API_KEY=
SAFE_BROWSING_API_KEY=
GEMINI_API_KEY=

# reCAPTCHA (Bot Protection)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=
RECAPTCHA_MIN_SCORE=0.5

# Admin & Verification
ADMIN_PASSWORD=
VERIFIED_USER_PASSWORD=

# Moderation
FILTER_WHITELIST_MODE=false
```

### Customizing Agent Behavior

#### Adjust VirusTotal Threshold

File: `/lib/urlScanner.js`
```javascript
const VIRUSTOTAL_THRESHOLD = 50;  // Lower = stricter
```

#### Adjust Gemini Prompts

File: `/app/api/moderate/route.js`
```javascript
const MODERATION_PROMPT = `Analyze URL: ${url}...`;
```

#### Adjust Regex Patterns

File: `/app/api/moderate/route.js`
```javascript
const BLOCKED_PATTERNS = [
  /\b(porn|xxx|adult)\b/i,
  /\b(gambling|casino|bet)\b/i,
  // Add custom patterns
];
```

---

## 📊 Agent Performance

### Average Response Times

| Agent | Avg Time | 95th Percentile |
|-------|----------|-----------------|
| Regex Filter | <1ms | <5ms |
| Safe Browsing | 200ms | 500ms |
| Gemini AI | 1.5s | 3s |
| VirusTotal | 2s | 4s |
| URLScan.io (submit) | 1s | 2s |
| URLScan.io (result) | 15s | 30s |

### Accuracy Rates (Estimates)

| Agent | True Positive | False Positive | True Negative | False Negative |
|-------|---------------|----------------|----------------|-----------------|
| Regex Filter | 95% | 20% | 80% | 5% |
| Safe Browsing | 98% | 2% | 98% | 2% |
| Gemini AI | 90% | 5% | 95% | 10% |
| VirusTotal | 99% | 1% | 99% | 1% |
| URLScan.io | 95% | 3% | 97% | 5% |

---

## 🚨 Error Handling

### Agent Failure Fallbacks

1. **VirusTotal Down**
   - Fallback to URLScan.io only
   - Mark as "Pending" for manual review

2. **Gemini Down**
   - Fallback to regex + Safe Browsing
   - Log error for monitoring

3. **URLScan.io Down**
   - Rely on VirusTotal + Gemini
   - Continue without behavioral analysis

4. **Safe Browsing Down**
   - Continue with other agents
   - Monitor for increased spam

### Error Codes

| Code | Description | Action |
|------|-------------|--------|
| `VT_RATE_LIMIT` | VirusTotal quota exceeded | Queue for retry |
| `URLSCAN_UNAVAILABLE` | URLScan.io service down | Use fallback |
| `GEMINI_TIMEOUT` | Gemini response timeout | Retry with shorter prompt |
| `SB_API_ERROR` | Safe Browsing error | Continue without |

---

## 🔮 Future Agent Enhancements

### Planned Additions

- [ ] **Phishing Detection Agent** - ML-based pattern recognition for phishing URLs
- [ ] **Content Summarization Agent** - Auto-generate link descriptions
- [ ] **Duplicate Detection Agent** - Identify and merge similar links
- [ ] **User Reputation Agent** - Track user behavior patterns
- [ ] **Image Moderation Agent** - Analyze screenshot content (if added)

### Potential Integrations

- OpenAI Content Moderation API
- AWS Rekognition (for image moderation)
- Cloudflare Security Center
- Have I Been Pwned (breached credential checking)

---

## 📚 API Documentation

For detailed API documentation for each agent:

- **VirusTotal:** https://docs.virustotal.com/reference
- **URLScan.io:** See `URLscan Documentaion.md`
- **Google Safe Browsing:** https://developers.google.com/safe-browsing
- **Google Gemini:** https://ai.google.dev/gemini-api/docs

---

## 🤝 Contributing

To add new agents or modify existing ones:

1. Create agent function in `/lib/` or `/app/api/`
2. Follow the async pattern for long-running operations
3. Add error handling with appropriate fallbacks
4. Update this documentation with agent details
5. Test with various URL types (safe, suspicious, malicious)

---

## 📧 Support

For issues related to specific agents:

- **VirusTotal:** Check your API key and rate limits
- **URLScan.io:** Verify UUID polling and visibility settings
- **Gemini:** Ensure API key has billing enabled (even if free tier)
- **General:** Open a GitHub issue with agent logs

---

**Document Version:** 1.0
**Maintained by:** FanzYB
