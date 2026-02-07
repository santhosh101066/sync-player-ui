import React, { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useWebSocket } from '../context/WebSocketContext';
import { RefreshCw } from 'lucide-react';
import { LibraryItem } from './Library/LibraryItem';

export const Library: React.FC = () => {
    const [files, setFiles] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { send, isAdmin } = useWebSocket();

    const refreshLibrary = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get('/api/library');
            if (Array.isArray(res.data)) {
                setFiles(res.data);
            } else {
                setFiles([]);
            }
        } catch (e) {
            console.error("Library load error", e);
        } finally {
            setTimeout(() => setIsLoading(false), 500); // Visual delay for feedback
        }
    };

    useEffect(() => {
        refreshLibrary();
    }, []);

    // ✅ Memoize playFile callback to prevent re-creating on every render
    const playFile = useCallback((file: string) => {
        const url = `/downloads/${file}`;

        // Only send WebSocket message if admin (prevents double-load)
        if (isAdmin) {
            send({ type: 'load', url });
        }

        // Always dispatch local event
        window.dispatchEvent(new CustomEvent('play-video', { detail: { url, autoPlay: false } }));
    }, [send, isAdmin]);

    // ✅ Memoize file list rendering
    const fileItems = useMemo(() => {
        return files.map(file => (
            <LibraryItem key={file} file={file} onPlay={playFile} />
        ));
    }, [files, playFile]);

    // ✅ Skeleton loader during loading
    const skeletonItems = useMemo(() => {
        return Array.from({ length: 3 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="file-item skeleton" style={{ minHeight: '60px' }}>
                <div className="file-thumb skeleton-pulse" style={{ width: '48px', height: '48px', borderRadius: '8px' }} />
                <div className="file-info" style={{ flex: 1 }}>
                    <div className="skeleton-text" style={{ width: '80%', height: '16px', marginBottom: '8px' }} />
                    <div className="skeleton-text" style={{ width: '40%', height: '12px' }} />
                </div>
            </div>
        ));
    }, []);

    return (
        <div className="library-section">
            <div className="library-header" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Up Next</span>

                <button
                    onClick={refreshLibrary}
                    className="ghost"
                    title="Refresh Library"
                    style={{ opacity: isLoading ? 0.5 : 1 }}
                    disabled={isLoading}
                >
                    <RefreshCw
                        size={18}
                        className={isLoading ? "spin-anim" : ""}
                        style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }}
                    />
                </button>
            </div>

            <div className="library-list">
                {isLoading ? skeletonItems : (
                    files.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No files found
                        </div>
                    ) : fileItems
                )}
            </div>

            <style>{`
                @keyframes spin { 100% { transform: rotate(360deg); } }
                
                .skeleton {
                    background: transparent;
                    pointer-events: none;
                }
                
                .skeleton-pulse {
                    background: linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%);
                    background-size: 200% 100%;
                    animation: skeleton-pulse-anim 1.5s ease-in-out infinite;
                }
                
                @keyframes skeleton-pulse-anim {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                
                .skeleton-text {
                    background: linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%);
                    background-size: 200% 100%;
                    border-radius: 4px;
                    animation: skeleton-pulse-anim 1.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};