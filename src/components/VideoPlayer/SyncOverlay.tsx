import React from "react";
import type { SyncOverlayProps } from "../../types/videoPlayer.types";

export const SyncOverlay: React.FC<SyncOverlayProps> = ({
    isBuffering,
    syncMessage,
    isAdmin,
    showAdminToast,
}) => {
    return (
        <>
            {/* Buffer Wait Overlay - Center */}
            {isBuffering && syncMessage && (
                <div className="absolute inset-0 z-25 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-black/80 border border-white/20 rounded-xl px-6 py-4 text-white text-center shadow-2xl animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span className="text-sm font-medium">{syncMessage}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin Toast - Bottom Right */}
            {isAdmin && showAdminToast && (
                <div className="absolute bottom-24 right-5 z-25 pointer-events-none">
                    <div className="bg-blue-500/20 border border-blue-500/40 backdrop-blur-xl rounded-lg px-4 py-2 text-blue-200 text-xs font-medium shadow-lg animate-in slide-in-from-right-5 fade-in duration-300">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                            <span>Sync Event Triggered</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
