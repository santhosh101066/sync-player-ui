/* eslint-disable @typescript-eslint/no-explicit-any */
import type Player from "video.js/dist/types/player";

// ============================================================================
// Main Component Props
// ============================================================================

export interface VideoPlayerProps {
    activeSpeakers: string[];
    isRecording: boolean;
    toggleMic: () => void;
}

// ============================================================================
// Floating Chat Message
// ============================================================================

export interface FloatingMessage {
    id: number;
    nick: string;
    text: string;
    color: string;
}

// ============================================================================
// Video Sync Hook State
// ============================================================================

export interface VideoSyncState {
    // Player refs
    playerRef: React.RefObject<Player | null>;
    videoContainerRef: React.RefObject<HTMLDivElement>;
    canvasRef: React.RefObject<HTMLCanvasElement>;
    timeSliderRef: React.RefObject<HTMLDivElement>;
    timeInputRef: React.RefObject<HTMLInputElement>;

    // Player state
    isPlayerReady: boolean;
    paused: boolean;
    muted: boolean;
    volume: number;
    displayTime: number;
    duration: number;
    isIntro: boolean;

    // Quality & Tracks
    qualities: any[];
    currentQuality: number;
    audioTracks: any[];
    currentAudioTrack: number;
    subtitleTracks: any[];
    currentSubtitle: number;

    // Handlers
    togglePlay: (e?: React.MouseEvent | React.TouchEvent | any) => Promise<void>;
    handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleVolumeChange: (newVol: number) => void;
    handleToggleMute: () => void;
    handlePlayIntro: () => void;
    setCurrentQuality: (index: number) => void;
    setCurrentSubtitle: (index: number) => void;
    setCurrentAudioTrack: (index: number) => void;
    toggleSubtitle: (index: number) => void;
    updateSliderVisuals: (currentTime: number, maxDuration: number, buffered: number) => void;
}

// ============================================================================
// Sub-Component Props
// ============================================================================

export interface VideoSurfaceProps {
    playerRef: React.RefObject<Player | null>;
    videoContainerRef: React.RefObject<HTMLDivElement>;
    canvasRef: React.RefObject<HTMLCanvasElement>;
    ambientMode: boolean;
    isPlayerReady: boolean;
    isLocked: boolean;
    onToggleFullscreen: () => void;
}

export interface PlayerControlsProps {
    // State
    paused: boolean;
    volume: number;
    muted: boolean;
    displayTime: number;
    duration: number;
    fullscreen: boolean;
    isRecording: boolean;
    isLocked: boolean;
    isIntro: boolean;
    ambientMode: boolean;
    controlsVisible: boolean;

    // Quality & Tracks
    qualities: any[];
    currentQuality: number;
    audioTracks: any[];
    currentAudioTrack: number;
    subtitleTracks: any[];
    currentSubtitle: number;

    // Refs
    timeSliderRef: React.RefObject<HTMLDivElement>;
    timeInputRef: React.RefObject<HTMLInputElement>;
    playerRef: React.RefObject<Player | null>;

    // Handlers
    onPlayPause: (e?: React.MouseEvent | React.TouchEvent | any) => Promise<void>;
    onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onVolumeChange: (vol: number) => void;
    onToggleMute: () => void;
    onToggleFullscreen: () => void;
    onToggleMic: () => void;
    onToggleAmbient: () => void;
    onPlayIntro: () => void;
    onQualityChange: (index: number) => void;
    onSubtitleChange: (index: number) => void;
    onAudioTrackChange: (index: number) => void;
}

export interface TimeSliderProps {
    timeSliderRef: React.RefObject<HTMLDivElement>;
    timeInputRef: React.RefObject<HTMLInputElement>;
    duration: number;
    isLocked: boolean;
    onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface VolumeControlsProps {
    volume: number;
    muted: boolean;
    onVolumeChange: (vol: number) => void;
    onToggleMute: () => void;
    showMobileVolume: boolean;
    onToggleMobileVolume: () => void;
}

export interface SettingsMenuProps {
    showSettingsMenu: boolean;
    onToggleSettings: () => void;
    settingsRef: React.RefObject<HTMLDivElement>;

    // Quality
    qualities: any[];
    currentQuality: number;
    onQualityChange: (index: number) => void;

    // Subtitles
    subtitleTracks: any[];
    currentSubtitle: number;
    onSubtitleChange: (index: number) => void;

    // Audio
    audioTracks: any[];
    currentAudioTrack: number;
    onAudioTrackChange: (index: number) => void;

    // Player ref for direct manipulation
    playerRef: React.RefObject<Player | null>;
}

export interface SyncOverlayProps {
    isBuffering: boolean;
    syncMessage?: string;
    isAdmin: boolean;
    showAdminToast: boolean;
}

export interface ChatOverlayProps {
    messages: FloatingMessage[];
}

export interface StatusIndicatorsProps {
    isConnected: boolean;
    isLocked: boolean;
    activeSpeakers: string[];
    controlsVisible: boolean;
    paused: boolean;
}
