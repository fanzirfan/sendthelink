// app/admin/page.js
"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

// Available tags for categorization (must match page.js)
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

export default function AdminPanel() {
    const [authenticated, setAuthenticated] = useState(false);
    const [password, setPassword] = useState("");
    const [links, setLinks] = useState([]);
    const [filter, setFilter] = useState("all"); // all, reported, flagged, security, verified, notverified
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [editingLink, setEditingLink] = useState(null);
    const [editTags, setEditTags] = useState([]); // For tag editing in modal
    const [editStatus, setEditStatus] = useState('approved'); // For status editing
    const [editVerified, setEditVerified] = useState(false); // For verified editing
const [deleteConfirm, setDeleteConfirm] = useState(null); // For custom delete modal
    const [refreshingPreviews, setRefreshingPreviews] = useState(false); // For refresh previews
    const [previewResult, setPreviewResult] = useState(null); // For showing refresh result

    const fetchLinks = async () => {
        setLoading(true);
        try {
            const authToken = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/links', {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (res.status === 401) {
                localStorage.removeItem('adminToken');
                setAuthenticated(false);
                return;
            }

            const data = await res.json();
            setLinks(data.links || []);
        } catch (error) {
            console.error('Failed to fetch links:', error);
        }
        setLoading(false);
    };



    // Check for existing auth in localStorage
    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (token) {
            // eslint-disable-next-line
            setAuthenticated(true);
            // fetchLinks(); // Can't call this here directly if it depends on state/props not yet initialized or causes lint issues
            // Instead, we will rely on a separate useEffect or call it after render if authenticated is true.
            // But fetchLinks depends on 'authenticated' state indirectly via localStorage check?
        }
    }, []);

    // Fetch links when authenticated changes to true
    useEffect(() => {
        if (authenticated) {
            // eslint-disable-next-line
            fetchLinks();
        }
    }, [authenticated]);

    // Filter links based on selected filter and search
    const filteredLinks = useMemo(() => {
        let filtered = links;

        // Apply filter
        if (filter === "reported") {
            filtered = filtered.filter(link => (link.reportCount || 0) > 0);
        } else if (filter === "flagged") {
            filtered = filtered.filter(link => link.status === "flagged");
        } else if (filter === "security") {
            filtered = filtered.filter(link =>
                link.securityStatus === 'suspicious' ||
                link.securityStatus === 'malicious' ||
                link.status === 'pending_review'
            );
        } else if (filter === "verified") {
            filtered = filtered.filter(link => link.isVerified === true);
        } else if (filter === "notverified") {
            filtered = filtered.filter(link => !link.isVerified);
        } else if (filter === "mostviewed") {
            filtered = [...filtered].sort((a, b) => (b.views || 0) - (a.views || 0));
        }

        // Apply search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(link =>
                link.from?.toLowerCase().includes(query) ||
                link.message?.toLowerCase().includes(query) ||
                link.url?.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [links, filter, searchQuery]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/admin/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });

            const data = await res.json();

            if (data.success) {
                localStorage.setItem('adminToken', data.token);
                setAuthenticated(true);
                setPassword("");
                fetchLinks();
            } else {
                alert("❌ Invalid password");
            }
        } catch (error) {
            console.error('Login error:', error);
            alert("❌ Authentication failed");
        }

        setLoading(false);
    };



    const handleDelete = async (linkId) => {
        try {
            const authToken = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/links', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ linkId }),
            });

            if (res.ok) {
                alert("✅ Link deleted successfully");
                setDeleteConfirm(null);
                fetchLinks();
            } else {
                alert("❌ Failed to delete link");
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert("❌ Failed to delete link");
        }
    };

    const handleUpdate = async (linkId, updates) => {
        try {
            const authToken = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/links', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ linkId, updates }),
            });

            if (res.ok) {
                alert("✅ Link updated successfully");
                setEditingLink(null);
                fetchLinks();
            } else {
                alert("❌ Failed to update link");
            }
        } catch (error) {
            console.error('Update error:', error);
            alert("❌ Failed to update link");
        }
    };

