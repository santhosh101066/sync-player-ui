export interface ConnectedUser {
    id: string;  // Changed from number to string (hashed Google ID)
    nick: string;
    isAdmin: boolean;
    isMuted: boolean;
    picture?: string;
}

export interface QueueVideo {
    videoId: string;
    url: string;
    title: string;
    thumbnail: string;
    author: string;
    duration: string;
}

export interface QueueItem extends QueueVideo {
    id: string;
    addedBy: string;
    addedAt: number;
}

// ... ClientMessage stays the same ...
export type ClientMessage =
    | { type: 'identify'; nick: string }
    | { type: 'chat'; text: string; nick: string; image?: string; picture?: string }
    | { type: 'admin-login'; password: string }
    | { type: 'sync' | 'forceSync'; time: number; paused: boolean; url?: string }
    | { type: 'load'; url: string }
    | { type: 'timeUpdate'; time: number; paused: boolean }
    | { type: 'toggle-user-controls'; value: boolean }
    | { type: 'mute-user'; targetId: string }  // Changed from number to string
    | { type: 'kick-user'; targetId: string }  // Changed from number to string
    | { type: 'toggle-proxy'; value: boolean }
    | { type: 'get-users' }
    | { type: 'queue-add'; video: QueueVideo }
    | { type: 'queue-play-next'; video: QueueVideo }
    | { type: 'queue-play-now'; video: QueueVideo }
    | { type: 'queue-remove'; itemId: string }
    | { type: 'queue-reorder'; fromIndex: number; toIndex: number }
    | { type: 'queue-get' }
    | { type: 'video-ended' }
    | { type: 'ping' } | { type: 'pong' };

export type ServerMessage =
    | { type: 'welcome'; userId: string }  // Changed from number to string
    | { type: 'user-list'; users: ConnectedUser[] }
    | { type: 'system-state'; userControlsAllowed: boolean; proxyEnabled?: boolean }
    | { type: 'admin-success' }
    | { type: 'admin-fail' }
    | { type: 'chat'; nick: string; text: string; isAdmin?: boolean; isSystem?: boolean; image?: string; picture?: string }
    // ADD THIS NEW TYPE:
    | { type: 'chat-history'; messages: Array<{ nick: string; text: string; isAdmin: boolean; isSystem: boolean; timestamp: number; image?: string; picture?: string }> }
    | { type: 'sync' | 'forceSync'; time: number; paused: boolean; url?: string }
    | { type: 'load'; url: string }
    | { type: 'kick' }
    | { type: 'session-replaced'; text: string }  // NEW: notify user of session replacement
    | { type: 'queue-state'; queue: QueueItem[]; currentIndex: number }
    | { type: 'ping' } | { type: 'pong' }
    | { type: 'auth-success'; nick: string; picture?: string; email?: string; userId?: string };