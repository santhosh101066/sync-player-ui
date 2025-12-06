import React, { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { Send } from 'lucide-react';

export const Chat: React.FC = () => {
    // [FIX] Use global chat state instead of local state
    const { send, nickname, chatMessages, addLocalMessage } = useWebSocket();
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const sendMessage = () => {
        if (!input.trim()) return;
        
        // 1. Send to server
        send({ type: 'chat', text: input, nick: nickname });
        
        // 2. Add to local history instantly (Optimistic UI)
        addLocalMessage(input);
        
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
                                {msg.nick.charAt(0).toUpperCase()}
                            </div>
                            <div className="chat-content" style={{ alignItems: isMe ? 'flex-end' : 'flex-start', display: 'flex', flexDirection: 'column' }}>
                                <div className="chat-author">
                                    {msg.nick} {msg.isAdmin && <span style={{ color: 'var(--primary)', fontSize: '0.7em', border: '1px solid var(--primary)', padding: '0 4px', borderRadius: '4px' }}>ADMIN</span>}
                                </div>
                                <div className="chat-text" style={{ 
                                    background: isMe ? 'var(--primary)' : 'var(--bg-element)',
                                    color: isMe ? 'white' : 'var(--text-main)',
                                    borderRadius: isMe ? '12px 4px 12px 12px' : '4px 12px 12px 12px'
                                }}>
                                    {msg.text}
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
                    placeholder="Type a message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    style={{ flex: 1 }}
                />
                <button onClick={sendMessage} className="primary" style={{ padding: '8px 12px' }}>
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
};