const handleLogout = () => {
        localStorage.removeItem('adminToken');
        setAuthenticated(false);
        setLinks([]);
    };

    // Refresh all missing previews
    const handleRefreshPreviews = async () => {
        setRefreshingPreviews(true);
        setPreviewResult(null);
        try {
            const authToken = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/refresh-previews', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({})
            });

            if (res.status === 401) {
                localStorage.removeItem('adminToken');
                setAuthenticated(false);
                return;
            }

            const data = await res.json();
            if (data.success) {
                setPreviewResult({
                    type: 'success',
                    message: `✅ Refreshed ${data.summary.refreshed} previews (${data.summary.skipped} skipped, ${data.summary.failed} failed)`
                });
                fetchLinks(); // Reload to show updated previews
            } else {
                setPreviewResult({
                    type: 'error',
                    message: `❌ ${data.error || 'Failed to refresh previews'}`
                });
            }
        } catch (error) {
            console.error('Refresh previews error:', error);
            setPreviewResult({
                type: 'error',
                message: '❌ Network error. Please try again.'
            });
        }
        setRefreshingPreviews(false);

        // Auto-hide result after 5 seconds
        setTimeout(() => setPreviewResult(null), 5000);
    };

    // Login Screen
    if (!authenticated) {
        return (
            <main className="min-h-screen flex items-center justify-center p-4">
                <div className="glass-card p-8 max-w-md w-full">
                    <h1 className="text-3xl font-bold mb-6 text-center">
                        🔐 Admin Login
                    </h1>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="password"
                            placeholder="Admin Password"
                            className="input-glass w-full"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button
                            type="submit"
                            className="btn-glass w-full"
                            disabled={loading}
                        >
                            {loading ? "Authenticating..." : "Login"}
                        </button>
                    </form>
                </div>
            </main>
        );
    }

    // Admin Dashboard
    return (
        <main className="min-h-screen p-4 md:p-8">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-bold mb-1">Admin Dashboard</h1>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Manage shared links</p>
                    </div>
<div className="flex gap-2">
                        <button
                            onClick={handleRefreshPreviews}
                            disabled={refreshingPreviews}
                            className="px-3 py-2 text-sm rounded-lg bg-green-500/20 hover:bg-green-500/30 transition disabled:opacity-50"
                            title="Refresh missing link preview images"
                        >
                            {refreshingPreviews ? '⏳ Refreshing...' : '🖼️ Refresh Previews'}
                        </button>
                        <button
                            onClick={fetchLinks}
                            className="px-3 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/20 transition"
                        >
                            🔄 Refresh
                        </button>
                        <button
                            onClick={handleLogout}
                            className="px-3 py-2 text-sm rounded-lg bg-red-500/20 hover:bg-red-500/30 transition"
                        >
                            🚪 Logout
                        </button>
</div>
                </div>

                {/* Refresh Previews Result Toast */}
                {previewResult && (
                    <div className={`mb-4 p-4 rounded-lg ${previewResult.type === 'success' ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'}`}>
                        <p className="text-sm">{previewResult.message}</p>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2 md:gap-4 mb-6">
                    <div className="glass-card p-3 md:p-5">
                        <div className="text-xl md:text-3xl font-bold">{links.length}</div>
                        <div className="text-xs md:text-sm" style={{ color: 'var(--text-secondary)' }}>Total</div>
                    </div>
                    <div className="glass-card p-3 md:p-5">
                        <div className="text-xl md:text-3xl font-bold text-yellow-300">
                            {links.filter(l => (l.reportCount || 0) > 0).length}
                        </div>
                        <div className="text-xs md:text-sm" style={{ color: 'var(--text-secondary)' }}>Reported</div>
                    </div>
                    <div className="glass-card p-3 md:p-5">
                        <div className="text-xl md:text-3xl font-bold text-red-300">
                            {links.filter(l => l.status === 'flagged').length}
                        </div>
                        <div className="text-xs md:text-sm" style={{ color: 'var(--text-secondary)' }}>Flagged</div>
                    </div>
                    <div className="glass-card p-3 md:p-5">
                        <div className="text-xl md:text-3xl font-bold text-orange-300">
                            {links.filter(l => l.securityStatus === 'suspicious' || l.securityStatus === 'malicious').length}
                        </div>
                        <div className="text-xs md:text-sm" style={{ color: 'var(--text-secondary)' }}>🛡️ Security</div>
                    </div>
                    <div className="glass-card p-3 md:p-5">
                        <div className="text-xl md:text-3xl font-bold text-blue-300">
                            {links.filter(l => l.isVerified === true).length}
                        </div>
                        <div className="text-xs md:text-sm" style={{ color: 'var(--text-secondary)' }}>✓ Verified</div>
                    </div>
                </div>

                {/* Filters and Search */}
                <div className="glass-card p-4 md:p-5 mb-6">
                    <div className="flex flex-col gap-3">
                        {/* Filter Buttons */}
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setFilter("all")}
                                className={`px-3 py-1.5 text-sm rounded-lg transition ${filter === "all" ? "bg-purple-500" : "bg-white/10 hover:bg-white/20"
                                    }`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setFilter("reported")}
                                className={`px-3 py-1.5 text-sm rounded-lg transition ${filter === "reported" ? "bg-yellow-500" : "bg-white/10 hover:bg-white/20"
                                    }`}
                            >
                                Reported
                            </button>
                            <button
                                onClick={() => setFilter("flagged")}
                                className={`px-3 py-1.5 text-sm rounded-lg transition ${filter === "flagged" ? "bg-red-500" : "bg-white/10 hover:bg-white/20"
                                    }`}
                            >
                                Flagged
                            </button>
                            <button
                                onClick={() => setFilter("security")}
                                className={`px-3 py-1.5 text-sm rounded-lg transition ${filter === "security" ? "bg-orange-500" : "bg-white/10 hover:bg-white/20"
                                    }`}
                            >
                                🛡️
                            </button>
                            <button
                                onClick={() => setFilter("verified")}
                                className={`px-3 py-1.5 text-sm rounded-lg transition ${filter === "verified" ? "bg-blue-500" : "bg-white/10 hover:bg-white/20"
                                    }`}
                            >
                                ✓
                            </button>
                            <button
                                onClick={() => setFilter("notverified")}
                                className={`px-3 py-1.5 text-sm rounded-lg transition ${filter === "notverified" ? "bg-gray-500" : "bg-white/10 hover:bg-white/20"
                                    }`}
                            >
                                ✗
                            </button>
                            <button
                                onClick={() => setFilter("mostviewed")}
                                className={`px-3 py-1.5 text-sm rounded-lg transition ${filter === "mostviewed" ? "bg-pink-500" : "bg-white/10 hover:bg-white/20"
                                    }`}
                            >
                                👁️ Most Viewed
                            </button>
                        </div>

                        {/* Search */}
                        <input
                            type="text"
                            placeholder="Search links..."
                            className="input-glass w-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Delete Confirmation Modal */}
                {deleteConfirm && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="glass-card p-6 max-w-md w-full">
                            <h3 className="text-xl font-bold mb-4 text-red-400">🗑️ Delete Link?</h3>
                            <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
                                Are you sure you want to permanently delete this link? This action cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleDelete(deleteConfirm)}
                                    className="flex-1 px-6 py-3 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition font-semibold text-red-400"
                                >
                                    Delete
                                </button>
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition font-semibold"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {editingLink && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="glass-card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <h2 className="text-2xl font-bold mb-4">✏️ Edit Link</h2>

                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const formData = new FormData(e.target);
                                const updates = {
                                    from: formData.get('from'),
                                    message: formData.get('message'),
                                    url: formData.get('url'),
                                    tags: editTags,
                                    status: editStatus,
                                    isVerified: editVerified
                                };
                                handleUpdate(editingLink.id, updates);
                            }} className="space-y-4">

                                <div>
                                    <label className="block text-sm font-medium mb-2">From:</label>
                                    <input
                                        name="from"
                                        type="text"
                                        defaultValue={editingLink.from}
                                        className="input-glass w-full"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Message:</label>
                                    <textarea
                                        name="message"
                                        rows="4"
                                        defaultValue={editingLink.message}
                                        className="input-glass w-full resize-none"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">URL:</label>
                                    <input
                                        name="url"
                                        type="url"
                                        defaultValue={editingLink.url}
                                        className="input-glass w-full"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">🏷️ Tags:</label>
                                    <div className="flex flex-wrap gap-2">
                                        {AVAILABLE_TAGS.map((tag) => (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                onClick={() => {
                                                    const newTags = editTags.includes(tag.id)
                                                        ? editTags.filter(t => t !== tag.id)
                                                        : [...editTags, tag.id];
                                                    setEditTags(newTags);
                                                }}
                                                className={`px-3 py-1.5 rounded-full text-sm transition-all ${editTags.includes(tag.id)
                                                    ? 'bg-purple-500 text-white'
                                                    : 'bg-white/10 hover:bg-white/20'
                                                    }`}
                                            >
                                                {tag.emoji} {tag.label}
                                            </button>
                                        ))}
                                    </div>
                                    {editTags.length === 0 && (
                                        <p className="text-xs text-yellow-300 mt-2">⚠️ At least one tag is required</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">📋 Status:</label>
                                    <select
                                        value={editStatus}
                                        onChange={(e) => setEditStatus(e.target.value)}
                                        className="input-glass w-full cursor-pointer"
                                    >
                                        <option value="approved" className="bg-gray-900">✅ Approved (Visible)</option>
                                        <option value="pending_review" className="bg-gray-900">🔍 Pending Review (Hidden)</option>
                                        <option value="flagged" className="bg-gray-900">🚩 Flagged (Hidden)</option>
                                        <option value="rejected" className="bg-gray-900">❌ Rejected (Hidden)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">✓ Verified Status:</label>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setEditVerified(true)}
                                            className={`flex-1 px-4 py-2 rounded-lg transition font-medium ${editVerified
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-white/10 hover:bg-white/20'
                                                }`}
                                        >
                                            ✓ Verified
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditVerified(false)}
                                            className={`flex-1 px-4 py-2 rounded-lg transition font-medium ${!editVerified
                                                ? 'bg-gray-500 text-white'
                                                : 'bg-white/10 hover:bg-white/20'
                                                }`}
                                        >
                                            Not Verified
                                        </button>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        className="btn-glass flex-1"
                                    >
                                        💾 Save Changes
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditingLink(null)}
                                        className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition font-semibold"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Links - Mobile Cards / Desktop Table */}
                <div className="glass-card p-3 md:p-5">
                    {loading ? (
                        <div className="text-center py-8">Loading...</div>
                    ) : filteredLinks.length === 0 ? (
                        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                            No links found
                        </div>
                    ) : (
                        <>
                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-3">
                                {filteredLinks.map((link) => (
                                    <div key={link.id} className="bg-white/5 rounded-lg p-4">
                                        {/* Header: From + Badges */}
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{link.from || "Anonymous"}</span>
                                                {link.isVerified && (
                                                    <span className="verified-icon" title="Verified">✓</span>
                                                )}
                                            </div>
                                            <div className="flex gap-1">
                                                <span className={`px-2 py-0.5 rounded text-xs ${link.securityStatus === 'malicious' ? 'bg-red-500/20 text-red-300' :
                                                    link.securityStatus === 'suspicious' ? 'bg-orange-500/20 text-orange-300' :
                                                        link.securityStatus === 'safe' ? 'bg-green-500/20 text-green-300' :
                                                            'bg-gray-500/20 text-gray-300'
                                                    }`}>
                                                    {link.securityStatus === 'malicious' ? '🚨' :
                                                        link.securityStatus === 'suspicious' ? '⚠️' :
                                                            link.securityStatus === 'safe' ? '✅' :
                                                                link.securityStatus === 'pending' ? '🔄' : '❓'}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-xs ${link.status === 'flagged' ? 'bg-red-500/20 text-red-300' :
                                                    link.status === 'rejected' ? 'bg-gray-500/20 text-gray-300' :
                                                        'bg-green-500/20 text-green-300'
                                                    }`}>
                                                    {link.status === 'flagged' ? '🚩' : link.status === 'rejected' ? '❌' : '✅'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Message */}
                                        <p className="text-sm mb-2 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                                            {link.message}
                                        </p>

                                        {/* URL */}
                                        <a
                                            href={link.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs text-blue-300 hover:underline block truncate mb-3"
                                        >
                                            {(() => { try { return new URL(link.url).hostname; } catch { return link.url; } })()}
                                        </a>

                                        {/* Tags + Reports */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex gap-1">
                                                {link.tags?.slice(0, 3).map(tagId => {
                                                    const tag = AVAILABLE_TAGS.find(t => t.id === tagId);
                                                    return tag ? (
                                                        <span key={tagId} className="text-xs px-1.5 py-0.5 rounded bg-purple-500/30">
                                                            {tag.emoji}
                                                        </span>
                                                    ) : null;
                                                })}
                                            </div>
                                            {(link.reportCount || 0) > 0 && (
                                                <span className="text-xs text-yellow-300">⚠️ {link.reportCount} reports</span>
                                            )}
                                            <div className="text-xs text-blue-200 bg-blue-500/10 px-2 py-0.5 rounded">
                                                👁️ {link.views || 0} views
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditingLink(link);
                                                    setEditTags(link.tags || []);
                                                    setEditStatus(link.status || 'approved');
                                                    setEditVerified(link.isVerified || false);
                                                }}
                                                className="flex-1 text-xs py-2 rounded bg-blue-500/20 hover:bg-blue-500/30 transition"
                                            >
                                                ✏️ Edit
                                            </button>
                                            <button
                                                onClick={() => handleUpdate(link.id, {
                                                    status: link.status === 'flagged' ? 'approved' : 'flagged'
                                                })}
                                                className="flex-1 text-xs py-2 rounded bg-yellow-500/20 hover:bg-yellow-500/30 transition"
                                            >
                                                {link.status === 'flagged' ? '✅ Approve' : '🚩 Flag'}
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirm(link.id)}
                                                className="text-xs px-4 py-2 rounded bg-red-500/20 hover:bg-red-500/30 transition"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            <th className="text-left p-3">From</th>
                                            <th className="text-left p-3">Message</th>
                                            <th className="text-left p-3">Tags</th>
                                            <th className="text-left p-3">URL</th>
                                            <th className="text-left p-3">Views</th>
                                            <th className="text-left p-3">Reports</th>
                                            <th className="text-left p-3">Security</th>
                                            <th className="text-left p-3">Status</th>
                                            <th className="text-left p-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLinks.map((link) => (
                                            <tr key={link.id} className="border-b border-white/5 hover:bg-white/5">
                                                <td className="p-3 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        {link.from || "Anonymous"}
                                                        {link.isVerified && (
                                                            <span className="verified-icon" title="Verified">✓</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-sm max-w-xs truncate">{link.message}</td>
                                                <td className="p-3 text-sm">
                                                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                                                        {link.tags && link.tags.length > 0 ? (
                                                            link.tags.slice(0, 2).map(tagId => {
                                                                const tag = AVAILABLE_TAGS.find(t => t.id === tagId);
                                                                return tag ? (
                                                                    <span key={tagId} className="text-xs px-1.5 py-0.5 rounded bg-purple-500/30">
                                                                        {tag.emoji}
                                                                    </span>
                                                                ) : null;
                                                            })
                                                        ) : (
                                                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                                                        )}
                                                        {link.tags && link.tags.length > 2 && (
                                                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>+{link.tags.length - 2}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-sm">
                                                    <a
                                                        href={link.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-blue-300 hover:underline truncate block max-w-xs"
                                                    >
                                                        {(() => { try { return new URL(link.url).hostname; } catch { return link.url; } })()}
                                                    </a>
                                                </td>
                                                <td className="p-3 text-sm">
                                                    <div className="flex items-center gap-1">
                                                        👁️ {link.views || 0}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-sm">
                                                    <span className={`${(link.reportCount || 0) > 0 ? 'text-yellow-300 font-bold' : ''}`}>
                                                        {link.reportCount || 0}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-sm">
                                                    <span className={`px-2 py-1 rounded text-xs ${link.securityStatus === 'malicious' ? 'bg-red-500/20 text-red-300' :
                                                        link.securityStatus === 'suspicious' ? 'bg-orange-500/20 text-orange-300' :
                                                            link.securityStatus === 'safe' ? 'bg-green-500/20 text-green-300' :
                                                                'bg-gray-500/20 text-gray-300'
                                                        }`}>
                                                        {link.securityStatus === 'malicious' ? '🚨 Malicious' :
                                                            link.securityStatus === 'suspicious' ? '⚠️ Suspicious' :
                                                                link.securityStatus === 'safe' ? '✅ Safe' :
                                                                    link.securityStatus === 'pending' ? '🔄 Scanning' :
                                                                        '❓ Unknown'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-sm">
                                                    <span className={`px-2 py-1 rounded text-xs ${link.status === 'flagged' ? 'bg-red-500/20 text-red-300' :
                                                        link.status === 'rejected' ? 'bg-gray-500/20 text-gray-300' :
                                                            'bg-green-500/20 text-green-300'
                                                        }`}>
                                                        {link.status || 'approved'}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingLink(link);
                                                                setEditTags(link.tags || []);
                                                                setEditStatus(link.status || 'approved');
                                                                setEditVerified(link.isVerified || false);
                                                            }}
                                                            className="text-xs px-3 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 transition"
                                                            title="Edit"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdate(link.id, {
                                                                status: link.status === 'flagged' ? 'approved' : 'flagged'
                                                            })}
                                                            className="text-xs px-3 py-1 rounded bg-yellow-500/20 hover:bg-yellow-500/30 transition"
                                                            title={link.status === 'flagged' ? 'Approve' : 'Flag'}
                                                        >
                                                            {link.status === 'flagged' ? '✅' : '🚩'}
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(link.id)}
                                                            className="text-xs px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 transition"
                                                            title="Delete"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>

            </div>
        </main>
    );
}
