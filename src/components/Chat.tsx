import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWebSocket } from '../context/WebSocketContext';
import { Send, X, ZoomIn, ZoomOut, Download } from 'lucide-react';

export const Chat: React.FC = () => {
    // [FIX] Use global chat state instead of local state
    const { send, nickname, chatMessages, addLocalMessage, userPicture } = useWebSocket();
    const [input, setInput] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoomLevel > 1) {
            setIsDragging(true);
            dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && zoomLevel > 1) {
            e.preventDefault();
            setPan({
                x: e.clientX - dragStart.current.x,
                y: e.clientY - dragStart.current.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const closeLightbox = () => {
        setSelectedImage(null);
        setZoomLevel(1);
        setPan({ x: 0, y: 0 });
    };

    const handleUpload = async (file: File) => {
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                const imageUrl = data.url;

                // Send chat message with image
                send({ type: 'chat', text: '', nick: nickname, image: imageUrl });
                addLocalMessage('', imageUrl, userPicture);
            } else {
                console.error("Upload failed");
            }
        } catch (error) {
            console.error("Error uploading file:", error);
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) handleUpload(blob);
            }
        }
    };

    const sendMessage = () => {
        if (!input.trim()) return;

        // 1. Send to server
        send({ type: 'chat', text: input, nick: nickname });

        // 2. Add to local history instantly (Optimistic UI)
        addLocalMessage(input, undefined, userPicture);

        setInput('');
    };

    return (
        <div className="chat-section">
            <div className="chat-messages">
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9em', margin: '20px 0' }}>
                    👋 Welcome to the session
                </div>

                {chatMessages.map((msg, i) => {
                    // --- HANDLE SYSTEM MESSAGES ---
                    if (msg.isSystem) {
                        return (
                            <div key={i} style={{
                                textAlign: 'center',
                                fontSize: '0.8rem',
                                color: 'var(--text-muted)',
                                margin: '8px 0',
                                fontStyle: 'italic'
                            }}>
                                {msg.text}
                            </div>
                        );
                    }
                    // ------------------------------

                    const isMe = msg.nick === nickname;
                    const prevMsg = chatMessages[i - 1];
                    const isSequence = prevMsg && !prevMsg.isSystem && prevMsg.nick === msg.nick;

                    return (
                        <div key={i} className="chat-msg" style={{
                            flexDirection: isMe ? 'row-reverse' : 'row',
                            marginTop: isSequence ? '2px' : '12px'
                        }}>
                            <div className="chat-avatar" style={{ visibility: isSequence ? 'hidden' : 'visible' }}>
                                {msg.picture ? (
                                    <img src={msg.picture} alt={msg.nick.charAt(0)} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                    msg.nick.charAt(0).toUpperCase()
                                )}
                            </div>
                            <div className="chat-content" style={{ alignItems: isMe ? 'flex-end' : 'flex-start', display: 'flex', flexDirection: 'column' }}>
                                {!isSequence && (
                                    <div className="chat-author">
                                        {isMe ? 'You' : msg.nick} {msg.isAdmin && <span style={{ color: 'var(--primary)', fontSize: '0.7em', border: '1px solid var(--primary)', padding: '0 4px', borderRadius: '4px' }}>ADMIN</span>}
                                    </div>
                                )}
                                <div className="chat-text" style={{
                                    background: isMe ? 'var(--primary)' : 'var(--bg-element)',
                                    color: isMe ? 'white' : 'var(--text-main)',
                                    borderRadius: isMe
                                        ? (isSequence ? '12px 12px 12px 12px' : '12px 4px 12px 12px')
                                        : (isSequence ? '12px 12px 12px 12px' : '4px 12px 12px 12px')
                                }}>
                                    {msg.image ? (
                                        <img
                                            src={msg.image}
                                            alt="Shared"
                                            style={{ maxWidth: '200px', maxHeight: '200px', cursor: 'pointer', borderRadius: '4px' }}
                                            onClick={() => setSelectedImage(msg.image || null)}
                                        />
                                    ) : msg.text}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
                <input
                    type="text"
                    placeholder="Type a message... (Paste images supported)"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onPaste={handlePaste}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    style={{ flex: 1 }}
                />
                <button onClick={sendMessage} className="primary" style={{ padding: '8px 12px' }}>
                    <Send size={18} />
                </button>
            </div>

            {/* LIGHTBOX / POPUP - PORTAL */}
            {selectedImage && createPortal(
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 99999,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    userSelect: 'none'
                }}
                    onClick={closeLightbox}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <div style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', width: '100%', cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                    }}
                        onMouseDown={handleMouseDown}
                    >
                        <img
                            src={selectedImage}
                            alt="Fullscreen"
                            style={{
                                maxWidth: '90%',
                                maxHeight: '90%',
                                borderRadius: '8px',
                                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
                                transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                                pointerEvents: 'auto'
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onDragStart={(e) => e.preventDefault()}
                        />
                    </div>

                    {/* Toolbar */}
                    <div style={{
                        position: 'absolute', bottom: 24,
                        background: 'rgba(20, 20, 20, 0.85)',
                        backdropFilter: 'blur(12px)',
                        padding: '8px 16px',
                        borderRadius: '100px',
                        display: 'flex', alignItems: 'center', gap: '16px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        pointerEvents: 'auto'
                    }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => { setZoomLevel(z => Math.max(0.5, z - 0.5)); setPan({ x: 0, y: 0 }); }} title="Zoom Out" style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', padding: 4 }}>
                            <ZoomOut size={18} />
                        </button>
                        <span style={{ minWidth: '36px', textAlign: 'center', color: '#e0e0e0', fontSize: '0.85rem', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                            {Math.round(zoomLevel * 100)}%
                        </span>
                        <button onClick={() => setZoomLevel(z => Math.min(4, z + 0.5))} title="Zoom In" style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', padding: 4 }}>
                            <ZoomIn size={18} />
                        </button>
                        <div style={{ width: 1, height: '16px', background: 'rgba(255,255,255,0.2)' }}></div>
                        <button onClick={() => {
                            const link = document.createElement('a');
                            link.href = selectedImage;
                            link.download = `syncplayer-image-${Date.now()}.png`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }} title="Download" style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', padding: 4 }}>
                            <Download size={18} />
                        </button>
                    </div>

                    <button style={{
                        position: 'absolute', top: 20, right: 20,
                        background: 'transparent', border: 'none', color: 'white', cursor: 'pointer',
                        padding: '10px',
                        pointerEvents: 'auto'
                    }} onClick={closeLightbox}>
                        <X size={32} />
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
};