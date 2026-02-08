import { useState, useEffect } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { useToast } from '../context/ToastContext';
import type { QueueItem, QueueVideo } from '../types/types';

export const useQueue = () => {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const { send, lastMessage, isAdmin } = useWebSocket();
    const { showToast } = useToast();

    // Listen for queue state updates from server
    useEffect(() => {
        if (lastMessage?.type === 'queue-state') {
            setQueue(lastMessage.queue);
            setCurrentIndex(lastMessage.currentIndex);
        }
    }, [lastMessage]);

    // Request initial queue state on mount
    useEffect(() => {
        send({ type: 'queue-get' });
    }, [send]);

    // Queue operations
    const addToQueue = (video: QueueVideo) => {
        send({ type: 'queue-add', video });
        showToast(`Added "${video.title}" to queue`, 'success');
    };

    const playNext = (video: QueueVideo) => {
        if (!isAdmin) return;
        send({ type: 'queue-play-next', video });
        showToast(`"${video.title}" will play next`, 'info');
    };

    const playNow = (video: QueueVideo) => {
        if (!isAdmin) return;
        send({ type: 'queue-play-now', video });
        showToast(`Playing "${video.title}" now`, 'info');
    };

    const removeItem = (itemId: string) => {
        if (!isAdmin) return;
        const item = queue.find(q => q.id === itemId);
        send({ type: 'queue-remove', itemId });
        if (item) {
            showToast(`Removed "${item.title}" from queue`, 'info');
        }
    };

    const reorderQueue = (fromIndex: number, toIndex: number) => {
        if (!isAdmin) return;
        send({ type: 'queue-reorder', fromIndex, toIndex });
        showToast('Queue reordered', 'success');
    };

    return {
        queue,
        currentIndex,
        addToQueue,
        playNext,
        playNow,
        removeItem,
        reorderQueue,
        isAdmin
    };
};
