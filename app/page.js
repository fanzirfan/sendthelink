// app/page.js
"use client";
import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import Link from "next/link";
import { Gamepad2, Palette, Laptop, BookOpen, Hammer, Bot, Music, Film, PenTool, Smartphone, Monitor, Box, Search, Copy, Flag, RefreshCw, Tag, Lock, EyeOff, Shield, Mail, SearchCheck, Link as LinkIcon, FileSpreadsheet, Coffee, Plus } from "lucide-react";

// Helper function to validate image URLs
const isValidImageUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:');
};

// Available tags for categorization
const AVAILABLE_TAGS = [
  { id: '3d', label: '3D Assets', icon: Gamepad2 },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'code', label: 'Code', icon: Laptop },
  { id: 'tutorial', label: 'Tutorial', icon: BookOpen },
  { id: 'tools', label: 'Tools', icon: Hammer },
  { id: 'ai', label: 'AI', icon: Bot },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'video', label: 'Video', icon: Film },
  { id: 'fonts', label: 'Fonts', icon: PenTool },
  { id: 'game', label: 'Game', icon: Gamepad2 },
  { id: 'android', label: 'Android', icon: Smartphone },
  { id: 'windows', label: 'Windows', icon: Monitor },
  { id: 'other', label: 'Other', icon: Box },
];

export default function Home() {
  const [links, setLinks] = useState([]);
  const [form, setForm] = useState({ from: "", message: "", url: "", isAnonymous: false, tags: [], verifyPassword: "" });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTagFilter, setActiveTagFilter] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
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
    });
    return () => unsubscribe();
  }, []);

  // Search and tag filter
  const filteredLinks = useMemo(() => {
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

    return filtered;
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
      showToast('Please select at least one tag', 'warning');
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
          showToast('Security verification failed. Please try again.', 'error');
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
        showToast(`Link Blocked: ${moderateData.reason}`, 'error');
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
          showToast(`Rate limit exceeded. Please wait ${submitData.retryAfter} seconds.`, 'error');
        } else {
          showToast(`${submitData.error || 'Failed to submit link'}`, 'error');
        }
        setLoading(false);
        return;
      }

// Reset form
      setForm({ from: "", message: "", url: "", isAnonymous: false, tags: [], verifyPassword: "" });
      showToast("Link shared successfully!\nLink is being scanned for security, please wait...", "success");

} catch (error) {
      console.error(error);
      showToast("Failed to share link. Please try again.", "error");
    }

    setLoading(false);
  };

  // Handle copy link button - copies the actual URL
