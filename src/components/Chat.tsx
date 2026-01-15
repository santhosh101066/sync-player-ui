import React, { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { Send, X } from 'lucide-react';

export const Chat: React.FC = () => {
    // [FIX] Use global chat state instead of local state
    const { send, nickname, chatMessages, addLocalMessage, userPicture } = useWebSocket();
    const [input, setInput] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

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
                    return (
                        <div key={i} className="chat-msg" style={{ flexDirection: isMe ? 'row-reverse' : 'row' }}>
                            <div className="chat-avatar">
                                {msg.picture ? (
                                    <img src={msg.picture} alt={msg.nick.charAt(0)} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                    msg.nick.charAt(0).toUpperCase()
                                )}
                            </div>
                            <div className="chat-content" style={{ alignItems: isMe ? 'flex-end' : 'flex-start', display: 'flex', flexDirection: 'column' }}>
                                <div className="chat-author">
                                    {isMe ? 'You' : msg.nick} {msg.isAdmin && <span style={{ color: 'var(--primary)', fontSize: '0.7em', border: '1px solid var(--primary)', padding: '0 4px', borderRadius: '4px' }}>ADMIN</span>}
                                </div>
                                <div className="chat-text" style={{
                                    background: isMe ? 'var(--primary)' : 'var(--bg-element)',
                                    color: isMe ? 'white' : 'var(--text-main)',
                                    borderRadius: isMe ? '12px 4px 12px 12px' : '4px 12px 12px 12px'
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

            {/* LIGHTBOX / POPUP */}
            {selectedImage && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} onClick={() => setSelectedImage(null)}>
                    <img src={selectedImage} alt="Fullscreen" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '8px' }} />
                    <button style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                        <X size={32} />
                    </button>
                </div>
            )}
        </div>
    );
};