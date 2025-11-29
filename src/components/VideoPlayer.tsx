import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import '@videojs/themes/dist/fantasy/index.css';
import { useWebSocket } from '../context/WebSocketContext';
import { Mic } from 'lucide-react';

interface VideoPlayerProps {
    src?: string;
    activeSpeakers: string[];
}

interface FloatingMessage {
    id: number;
    nick: string;
    text: string;
    color: string;
}

// Helper to generate consistent avatar colors (Pastel/Bright for dark mode)
const getAvatarColor = (name: string) => {
    const colors = [
        '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399', 
        '#22d3ee', '#818cf8', '#c084fc', '#f472b6', '#f43f5e'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src: propSrc, activeSpeakers }) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const playerRef = useRef<any>(null);
    
    // UI States
    const [overlayNode, setOverlayNode] = useState<HTMLElement | null>(null);
    const [overlayChat, setOverlayChat] = useState<FloatingMessage[]>([]); 

    // Context & State
    const { send, lastMessage, isConnected, isAdmin, userControlsAllowed } = useWebSocket();
    const [currentSrc, setCurrentSrc] = useState<string>('');
    
    // Refs
    const permissionsRef = useRef({ isAdmin, userControlsAllowed, isConnected });
    const currentSrcRef = useRef(currentSrc);
    const isRemoteUpdate = useRef(false);

    // Sync Refs
    useEffect(() => {
        permissionsRef.current = { isAdmin, userControlsAllowed, isConnected };
    }, [isAdmin, userControlsAllowed, isConnected]);

    useEffect(() => {
        currentSrcRef.current = currentSrc;
    }, [currentSrc]);
    
    // Handle Incoming Chat for Overlay
    useEffect(() => {
        if (!lastMessage) return;

        if (lastMessage.type === 'chat') {
            const id = Date.now() + Math.random();
            const newMsg: FloatingMessage = {
                id,
                nick: lastMessage.nick,
                text: lastMessage.text,
                color: getAvatarColor(lastMessage.nick)
            };

            setOverlayChat(prev => [...prev, newMsg]);

            // Remove after 6 seconds (slightly longer for readability)
            setTimeout(() => {
                setOverlayChat(prev => prev.filter(m => m.id !== id));
            }, 6000);
        }
    }, [lastMessage]);

    // Listeners for Manual Sync/Load
    useEffect(() => {
        const handleRequestSync = () => {
            const player = playerRef.current;
            if (!player) return;
            sendSync('forceSync', player.currentTime(), player.paused());
        };
        window.addEventListener('request-sync', handleRequestSync);
        return () => window.removeEventListener('request-sync', handleRequestSync);
    }, []);

    useEffect(() => {
        const handleLocalLoad = (e: any) => {
            if (e.detail?.url) playVideo(e.detail.url);
        };
        window.addEventListener('play-video', handleLocalLoad);
        return () => window.removeEventListener('play-video', handleLocalLoad);
    }, []);

    // Initialize Player & Create Overlay Node
    useEffect(() => {
        if (!videoRef.current) return;
        
        if (!playerRef.current) {
            const player = videojs(videoRef.current, {
                controls: true,
                autoplay: false,
                preload: 'auto',
                fluid: true,
                sources: [],
                liveui: true,
            });

            playerRef.current = player;

            // Create Overlay Container
            const overlayContainer = document.createElement('div');
            overlayContainer.className = 'vjs-react-overlay-container';
            player.el().appendChild(overlayContainer);
            setOverlayNode(overlayContainer);

            // Events
            player.on('play', () => {
                if (!isRemoteUpdate.current) sendSync('play', player.currentTime()??0, false);
            });
            player.on('pause', () => {
                if (!isRemoteUpdate.current) sendSync('pause', player.currentTime()??0, true);
            });
            player.on('seeked', () => {
                if (!isRemoteUpdate.current) sendSync('seek', player.currentTime()??0, player.paused());
            });
        }
    }, [videoRef]);

    // Handle Props Change
    useEffect(() => {
        if (propSrc && propSrc !== currentSrc) {
            playVideo(propSrc);
        }
    }, [propSrc]);

    // Handle Sync Messages
    useEffect(() => {
        const player = playerRef.current;
        if (!lastMessage || !player) return;

        const msg = lastMessage;

        if (msg.type === 'sync' || msg.type === 'forceSync') {
            const time = parseFloat(msg.time);
            const paused = msg.paused;
            const url = msg.url;

            if (url && url !== currentSrcRef.current) {
                isRemoteUpdate.current = true;
                playVideo(url);
            }

            const diff = Math.abs(player.currentTime() - time);
            if (msg.type === 'forceSync' || diff > 1) {
                isRemoteUpdate.current = true;
                player.currentTime(time);
            }

            if (paused && !player.paused()) {
                isRemoteUpdate.current = true;
                player.pause();
            } else if (!paused && player.paused()) {
                isRemoteUpdate.current = true;
                player.play()?.catch(() => {});
            }
            setTimeout(() => { isRemoteUpdate.current = false; }, 500);

        } else if (msg.type === 'load') {
            playVideo(msg.url);
        }
    }, [lastMessage]);

    const playVideo = (url: string) => {
        const player = playerRef.current;
        if (!player) return;

        setCurrentSrc(url);
        currentSrcRef.current = url; 

        let type = 'application/x-mpegURL';
        if (url.match(/\.(mp4|webm|mkv)$/i)) type = 'video/mp4';

        let src = url;
        if (!url.startsWith("/") && !url.includes(window.location.host) && type === 'application/x-mpegURL') {
            src = `/api/proxy?url=${btoa(url)}`;
        }

        player.src({ src, type });
        if (permissionsRef.current.isAdmin || permissionsRef.current.userControlsAllowed) {
            player.play()?.catch(() => {});
        }
    };

    const sendSync = (action: string, time: number, paused: boolean) => {
        const { isAdmin, userControlsAllowed, isConnected } = permissionsRef.current;
        if (!isConnected) return;
        if (!isAdmin && !userControlsAllowed) return;

        send({
            type: 'forceSync',
            action: action,
            time: time,
            paused: paused,
            url: currentSrcRef.current 
        });
    };

    const isLocked = !isAdmin && !userControlsAllowed;

    return (
        <div className={`video-container ${isLocked ? 'locked-mode' : ''}`}>
            <div data-vjs-player>
                <video ref={videoRef} className="video-js vjs-theme-fantasy vjs-big-play-centered" />
            </div>

            {/* --- PORTAL INTO VIDEO PLAYER --- */}
            {overlayNode && createPortal(
                <div className="vjs-overlay-content">
                    
                    {/* 1. CHAT OVERLAY (Right Side) */}
                    <div className="vjs-chat-overlay">
                        {overlayChat.map((msg) => (
                            <div key={msg.id} className="vjs-chat-bubble">
                                <span className="vjs-chat-nick" style={{ color: msg.color }}>
                                    {msg.nick}
                                </span>
                                <span className="vjs-chat-text">{msg.text}</span>
                            </div>
                        ))}
                    </div>

                    {/* 2. ACTIVE SPEAKERS (Top-Right) */}
                    {activeSpeakers.length > 0 && (
                        <div className="vjs-speaker-list">
                            {activeSpeakers.map((name, i) => (
                                <div key={i} className="vjs-speaker-item">
                                    <div className="speaker-avatar">
                                        <Mic size={12} color="white" />
                                    </div>
                                    <span className="speaker-name">{name}</span>
                                    <div className="speaker-wave">
                                        <span></span><span></span><span></span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 3. LOCK INDICATOR (Top-Left) */}
                    {isLocked && (
                        <div className="vjs-lock-indicator">
                            <span style={{fontSize:'1.2rem'}}>🔒</span>
                            <span>Controls Locked</span>
                        </div>
                    )}
                </div>,
                overlayNode
            )}

            <style>{`
                
            `}</style>
        </div>
    );
};