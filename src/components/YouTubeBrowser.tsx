import React, { useState, useRef, useCallback } from "react";
import { Search, X, Play, Loader2, Plus, Zap, MoreVertical } from "lucide-react";
import type { QueueVideo } from "../types/types";

interface VideoResult {
  id: string;
  title: string;
  thumbnail: string;
  author: string;
  duration: string;
  views: number;
}

interface YouTubeBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToQueue: (video: QueueVideo) => void;
  onPlayNext?: (video: QueueVideo) => void;
  onPlayNow?: (video: QueueVideo) => void;
  isAdmin: boolean;
}

interface ContextMenuProps {
  video: VideoResult;
  onPlayNow: () => void;
  onPlayNext: () => void;
  onAddToQueue: () => void;
  onClose: () => void;
  position: { x: number; y: number };
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  onPlayNow,
  onPlayNext,
  onAddToQueue,
  onClose,
  position
}) => {
  return (
    <>
      <div className="fixed inset-0 z-[110]" onClick={onClose} />
      <div
        className="fixed z-[120] bg-zinc-900 border border-white/10 rounded-lg shadow-2xl py-1 min-w-[160px]"
        style={{ left: position.x, top: position.y }}
      >
        <button
          onClick={onPlayNow}
          className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
        >
          <Play size={14} />
          Play Now
        </button>
        <button
          onClick={onPlayNext}
          className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
        >
          <Zap size={14} />
          Play Next
        </button>
        <div className="h-px bg-white/10 my-1" />
        <button
          onClick={onAddToQueue}
          className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
        >
          <Plus size={14} />
          Add to Queue
        </button>
      </div>
    </>
  );
};

const YouTubeBrowser: React.FC<YouTubeBrowserProps> = ({
  isOpen,
  onClose,
  onAddToQueue,
  onPlayNext,
  onPlayNow,
  isAdmin
}) => {
  // Early return BEFORE any hooks
  if (!isOpen) return null;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [contextMenu, setContextMenu] = useState<{
    video: VideoResult;
    position: { x: number; y: number };
  } | null>(null);

  const observer = useRef<IntersectionObserver | null>(null);

  const handleSearch = async (e?: React.FormEvent, resetResults = true) => {
    e?.preventDefault();
    if (!query.trim()) return;

    if (resetResults) {
      setResults([]);
      setPage(1);
      setHasMore(true);
    }

    setLoading(resetResults);
    setLoadingMore(!resetResults);

    try {
      const currentPage = resetResults ? 1 : page;
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}&page=${currentPage}`);
      const data = await res.json();

      if (data.videos) {
        if (resetResults) {
          setResults(data.videos);
        } else {
          setResults(prev => [...prev, ...data.videos]);
        }

        setHasMore(data.hasMore ?? false);
        setPage(currentPage + 1);
      }
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && query.trim()) {
      handleSearch(undefined, false);
    }
  }, [loadingMore, hasMore, query, page]);

  const lastVideoRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    });

    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore, loadMore]);

  const videoToQueueVideo = (video: VideoResult): QueueVideo => ({
    videoId: video.id,
    url: `https://www.youtube.com/watch?v=${video.id}`,
    title: video.title,
    thumbnail: video.thumbnail,
    author: video.author,
    duration: video.duration
  });

  const handleContextMenu = (e: React.MouseEvent, video: VideoResult) => {
    if (!isAdmin) return;
    e.preventDefault();
    setContextMenu({
      video,
      position: { x: e.clientX, y: e.clientY }
    });
  };

  const handleVideoClick = (video: VideoResult) => {
    onAddToQueue(videoToQueueVideo(video));
  };

  const handlePlayNow = () => {
    if (contextMenu && onPlayNow) {
      onPlayNow(videoToQueueVideo(contextMenu.video));
      setContextMenu(null);
      onClose();
    }
  };

  const handlePlayNext = () => {
    if (contextMenu && onPlayNext) {
      onPlayNext(videoToQueueVideo(contextMenu.video));
      setContextMenu(null);
    }
  };

  const handleAddToQueue = () => {
    if (contextMenu) {
      onAddToQueue(videoToQueueVideo(contextMenu.video));
      setContextMenu(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#18181b] border border-white/10 w-full max-w-4xl h-[80vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center gap-4 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
              <Play fill="white" className="text-white ml-0.5" size={16} />
            </div>
            <h2 className="font-bold text-lg text-white">YouTube Browser</h2>
          </div>

          <form onSubmit={(e) => handleSearch(e, true)} className="flex-1 relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-white transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search videos..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-full py-2 pl-4 text-sm text-white focus:outline-none focus:border-red-500/50 transition-all font-medium"
              style={{ paddingLeft: '3rem' }}
              autoFocus
            />
          </form>

          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-3">
              <Loader2 className="animate-spin" size={32} />
              <p className="text-sm font-medium">Searching YouTube...</p>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {results.map((video, index) => (
                  <div
                    key={`${video.id}-${index}`}
                    ref={index === results.length - 1 ? lastVideoRef : null}
                    className="group relative bg-zinc-900/50 border border-white/5 rounded-lg overflow-hidden cursor-pointer hover:border-red-500/50 transition-all"
                    onClick={() => handleVideoClick(video)}
                    onContextMenu={(e) => handleContextMenu(e, video)}
                    style={{ display: 'flex', flexDirection: 'column' }}
                  >
                    <div className="aspect-video relative overflow-hidden bg-black w-full">
                      <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-bold text-white">
                        {video.duration}
                      </div>

                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                          <Plus size={20} className="text-white" />
                        </div>
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleContextMenu(e, video);
                            }}
                            className="bg-white/20 backdrop-blur-sm rounded-full p-2 hover:bg-white/30 transition-colors"
                          >
                            <MoreVertical size={20} className="text-white" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <h3 className="text-sm font-medium text-white line-clamp-2 leading-tight mb-1 group-hover:text-red-400 transition-colors">{video.title}</h3>
                      <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-auto">
                        <span>{video.author}</span>
                        <span>{(video.views || 0).toLocaleString()} views</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {loadingMore && (
                <div className="flex items-center justify-center py-8 gap-2 text-zinc-500">
                  <Loader2 className="animate-spin" size={20} />
                  <span className="text-sm">Loading more...</span>
                </div>
              )}

              {!hasMore && results.length > 0 && (
                <div className="flex items-center justify-center py-8 text-zinc-600">
                  <span className="text-sm">No more results</span>
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-2">
              <Search size={48} className="opacity-20" />
              <p className="text-sm font-medium">Search for something to watch</p>
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          video={contextMenu.video}
          onPlayNow={handlePlayNow}
          onPlayNext={handlePlayNext}
          onAddToQueue={handleAddToQueue}
          onClose={() => setContextMenu(null)}
          position={contextMenu.position}
        />
      )}
    </div>
  );
};

export default YouTubeBrowser;
