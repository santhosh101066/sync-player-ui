export interface ConnectedUser {
    id: number;
    nick: string;
    isAdmin: boolean;
    isMuted: boolean;
}

// --- Messages sent FROM Client TO Server ---
export type ClientMessage =
    | { type: 'identify'; nick: string }
    | { type: 'chat'; text: string; nick: string }
    | { type: 'admin-login'; password: string }
    | { type: 'sync' | 'forceSync'; time: number; paused: boolean; url?: string }
    | { type: 'load'; url: string }
    | { type: 'timeUpdate'; time: number; paused: boolean }
    | { type: 'toggle-user-controls'; value: boolean }
    | { type: 'mute-user'; targetId: number }
    | { type: 'kick-user'; targetId: number }
    | { type: 'toggle-proxy'; value: boolean }
    | { type: 'get-users' }
    | { type: 'ping' } | { type: 'pong' };

// --- Messages received FROM Server BY Client ---
export type ServerMessage =
    | { type: 'welcome'; userId: number }
    | { type: 'user-list'; users: ConnectedUser[] }
    | { type: 'system-state'; userControlsAllowed: boolean; usersControlsAllowed?: boolean; proxyEnabled?: boolean } // Handle potential typo support
    | { type: 'admin-success' }
    | { type: 'admin-fail' }
    | { type: 'chat'; nick: string; text: string; isAdmin?: boolean; isSystem?: boolean }
    | { type: 'sync' | 'forceSync'; time: number; paused: boolean; url?: string } // Server broadcasts these back
    | { type: 'load'; url: string }
    | { type: 'seek' | 'play' | 'pause'; time: number } // Other sync events
    | { type: 'ping' } | { type: 'pong' }; // Other sync events