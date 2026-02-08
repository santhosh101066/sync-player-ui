import React, { useState, useEffect, useCallback } from 'react';
import { Upload, CheckCircle, XCircle, RefreshCw, Info, X } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

interface CookieStatus {
    status: string;
    cookiesFound: number;
    requiredCookies: {
        found: string[];
        missing: string[];
    };
    soonestExpiry: {
        name: string;
        expiresAt: string;
        expiresInSeconds: number;
    } | null;
}

interface CookiesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CookiesModal: React.FC<CookiesModalProps> = ({ isOpen, onClose }) => {
    const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken') || '');
    const [cookieText, setCookieText] = useState('');
    const [status, setStatus] = useState<CookieStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

    const fetchStatus = useCallback(async () => {
        if (!adminToken) {
            setMessage({ type: 'error', text: 'Please enter admin token first' });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/admin/cookies/status`, {
                headers: { 'X-Admin-Token': adminToken }
            });

            if (res.status === 401) {
                setMessage({ type: 'error', text: 'Invalid admin token' });
                return;
            }

            const data = await res.json();
            setStatus(data);
            setMessage(null);
        } catch {
            setMessage({ type: 'error', text: 'Failed to fetch status' });
        } finally {
            setLoading(false);
        }
    }, [adminToken]);

    const uploadCookies = async () => {
        if (!adminToken) {
            setMessage({ type: 'error', text: 'Please enter admin token first' });
            return;
        }

        if (!cookieText.trim()) {
            setMessage({ type: 'error', text: 'Please paste cookies first' });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/admin/cookies/upload`, {
                method: 'POST',
                headers: {
                    'X-Admin-Token': adminToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ cookies: cookieText })
            });

            const data = await res.json();

            if (res.ok) {
                setMessage({ type: 'success', text: `Cookies updated! Cache cleared: ${data.cacheCleared} entries` });
                setCookieText('');
                fetchStatus();
            } else {
                setMessage({ type: 'error', text: data.error || 'Upload failed' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to upload cookies' });
        } finally {
            setLoading(false);
        }
    };

    const validateCookies = async () => {
        if (!adminToken) {
            setMessage({ type: 'error', text: 'Please enter admin token first' });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/admin/cookies/validate`, {
                method: 'POST',
                headers: { 'X-Admin-Token': adminToken }
            });

            const data = await res.json();

            if (data.valid) {
                setMessage({ type: 'success', text: `✓ Cookies working! Test: "${data.testVideo?.title}"` });
            } else {
                setMessage({ type: 'error', text: `✗ ${data.message}` });
            }
        } catch {
            setMessage({ type: 'error', text: 'Validation failed' });
        } finally {
            setLoading(false);
        }
    };

    const clearCache = async () => {
        if (!adminToken) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/admin/cookies/clear-cache`, {
                method: 'DELETE',
                headers: { 'X-Admin-Token': adminToken }
            });

            const data = await res.json();
            setMessage({ type: 'success', text: data.message });
        } catch {
            setMessage({ type: 'error', text: 'Failed to clear cache' });
        } finally {
            setLoading(false);
        }
    };

    const saveToken = () => {
        localStorage.setItem('adminToken', adminToken);
        setMessage({ type: 'success', text: 'Token saved to browser' });
    };

    const formatExpiry = (seconds: number) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        if (days > 0) return `${days}d ${hours}h`;
        return `${hours}h`;
    };

