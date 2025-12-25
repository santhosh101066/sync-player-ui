import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

interface User {
    id: number;
    nick: string;
    isAdmin: boolean;
}

export const AdminDashboard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { send, lastMessage } = useWebSocket();
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        // Request fresh list on open
        send({ type: 'get-users' });
    }, [send]);

    useEffect(() => {
        if (lastMessage && lastMessage.type === 'user-list') {
            setUsers(lastMessage.users);
        }
    }, [lastMessage]);

    const kickUser = (id: number) => {
        if (confirm("Kick this user?")) {
            send({ type: 'kick-user', targetId: id });
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0,
            width: '100vw', height: '100vh',
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div style={{
                background: 'rgba(30, 30, 35, 0.85)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '24px',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '500px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                color: '#fff',
                fontFamily: 'Inter, sans-serif'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🛡️</span> Admin Console
                    </h2>
                    <button onClick={onClose} style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255,255,255,0.6)',
                        cursor: 'pointer',
                        padding: '4px'
                    }}>✕</button>
                </div>

                <div style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                }}>
                    {users.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
                            No active users found.
                        </div>
                    )}

                    {users.map(u => (
                        <div key={u.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '10px'
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                                    {u.nick}
                                    {u.isAdmin && (
                                        <span style={{
                                            fontSize: '0.7rem',
                                            background: 'rgba(124, 58, 237, 0.2)',
                                            color: '#c4b5fd',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            border: '1px solid rgba(124, 58, 237, 0.3)'
                                        }}>ADMIN</span>
                                    )}
                                </div>
                                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                                    ID: {u.id}
                                </span>
                            </div>

                            {!u.isAdmin && (
                                <button
                                    onClick={() => kickUser(u.id)}
                                    title="Kick User"
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        color: '#fca5a5',
                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: 500,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Kick
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <div style={{
                    marginTop: '20px',
                    paddingTop: '16px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#fff',
                            color: '#000',
                            border: 'none',
                            padding: '8px 20px',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
