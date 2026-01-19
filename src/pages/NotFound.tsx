import React from 'react';
import { Home, FileQuestion } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const NotFound: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/20 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center">
                <div className="mb-6 p-6 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl animate-float">
                    <FileQuestion size={64} className="text-purple-400 opacity-80" strokeWidth={1.5} />
                </div>

                <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40 mb-2 tracking-tighter">
                    404
                </h1>

                <h2 className="text-2xl font-bold text-white mb-2">Page Not Found</h2>

                <p className="text-zinc-400 max-w-md mb-8 leading-relaxed">
                    The page you are looking for doesn't exist or has been moved.
                    Let's get you back to the playback.
                </p>

                <button
                    onClick={() => navigate('/')}
                    className="group flex items-center gap-2 px-6 py-3 bg-white text-zinc-950 font-bold rounded-full hover:scale-105 active:scale-95 transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]"
                >
                    <Home size={18} className="transition-transform group-hover:-translate-y-0.5" />
                    <span>Go Home</span>
                </button>
            </div>
        </div>
    );
};
