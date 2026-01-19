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
                <div className="text-center text-zinc-500 text-sm my-5">
                    👋 Welcome to the session
                </div>

                {chatMessages.map((msg, i) => {
                    // --- HANDLE SYSTEM MESSAGES ---
                    if (msg.isSystem) {
                        return (
                            <div key={i} className="text-center text-xs text-white/60 my-2 italic">
                                {msg.text}
                            </div>
                        );
                    }
                    // ------------------------------

                    const isMe = msg.nick === nickname;
                    const prevMsg = chatMessages[i - 1];
                    const isSequence = prevMsg && !prevMsg.isSystem && prevMsg.nick === msg.nick;

                    return (
                        <div key={i} className={`flex gap-3 px-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${isSequence ? 'mt-0.5' : 'mt-3'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                            <div className={`w-8 h-8 flex-shrink-0 ${isSequence ? 'invisible' : 'visible'}`}>
                                {msg.picture ? (
                                    <img src={msg.picture} alt={msg.nick.charAt(0)} className="w-full h-full rounded-full object-cover shadow-sm bg-zinc-800" />
                                ) : (
                                    <div className="w-full h-full rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                                        {msg.nick.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                                {!isSequence && (
                                    <div className="text-xs text-white/50 mb-1 flex items-center gap-1.5 px-1">
                                        {isMe ? 'You' : msg.nick}
                                        {msg.isAdmin && (
                                            <span className="text-[0.6rem] text-primary border border-primary/30 bg-primary/10 px-1 rounded uppercase font-bold tracking-wider">
                                                ADMIN
                                            </span>
                                        )}
                                    </div>
                                )}
                                <div
                                    className={`px-3.5 py-2.5 shadow-md break-words text-sm
                                        ${isMe
                                            ? 'bg-violet-500 text-white'
                                            : 'bg-white/10 text-gray-100'
                                        }
                                        ${isMe
                                            ? (isSequence ? 'rounded-2xl rounded-tr-md' : 'rounded-2xl rounded-tr-sm')
                                            : (isSequence ? 'rounded-2xl rounded-tl-md' : 'rounded-2xl rounded-tl-sm')
                                        }
                                    `}
                                >
                                    {msg.image ? (
                                        <img
                                            src={msg.image}
                                            alt="Shared"
                                            className="max-w-[200px] max-h-[200px] cursor-pointer rounded-md hover:brightness-110 transition-all border border-black/10"
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

            <div className="p-4 border-t border-white/10 bg-black/20 flex gap-2.5 backdrop-blur-sm">
                <input
                    type="text"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all"
                    placeholder="Type a message... (Paste images supported)"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onPaste={handlePaste}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button onClick={sendMessage} className="p-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl transition-colors shadow-lg shadow-primary/20 flex items-center justify-center">
                    <Send size={18} />
                </button>
            </div>

            {/* LIGHTBOX / POPUP - PORTAL */}
            {selectedImage && createPortal(
                <div
                    className="fixed inset-0 bg-black/95 z-[99999] flex flex-col items-center justify-center select-none animate-in fade-in duration-200"
                    onClick={closeLightbox}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <div
                        className={`flex-1 flex items-center justify-center overflow-hidden w-full ${zoomLevel > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'}`}
                        onMouseDown={handleMouseDown}
                    >
                        <img
                            src={selectedImage}
                            alt="Fullscreen"
                            className="max-w-[90%] max-h-[90%] rounded-lg shadow-2xl"
                            style={{
                                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
                                transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                                pointerEvents: 'auto'
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onDragStart={(e) => e.preventDefault()}
                        />
                    </div>

                    {/* Toolbar */}
                    <div
                        className="absolute bottom-6 bg-zinc-900/85 backdrop-blur-xl px-4 py-2 rounded-full flex items-center gap-4 border border-white/10 shadow-2xl pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button onClick={() => { setZoomLevel(z => Math.max(0.5, z - 0.5)); setPan({ x: 0, y: 0 }); }} title="Zoom Out" className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors">
                            <ZoomOut size={18} />
                        </button>
                        <span className="min-w-[36px] text-center text-zinc-300 text-sm font-medium tabular-nums">
                            {Math.round(zoomLevel * 100)}%
                        </span>
                        <button onClick={() => setZoomLevel(z => Math.min(4, z + 0.5))} title="Zoom In" className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors">
                            <ZoomIn size={18} />
                        </button>
                        <div className="w-px h-4 bg-white/20"></div>
                        <button onClick={() => {
                            const link = document.createElement('a');
                            link.href = selectedImage;
                            link.download = `syncplayer-image-${Date.now()}.png`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }} title="Download" className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors">
                            <Download size={18} />
                        </button>
                    </div>

                    <button
                        className="absolute top-5 right-5 text-white/70 hover:text-white hover:bg-white/10 p-2 rounded-full transition-all pointer-events-auto"
                        onClick={closeLightbox}
                    >
                        <X size={32} />
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
};