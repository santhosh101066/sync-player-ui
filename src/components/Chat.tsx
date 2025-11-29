import React, { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { Send } from 'lucide-react';

interface ChatMessage {
    nick: string;
    text: string;
    isAdmin?: boolean;
    isSystem?: boolean; // Added isSystem
}

export const Chat: React.FC = () => {
    const { send, lastMessage, nickname } = useWebSocket();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (lastMessage && lastMessage.type === 'chat') {
            setMessages(prev => [...prev, { 
                nick: lastMessage.nick, 
                text: lastMessage.text, 
                isAdmin: lastMessage.isAdmin,
                isSystem: lastMessage.isSystem // Capture system flag
            }]);
        }
    }, [lastMessage]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = () => {
        if (!input.trim()) return;
        send({ type: 'chat', text: input, nick: nickname });
        setMessages(prev => [...prev, { nick: nickname, text: input, isAdmin: false }]);
        setInput('');
    };

    return (
        <div className="chat-section">
            <div className="chat-messages">
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9em', margin: '20px 0' }}>
                    👋 Welcome to the session
                </div>
                
                {messages.map((msg, i) => {
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