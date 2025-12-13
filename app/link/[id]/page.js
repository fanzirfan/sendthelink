// app/link/[id]/page.js
"use client";
import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import Link from "next/link";
import { useParams } from "next/navigation";

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

export default function LinkDetailsPage() {
    const params = useParams();
    const [linkData, setLinkData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState(null);

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

    // Handle copy link button
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
                    showToast(`🔗 Page link copied!`, "success");
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
                body: JSON.stringify({ linkId: params.id, reporterId, reason: reportReason.trim() }),
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
            <main className="min-h-screen px-4 md:px-10 py-8 md:py-10 flex items-center justify-center">
                <div className="glass-card p-8 text-center">
                    <div className="text-4xl mb-4 animate-pulse">⏳</div>
                    <p className="text-lg">Loading link details...</p>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="min-h-screen px-4 md:px-10 py-8 md:py-10 flex items-center justify-center">
                <div className="glass-card p-8 text-center max-w-md">
                    <div className="text-5xl mb-4">😕</div>
                    <h1 className="text-2xl font-bold mb-4">Oops!</h1>
                    <p className="text-lg mb-6" style={{ color: 'var(--text-secondary)' }}>{error}</p>
                    <Link href="/" className="btn-glass inline-block">
                        ← Back to Home
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen px-4 md:px-10 py-8 md:py-10">
            <div className="max-w-4xl mx-auto">

                {/* Toast Notification */}
                {toast && (
                    <div className={`fixed top-4 right-4 z-50 glass-card p-4 max-w-md animate-slide-in ${toast.type === 'error' ? 'border-red-500' :
                        toast.type === 'success' ? 'border-green-500' :
                            toast.type === 'warning' ? 'border-yellow-500' :
                                'border-blue-500'
                        } border-l-4`}>
                        <p className="text-sm whitespace-pre-line">{toast.message}</p>
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
                                    onClick={() => setReportModal(false)}
                                    className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition font-semibold"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Back Button */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition font-semibold fade-in-up"
                >
                    ← Back to Home
                </Link>

                {/* Main Content Card */}
                <div className="glass-card p-6 md:p-8 fade-in-up" style={{ animationDelay: '0.1s' }}>

                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div>
                            <div className="text-sm font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                                Shared by
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200 bg-clip-text text-transparent">
                                {linkData.from || "Anonymous"}
                            </h1>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {/* Share Button */}
                            <button
                                onClick={handleSharePage}
                                className="text-base px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 transition font-bold"
                                title="Share this page"
                            >
                                🔗 Share
                            </button>
                            <button
                                onClick={() => handleCopyLink(linkData.url)}
                                className="text-base px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition font-bold"
                                title="Copy original link to clipboard"
                            >
                                📋 Copy Link
                            </button>
                            <button
                                onClick={() => setReportModal(true)}
                                className="text-base px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition font-bold"
                                title="Report inappropriate content"
                            >
                                🚩 Report
                            </button>
                        </div>
                    </div>

                    {/* Date */}
                    <div className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                        🕐 {formatDate(linkData.createdAt)}
                    </div>

                    {/* Tags */}
                    {linkData.tags && linkData.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-6">
                            {linkData.tags.map(tagId => {
                                const tag = AVAILABLE_TAGS.find(t => t.id === tagId);
                                return tag ? (
                                    <span key={tagId} className="tag-display text-sm px-3 py-1">
                                        {tag.emoji} {tag.label}
                                    </span>
                                ) : null;
                            })}
                        </div>
                    )}

                    {/* Message */}
                    <div className="mb-8">
                        <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                            📝 Message
                        </h2>
                        <p className="text-lg leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                            "{linkData.message}"
                        </p>
                    </div>

                    {/* Link Preview Card */}
                    <div className="mb-6">
                        <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                            🔗 Link
                        </h2>
                        <a
                            href={linkData.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block bg-white/10 rounded-xl overflow-hidden border border-white/20 hover:bg-white/20 transition group"
                        >
                            {/* Large Preview Image */}
                            {linkData.metaImage && (
                                <div className="w-full h-48 md:h-64 relative overflow-hidden bg-white/5">
                                    <img
                                        src={linkData.metaImage}
                                        alt="preview"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                </div>
                            )}

                            {/* Link Info */}
                            <div className="p-4">
                                <h3 className="font-bold text-lg md:text-xl group-hover:text-blue-300 transition mb-2">
                                    {linkData.metaTitle || linkData.url}
                                </h3>
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
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
                        className="btn-glass w-full text-center text-lg font-bold block"
                    >
                        🚀 Open Link
                    </a>

                </div>

                {/* Footer */}
                <footer className="mt-12 pt-8 border-t border-white/10 text-center fade-in-up">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        © 2025 SendTheLink • Share knowledge freely
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
