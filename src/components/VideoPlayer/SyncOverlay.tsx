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
    participantCount,
}) => {
    // Determine which message to show
    const messageConfig = getSyncMessage(syncState, isBuffering, participantCount);

    if (!messageConfig) return null;

    return (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-black/40 border border-white/10 rounded-xl p-6 flex flex-col items-center gap-4 max-w-sm text-center shadow-2xl">
                <div className="p-3 bg-white/5 rounded-full">
                    <SyncIcon type={messageConfig.icon} />
                </div>
                <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold text-white">{messageConfig.title}</h3>
                    <p className="text-sm text-white/60">{messageConfig.description}</p>
                </div>
            </div>
        </div>
    );
};

