import React from "react";
import type { SyncOverlayProps } from "../../types/videoPlayer.types";
import { getSyncMessage } from "../../utils/syncMessages";

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
    const messageConfig = getSyncMessage(syncState, isBuffering, participantCount);
    const isSuccess = messageConfig.variant === 'success';

    return (
        <>
            {/* Admin Toast - Bottom Right (NON-BLOCKING) */}
            {isAdmin && showAdminToast && (
                <div className="absolute bottom-24 right-5 z-25">
                    <div
                        className={`
                            ${isSuccess ? 'bg-green-500/90 border-green-400/50' : 'bg-blue-500/90 border-blue-400/50'}
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
                            {onDismissToast && !isSuccess && (
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
                            <div className="mt-2 w-full bg-blue-700/30 rounded-full h-1 overflow-hidden">
                                <div className="h-full bg-blue-300 rounded-full animate-pulse w-2/3" />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

