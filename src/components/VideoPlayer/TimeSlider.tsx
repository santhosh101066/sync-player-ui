import React from "react";
import type { TimeSliderProps } from "../../types/videoPlayer.types";

export const TimeSlider = React.memo<TimeSliderProps>(({
    timeSliderRef,
    timeInputRef,
    duration,
    isLocked,
    onSeek,
}) => {
    return (
        <div className="w-full relative h-3.5 mb-2 max-[900px]:h-3 max-[900px]:mb-0.5">
            <div
                ref={timeSliderRef as React.RefObject<HTMLDivElement>}
                className="w-full h-5 flex items-center cursor-pointer relative group/slider max-[900px]:h-3"
                style={{
                    pointerEvents: isLocked ? "none" : "auto",
                    opacity: isLocked ? 0.5 : 1,
                }}
            >
                <input
                    ref={timeInputRef as React.RefObject<HTMLInputElement>}
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.1"
                    defaultValue="0"
                    onInput={onSeek}
                    className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
                />
                <div className="w-full h-1 bg-white/30 !rounded-full relative group-hover/slider:h-1.5 transition-all max-[900px]:h-[3px]">
                    {/* Fill */}
                    <div className="absolute left-0 top-0 h-full bg-[var(--primary)] !rounded-full z-[2] w-[var(--slider-fill,0%)] pointer-events-none" />
                    {/* Buffer */}
                    <div className="absolute left-0 top-0 h-full bg-white/50 !rounded-full z-[1] w-[var(--slider-progress,0%)] pointer-events-none" />
                    {/* Thumb */}
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white !rounded-full shadow-md z-[3] pointer-events-none transition-transform group-hover/slider:scale-125 left-[var(--slider-fill)] max-[900px]:w-2.5 max-[900px]:h-2.5" />
                </div>
            </div>
        </div>
    );
});

TimeSlider.displayName = "TimeSlider";
