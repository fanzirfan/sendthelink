# 🔗 SendTheLink

> **SendTheLink** is a free, secure, and modern link sharing platform with AI-powered content moderation, spam protection, and tag-based categorization. Share useful resources with anyone — no login required.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/fanzyb/sendthelink)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.0.7-black)](https://nextjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-12.6.0-orange)](https://firebase.google.com/)

**Live Demo:** [sendthelink.vercel.app](https://sendthelink.vercel.app)

**Keywords:** link sharing, resource sharing, free links, design assets, code resources, AI moderation, anonymous sharing

---

## ✨ Features

### 🔒 **Security First**
- ✅ **Rate Limiting** - Prevents spam (5 submissions per 10 min)
- ✅ **XSS Protection** - All inputs sanitized
- ✅ **Google reCAPTCHA v3** - Bot protection
- ✅ **3-Layer Content Moderation**:
  - Pattern-based filtering (spam, adult, gambling)
  - Google Safe Browsing API
  - Google Gemini AI analysis
- ✅ **Security Headers** - CSP, X-Frame-Options, HSTS, etc.

### 🎨 **Modern UI/UX**
- Glassmorphic dark purple design with smooth animations
- Responsive layout (mobile, tablet, desktop)
- Dark mode optimized
- Real-time link preview with OG metadata
- Anonymous posting option
- **Tag-based categorization** (3D Assets, Design, Code, Tutorial, Tools, AI, Music, Video, Fonts, Game, Android, Windows)

### 📊 **Admin Dashboard**
- Password-protected admin panel
- Moderate reported links
- Edit/delete links and tags
- Search and filter by tags
- Auto-flag system (3+ reports)

### 🚀 **Performance**
- Server-side rendering with Next.js 16
- Edge-optimized API routes
- Real-time updates with Firestore
- Optimized images and assets

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Firebase account
- Google Cloud account (for APIs)
- Vercel account (for deployment)

### 1. Clone Repository

```bash
git clone https://github.com/fanzyb/sendthelink.git
cd sendthelink
npm install
```

### 2. Set Up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Firestore Database
4. Get your Firebase config (Settings → Your apps)

### 3. Set Up Google APIs

Get API keys from [Google Cloud Console](https://console.cloud.google.com/):
- **Gemini API** (for AI moderation)
- **Safe Browsing API** (for malware detection)
- **reCAPTCHA v3** (for bot protection)

### 4. Configure Environment Variables

Create `.env.local`:

```bash
# Backend API Keys
GEMINI_API_KEY=your_gemini_api_key
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
SAFE_BROWSING_API_KEY=your_safe_browsing_api_key
ADMIN_PASSWORD=your_secure_admin_password

# Configuration
RECAPTCHA_MIN_SCORE=0.5
FILTER_WHITELIST_MODE=false

# Frontend (NEXT_PUBLIC_*)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_recaptcha_site_key

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

See `.env.example` for a complete template.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📦 Deployment

### Deploy to Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your repository
   - Add all environment variables (see `.env.example`)
   - Deploy!

3. **Post-Deployment**
   - Add production domain to reCAPTCHA whitelist
   - Update Firebase Firestore rules

---

## 🛡️ Security

This project implements multiple layers of security:

- **Input Sanitization** - XSS protection on all user inputs
- **Rate Limiting** - IP-based rate limiting on all endpoints
- **Content Moderation** - AI + pattern-based filtering
- **HTTPS Only** - Enforced via HSTS headers
- **CSP** - Content Security Policy headers
- **Safe Firebase Rules** - Server-only writes, public reads


### Reporting Security Issues

Please report security vulnerabilities to: **fanzirfan@proton.me**

Do NOT open public issues for security vulnerabilities.

---

## 📂 Project Structure

```
sendthelink/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── admin/        # Admin endpoints
│   │   ├── moderate/     # Content moderation
│   │   ├── preview/      # Link preview
│   │   ├── report/       # Report system
│   │   ├── submit/       # Secure submission
│   │   └── verify-captcha/ # reCAPTCHA
│   ├── admin/            # Admin dashboard
│   ├── globals.css       # Global styles
│   ├── layout.js         # Root layout
│   └── page.js           # Homepage
├── lib/                   # Utilities
│   ├── firebase.js       # Firebase config
│   ├── rateLimit.js      # Rate limiting
│   └── sanitize.js       # Input sanitization
├── public/               # Static assets
└── docs/                 # Documentation
```

---

## 🔧 Configuration

### Content Filtering

Edit `app/api/moderate/route.js` to customize:
- Blocked keywords
- Spam patterns
- Whitelisted domains (if `FILTER_WHITELIST_MODE=true`)

### Rate Limits

Edit `lib/rateLimit.js`:
```javascript
export const submitLimiter = rateLimit({
  interval: 10 * 60 * 1000, // 10 minutes
  // Change limit: await submitLimiter.check(request, 5, ip);
});
```

### Admin Auth

Default uses simple password auth. For production:
- Consider implementing JWT with expiration
- Add 2FA for admin access
- Use session management

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style
- Add tests for new features
- Update documentation
- Ensure security best practices

---

## 📝 License

This project is licensed under the **MIT License** - see [LICENSE](LICENSE) file.

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Firebase](https://firebase.google.com/) - Backend infrastructure
- [Google Gemini](https://ai.google.dev/) - AI moderation
- [Vercel](https://vercel.com/) - Hosting platform
- [reCAPTCHA](https://www.google.com/recaptcha/) - Bot protection

---

## 📧 Contact

- **Website:** [sendthelink.vercel.app](https://sendthelink.vercel.app)
- **Issues:** [GitHub Issues](https://github.com/fanzyb/sendthelink/issues)
- **Email:** fanzirfan@proton.me

---

## 🗺️ Roadmap

- [ ] User accounts & profiles
- [x] ~~Collections/categories~~ → **Tags system implemented!**
- [ ] Link analytics
- [ ] Custom short URLs
- [ ] API for third-party integrations
- [ ] Mobile app (React Native)
- [ ] Browser extension

---

Made with ❤️ by [FanzYB](https://github.com/fanzyb)
