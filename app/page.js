// app/page.js
"use client";
import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import Link from "next/link";

// Helper function to validate image URLs
const isValidImageUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:');
};

// Available tags for categorization
const AVAILABLE_TAGS = [
  { id: '3d', label: '3D Assets', emoji: '🎮' },
  { id: 'design', label: 'Design', emoji: '🎨' },
  { id: 'code', label: 'Code', emoji: '💻' },
  { id: 'tutorial', label: 'Tutorial', emoji: '📚' },
  { id: 'tools', label: 'Tools', emoji: '🛠️' },
  { id: 'ai', label: 'AI', emoji: '🤖' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'video', label: 'Video', emoji: '🎬' },
  { id: 'fonts', label: 'Fonts', emoji: '✍️' },
  { id: 'game', label: 'Game', emoji: '🕹️' },
  { id: 'android', label: 'Android', emoji: '🤖' },
  { id: 'windows', label: 'Windows', emoji: '🪟' },
  { id: 'other', label: 'Other', emoji: '📦' },
];

export default function Home() {
  const [links, setLinks] = useState([]);
  const [filteredLinks, setFilteredLinks] = useState([]);
  const [form, setForm] = useState({ from: "", message: "", url: "", isAnonymous: false, tags: [], verifyPassword: "" });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTagFilter, setActiveTagFilter] = useState(null);
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState(null);

  // Report modal state
  const [reportModal, setReportModal] = useState(null);
  const [reportReason, setReportReason] = useState("");

  // Show toast notification
  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Load reCAPTCHA script
  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey) return;

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => setRecaptchaLoaded(true);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  // Fetch links from Firestore
  useEffect(() => {
    const q = query(collection(db, "shared_links"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const linksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Filter out rejected/flagged/pending_review links from public view  
      const approvedLinks = linksData.filter(link =>
        !link.status || link.status === 'approved'
      );
      setLinks(approvedLinks);
      setFilteredLinks(approvedLinks);
    });
    return () => unsubscribe();
  }, []);

  // Search and tag filter
  useEffect(() => {
    let filtered = links;

    // Filter by tag first
    if (activeTagFilter) {
      filtered = filtered.filter(link =>
        link.tags && link.tags.includes(activeTagFilter)
      );
    }

    // Then filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(link =>
        link.from?.toLowerCase().includes(q) ||
        link.message?.toLowerCase().includes(q) ||
        link.url?.toLowerCase().includes(q) ||
        link.metaTitle?.toLowerCase().includes(q)
      );
    }

    setFilteredLinks(filtered);
  }, [searchQuery, links, activeTagFilter]);

  // Get reCAPTCHA token
  const getReCaptchaToken = async () => {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey || !window.grecaptcha) return null;

    try {
      const token = await window.grecaptcha.execute(siteKey, { action: 'submit' });
      return token;
    } catch (error) {
      console.error('reCAPTCHA error:', error);
      return null;
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate tags (minimum 1 required)
    if (form.tags.length === 0) {
      showToast('⚠️ Please select at least one tag', 'warning');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Verify reCAPTCHA
      const recaptchaToken = await getReCaptchaToken();
      if (recaptchaToken) {
        const captchaRes = await fetch('/api/verify-captcha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: recaptchaToken }),
        });
        const captchaData = await captchaRes.json();

        if (!captchaData.success) {
          showToast('❌ Security verification failed. Please try again.', 'error');
          setLoading(false);
          return;
        }
      }

      // Step 2: Moderate content (check URL AND message)
      const moderateRes = await fetch('/api/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.url, message: form.message }),
      });
      const moderateData = await moderateRes.json();

      if (!moderateData.safe) {
        showToast(`⚠️ Link Blocked: ${moderateData.reason}`, 'error');
        setLoading(false);
        return;
      }

      // Step 3: Fetch preview metadata
      const metaRes = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.url }),
      });
      const metaData = await metaRes.json();

      // Step 4: Submit via secure API (includes rate limiting & sanitization)
      const fromValue = form.isAnonymous ? "Anonymous" : (form.from || "Anonymous");

      const submitRes = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromValue,
          isAnonymous: form.isAnonymous,
          message: form.message,
          url: form.url,
          tags: form.tags,
          metaTitle: metaData.title || form.url,
          metaImage: metaData.image || null,
          verifyPassword: form.verifyPassword || null, // For verified badge
        }),
      });

      const submitData = await submitRes.json();

      if (!submitRes.ok) {
        if (submitRes.status === 429) {
          showToast(`⚠️ Rate limit exceeded. Please wait ${submitData.retryAfter} seconds.`, 'error');
        } else {
          showToast(`❌ ${submitData.error || 'Failed to submit link'}`, 'error');
        }
        setLoading(false);
        return;
      }

      // Reset form
      setForm({ from: "", message: "", url: "", isAnonymous: false, tags: [], verifyPassword: "" });
      showToast("✅ Link shared successfully!\n🔍 Link is being scanned for security, please wait...", "success");

    } catch (error) {
      console.error(error);
      showToast("❌ Failed to share link. Please try again.", "error");
    }

    setLoading(false);
  };

  // Handle copy link button - copies the actual URL
  const handleCopyLink = (url) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => {
          showToast(`📋 Link copied!`, "success");
        })
        .catch((err) => {
          console.error('Clipboard error:', err);
          showToast(url, "info");
        });
    } else {
      showToast(url, "info");
    }
  };

  // Handle share details page - uses Web Share API or copies details URL
  const handleShareDetails = (linkId, title) => {
    const detailsUrl = `${window.location.origin}/link/${linkId}`;

    // Try Web Share API first (mobile-friendly)
    if (navigator.share) {
      navigator.share({
        title: title || 'Check out this link on SendTheLink!',
        url: detailsUrl,
      }).catch((err) => {
        // User cancelled or error, fallback to clipboard
        if (err.name !== 'AbortError') {
          copyToClipboard(detailsUrl);
        }
      });
    } else {
      // Fallback: copy to clipboard
      copyToClipboard(detailsUrl);
    }
  };

  // Helper function to copy to clipboard
  const copyToClipboard = (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          showToast(`🔗 Details link copied!`, "success");
        })
        .catch(() => {
          showToast(text, "info");
        });
    } else {
      showToast(text, "info");
    }
  };

  // Handle report button - show modal
  const openReportModal = (linkId) => {
    setReportModal(linkId);
    setReportReason("");
  };

  // Submit report
  const submitReport = async () => {
    if (!reportReason.trim()) {
      showToast("ℹ️ Please enter a reason for reporting", "warning");
      return;
    }

    // Get or create reporter ID from localStorage
    let reporterId = localStorage.getItem('reporterId');
    if (!reporterId) {
      reporterId = `reporter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('reporterId', reporterId);
    }

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId: reportModal, reporterId, reason: reportReason.trim() }),
      });

      const data = await res.json();

      if (data.alreadyReported) {
        showToast("⚠️ You've already reported this link", "warning");
      } else if (data.success) {
        showToast(`✅ Report submitted! (Total: ${data.reportCount})`, "success");
      } else {
        showToast("❌ Failed to submit report", "error");
      }
    } catch (error) {
      console.error('Report error:', error);
      showToast("❌ Network error. Please try again.", "error");
    }

    setReportModal(null);
    setReportReason("");
  };

  return (
    <main className="min-h-screen px-4 md:px-10 py-8 md:py-10">
      <div className="max-w-6xl mx-auto">

        {/* Toast Notification */}
        {toast && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className={`glass-card p-6 md:p-8 w-full max-w-sm md:max-w-lg animate-toast-popup pointer-events-auto ${toast.type === 'error' ? 'border-red-500' :
              toast.type === 'success' ? 'border-green-500' :
                toast.type === 'warning' ? 'border-yellow-500' :
                  'border-blue-500'
              } border-l-4 text-center shadow-2xl`}>
              <p className="text-base md:text-lg font-medium whitespace-pre-line">{toast.message}</p>
            </div>
          </div>
        )}

        {/* Report Modal */}
        {reportModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="glass-card p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">🚩 Report Inappropriate Content</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                Please tell us why you're reporting this link:
              </p>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="e.g., spam, inappropriate content, scam..."
                className="input-glass w-full resize-none mb-4"
                rows="4"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={submitReport}
                  className="btn-glass flex-1"
                >
                  Submit Report
                </button>
                <button
                  onClick={() => setReportModal(null)}
                  className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="mb-10 text-center fade-in-up px-2">
          <h1 className="text-3xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200 bg-clip-text text-transparent">
            SendTheLink
          </h1>
          <p className="text-base md:text-lg" style={{ color: 'var(--text-secondary)' }}>
            Share useful links with everyone. No login required.
          </p>
        </header>

        {/* Form - Glassmorphic Card */}
        <div className="glass-card p-6 md:p-8 mb-12 fade-in-up" style={{ animationDelay: '0.1s' }}>
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                required
                type="text"
                placeholder="From: (e.g., John Doe)"
                className="input-glass w-full"
                value={form.from}
                onChange={(e) => setForm({ ...form, from: e.target.value })}
                disabled={form.isAnonymous}
              />
              <input
                required
                type="url"
                placeholder="Paste Link (https://...)"
                className="input-glass w-full"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </div>

            <textarea
              required
              rows="3"
              placeholder="Your message (e.g., This is a great free 3D asset!)"
              className="input-glass w-full resize-none"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />

            {/* Tag Selector */}
            <div>
              <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                🏷️ Select Tags (min 1 required)
              </label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TAGS.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      const newTags = form.tags.includes(tag.id)
                        ? form.tags.filter(t => t !== tag.id)
                        : [...form.tags, tag.id];
                      setForm({ ...form, tags: newTags });
                    }}
                    className={`tag-chip ${form.tags.includes(tag.id) ? 'active' : ''}`}
                  >
                    {tag.emoji} {tag.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Verified Password (Optional) */}
            <div>
              <input
                type="password"
                placeholder="🔐 Verification Password (optional - for verified badge)"
                className="input-glass w-full"
                value={form.verifyPassword}
                onChange={(e) => setForm({ ...form, verifyPassword: e.target.value })}
              />
            </div>

            {/* Anonymous Checkbox */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="anonymous"
                checked={form.isAnonymous}
                onChange={(e) => setForm({ ...form, isAnonymous: e.target.checked })}
                className="w-5 h-5 accent-purple-500 cursor-pointer"
              />
              <label htmlFor="anonymous" className="cursor-pointer text-sm" style={{ color: 'var(--text-secondary)' }}>
                🕶️ Send Anonymously (hide my name)
              </label>
            </div>

            <button
              disabled={loading}
              type="submit"
              className="btn-glass w-full text-lg font-bold"
            >
              {loading ? "🔄 Processing..." : "Send Link 🚀"}
            </button>

          </form>
        </div>

        {/* Search Bar */}
        <div className="mb-4 fade-in-up" style={{ animationDelay: '0.2s' }}>
          <input
            type="text"
            placeholder="🔍 Search links by sender, message, or URL..."
            className="input-glass w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Tag Filter Buttons */}
        <div className="mb-8 fade-in-up" style={{ animationDelay: '0.25s' }}>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTagFilter(null)}
              className={`tag-filter ${!activeTagFilter ? 'active' : ''}`}
            >
              📚 All
            </button>
            {AVAILABLE_TAGS.map((tag) => (
              <button
                key={tag.id}
                onClick={() => setActiveTagFilter(activeTagFilter === tag.id ? null : tag.id)}
                className={`tag-filter ${activeTagFilter === tag.id ? 'active' : ''}`}
              >
                {tag.emoji} {tag.label}
              </button>
            ))}
          </div>
        </div>

        {/* Links Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredLinks.length === 0 && searchQuery && (
            <div className="col-span-full text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <p className="text-xl">No links found matching "{searchQuery}"</p>
            </div>
          )}

          {filteredLinks.map((item, index) => (
            <Link
              key={item.id}
              href={`/link/${item.id}`}
              id={item.id}
              className="glass-card p-5 fade-in-up block cursor-pointer hover:scale-[1.02] transition-transform duration-300"
              style={{ animationDelay: `${0.3 + index * 0.05}s` }}
            >
              <div className="mb-3">
                {/* Top row: From + Verified badge */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    From: <span style={{ color: 'var(--text-secondary)' }}>{item.from || "Anonymous"}</span>
                  </span>
                  {item.isVerified && (
                    <span className="verified-icon" title="Verified">✓</span>
                  )}
                </div>
                {/* Buttons row */}
                <div className="flex gap-2">
                  {/* Share Details Button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleShareDetails(item.id, item.metaTitle);
                    }}
                    className="text-xs md:text-sm px-2 md:px-3 py-1.5 md:py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 transition font-semibold"
                    title="Share this content"
                  >
                    🔗 <span className="hidden sm:inline">Share</span>
                  </button>
                  {/* Copy Link Button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCopyLink(item.url);
                    }}
                    className="text-xs md:text-sm px-2 md:px-3 py-1.5 md:py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition font-semibold"
                    title="Copy original link to clipboard"
                  >
                    📋 <span className="hidden sm:inline">Copy</span>
                  </button>
                  {/* Report Button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openReportModal(item.id);
                    }}
                    className="text-xs md:text-sm px-2 md:px-3 py-1.5 md:py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition font-semibold"
                    title="Report inappropriate content"
                  >
                    🚩
                  </button>
                </div>
              </div>

              {/* Tags */}
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {item.tags.map(tagId => {
                    const tag = AVAILABLE_TAGS.find(t => t.id === tagId);
                    return tag ? (
                      <span key={tagId} className="tag-display">
                        {tag.emoji} {tag.label}
                      </span>
                    ) : null;
                  })}
                </div>
              )}

              {/* Message */}
              <p className="text-base mb-4 leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                "{item.message}"
              </p>

              {/* Link Preview Card */}
              <div
                className="flex items-center bg-white/10 rounded-xl overflow-hidden border border-white/20 hover:bg-white/20 transition group"
              >
                {/* Thumbnail */}
                <div className="w-20 h-20 bg-white/5 flex-shrink-0 relative overflow-hidden">
                  {isValidImageUrl(item.metaImage) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.metaImage}
                      alt="preview"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🔗</div>
                  )}
                </div>

                {/* Link Info */}
                <div className="p-3 overflow-hidden flex-1">
                  <h3 className="font-bold text-sm truncate group-hover:text-blue-300 transition">
                    {item.metaTitle}
                  </h3>
                  <p className="text-xs truncate mt-1" style={{ color: 'var(--text-muted)' }}>
                    {(() => {
                      try {
                        return new URL(item.url).hostname;
                      } catch {
                        return item.url;
                      }
                    })()}
                  </p>
                </div>
              </div>

              {/* View Details Hint */}
              <div className="mt-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                👆 Click card "View Details"
              </div>

            </Link>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-white/10 text-center fade-in-up">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} SendTheLink • Share knowledge freely
          </p>

          {/* Security Credits */}
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            <a
              href="https://www.virustotal.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs hover:text-white transition-colors flex items-center gap-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              🛡️ Secured by VirusTotal
            </a>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>•</span>
            <a
              href="https://urlscan.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs hover:text-white transition-colors flex items-center gap-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              🔍 Scanned by URLScan.io
            </a>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>•</span>
            <a
              href="/analytics-policy"
              className="text-xs hover:text-white transition-colors flex items-center gap-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              📊 Analytics Policy
            </a>
          </div>

          <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
            Protected by reCAPTCHA • All links are security scanned
          </p>

          <p className="text-xs mt-3">
            <a
              href="mailto:dmca@manji.eu.org"
              className="hover:text-white transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              title="Report copyright infringement"
            >
              📧 DMCA Takedown Request
            </a>
          </p>
        </footer>

      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        @keyframes toast-popup {
          from {
            transform: scale(0.8);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-toast-popup {
          animation: toast-popup 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
      `}</style>
    </main>
  );
}