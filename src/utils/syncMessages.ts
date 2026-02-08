import { SyncState } from '../types/videoPlayer.types';

export interface SyncMessageConfig {
    title: string;
    description: string;
    icon: 'spinner' | 'pulse' | 'checkmark' | 'users';
    variant: 'buffering' | 'waiting' | 'ready' | 'success';
}

export const getSyncMessage = (
    syncState: SyncState,
    isBuffering: boolean,
    participantCount?: { ready: number; total: number }
): SyncMessageConfig | null => {
    // INITIAL_SYNC + Buffering = Local buffering
    if (syncState === SyncState.INITIAL_SYNC && isBuffering) {
        return {
            title: 'Buffering',
            description: 'Loading video content...',
            icon: 'spinner',
            variant: 'buffering'
        };
    }

    // INITIAL_SYNC + Not buffering = Waiting for participants
    if (syncState === SyncState.INITIAL_SYNC && !isBuffering) {
        const desc = participantCount
            ? `Waiting for ${participantCount.ready} of ${participantCount.total} participants...`
            : 'Waiting for all users...';

        return {
            title: 'Syncing Playback',
            description: desc,
            icon: 'users',
            variant: 'waiting'
        };
    }

    // SYNCED = Ready state (shows briefly before auto-dismiss)
    if (syncState === SyncState.SYNCED) {
        return null;
    }

    // IDLE = Default (shouldn't show toast)
    // IDLE = Default (shouldn't show toast)
    return null;
};
