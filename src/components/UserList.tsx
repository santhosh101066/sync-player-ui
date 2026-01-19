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
        <div className="p-4 flex-1 overflow-y-auto">
            <div className="mb-4 text-sm text-white/50 font-medium px-1">
                {connectedUsers.length} Online
            </div>

            <div className="flex flex-col gap-2">
                {connectedUsers.map(user => {
                    const isSpeaking = activeSpeakers.includes(user.nick);
                    const isMe = user.nick === nickname;

                    return (
                        <div key={user.id} className={`
                            flex items-center justify-between p-2.5 rounded-xl bg-white/5 border transition-all duration-200
                            ${isSpeaking ? 'border-green-500/50 shadow-[0_0_15px_-3px_rgba(34,197,94,0.3)]' : 'border-transparent hover:bg-white/10'}
                        `}>
                            <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                {/* Avatar */}
                                <div className={`
                                    w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white bg-cover bg-center
                                    ${user.isMuted ? 'bg-red-500' : (isSpeaking ? 'bg-green-500' : 'bg-zinc-700')}
                                `}
                                    style={{
                                        backgroundImage: user.picture ? `url(${user.picture})` : 'none',
                                    }}
                                >
                                    {user.isMuted ? <MicOff size={14} /> : (user.picture ? null : user.nick.charAt(0).toUpperCase())}
                                </div>

                                {/* Info */}
                                <div className="flex flex-col min-w-0">
                                    <span className={`
                                        font-medium text-sm truncate
                                        ${user.isMuted ? 'text-red-400' : (isSpeaking ? 'text-green-400' : 'text-white')}
                                    `}>
                                        {user.nick} {isMe && <span className="text-white/30 text-xs font-normal ml-1">(You)</span>}
                                    </span>
                                    {user.isAdmin && (
                                        <span className="text-[0.65rem] text-purple-400 flex items-center gap-1">
                                            <Shield size={10} className="fill-current" /> Admin
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                {isAdmin && !isMe && (
                                    <button
                                        onClick={() => toggleMute(user.id)}
                                        className={`
                                            bg-transparent border rounded p-1.5 h-auto transition-colors
                                            ${user.isMuted
                                                ? 'border-red-500/30 text-red-500 hover:bg-red-500/10'
                                                : 'border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                                            }
                                        `}
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