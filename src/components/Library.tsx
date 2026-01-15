import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useWebSocket } from '../context/WebSocketContext';
import { RefreshCw, Play, FileVideo } from 'lucide-react';

export const Library: React.FC = () => {
    const [files, setFiles] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { send } = useWebSocket();

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

    const playFile = (file: string) => {
        const url = `/downloads/${file}`;
        send({ type: 'load', url });
        window.dispatchEvent(new CustomEvent('play-video', { detail: { url, autoPlay: false } }));
    };

    return (
        <div className="library-section">
            <div className="library-header" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Up Next</span>
                
                {/* Replaced Emoji with Ghost Button & Icon */}
                <button 
                    onClick={refreshLibrary} 
                    className="ghost" 
                    title="Refresh Library"
                    style={{ opacity: isLoading ? 0.5 : 1 }}
                >
                    <RefreshCw 
                        size={18} 
                        className={isLoading ? "spin-anim" : ""} 
                        style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }}
                    />
                </button>
            </div>

            <div className="library-list">
                {files.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No files found
                    </div>
                )}
                
                {files.map(file => (
                    <div key={file} className="file-item" onClick={() => playFile(file)}>
                        <div className="file-thumb">
                            <Play size={24} fill="var(--bg-panel)" />
                        </div>
                        <div className="file-info">
                            <div className="file-name">{file}</div>
                            <div className="file-meta" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <FileVideo size={12} /> Local Video
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            <style>{`
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};