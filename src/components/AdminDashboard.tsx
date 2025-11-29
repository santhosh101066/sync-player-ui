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
        <div className="modal-overlay">
            <div className="modal" style={{ width: '500px' }}>
                <h2>🎛️ Admin Dashboard</h2>
                <div className="user-list">
                    {users.length === 0 && <div style={{ padding: '10px', color: '#888' }}>No users connected</div>}
                    {users.map(u => (
                        <div key={u.id} className="user-row">
                            <span>
                                {u.nick} {u.isAdmin && <span className="admin-badge">ADMIN</span>} (ID: {u.id})
                            </span>
                            {!u.isAdmin && (
                                <button className="kick-btn" onClick={() => kickUser(u.id)}>Kick</button>
                            )}
                        </div>
                    ))}
                </div>
                <button onClick={onClose} style={{ background: '#444' }}>Close</button>
            </div>
        </div>
    );
};
