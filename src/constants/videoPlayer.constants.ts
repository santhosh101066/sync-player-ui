// ============================================================================
// Video Player Constants
// ============================================================================

export const INTRO_URL = "/intro.mp4";

// Avatar colors for chat messages
export const AVATAR_COLORS = [
    "#f87171", "#fb923c", "#fbbf24", "#a3e635", "#34d399", "#22d3ee",
    "#818cf8", "#c084fc", "#f472b6", "#f43f5e", "#495057",
];

// Sync thresholds (in seconds)
export const HARD_SYNC_THRESHOLD = 0.5;  // Jump to position if drift > 500ms
export const PAUSE_SYNC_THRESHOLD = 0.1; // Sync threshold when paused

export const NORMAL_PLAYBACK_RATE = 1.0;

// UI timing
export const CONTROLS_HIDE_DELAY = 2500; // ms
export const CHAT_MESSAGE_DURATION = 6000; // ms
export const REMOTE_UPDATE_LOCK_DURATION = 1000; // ms
export const SOURCE_SWITCH_LOCK_DURATION = 1500; // ms

// Ambient lighting
export const AMBIENT_FPS = 30;
export const AMBIENT_CANVAS_SIZE = 50;

// Packet age threshold
export const MAX_PACKET_AGE = 2000; // ms - drop packets older than this

// Local interaction cooldown
export const LOCAL_INTERACTION_COOLDOWN = 1000; // ms
