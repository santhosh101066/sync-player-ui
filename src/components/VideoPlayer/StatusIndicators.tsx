import React from "react";
import { Mic, Lock } from "lucide-react";
import type { StatusIndicatorsProps } from "../../types/videoPlayer.types";

export const StatusIndicators: React.FC<StatusIndicatorsProps> = ({
    isConnected,
    isLocked,
    activeSpeakers,
    controlsVisible,
    paused,
}) => {
    return (
        <div
            className={`absolute inset-0 z-20 pointer-events-none transition-opacity duration-300 ${controlsVisible || paused ? "opacity-100" : "opacity-0"
                } group-hover/root:opacity-100`}
        >
            {/* Connection Status - Top Right */}
            <div
                className={`absolute top-5 right-5 px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 shadow-sm ${!isConnected
                        ? "bg-red-500/20 border border-red-500 text-red-500"
                        : "bg-green-500/20 border border-green-500 text-green-500"
                    }`}
            >
                <div className="w-2 h-2 rounded-full bg-current" />
                {isConnected ? "Live" : "Offline"}
            </div>

            {/* Lock Indicator - Top Left */}
            {isLocked && (
                <div className="absolute top-6 left-6 text-white/40 p-1 flex items-center justify-center">
                    <Lock size={16} strokeWidth={1.5} />
                </div>
            )}

            {/* Active Speakers - Top Right (below connection status) */}
            {activeSpeakers.length > 0 && (
                <div className="absolute top-[60px] right-5 flex flex-col items-end gap-2">
                    {activeSpeakers.map((name, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-2 bg-green-500/40 border border-green-500/20 px-1 py-1 pr-2.5 rounded-full text-white text-sm font-medium shadow-sm animate-in fade-in zoom-in duration-300"
                        >
                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(34,197,94,0.4)]">
                                <Mic size={14} color="white" strokeWidth={1.5} />
                            </div>
                            <span>{name}</span>
                            <div className="flex gap-[2px] h-3 items-end">
                                <div
                                    className="w-0.5 bg-white rounded-full animate-pulse h-[60%]"
                                    style={{ animationDelay: "0s" }}
                                />
                                <div
                                    className="w-0.5 bg-white rounded-full animate-pulse h-full"
                                    style={{ animationDelay: "0.1s" }}
                                />
                                <div
                                    className="w-0.5 bg-white rounded-full animate-pulse h-[50%]"
                                    style={{ animationDelay: "0.2s" }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
