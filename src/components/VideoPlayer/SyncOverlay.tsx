import React from "react";
import type { SyncOverlayProps } from "../../types/videoPlayer.types";
import { getSyncMessage } from "../../utils/syncMessages";
import { useWebSocket } from "../../context/WebSocketContext";

const SyncIcon: React.FC<{ type: 'spinner' | 'pulse' | 'checkmark' | 'users' }> = ({ type }) => {
    switch (type) {
        case 'spinner':
            return <div className="w-4 h-4 border-2 border-blue-200/30 border-t-blue-200 rounded-full animate-spin" />;

        case 'pulse':
            return <div className="w-2 h-2 bg-blue-200 rounded-full animate-pulse" />;

        case 'checkmark':
            return (
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
            );

        case 'users':
            return (
                <svg className="w-4 h-4 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            );
    }
};

export const SyncOverlay: React.FC<SyncOverlayProps> = ({
    syncState,
    isBuffering,
    isAdmin,
    showAdminToast,
    onDismissToast,
    participantCount,
}) => {
    // --- Buffer Progress (Admin Only) ---
    const { bufferProgress } = useWebSocket();

    // Determine which message to show
    let messageConfig = getSyncMessage(syncState, isBuffering, participantCount);
    let isSuccess = messageConfig.variant === 'success';

    // Override for Buffer Progress if active
    if (isAdmin && bufferProgress && bufferProgress.total > 0 && !bufferProgress.allReady) {
        messageConfig = {
            title: "Loading Video...",
            description: `${bufferProgress.ready}/${bufferProgress.total} Users Ready`,
            icon: 'spinner',
            variant: 'waiting'
        };
        isSuccess = false;
    } else if (isAdmin && bufferProgress?.allReady) {
        messageConfig = {
            title: "Ready to Play!",
            description: "All users loaded successfully",
            icon: 'checkmark',
            variant: 'success'
        };
        isSuccess = true;
    }

    return (
        <>
            {/* Admin Toast - Bottom Right (NON-BLOCKING) */}
            {isAdmin && (showAdminToast || bufferProgress) && (
                <div className="absolute bottom-24 right-5 z-25">
                    <div
                        className={`
                            ${isSuccess ? 'bg-green-500/90 border-green-400/50' : 'bg-blue-500/90 border-blue-400/50'}
                            // Yellow override for buffering
                            ${bufferProgress && !bufferProgress.allReady ? '!bg-yellow-600/90 !border-yellow-500/50' : ''}

                            border backdrop-blur-xl rounded-lg px-4 py-3 text-white shadow-2xl 
                            animate-in slide-in-from-right-5 fade-in duration-300 min-w-[280px]
                            transition-colors duration-500
                        `}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 flex-1">
                                <SyncIcon type={messageConfig.icon} />
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-semibold">{messageConfig.title}</span>
                                    <span className="text-xs text-blue-100 opacity-90">
                                        {messageConfig.description}
                                    </span>
                                </div>
                            </div>
                            {onDismissToast && !isSuccess && !bufferProgress && (
                                <button
                                    onClick={onDismissToast}
                                    className="text-blue-100 hover:text-white transition-colors p-1 -mt-1 -mr-1"
                                    aria-label="Dismiss"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Progress bar - only show when waiting */}
                        {messageConfig.variant === 'waiting' && (
                            <div className="mt-2 w-full bg-black/20 rounded-full h-1 overflow-hidden">
                                <div
                                    className="h-full bg-white/50 rounded-full transition-all duration-500"
                                    style={{ width: bufferProgress ? `${(bufferProgress.ready / bufferProgress.total) * 100}%` : '66%' }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

