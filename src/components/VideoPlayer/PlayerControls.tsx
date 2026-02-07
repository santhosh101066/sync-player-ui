import React, { useState, useCallback, useRef, useEffect } from "react";
import {
    Play,
    Pause,
    MicOff,
    Mic,
    Lightbulb,
    Sparkles,
    Maximize,
    Minimize,
} from "lucide-react";
import { TimeSlider } from "./TimeSlider";
import { VolumeControls } from "./VolumeControls";
import { SettingsMenu } from "./SettingsMenu";
import { formatTime } from "../../utils/videoPlayer.utils";
import type { PlayerControlsProps } from "../../types/videoPlayer.types";

export const PlayerControls = React.memo<PlayerControlsProps>(({
    paused,
    volume,
    muted,
    displayTime,
    duration,
    fullscreen,
    isRecording,
    isLocked,
    isIntro,
    ambientMode,
    controlsVisible,
    qualities,
    currentQuality,
    audioTracks,
    currentAudioTrack,
    subtitleTracks,
    currentSubtitle,
    timeSliderRef,
    timeInputRef,
    playerRef,
    onPlayPause,
    onSeek,
    onVolumeChange,
    onToggleMute,
    onToggleFullscreen,
    onToggleMic,
    onToggleAmbient,
    onPlayIntro,
    onQualityChange,
    onSubtitleChange,
    onAudioTrackChange,
}) => {
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [showMobileVolume, setShowMobileVolume] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);

    // Click outside to close settings
    useEffect(() => {
        function handleClickOutside(event: MouseEvent | TouchEvent) {
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                setShowSettingsMenu(false);
            }
        }
        if (showSettingsMenu) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("touchstart", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, [showSettingsMenu]);

    const toggleMobileVolume = useCallback(() => {
        setShowMobileVolume((prev) => !prev);
    }, []);

    return (
        <div
            className={`absolute inset-0 z-30 flex flex-col justify-end pointer-events-none transition-opacity duration-300 ${controlsVisible || paused ? "opacity-100" : "opacity-0"
                }`}
            data-visible={controlsVisible || paused}
        >
            <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent px-6 pb-5 flex flex-col gap-3 pointer-events-auto max-[900px]:px-3 max-[900px]:pb-2.5 max-[900px]:gap-1.5">
                {/* Time Slider */}
                <TimeSlider
                    timeSliderRef={timeSliderRef}
                    timeInputRef={timeInputRef}
                    duration={duration}
                    isLocked={isLocked}
                    onSeek={onSeek}
                />

                {/* Control Bar */}
                <div className="flex items-center justify-between w-full mt-1 max-[900px]:mt-0.5">
                    {/* Left Side Controls */}
                    <div className="flex items-center gap-3 max-[900px]:gap-2">
                        {/* Play/Pause Button */}
                        <button
                            className="vp-control-btn vp-play-btn w-10 h-10 flex items-center justify-center shrink-0 max-[900px]:w-7 max-[900px]:h-7"
                            onClick={onPlayPause}
                            title={isLocked ? "Controls Locked" : paused ? "Play" : "Pause"}
                            style={{
                                opacity: isLocked ? 0.5 : 1,
                                cursor: isLocked ? "not-allowed" : "pointer",
                            }}
                            disabled={isLocked}
                        >
                            {paused ? (
                                <Play
                                    className="w-5 h-5 fill-white text-white max-[900px]:w-3.5 max-[900px]:h-3.5"
                                    strokeWidth={1.5}
                                />
                            ) : (
                                <Pause
                                    className="w-5 h-5 fill-white text-white max-[900px]:w-3.5 max-[900px]:h-3.5"
                                    strokeWidth={1.5}
                                />
                            )}
                        </button>

                        {/* Volume Controls */}
                        <VolumeControls
                            volume={volume}
                            muted={muted}
                            onVolumeChange={onVolumeChange}
                            onToggleMute={onToggleMute}
                            showMobileVolume={showMobileVolume}
                            onToggleMobileVolume={toggleMobileVolume}
                        />

                        {/* Time Display */}
                        <div className="flex gap-1 font-mono text-sm text-zinc-300 pointer-events-none ml-2 max-[900px]:text-xs max-[900px]:ml-1">
                            <span>{formatTime(displayTime)}</span>
                            <span className="opacity-50">/</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Right Side Controls */}
                    <div className="flex items-center gap-3 max-[900px]:gap-0.5">
                        {/* Microphone Toggle */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleMic();
                            }}
                            title={isRecording ? "Mute Mic" : "Unmute Mic"}
                            className={`vp-control-btn w-8 h-8 max-[900px]:w-7 max-[900px]:h-7 ${isRecording ? "active-mic animate-pulse" : "text-zinc-200 hover:text-white"
                                }`}
                        >
                            {isRecording ? (
                                <Mic size={20} strokeWidth={1.5} className="max-[900px]:w-4 max-[900px]:h-4" />
                            ) : (
                                <MicOff size={20} strokeWidth={1.5} className="max-[900px]:w-4 max-[900px]:h-4" />
                            )}
                        </button>

                        {/* Settings Menu */}
                        <SettingsMenu
                            showSettingsMenu={showSettingsMenu}
                            onToggleSettings={() => setShowSettingsMenu(!showSettingsMenu)}
                            settingsRef={settingsRef}
                            qualities={qualities}
                            currentQuality={currentQuality}
                            onQualityChange={onQualityChange}
                            subtitleTracks={subtitleTracks}
                            currentSubtitle={currentSubtitle}
                            onSubtitleChange={onSubtitleChange}
                            audioTracks={audioTracks}
                            currentAudioTrack={currentAudioTrack}
                            onAudioTrackChange={onAudioTrackChange}
                            playerRef={playerRef}
                        />

                        {/* Ambient Mode Toggle */}
                        <button
                            className={`vp-control-btn w-8 h-8 max-[900px]:w-7 max-[900px]:h-7 ${ambientMode ? "active-ambient" : "text-zinc-200 hover:text-white"
                                }`}
                            onClick={onToggleAmbient}
                            title="Toggle Ambient Mode"
                        >
                            <Lightbulb
                                size={20}
                                strokeWidth={1.5}
                                className={`w-5 h-5 max-[900px]:w-4 max-[900px]:h-4 ${ambientMode ? "fill-current" : ""
                                    }`}
                            />
                        </button>

                        {/* Play Intro Button (Only for Admin/Unlocked) */}
                        {!isLocked && (
                            <button
                                className={`vp-control-btn w-8 h-8 max-[900px]:w-7 max-[900px]:h-7 ${isIntro ? "active-ambient" : "text-zinc-200 hover:text-white"
                                    }`}
                                onClick={onPlayIntro}
                                title="Play Intro Loop"
                            >
                                <Sparkles
                                    size={20}
                                    strokeWidth={1.5}
                                    className="w-5 h-5 max-[900px]:w-4 max-[900px]:h-4"
                                />
                            </button>
                        )}

                        {/* Fullscreen Toggle */}
                        <button
                            className="vp-control-btn w-8 h-8 text-zinc-200 hover:text-white max-[900px]:w-7 max-[900px]:h-7"
                            onClick={onToggleFullscreen}
                            title={fullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                        >
                            {fullscreen ? (
                                <Minimize
                                    className="w-5 h-5 max-[900px]:w-4 max-[900px]:h-4"
                                    strokeWidth={1.5}
                                />
                            ) : (
                                <Maximize
                                    className="w-5 h-5 max-[900px]:w-4 max-[900px]:h-4"
                                    strokeWidth={1.5}
                                />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});

PlayerControls.displayName = "PlayerControls";
