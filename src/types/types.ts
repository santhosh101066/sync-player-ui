export interface ConnectedUser {
    id: number;
    nick: string;
    isAdmin: boolean;
    isMuted: boolean;
}

// ... ClientMessage stays the same ...
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

export type ServerMessage =
    | { type: 'welcome'; userId: number }
    | { type: 'user-list'; users: ConnectedUser[] }
    | { type: 'system-state'; userControlsAllowed: boolean; proxyEnabled?: boolean }
    | { type: 'admin-success' }
    | { type: 'admin-fail' }
    | { type: 'chat'; nick: string; text: string; isAdmin?: boolean; isSystem?: boolean }
    // ADD THIS NEW TYPE:
    | { type: 'chat-history'; messages: Array<{ nick: string; text: string; isAdmin: boolean; isSystem: boolean; timestamp: number }> }
    | { type: 'sync' | 'forceSync'; time: number; paused: boolean; url?: string }
    | { type: 'load'; url: string }
    | { type: 'kick' }
    | { type: 'ping' } | { type: 'pong' };