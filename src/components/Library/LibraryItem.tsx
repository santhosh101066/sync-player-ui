import { memo } from 'react';
import { Play, FileVideo } from 'lucide-react';

interface LibraryItemProps {
    file: string;
    onPlay: (file: string) => void;
}

export const LibraryItem = memo<LibraryItemProps>(({ file, onPlay }) => {
    return (
        <div
            className="file-item"
            onClick={() => onPlay(file)}
            style={{ minHeight: '60px' }} // Prevent layout shift
        >
            <div className="file-thumb">
                <Play size={24} fill="var(--bg-panel)" />
            </div>
            <div className="file-info">
                <div className="file-name">{file}</div>
                <div className="file-meta" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileVideo size={12} /> Local Video
                </div>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Only re-render if file name changes
    return prevProps.file === nextProps.file;
});

LibraryItem.displayName = 'LibraryItem';
