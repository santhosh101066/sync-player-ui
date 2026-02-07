/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { Settings, ChevronLeft, ChevronRight, Check } from "lucide-react";
import type { SettingsMenuProps } from "../../types/videoPlayer.types";

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
    showSettingsMenu,
    onToggleSettings,
    settingsRef,
    qualities,
    currentQuality,
    onQualityChange,
    subtitleTracks,
    currentSubtitle,
    onSubtitleChange,
    audioTracks,
    currentAudioTrack,
    onAudioTrackChange,
    playerRef,
}) => {
    const [settingsView, setSettingsView] = useState<"main" | "quality" | "captions" | "audio">("main");

    // Reset view when menu closes - using effect cleanup to avoid setState in effect warning
    useEffect(() => {
        return () => {
            setSettingsView("main");
        };
    }, [showSettingsMenu]);

    const handleQualitySelect = (index: number) => {
        const q = playerRef.current?.qualityLevels() as any;
        if (q) {
            for (let i = 0; i < q.length; i++) {
                q[i].enabled = index === -1 ? true : i === index;
            }
        }
        onQualityChange(index);
        setSettingsView("main");
    };

    const handleSubtitleSelect = (index: number) => {
        onSubtitleChange(index);
        setSettingsView("main");
    };

    const handleAudioSelect = (index: number) => {
        const tracks = playerRef.current?.audioTracks() as any;
        if (tracks && tracks[index]) {
            tracks[index].enabled = true;
            onAudioTrackChange(index);
        }
        setSettingsView("main");
    };

    return (
        <div className="relative">
            <button
                className={`vp-control-btn w-8 h-8 max-[900px]:w-7 max-[900px]:h-7 ${showSettingsMenu ? "active-settings" : "text-zinc-200 hover:text-white"
                    }`}
                onClick={onToggleSettings}
                title="Settings"
            >
                <Settings strokeWidth={1.5} className="w-5 h-5 max-[900px]:w-4 max-[900px]:h-4" />
            </button>

            {showSettingsMenu && (
                <div
                    className="absolute bottom-full right-0 w-48 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl p-1 shadow-2xl z-50 mb-3 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-bottom-right"
                    ref={settingsRef}
                >
                    {/* Main Menu */}
                    {settingsView === "main" && (
                        <div className="flex flex-col gap-0.5">
                            {/* Quality Row */}
                            <button
                                className="w-full flex items-center justify-between px-3 py-2 text-[13px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white rounded-lg transition-all group"
                                onClick={() => setSettingsView("quality")}
                            >
                                <div className="flex items-center gap-2">
                                    <span>Quality</span>
                                </div>
                                <div className="flex items-center gap-1 text-zinc-500 text-[11px] group-hover:text-zinc-400">
                                    <span>
                                        {currentQuality === -1 ? "Auto" : `${qualities[currentQuality]?.height}p`}
                                    </span>
                                    <ChevronRight size={14} />
                                </div>
                            </button>

                            {/* Captions Row */}
                            <button
                                className="w-full flex items-center justify-between px-3 py-2 text-[13px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white rounded-lg transition-all group"
                                onClick={() => setSettingsView("captions")}
                            >
                                <div className="flex items-center gap-2">
                                    <span>Captions</span>
                                </div>
                                <div className="flex items-center gap-1 text-zinc-500 text-[11px] group-hover:text-zinc-400">
                                    <span>
                                        {currentSubtitle === -1
                                            ? "Off"
                                            : subtitleTracks[currentSubtitle]?.label || "On"}
                                    </span>
                                    <ChevronRight size={14} />
                                </div>
                            </button>

                            {/* Audio Row (Conditional) */}
                            {audioTracks.length > 0 && (
                                <button
                                    className="w-full flex items-center justify-between px-3 py-2 text-[13px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white rounded-lg transition-all group"
                                    onClick={() => setSettingsView("audio")}
                                >
                                    <div className="flex items-center gap-2">
                                        <span>Audio</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-zinc-500 text-[11px] group-hover:text-zinc-400">
                                        <span className="max-w-[80px] truncate block text-right">
                                            {currentAudioTrack === -1
                                                ? "Default"
                                                : audioTracks[currentAudioTrack]?.name ||
                                                audioTracks[currentAudioTrack]?.lang ||
                                                `Track ${currentAudioTrack + 1}`}
                                        </span>
                                        <ChevronRight size={14} />
                                    </div>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Quality Submenu */}
                    {settingsView === "quality" && (
                        <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto">
                            <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-white/5">
                                <button
                                    className="p-1 -ml-1 hover:bg-white/10 rounded-md text-zinc-400 hover:text-white transition-colors"
                                    onClick={() => setSettingsView("main")}
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="text-xs font-bold text-white tracking-wide">Quality</span>
                            </div>

                            <button
                                className={`w-full flex items-center justify-between px-3 py-2 text-[12px] font-medium rounded-lg transition-all text-left ${currentQuality === -1
                                    ? "bg-white/10 text-white shadow-sm"
                                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                                    }`}
                                onClick={() => handleQualitySelect(-1)}
                            >
                                <span>Auto</span>
                                {currentQuality === -1 && <Check size={14} />}
                            </button>
                            {qualities.map((q, i) => (
                                <button
                                    key={i}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-[12px] font-medium rounded-lg transition-all text-left ${currentQuality === i
                                        ? "bg-white/10 text-white shadow-sm"
                                        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                                        }`}
                                    onClick={() => handleQualitySelect(i)}
                                >
                                    <span>{q.height}p</span>
                                    {currentQuality === i && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Captions Submenu */}
                    {settingsView === "captions" && (
                        <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto">
                            <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-white/5">
                                <button
                                    className="p-1 -ml-1 hover:bg-white/10 rounded-md text-zinc-400 hover:text-white transition-colors"
                                    onClick={() => setSettingsView("main")}
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="text-xs font-bold text-white tracking-wide">Captions</span>
                            </div>

                            <button
                                className={`w-full flex items-center justify-between px-3 py-2 text-[12px] font-medium rounded-lg transition-all text-left ${currentSubtitle === -1
                                    ? "bg-white/10 text-white shadow-sm"
                                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                                    }`}
                                onClick={() => handleSubtitleSelect(-1)}
                            >
                                <span>Off</span>
                                {currentSubtitle === -1 && <Check size={14} />}
                            </button>

                            {subtitleTracks.map((track, i) => (
                                <button
                                    key={i}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-[12px] font-medium rounded-lg transition-all text-left ${currentSubtitle === i
                                        ? "bg-white/10 text-white shadow-sm"
                                        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                                        }`}
                                    onClick={() => handleSubtitleSelect(i)}
                                >
                                    <span>{track.label}</span>
                                    {currentSubtitle === i && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Audio Submenu */}
                    {settingsView === "audio" && (
                        <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto">
                            <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-white/5">
                                <button
                                    className="p-1 -ml-1 hover:bg-white/10 rounded-md text-zinc-400 hover:text-white transition-colors"
                                    onClick={() => setSettingsView("main")}
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="text-xs font-bold text-white tracking-wide">Audio</span>
                            </div>

                            {audioTracks.map((track, i) => (
                                <button
                                    key={`audio-${i}`}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-[12px] font-medium rounded-lg transition-all text-left ${currentAudioTrack === i
                                        ? "bg-white/10 text-white shadow-sm"
                                        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                                        }`}
                                    onClick={() => handleAudioSelect(i)}
                                >
                                    <span className="truncate pr-2">
                                        {track.name || track.lang || `Track ${i + 1}`}
                                    </span>
                                    {currentAudioTrack === i && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
