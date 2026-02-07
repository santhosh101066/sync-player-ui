import { AVATAR_COLORS } from "../constants/videoPlayer.constants";

// ============================================================================
// Time Formatting
// ============================================================================

export const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return "0:00";

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
        return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// ============================================================================
// Avatar Color Generation
// ============================================================================

export const getAvatarColor = (name: string): string => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// ============================================================================
// Slider Visual Updates (Direct CSS)
// ============================================================================

export const updateSliderVisuals = (
    timeSliderRef: React.RefObject<HTMLDivElement>,
    timeInputRef: React.RefObject<HTMLInputElement>,
    currentTime: number,
    maxDuration: number,
    buffered: number
): void => {
    if (timeSliderRef.current) {
        const fillPercent = maxDuration > 0 ? (currentTime / maxDuration) * 100 : 0;
        const buffPercent = maxDuration > 0 ? (buffered / maxDuration) * 100 : 0;

        timeSliderRef.current.style.setProperty('--slider-fill', `${fillPercent}%`);
        timeSliderRef.current.style.setProperty('--slider-progress', `${buffPercent}%`);
    }
    if (timeInputRef.current) {
        timeInputRef.current.value = currentTime.toString();
    }
};

// ============================================================================
// Video Type Detection
// ============================================================================

export const determineVideoType = (url: string): string => {
    // Check for extension before query params (e.g. video.mp4?token=123)
    const cleanUrl = url.split('?')[0].toLowerCase();

    // Check for YouTube (Standard or Proxied)
    if (
        url.includes('youtube.com') ||
        url.includes('youtu.be') ||
        url.includes('/api/youtube/stream')
    ) {
        return 'video/mp4'; // Direct stream fallback
    }

    if (url.includes('/api/youtube/dash/manifest.mpd')) {
        return 'application/dash+xml';
    }

    // File extensions
    if (cleanUrl.endsWith('.mp4')) return 'video/mp4';
    if (cleanUrl.endsWith('.webm')) return 'video/webm';
    if (cleanUrl.endsWith('.mkv')) return 'video/x-matroska';
    if (cleanUrl.endsWith('.mov')) return 'video/quicktime';

    // Default to HLS
    return 'application/x-mpegURL';
};

// ============================================================================
// YouTube Video ID Extraction
// ============================================================================

export const extractYouTubeVideoId = (url: string): string | null => {
    try {
        if (url.includes("youtu.be")) {
            return url.split("youtu.be/")[1]?.split("?")[0] || null;
        } else {
            const urlObj = new URL(url);
            return urlObj.searchParams.get("v");
        }
    } catch (e) {
        return null;
    }
};
