import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, CheckCircle, XCircle, RefreshCw, Info } from 'lucide-react';

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

export default function AdminCookies() {
    const navigate = useNavigate();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [checking, setChecking] = useState(true);
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

    // Check if user is admin
    useEffect(() => {
        const checkAdmin = async () => {
            // Get user email from localStorage (set during Google login)
            const userEmail = localStorage.getItem('userEmail');

            if (!userEmail) {
                navigate('/session');
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/api/auth/check-admin?email=${encodeURIComponent(userEmail)}`);
                const data = await res.json();

                if (data.isAdmin) {
                    setIsAuthorized(true);
                } else {
                    navigate('/session');
                }
            } catch (err) {
                console.error('Admin check failed:', err);
                navigate('/session');
            } finally {
                setChecking(false);
            }
        };

        checkAdmin();
    }, [navigate]);

    // Fetch status on mount if token exists
    useEffect(() => {
        if (adminToken && isAuthorized) {
            fetchStatus();
        }
    }, [adminToken, isAuthorized, fetchStatus]); // Only run when authorized

    if (checking) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-400" />
                    <p className="text-gray-400">Verifying access...</p>
                </div>
            </div>
        );
    }

    if (!isAuthorized) {
        return null; // Will redirect
    }

    return (
        <div className="h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-y-auto">
            <div className="max-w-4xl mx-auto p-8 pb-20">
                <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    Cookie Management
                </h1>
                <p className="text-gray-400 mb-8">Manage YouTube authentication cookies</p>

                {/* Admin Token */}
                <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6 mb-6 border border-gray-700">
                    <label className="block text-sm font-medium mb-2">Admin Token</label>
                    <div className="flex gap-2">
                        <input
                            type="password"
                            value={adminToken}
                            onChange={(e) => setAdminToken(e.target.value)}
                            placeholder="Enter ADMIN_TOKEN from .env"
                            className="flex-1 bg-gray-900 border border-gray-700 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
                        />
                        <button
                            onClick={saveToken}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition"
                        >
                            Save
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        Find this in <code className="bg-gray-900 px-1 rounded">syncplayer-server/.env</code>
                    </p>
                </div>

                {/* Status Message */}
                {message && (
                    <div className={`p-4 rounded-lg mb-6 flex items-center gap-2 ${message.type === 'success' ? 'bg-green-900/30 border border-green-700' :
                        message.type === 'error' ? 'bg-red-900/30 border border-red-700' :
                            'bg-blue-900/30 border border-blue-700'
                        }`}>
                        {message.type === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
                        {message.type === 'error' && <XCircle className="w-5 h-5 text-red-400" />}
                        {message.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
                        <span>{message.text}</span>
                    </div>
                )}

                {/* Cookie Status */}
                {status && (
                    <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6 mb-6 border border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">Current Status</h2>
                            <button
                                onClick={fetchStatus}
                                disabled={loading}
                                className="p-2 hover:bg-gray-700 rounded transition"
                            >
                                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-gray-900/50 rounded p-4">
                                <div className="text-sm text-gray-400">Status</div>
                                <div className={`text-2xl font-bold ${status.status === 'valid' ? 'text-green-400' : 'text-yellow-400'
                                    }`}>
                                    {status.status.toUpperCase()}
                                </div>
                            </div>
                            <div className="bg-gray-900/50 rounded p-4">
                                <div className="text-sm text-gray-400">Cookies Found</div>
                                <div className="text-2xl font-bold">{status.cookiesFound}</div>
                            </div>
                        </div>

                        {status.soonestExpiry && (
                            <div className="bg-gray-900/50 rounded p-4 mb-4">
                                <div className="text-sm text-gray-400 mb-1">Next Expiry</div>
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-sm">{status.soonestExpiry.name}</span>
                                    <span className="text-yellow-400 font-semibold">
                                        {formatExpiry(status.soonestExpiry.expiresInSeconds)}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="bg-gray-900/50 rounded p-4">
                            <div className="text-sm text-gray-400 mb-2">Required Cookies</div>
                            <div className="flex flex-wrap gap-2">
                                {status.requiredCookies.found.map(cookie => (
                                    <span key={cookie} className="bg-green-900/30 text-green-400 px-2 py-1 rounded text-xs">
                                        ✓ {cookie}
                                    </span>
                                ))}
                                {status.requiredCookies.missing.map(cookie => (
                                    <span key={cookie} className="bg-red-900/30 text-red-400 px-2 py-1 rounded text-xs">
                                        ✗ {cookie}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Upload Cookies */}
                <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6 mb-6 border border-gray-700">
                    <h2 className="text-xl font-semibold mb-4">Upload New Cookies</h2>

                    <div className="bg-blue-900/20 border border-blue-700 rounded p-4 mb-4 text-sm">
                        <div className="font-semibold mb-2">📋 How to export cookies:</div>
                        <ol className="list-decimal list-inside space-y-1 text-gray-300">
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
                        className="w-full h-48 bg-gray-900 border border-gray-700 rounded px-4 py-3 font-mono text-sm focus:outline-none focus:border-blue-500 mb-4"
                    />

                    <div className="flex gap-2">
                        <button
                            onClick={uploadCookies}
                            disabled={loading || !cookieText.trim()}
                            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-semibold transition"
                        >
                            <Upload className="w-5 h-5" />
                            Upload Cookies
                        </button>
                    </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={validateCookies}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-6 py-3 rounded-lg transition"
                    >
                        <CheckCircle className="w-5 h-5" />
                        Test Cookies
                    </button>
                    <button
                        onClick={clearCache}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-6 py-3 rounded-lg transition"
                    >
                        <RefreshCw className="w-5 h-5" />
                        Clear Cache
                    </button>
                </div>
            </div>
        </div>
    );
}
