// app/link/[id]/page.js
"use client";
import { useState, useEffect, useRef } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Copy, Link as LinkIcon, Flag, LoaderCircle, Frown, Clock, CheckCircle, FileText, Gamepad2, Palette, Laptop, BookOpen, Hammer, Bot, Music, Film, PenTool, Smartphone, Monitor, Box, ExternalLink } from "lucide-react";

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

export default function LinkDetailsPage() {
    const params = useParams();
    const [linkData, setLinkData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState(null);
    const lastViewedId = useRef(null);

    // Report modal state
    const [reportModal, setReportModal] = useState(false);
    const [reportReason, setReportReason] = useState("");

    // Show toast notification
    const showToast = (message, type = "info") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 5000);
    };

    // Fetch link data from Firestore
    useEffect(() => {
        const fetchLink = async () => {
            try {
                const docRef = doc(db, "shared_links", params.id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    // Check if link is approved/visible
                    if (data.status && data.status !== 'approved') {
                        setError("This link is not available.");
                    } else {
                        setLinkData({ id: docSnap.id, ...data });
                    }
                } else {
                    setError("Link not found.");
                }
            } catch (err) {
                console.error("Error fetching link:", err);
                setError("Failed to load link details.");
            }
            setLoading(false);
        };

        if (params.id) {
            fetchLink();
        }
    }, [params.id]);

    // Track view count
    useEffect(() => {
        const trackView = async () => {
            if (params.id && lastViewedId.current !== params.id) {
                lastViewedId.current = params.id;
                try {
                    await fetch('/api/track-view', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ linkId: params.id }),
                    });
                } catch (err) {
                    // Ignore tracking errors on client
                    console.error('Tracking error:', err);
                }
            }
        };

        trackView();
    }, [params.id]);

    // Close the report dialog with Escape
    useEffect(() => {
        if (!reportModal) return;
        const onKey = (e) => { if (e.key === 'Escape') setReportModal(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [reportModal]);

    // Handle copy link button
    const handleCopyLink = (url) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url)
                .then(() => {
                    showToast("Link copied!", "success");
                })
                .catch((err) => {
                    console.error('Clipboard error:', err);
                    showToast(url, "info");
                });
        } else {
            showToast(url, "info");
        }
    };

    // Handle share this page
    const handleSharePage = () => {
        const pageUrl = window.location.href;
        const title = linkData?.metaTitle || 'Check out this link on SendTheLink!';

        // Try Web Share API first (mobile-friendly)
        if (navigator.share) {
            navigator.share({
                title: title,
                url: pageUrl,
            }).catch((err) => {
                // User cancelled or error, fallback to clipboard
                if (err.name !== 'AbortError') {
                    copyToClipboard(pageUrl);
                }
            });
        } else {
            // Fallback: copy to clipboard
            copyToClipboard(pageUrl);
        }
    };

    // Helper function to copy to clipboard
    const copyToClipboard = (text) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    showToast("Page link copied!", "success");
                })
                .catch(() => {
                    showToast(text, "info");
                });
        } else {
            showToast(text, "info");
        }
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
                body: JSON.stringify({ linkId: params.id, reporterId, reason: reportReason.trim() }),
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

        setReportModal(false);
        setReportReason("");
    };

    // Format date
    const formatDate = (timestamp) => {
        if (!timestamp) return "Unknown date";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <main className="min-h-[100dvh] px-4 md:px-10 py-8 md:py-10 flex items-center justify-center">
                <div className="glass-card p-8 text-center" aria-live="polite">
                    <LoaderCircle className="inline animate-spin mb-4" size={36} aria-hidden="true" />
                    <p className="text-lg font-body" style={{ color: 'var(--text-secondary)' }}>Loading link details...</p>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="min-h-[100dvh] px-4 md:px-10 py-8 md:py-10 flex items-center justify-center">
                <div className="glass-card p-8 text-center max-w-md w-full">
                    <Frown size={48} className="inline mb-4" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                    <h1 className="text-2xl font-bold mb-2">Link not found</h1>
                    <p className="text-base mb-6 font-body" style={{ color: 'var(--text-secondary)' }}>{error}</p>
                    <Link href="/" className="btn-glass inline-flex items-center gap-2">
                        <ArrowLeft size={16} aria-hidden="true" /> Back to all links
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-[100dvh] px-4 md:px-10 py-8 md:py-10">
            <div className="max-w-4xl mx-auto">

                {/* Toast Notification */}
                {toast && (
                    <div className={`fixed top-4 right-4 z-50 glass-card p-4 max-w-md animate-slide-in border-l-4 ${toast.type === 'error' ? 'border-l-red-400' :
                        toast.type === 'success' ? 'border-l-[var(--primary)]' :
                            toast.type === 'warning' ? 'border-l-amber-400' :
                                'border-l-[var(--border)]'
                        }`}>
                        <p className="text-sm whitespace-pre-line">{toast.message}</p>
                    </div>
                )}

                {/* Report Modal */}
                {reportModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
                        <div
                            className="glass-card p-6 max-w-md w-full"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="detail-report-title"
                        >
                            <h3 id="detail-report-title" className="text-xl font-bold mb-4 flex items-center gap-2">
                                <Flag size={20} style={{ color: 'var(--danger, #f87171)' }} aria-hidden="true" /> Report link
                            </h3>
                            <label htmlFor="detail-report-reason" className="block text-sm mb-1 font-body" style={{ color: 'var(--text-secondary)' }}>
                                Reason
                            </label>
                            <textarea
                                id="detail-report-reason"
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
                                    onClick={() => setReportModal(false)}
                                    className="px-6 py-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)] hover:border-[var(--ring)] transition font-semibold"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <Link
                    href="/"
                    className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)] hover:border-[var(--ring)] transition font-semibold fade-in-up"
                >
                    <ArrowLeft size={16} aria-hidden="true" /> All links
                </Link>

                {/* Main Content Card */}
                <div className="glass-card fade-in-up overflow-hidden" style={{ animationDelay: '0.1s' }}>
                    <div className="p-6 md:p-8">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div>
                            <div className="text-sm font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                                Shared by
                            </div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl md:text-3xl font-bold text-[var(--foreground)]">
                                    {linkData.from || "Anonymous"}
                                </h1>
                                {linkData.isVerified && (
                                    <span className="verified-badge"><CheckCircle size={12} className="inline mr-1" /> Verified</span>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={handleSharePage}
                                className="text-sm px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)] hover:border-[var(--ring)] transition font-semibold inline-flex items-center gap-2"
                            >
                                <LinkIcon size={16} aria-hidden="true" /> Share
                            </button>
                            <button
                                type="button"
                                onClick={() => handleCopyLink(linkData.url)}
                                className="text-sm px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)] hover:border-[var(--ring)] transition font-semibold inline-flex items-center gap-2"
                            >
                                <Copy size={16} aria-hidden="true" /> Copy link
                            </button>
                            <button
                                type="button"
                                onClick={() => setReportModal(true)}
                                className="text-sm px-4 py-2 rounded-lg border border-red-500/35 bg-red-500/15 hover:bg-red-500/25 transition font-semibold inline-flex items-center gap-2"
                            >
                                <Flag size={16} aria-hidden="true" /> Report
                            </button>
                        </div>
                    </div>

                    {/* Date */}
                    <div className="text-sm mb-6 inline-flex items-center gap-2 font-body" style={{ color: 'var(--text-muted)' }}>
                        <Clock size={14} aria-hidden="true" /> {formatDate(linkData.createdAt)}
                    </div>

                    {/* Tags */}
                    {linkData.tags && linkData.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-6">
                            {linkData.tags.map(tagId => {
                                const tag = AVAILABLE_TAGS.find(t => t.id === tagId);
                                return tag ? (
                                    <span key={tagId} className="tag-display text-sm px-3 py-1">
                                        <tag.icon size={14} className="inline mr-1" aria-hidden="true" /> {tag.label}
                                    </span>
                                ) : null;
                            })}
                        </div>
                    )}

                    {/* Message */}
                    <div className="mb-8">
                        <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                            <FileText size={14} className="inline mr-2" aria-hidden="true" /> Message
                        </h2>
                        <p className="text-lg leading-relaxed font-body" style={{ color: 'var(--text-primary)' }}>
                            &quot;{linkData.message}&quot;
                        </p>
                    </div>

                    {/* Link Preview Card */}
                    <div className="mb-6">
                        <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                            <LinkIcon size={14} className="inline mr-2" aria-hidden="true" /> Link
                        </h2>
                        <a
                            href={linkData.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--secondary)] hover:border-[var(--ring)] transition group"
                        >
                            {/* Large Preview Image */}
                            {isValidImageUrl(linkData.metaImage) && (
                                <div className="w-full h-48 md:h-64 relative overflow-hidden bg-black/20">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={linkData.metaImage}
                                        alt=""
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                </div>
                            )}

                            {/* Link Info */}
                            <div className="p-4">
                                <h3 className="font-semibold text-base group-hover:text-[var(--foreground)] transition">
                                    {linkData.metaTitle || linkData.url}
                                </h3>
                                <p className="text-sm font-body mt-1" style={{ color: 'var(--text-muted)' }}>
                                    {(() => {
                                        try {
                                            return new URL(linkData.url).hostname;
                                        } catch {
                                            return linkData.url;
                                        }
                                    })()}
                                </p>
                            </div>
                        </a>
                    </div>

                    {/* Open Link Button */}
                    <a
                        href={linkData.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-glass w-full text-center text-base font-bold flex items-center justify-center gap-2"
                    >
                        Open link <ExternalLink size={18} aria-hidden="true" />
                    </a>

                    </div>
                </div>

                <footer className="mt-12 pt-8 border-t border-[var(--border)] text-center fade-in-up">
                    <p className="text-sm font-body" style={{ color: 'var(--text-secondary)' }}>
                        © {new Date().getFullYear()} Nobody Space
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
      `}</style>
        </main>
    );
}
