import React, { useState } from "react";
import { Search, X, Play, Loader2 } from "lucide-react";

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
  onSelectVideo: (url: string) => void;
  isAdmin: boolean;
}

const YouTubeBrowser: React.FC<YouTubeBrowserProps> = ({ isOpen, onClose, onSelectVideo, isAdmin }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.videos) {
        setResults(data.videos);
      }
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (video: VideoResult) => {
    // Only admins can select/load videos
    if (!isAdmin) return;

    // Directly use the YouTube URL instead of resolving it.
    // VideoPlayer will handle proxying if needed.
    const url = `https://www.youtube.com/watch?v=${video.id}`;
    onSelectVideo(url);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#18181b] border border-white/10 w-full max-w-4xl h-[80vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center gap-4 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
              <Play fill="white" className="text-white ml-0.5" size={16} />
            </div>
            <h2 className="font-bold text-lg text-white">YouTube Browser</h2>
          </div>

          <form onSubmit={handleSearch} className="flex-1 relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-white transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search videos..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-full py-2 pl-4 text-sm text-white focus:outline-none focus:border-red-500/50 transition-all font-medium"
              style={{ paddingLeft: '3rem' }} // Force padding for icon
              autoFocus
            />
          </form>

          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-3">
              <Loader2 className="animate-spin" size={32} />
              <p className="text-sm font-medium">Searching YouTube...</p>
            </div>
          ) : results.length > 0 ? (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }} // Robust grid
            >
              {results.map((video) => (
                <div
                  key={video.id}
                  className={`group relative bg - zinc - 900 / 50 border border - white / 5 rounded - lg overflow - hidden cursor - pointer hover: border - red - 500 / 50 transition - all ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => handleSelect(video)}
                  style={{ display: 'flex', flexDirection: 'column' }}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video relative overflow-hidden bg-black w-full">
                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-bold text-white">
                      {video.duration}
                    </div>
                  </div>

                  {/* Info */}
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
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-2">
              <Search size={48} className="opacity-20" />
              <p className="text-sm font-medium">Search for something to watch</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default YouTubeBrowser;
