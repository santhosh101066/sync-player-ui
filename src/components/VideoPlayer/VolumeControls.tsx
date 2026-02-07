import React, { useCallback, useRef } from "react";
import { VolumeX, Volume1, Volume2 } from "lucide-react";
import type { VolumeControlsProps } from "../../types/videoPlayer.types";

export const VolumeControls = React.memo<VolumeControlsProps>(({
    volume,
    muted,
    onVolumeChange,
    onToggleMute,
    showMobileVolume,
    onToggleMobileVolume,
}) => {
    const mobileVolumeRef = useRef<HTMLDivElement>(null);

    const handleMobileVolumeDrag = useCallback(
        (e: React.PointerEvent) => {
            const slider = mobileVolumeRef.current;
            if (!slider) return;

            if (e.type === "pointerdown") {
                slider.setPointerCapture(e.pointerId);
            }

            const rect = slider.getBoundingClientRect();
            const rawValue = 1 - (e.clientY - rect.top) / rect.height;
            const newVolume = Math.max(0, Math.min(1, rawValue));

            onVolumeChange(newVolume);
        },
        [onVolumeChange]
    );

    return (
        <div className="flex items-center gap-2 relative max-[900px]:gap-0">
            {/* Mobile Popup Volume Slider */}
            {showMobileVolume && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-black/90 backdrop-blur-xl border border-white/10 rounded-full p-2 py-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200 flex flex-col items-center">
                    <div
                        ref={mobileVolumeRef}
                        className="h-24 w-8 relative flex items-center justify-center cursor-pointer touch-none"
                        onPointerDown={handleMobileVolumeDrag}
                        onPointerMove={(e) => {
                            if (e.buttons === 1) handleMobileVolumeDrag(e);
                        }}
                    >
                        <div className="absolute inset-0 z-20" />
                        <div className="w-1.5 h-full bg-white/20 rounded-full relative pointer-events-none overflow-hidden">
                            <div
                                className="absolute bottom-0 left-0 w-full bg-white rounded-full transition-none"
                                style={{ height: `${(muted ? 0 : volume) * 100}%` }}
                            />
                        </div>
                        <div
                            className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-lg pointer-events-none transition-none"
                            style={{ bottom: `calc(${(muted ? 0 : volume) * 100}% - 8px)` }}
                        />
                    </div>
                </div>
            )}

            <button
                className="vp-control-btn w-8 h-8 text-zinc-200 hover:text-white max-[900px]:w-8 max-[900px]:h-8 relative z-10"
                onClick={(e) => {
                    if (window.innerWidth <= 900) {
                        e.stopPropagation();
                        onToggleMobileVolume();
                    } else {
                        onToggleMute();
                    }
                }}
                title={muted ? "Unmute" : "Mute"}
            >
                {muted || volume === 0 ? (
                    <VolumeX className="w-5 h-5 max-[900px]:w-5 max-[900px]:h-5" strokeWidth={1.5} />
                ) : volume < 0.5 ? (
                    <Volume1 className="w-5 h-5 max-[900px]:w-5 max-[900px]:h-5" strokeWidth={1.5} />
                ) : (
                    <Volume2 className="w-5 h-5 max-[900px]:w-5 max-[900px]:h-5" strokeWidth={1.5} />
                )}
            </button>

            {/* Desktop Inline Slider (Hidden on Mobile) */}
            <div className="w-20 h-8 flex items-center relative opacity-100 max-[900px]:hidden">
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={muted ? 0 : volume}
                    onInput={(e) => onVolumeChange(parseFloat((e.target as HTMLInputElement).value))}
                    className="absolute inset-0 w-full h-full opacity-0 z-50 cursor-pointer appearance-none"
                />
                <div className="w-full h-1 bg-white/30 !rounded-full relative cursor-pointer">
                    <div
                        className="absolute top-0 left-0 h-full bg-white !rounded-full pointer-events-none"
                        style={{ width: `${(muted ? 0 : volume) * 100}%` }}
                    />
                    <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white !rounded-full pointer-events-none shadow-sm left-[var(--slider-fill)]"
                        style={{ left: `${(muted ? 0 : volume) * 100}%` }}
                    />
                </div>
            </div>
        </div>
    );
});

VolumeControls.displayName = "VolumeControls";