    useEffect(() => {
        if (adminToken && isOpen) {
            fetchStatus();
        }
    }, [adminToken, isOpen, fetchStatus]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#18181b] border border-white/10 w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-zinc-900/50">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Cookie Management</h2>
                        <p className="text-sm text-zinc-400 mt-1">Manage YouTube authentication cookies</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {/* Admin Token */}
                    <div className="bg-zinc-900/50 rounded-lg p-4 mb-4 border border-white/10">
                        <label className="block text-sm font-medium mb-2 text-white">Admin Token</label>
                        <div className="flex gap-2">
                            <input
                                type="password"
                                value={adminToken}
                                onChange={(e) => setAdminToken(e.target.value)}
                                placeholder="Enter ADMIN_TOKEN from .env"
                                className="flex-1 bg-black/50 border border-white/10 rounded px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                            />
                            <button
                                onClick={saveToken}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded transition text-white font-medium"
                            >
                                Save
                            </button>
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">
                            Find this in <code className="bg-black/50 px-1 rounded">syncplayer-server/.env</code>
                        </p>
                    </div>

                    {/* Status Message */}
                    {message && (
                        <div className={`p-4 rounded-lg mb-4 flex items-center gap-2 ${message.type === 'success' ? 'bg-green-500/20 border border-green-500/50' :
                                message.type === 'error' ? 'bg-red-500/20 border border-red-500/50' :
                                    'bg-blue-500/20 border border-blue-500/50'
                            }`}>
                            {message.type === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
                            {message.type === 'error' && <XCircle className="w-5 h-5 text-red-400" />}
                            {message.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
                            <span className="text-white text-sm">{message.text}</span>
                        </div>
                    )}

                    {/* Cookie Status */}
                    {status && (
                        <div className="bg-zinc-900/50 rounded-lg p-4 mb-4 border border-white/10">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white">Current Status</h3>
                                <button
                                    onClick={fetchStatus}
                                    disabled={loading}
                                    className="p-2 hover:bg-white/10 rounded transition"
                                >
                                    <RefreshCw className={`w-5 h-5 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-black/50 rounded p-4">
                                    <div className="text-sm text-zinc-400">Status</div>
                                    <div className={`text-2xl font-bold ${status.status === 'valid' ? 'text-green-400' : 'text-yellow-400'
                                        }`}>
                                        {status.status.toUpperCase()}
                                    </div>
                                </div>
                                <div className="bg-black/50 rounded p-4">
                                    <div className="text-sm text-zinc-400">Cookies Found</div>
                                    <div className="text-2xl font-bold text-white">{status.cookiesFound}</div>
                                </div>
                            </div>

                            {status.soonestExpiry && (
                                <div className="bg-black/50 rounded p-4 mb-4">
                                    <div className="text-sm text-zinc-400 mb-1">Next Expiry</div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-sm text-white">{status.soonestExpiry.name}</span>
                                        <span className="text-yellow-400 font-semibold">
                                            {formatExpiry(status.soonestExpiry.expiresInSeconds)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="bg-black/50 rounded p-4">
                                <div className="text-sm text-zinc-400 mb-2">Required Cookies</div>
                                <div className="flex flex-wrap gap-2">
                                    {status.requiredCookies.found.map(cookie => (
                                        <span key={cookie} className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs">
                                            ✓ {cookie}
                                        </span>
                                    ))}
                                    {status.requiredCookies.missing.map(cookie => (
                                        <span key={cookie} className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs">
                                            ✗ {cookie}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Upload Cookies */}
                    <div className="bg-zinc-900/50 rounded-lg p-4 mb-4 border border-white/10">
                        <h3 className="text-lg font-semibold mb-4 text-white">Upload New Cookies</h3>

                        <div className="bg-blue-500/20 border border-blue-500/50 rounded p-4 mb-4 text-sm">
                            <div className="font-semibold mb-2 text-white">📋 How to export cookies:</div>
                            <ol className="list-decimal list-inside space-y-1 text-zinc-300">
                                <li>Install "Get cookies.txt LOCALLY" browser extension</li>
                                <li>Go to youtube.com while logged in</li>
                                <li>Click extension icon → Export</li>
                                <li>Paste the exported text below</li>
                            </ol>
                        </div>

                        <textarea
                            value={cookieText}
                            onChange={(e) => setCookieText(e.target.value)}
                            placeholder="Paste Netscape format cookies here..."
                            className="w-full h-32 bg-black/50 border border-white/10 rounded px-4 py-3 font-mono text-sm text-white focus:outline-none focus:border-indigo-500 mb-4"
                        />

                        <button
                            onClick={uploadCookies}
                            disabled={loading || !cookieText.trim()}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition text-white"
                        >
                            <Upload className="w-5 h-5" />
                            Upload Cookies
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={validateCookies}
                            disabled={loading}
                            className="flex items-center justify-center gap-2 bg-zinc-900/50 hover:bg-zinc-800 border border-white/10 px-6 py-3 rounded-lg transition text-white"
                        >
                            <CheckCircle className="w-5 h-5" />
                            Test Cookies
                        </button>
                        <button
                            onClick={clearCache}
                            disabled={loading}
                            className="flex items-center justify-center gap-2 bg-zinc-900/50 hover:bg-zinc-800 border border-white/10 px-6 py-3 rounded-lg transition text-white"
                        >
                            <RefreshCw className="w-5 h-5" />
                            Clear Cache
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
