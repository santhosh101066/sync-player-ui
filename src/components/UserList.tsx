import React from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { Mic, MicOff, Shield } from 'lucide-react';

interface UserListProps {
    activeSpeakers: string[];
}

export const UserList: React.FC<UserListProps> = ({ activeSpeakers }) => {
    const { connectedUsers, nickname, isAdmin, send } = useWebSocket();

    const toggleMute = (targetId: number) => {
        if (!isAdmin) return;
        send({ type: 'mute-user', targetId });
    };

    return (
        <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
            <div style={{ marginBottom: '16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                {connectedUsers.length} Online
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {connectedUsers.map(user => {
                    const isSpeaking = activeSpeakers.includes(user.nick);
                    const isMe = user.nick === nickname;

                    return (
                        <div key={user.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 12px', background: 'var(--bg-element)', borderRadius: '8px',
                            border: isSpeaking ? '1px solid #22c55e' : '1px solid transparent'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
                                {/* Avatar */}
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '50%',
                                    background: user.isMuted ? '#ef4444' : (isSpeaking ? '#22c55e' : '#3f3f46'),
                                    backgroundImage: user.picture ? `url(${user.picture})` : 'none',
                                    backgroundSize: 'cover',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontWeight: 'bold', fontSize: '0.8rem', flexShrink: 0
                                }}>
                                    {user.isMuted ? <MicOff size={14} /> : (user.picture ? null : user.nick.charAt(0).toUpperCase())}
                                </div>

                                {/* Info */}
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                    <span style={{
                                        fontWeight: 500,
                                        color: user.isMuted ? '#ef4444' : (isSpeaking ? '#22c55e' : 'white'),
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                    }}>
                                        {user.nick} {isMe && '(You)'}
                                    </span>
                                    {user.isAdmin && <span style={{ fontSize: '0.7rem', color: '#8b5cf6' }}><Shield size={10}></Shield> Admin</span>}
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {isAdmin && !isMe && (
                                    <button
                                        onClick={() => toggleMute(user.id)}
                                        style={{
                                            background: 'transparent', border: '1px solid var(--border)',
                                            padding: '4px 8px', borderRadius: '4px', height: 'auto',
                                            color: user.isMuted ? '#ef4444' : 'var(--text-muted)',
                                            cursor: 'pointer'
                                        }}
                                        title={user.isMuted ? "Unmute User" : "Mute User"}
                                    >
                                        {user.isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};