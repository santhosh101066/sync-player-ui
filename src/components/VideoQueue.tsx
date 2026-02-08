import React from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Play, Trash2, GripVertical } from 'lucide-react';
import type { QueueItem } from '../types/types';

interface VideoQueueProps {
    queue: QueueItem[];
    currentIndex: number;
    onRemove: (itemId: string) => void;
    onReorder: (fromIndex: number, toIndex: number) => void;
    onPlayNow: (item: QueueItem) => void;
    isAdmin: boolean;
}

interface SortableItemProps {
    item: QueueItem;
    index: number;
    isCurrent: boolean;
    isAdmin: boolean;
    onRemove: (itemId: string) => void;
    onPlayNow: (item: QueueItem) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({
    item,
    index,
    isCurrent,
    isAdmin,
    onRemove,
    onPlayNow
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id, disabled: !isAdmin });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group relative flex items-center gap-3 p-3 rounded-lg border transition-all ${isCurrent
                ? 'bg-indigo-500/20 border-indigo-500/50'
                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
        >
            {/* Drag Handle (Admin Only) */}
            {isAdmin && (
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-zinc-500 hover:text-white transition-colors"
                >
                    <GripVertical size={18} />
                </div>
            )}

            {/* Thumbnail */}
            <div className="relative w-20 h-12 rounded overflow-hidden bg-black flex-shrink-0">
                <img
                    src={item.thumbnail}
                    alt={item.title}
                    className="w-full h-full object-cover"
                />
                {isCurrent && (
                    <div className="absolute inset-0 bg-indigo-500/30 flex items-center justify-center">
                        <Play size={16} className="text-white" fill="white" />
                    </div>
                )}
                <div className="absolute bottom-0.5 right-0.5 bg-black/80 px-1 py-0.5 text-[9px] font-bold text-white rounded">
                    {item.duration}
                </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-white line-clamp-1 leading-tight">
                    {item.title}
                </h4>
                <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">
                    {item.author}
                </p>
            </div>

            {/* Position Indicator */}
            <div className="text-xs font-bold text-zinc-600 tabular-nums">
                #{index + 1}
            </div>

            {/* Admin Actions */}
            {isAdmin && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isCurrent && (
                        <button
                            onClick={() => onPlayNow(item)}
                            className="p-1.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 hover:text-indigo-300 transition-colors"
                            title="Play Now"
                        >
                            <Play size={14} />
                        </button>
                    )}
                    <button
                        onClick={() => onRemove(item.id)}
                        className="p-1.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-colors"
                        title="Remove"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            )}
        </div>
    );
};

export const VideoQueue: React.FC<VideoQueueProps> = ({
    queue,
    currentIndex,
    onRemove,
    onReorder,
    onPlayNow,
    isAdmin
}) => {
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    const handleDragEnd = (event: any) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = queue.findIndex((item) => item.id === active.id);
            const newIndex = queue.findIndex((item) => item.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                onReorder(oldIndex, newIndex);
            }
        }
    };

    if (queue.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-3 p-8">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                    <Play size={28} className="opacity-20" />
                </div>
                <p className="text-sm font-medium text-center">
                    Queue is empty
                </p>
                <p className="text-xs text-center text-zinc-700">
                    Add videos from YouTube browser
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-white/10">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Play size={16} className="text-indigo-400" />
                    Queue ({queue.length})
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={queue.map((item) => item.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {queue.map((item, index) => (
                            <SortableItem
                                key={item.id}
                                item={item}
                                index={index}
                                isCurrent={index === currentIndex}
                                isAdmin={isAdmin}
                                onRemove={onRemove}
                                onPlayNow={onPlayNow}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </div>
        </div>
    );
};
