import React, { useState, useRef, useEffect } from "react";
import { useWebSocket } from "../../context/WebSocketContext";
import { RefreshCw, GripHorizontal, Check, Clock, User, Play, X, Pause } from "lucide-react";

export const DraggableSyncStatus: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
    const { isAdmin, bufferProgress, send, connectedUsers } = useWebSocket();
    const [position, setPosition] = useState({ x: 20, y: 100 });
    const panelRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

    // Auto-refresh every 5 seconds (MUST be called before early return)
    useEffect(() => {
        if (!visible || !isAdmin) return;

        const interval = setInterval(() => {
            send({ type: 'check-buffer' } as any);
        }, 5000);

        return () => clearInterval(interval);
    }, [visible, isAdmin, send]);

    // Only show for admins when visible (AFTER all hooks)
    if (!isAdmin || !visible) return null;

    // Use default values if no buffer progress exists (fallback state)
    const effectiveBufferProgress = bufferProgress || {
        ready: 0,
        total: connectedUsers.length,
        allReady: true, // Default to true so it shows green when idle
        unreadyUsers: []
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // Prevent default to stop text selection
        e.preventDefault();

        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialX: position.x,
            initialY: position.y
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!dragRef.current || !panelRef.current) return;

            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;

            // Calculate new position (without state update)
            const newX = Math.max(0, Math.min(window.innerWidth - 250, dragRef.current.initialX + dx));
            const newY = Math.max(0, Math.min(window.innerHeight - 400, dragRef.current.initialY + dy));

            // Direct DOM update for performance (GPU accelerated)
            panelRef.current.style.transform = `translate3d(${newX - position.x}px, ${newY - position.y}px, 0)`;
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (!dragRef.current) return;

            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;

            const finalX = Math.max(0, Math.min(window.innerWidth - 250, dragRef.current.initialX + dx));
            const finalY = Math.max(0, Math.min(window.innerHeight - 400, dragRef.current.initialY + dy));

            // Commit final position to state
            setPosition({ x: finalX, y: finalY });

            // Reset transform since we updated left/top via state
            if (panelRef.current) {
                panelRef.current.style.transform = 'none';
            }

            dragRef.current = null;
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const isAllReady = effectiveBufferProgress.allReady;
    const unreadyList = effectiveBufferProgress.unreadyUsers || [];

    // Helper to check if a specific user is ready
    const isUserReady = (nick: string) => {
        if (isAllReady) return true;
        return !unreadyList.includes(nick);
    };

    return (
        <div
            ref={panelRef}
            className={`
                fixed z-50 backdrop-blur-md border rounded-xl shadow-2xl overflow-hidden w-64 max-w-[90vw] animate-in fade-in zoom-in duration-300
                ${isAllReady ? 'bg-green-900/90 border-green-500/30' : 'bg-black/80 border-white/10'}
            `}
            style={{
                left: position.x,
                top: position.y,
                // Cursor style handled by class or conditional
            }}
        >
            {/* Header / Drag Handle */}
            <div
                className="bg-white/5 p-2 flex items-center justify-between border-b border-white/5"
            >
                <div className="flex items-center gap-2 text-xs font-medium text-white/90 cursor-grab active:cursor-grabbing" onMouseDown={handleMouseDown}>
                    <GripHorizontal size={14} />
                    <span>{isAllReady ? 'Sync Monitor' : 'Syncing Players...'}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${!isAllReady ? 'bg-yellow-500/20 text-yellow-200' : 'bg-green-500/20 text-green-200'}`}>
                        {effectiveBufferProgress.ready}/{effectiveBufferProgress.total}
                    </div>
                    <button
                        onClick={onClose}
                        className="hover:bg-white/10 p-1 rounded transition-colors text-white/60 hover:text-white"
                        title="Close"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-3 space-y-3">

                {/* User List */}
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {connectedUsers.map((user) => {
                        const ready = isUserReady(user.nick);
                        const isPlaying = !user.paused; // Use per-user paused state
                        return (
                            <div key={user.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-white/5">
                                <div className="flex items-center gap-2">
                                    <User size={12} className="text-white/50" />
                                    <span className="text-white/90 font-medium truncate max-w-[100px]" title={user.nick}>
                                        {user.nick}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Playing/Paused State */}
                                    {isPlaying ? (
                                        <Play size={10} className="text-blue-400" fill="currentColor" />
                                    ) : (
                                        <Pause size={10} className="text-gray-400" />
                                    )}
                                    {/* Buffer Status */}
                                    {ready ? (
                                        <div className="flex items-center gap-1 text-green-400">
                                            <Check size={12} />
                                            <span className="text-[10px]">Ready</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-yellow-400 animate-pulse">
                                            <Clock size={12} />
                                            <span className="text-[10px]">Pending</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Actions */}
                <div className="pt-2 border-t border-white/10 flex gap-2">
                    <button
                        onClick={() => send({ type: 'check-buffer' } as any)}
                        className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-xs text-white font-medium py-1.5 rounded-lg border border-white/5"
                        title="Re-check status"
                    >
                        <RefreshCw size={12} className={!isAllReady ? "animate-spin" : ""} />
                        <span className="sr-only">Check</span>
                    </button>

                    <button
                        onClick={() => {
                            // Force play command (skips buffer check)
                            send({ type: 'forceSync', time: 0, paused: false } as any);
                        }}
                        className="flex-[3] flex items-center justify-center gap-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/20 active:bg-green-600/40 transition-colors text-xs font-bold py-1.5 rounded-lg"
                    >
                        <Play size={12} fill="currentColor" />
                        FORCE PLAY
                    </button>
                </div>

            </div>
        </div>
    );
};