const handleCopyLink = (url) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => {
          showToast(`Link copied!`, "success");
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
          showToast(`Details link copied!`, "success");
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
      showToast("Please enter a reason for reporting", "warning");
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
        showToast("You've already reported this link", "warning");
      } else if (data.success) {
        showToast(`Report submitted! (Total: ${data.reportCount})`, "success");
      } else {
        showToast("Failed to submit report", "error");
      }
    } catch (error) {
      console.error('Report error:', error);
      showToast("Network error. Please try again.", "error");
    }

    setReportModal(null);
    setReportReason("");
  };

  // Close the report dialog with Escape
  useEffect(() => {
    if (!reportModal) return;
    const onKey = (e) => { if (e.key === 'Escape') setReportModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reportModal]);

  return (
    <main className="min-h-[100dvh] px-4 md:px-10 py-8 md:py-10 text-[var(--foreground)]">
      <div className="max-w-6xl mx-auto">

        {/* Toast Notification */}
        {toast && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className={`glass-card p-5 w-full max-w-sm md:max-w-lg animate-toast-popup pointer-events-auto border-l-4 ${toast.type === 'error' ? 'border-l-red-400' :
              toast.type === 'success' ? 'border-l-[var(--primary)]' :
                toast.type === 'warning' ? 'border-l-amber-400' :
                  'border-l-[var(--border)]'
              } text-center`}>
              <p className="text-base md:text-lg font-medium whitespace-pre-line">{toast.message}</p>
            </div>
          </div>
        )}

        {/* Report Modal */}
        {reportModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <div
              className="glass-card p-6 max-w-md w-full"
              role="dialog"
              aria-modal="true"
              aria-labelledby="report-title"
            >
              <h3 id="report-title" className="text-xl font-bold mb-4 flex items-center gap-2">
                <Flag size={20} className="text-red-400" /> Report link
              </h3>
              <label htmlFor="report-reason" className="block text-sm mb-1 font-body" style={{ color: 'var(--text-secondary)' }}>
                Reason
              </label>
              <textarea
                id="report-reason"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Spam, scam, malware, copyright..."
                className="input-glass w-full resize-none mb-4"
                rows="4"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={submitReport}
                  className="btn-glass flex-1"
                >
                  Submit report
                </button>
                <button
                  type="button"
                  onClick={() => setReportModal(null)}
                  className="px-6 py-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)] hover:border-[var(--ring)] transition font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="mb-10 fade-in-up">
          <div className="glass-card terminal-card w-full overflow-hidden">
            <div className="terminal-window-bar">
              <div className="terminal-dots">
                <span className="terminal-dot red"></span>
                <span className="terminal-dot yellow"></span>
                <span className="terminal-dot green"></span>
              </div>
              <span className="terminal-title">shared-links/</span>
            </div>
            <div className="text-center px-6 py-8 md:py-10 lg:px-12 lg:py-12">
              <h1 className="text-4xl md:text-5xl font-semibold mb-2 tracking-tight text-[var(--foreground)]">
                <span className="text-[var(--primary)]">&gt;_</span>SendTheLink
              </h1>
              <p className="text-sm md:text-base tracking-wide mb-3 font-body" style={{ color: 'var(--text-secondary)' }}>
                by Nobody Space
              </p>
              <p className="text-base md:text-lg mb-5 font-body" style={{ color: 'var(--text-secondary)' }}>
                Share useful links with everyone. No login required.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateForm((prev) => !prev)}
                className="btn-glass inline-flex items-center gap-2"
              >
                <Plus size={18} /> {showCreateForm ? 'Hide Form' : 'Add Link'}
              </button>
            </div>
          </div>
        </header>

        {/* Form - Glassmorphic Card */}
        {showCreateForm && (
        <div className="glass-card overflow-hidden mb-12 fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="p-6 md:p-8">
          <h2 className="text-xl font-semibold mb-1">Share a link</h2>
          <p className="text-sm mb-6 font-body" style={{ color: 'var(--text-secondary)' }}>
            Scanned for malware before it appears.
          </p>
          <form onSubmit={handleSubmit} className="space-y-5">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="from" className="block text-sm mb-2 font-body" style={{ color: 'var(--text-secondary)' }}>
                  From
                </label>
                <input
                  id="from"
                  required
                  type="text"
                  placeholder="Name or handle"
                  className="input-glass w-full"
                  value={form.from}
                  onChange={(e) => setForm({ ...form, from: e.target.value })}
                  disabled={form.isAnonymous}
                />
              </div>
              <div>
                <label htmlFor="url" className="block text-sm mb-2 font-body" style={{ color: 'var(--text-secondary)' }}>
                  Link
                </label>
                <input
                  id="url"
                  required
                  type="url"
                  placeholder="https://..."
                  className="input-glass w-full"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm mb-2 font-body" style={{ color: 'var(--text-secondary)' }}>
                Message
              </label>
              <textarea
                id="message"
                required
                rows="3"
                placeholder="Why is it worth sharing?"
                className="input-glass w-full resize-none"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </div>

{/* Tag Selector */}
            <div>
              <span className="block text-sm mb-2 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <Tag size={16} aria-hidden="true" /> Tags (at least one)
              </span>
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
                    <tag.icon size={16} className="inline mr-1" aria-hidden="true" /> {tag.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Verification Password (optional) */}
            <div>
              <label htmlFor="verifyPassword" className="block text-sm mb-2 font-body" style={{ color: 'var(--text-secondary)' }}>
                Verification password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                <input
                  id="verifyPassword"
                  type="password"
                  placeholder="Optional"
                  aria-describedby="verify-hint"
                  className="input-glass w-full pl-10"
                  value={form.verifyPassword}
                  onChange={(e) => setForm({ ...form, verifyPassword: e.target.value })}
                />
              </div>
              <p id="verify-hint" className="text-xs mt-1 font-body" style={{ color: 'var(--text-muted)' }}>
                Adds the verified badge to your link.
              </p>
            </div>

{/* Anonymous Checkbox */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="anonymous"
                checked={form.isAnonymous}
                onChange={(e) => setForm({ ...form, isAnonymous: e.target.checked })}
                className="w-5 h-5 cursor-pointer"
              />
              <label htmlFor="anonymous" className="cursor-pointer text-sm flex items-center gap-2 font-body" style={{ color: 'var(--text-secondary)' }}>
                <EyeOff size={16} aria-hidden="true" /> Send anonymously
              </label>
            </div>

            <button
              disabled={loading}
              type="submit"
              className="btn-glass w-full text-lg font-bold"
            >
              {loading ? <RefreshCw size={20} className="animate-spin inline" /> : "Send link"}
            </button>

          </form>
          </div>
        </div>
        )}

{/* Search Bar */}
        <div className="mb-4 fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
            <input
              type="text"
              aria-label="Search links"
              placeholder="Search by sender, message, or URL..."
              className="input-glass w-full pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tag Filter Buttons */}
        <div className="mb-8 fade-in-up" style={{ animationDelay: '0.25s' }}>
<div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTagFilter(null)}
              className={`tag-filter ${!activeTagFilter ? 'active' : ''}`}
            >
              <BookOpen size={16} className="inline mr-1" /> All
            </button>
            {AVAILABLE_TAGS.map((tag) => (
              <button
                key={tag.id}
                onClick={() => setActiveTagFilter(activeTagFilter === tag.id ? null : tag.id)}
                className={`tag-filter ${activeTagFilter === tag.id ? 'active' : ''}`}
              >
                <tag.icon size={16} className="inline mr-1" /> {tag.label}
              </button>
            ))}
          </div>
        </div>

        {/* Links Grid */}
        {links.length === 0 ? (
          <div className="glass-card p-10 text-center fade-in-up" aria-live="polite">
            <p className="text-lg mb-1.5">No links yet</p>
            <p className="text-sm font-body mb-6" style={{ color: 'var(--text-secondary)' }}>
              Nothing has been shared yet. Add the first link.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="btn-glass inline-flex items-center gap-2"
            >
              <Plus size={18} aria-hidden="true" /> Add link
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredLinks.length === 0 && (
            <div
              className="col-span-full glass-card p-8 text-center"
              style={{ color: 'var(--text-muted)' }}
              aria-live="polite"
            >
              <p className="text-base">
                {searchQuery
                  ? `No links match "${searchQuery}"`
                  : 'No links with this tag yet'}
              </p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setActiveTagFilter(null); }}
                className="tag-filter mt-3"
              >
                Clear filters
              </button>
            </div>
          )}

          {filteredLinks.map((item, index) => (
            <Link
              key={item.id}
              href={`/link/${item.id}`}
              id={item.id}
              className="glass-card fade-in-up block cursor-pointer"
              style={{ animationDelay: `${0.3 + index * 0.05}s` }}
            >
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border)]">
                <h2 className="text-sm font-semibold truncate">
                  {item.metaTitle || item.url}
                </h2>
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {item.from || 'Anonymous'}
                  {item.isVerified && <span className="verified-icon ml-2" title="Verified">✓</span>}
                </span>
              </div>
              <div className="p-4">
              <div className="mb-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleShareDetails(item.id, item.metaTitle);
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)] hover:border-[var(--ring)] transition font-semibold inline-flex items-center gap-1.5"
                  >
                    <LinkIcon size={14} aria-hidden="true" /> Share
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCopyLink(item.url);
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)] hover:border-[var(--ring)] transition font-semibold inline-flex items-center gap-1.5"
                  >
                    <Copy size={14} aria-hidden="true" /> Copy
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openReportModal(item.id);
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-500/35 bg-red-500/15 hover:bg-red-500/25 transition font-semibold inline-flex items-center gap-1.5"
                    title="Report this link"
                  >
                    <Flag size={14} aria-hidden="true" /> Report
                  </button>
                </div>
              </div>

              {/* Tags */}
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {item.tags.map(tagId => {
                    const tag = AVAILABLE_TAGS.find(t => t.id === tagId);
                    return tag ? (
                      <span key={tagId} className="tag-display flex items-center gap-1">
                        <tag.icon size={12} aria-hidden="true" /> {tag.label}
                      </span>
                    ) : null;
                  })}
                </div>
              )}

              {/* Message */}
              <p className="text-base mb-4 leading-relaxed line-clamp-3 font-body" style={{ color: 'var(--text-primary)' }}>
                &quot;{item.message}&quot;
              </p>

              {/* Link Preview */}
              <div className="flex items-center rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--secondary)] transition group">
                <div className="w-20 h-20 bg-black/20 flex-shrink-0 relative overflow-hidden">
                  {isValidImageUrl(item.metaImage) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.metaImage}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                      <LinkIcon size={24} aria-hidden="true" />
                    </div>
                  )}
                </div>

                <div className="p-3 overflow-hidden flex-1">
                  <h3 className="font-bold text-sm truncate group-hover:text-[var(--foreground)] transition">
                    {item.metaTitle || item.url}
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

              <div className="mt-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                Open details
              </div>

              </div>

            </Link>
          ))}
        </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-[var(--border)] text-center fade-in-up">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            © {new Date().getFullYear()} Nobody Space
          </p>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mt-5">
            <a
              href="https://www.virustotal.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs inline-flex items-center gap-1.5 transition-colors hover:text-[var(--foreground)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Shield size={14} aria-hidden="true" /> VirusTotal
            </a>
            <a
              href="https://urlscan.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs inline-flex items-center gap-1.5 transition-colors hover:text-[var(--foreground)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <SearchCheck size={14} aria-hidden="true" /> URLScan.io
            </a>
            <a
              href="/analytics-policy"
              className="text-xs inline-flex items-center gap-1.5 transition-colors hover:text-[var(--foreground)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <FileSpreadsheet size={14} aria-hidden="true" /> Analytics policy
            </a>
            <a
              href="mailto:dmca@manji.eu.org"
              className="text-xs inline-flex items-center gap-1.5 transition-colors hover:text-[var(--foreground)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Mail size={14} aria-hidden="true" /> DMCA
            </a>
            <a
              href="https://sociabuzz.com/fanzirfan/donate"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs inline-flex items-center gap-1.5 transition-colors hover:text-[var(--foreground)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Coffee size={14} aria-hidden="true" /> Buy me a coffee
            </a>
          </div>

          <p className="text-xs mt-5 font-body" style={{ color: 'var(--text-muted)' }}>
            Links are scanned for malware before they appear. Protected by reCAPTCHA.
          </p>
        </footer>

      </div>

      <style jsx>{`
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
