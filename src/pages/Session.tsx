import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from "../context/WebSocketContext";
import { VideoPlayer } from "../components/VideoPlayer";
import { Chat } from "../components/Chat";
import { Library } from "../components/Library";
import { AdminDashboard } from "../components/AdminDashboard";
import { UserList } from "../components/UserList";
import { useAudio } from "../hooks/useAudio";
import {
    Mic,
    MicOff,
    Shield,
    MessageSquare,
    FolderOpen,
    Volume2,
    Link as LinkIcon,
    Zap,
    RefreshCw,
    VolumeX,
    Users,
    Unlock,
    Lock,
    Globe,
    Settings2,
    X,
} from "lucide-react";
import "../App.css";
import "../App.css";


// Define a type guard for messages that might contain URLs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const msgHasUrl = (msg: any): msg is { url: string; type: string } => {
    return (
        msg &&
        (msg.type === "sync" || msg.type === "forceSync" || msg.type === "load") &&
        typeof msg.url === "string"
    );
};

export const Session: React.FC = () => {
    const navigate = useNavigate();
    // 1. Data Layer
    const {
        send,
        isAdmin,
        userControlsAllowed,
        proxyEnabled,
        lastMessage,
        nickname,
        userPicture,
        isConnected
    } = useWebSocket();

    // 2. Audio Layer
    const {
        toggleMic,
        isRecording,
        setVolume,
        volume,
        initAudio,
        activeSpeakers,
        audioBlocked,
    } = useAudio();

    // 3. UI State
    useEffect(() => {
        if (!isConnected) {
            navigate('/');
        }

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = ''; // Chrome requires returnValue to be set
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isConnected, navigate]);

    // 4. Form Inputs
    const [showAdminDashboard, setShowAdminDashboard] = useState(false);
    const [showMobileControls, setShowMobileControls] = useState(false);
    const [activeTab, setActiveTab] = useState<"chat" | "library" | "users">(
        "chat"
    );
    // 4. Form Inputs
    const [urlInput, setUrlInput] = useState("");
    const currentServerUrlRef = useRef(""); // To prevent overwriting user input

    // --- Effect: Sync Input Box with Actual Playing Video ---
    // --- Effect: Sync Input Box with Actual Playing Video ---
    useEffect(() => {
        if (!lastMessage || !msgHasUrl(lastMessage)) return;

        // Update input IF the server says we are playing a different URL than what we last KNEW about
        if (lastMessage.url && lastMessage.url !== currentServerUrlRef.current) {

            // Ignore intro URL updates in the input box to keep it clean
            if (!lastMessage.url.includes("/intro.mp4")) {
                setUrlInput(lastMessage.url);
                currentServerUrlRef.current = lastMessage.url;
            }
        }
    }, [lastMessage]);

    // --- Actions ---
    // (handleJoin removed)

    const toggleUserControls = () => {
        send({ type: "toggle-user-controls", value: !userControlsAllowed });
    };

    const toggleProxy = () => {
        send({ type: "toggle-proxy", value: !proxyEnabled });
    };

    const handleManualLoad = () => {
        if (urlInput) {
            // 1. Send load command via WebSocket for sync [cite: 353]
            send({ type: "load", url: urlInput });

            // 2. [FIX] Dispatch local event to force the VideoPlayer component to load/play immediately
            window.dispatchEvent(
                new CustomEvent("play-video", {
                    detail: { url: urlInput, autoPlay: true },
                })
            );
        }
    };

    const handleSync = () => {
        // Dispatch a custom event that VideoPlayer will listen for
        window.dispatchEvent(new CustomEvent("trigger-force-sync"));
    };


    return (
        <div className="app-layout">

            {showAdminDashboard && (
                <AdminDashboard onClose={() => setShowAdminDashboard(false)} />
            )}

            {audioBlocked && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full z-50 shadow-lg flex items-center gap-3 cursor-pointer animate-in fade-in slide-in-from-top-4" onClick={() => initAudio()}>
                    <VolumeX size={20} strokeWidth={1.5} />
                    <span className="font-semibold">
                        Audio is blocked! Click here to listen.
                    </span>
                </div>
            )}

            {/* --- Header (Unified Toolbar) --- */}
            <div className="w-full h-16 px-3 md:px-6 flex items-center justify-between gap-4 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 z-50 relative">

                {/* LEFT: Branding */}
                <div className="flex items-center gap-6 shrink-0 z-10">
                    <img src="/logo.svg" alt="App Logo" className="h-7 w-auto md:h-8 hover:scale-105 transition-transform cursor-pointer" />
                </div>

                {/* CENTER: URL Input (Collapsible on Mobile & Tablet) */}
                <div className={`flex-1 max-w-2xl px-4 flex justify-center transition-all duration-300 ${showMobileControls ? 'absolute top-16 left-0 w-full bg-zinc-950/90 p-4 border-b border-white/5 flex flex-col gap-3' : 'hidden lg:flex'}`}>

                    {/* Mobile Title */}
                    <div className="lg:hidden text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Stream Settings</div>

                    {isAdmin ? (
                        <div className="w-full max-w-xl relative flex items-center gap-2 bg-white/5 border border-white/5 rounded-lg p-1.5 focus-within:bg-zinc-900 focus-within:border-indigo-500/50 transition-all">
                            <LinkIcon size={16} className="text-zinc-500 ml-2" />
                            <input
                                type="text"
                                placeholder="Paste stream URL..."
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-zinc-600 font-medium h-full"
                            />
                            <button
                                onClick={handleManualLoad}
                                className="px-3 h-8 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-md transition-colors flex items-center gap-2"
                            >
                                <RefreshCw size={14} className={!urlInput ? "" : "animate-[spin_1s_ease-out]"} />
                                <span>LOAD</span>
                            </button>
                        </div>
                    ) : userControlsAllowed ? (
                        <div className="hidden lg:flex items-center gap-2 text-green-400/50 text-sm font-medium select-none">
                            <Unlock size={14} />
                            <span>Controls enabled</span>
                        </div>
                    ) : (
                        <div className="hidden lg:flex items-center gap-2 text-white/20 text-sm font-medium select-none">
                            <Lock size={14} />
                            <span>Controls restricted to admin</span>
                        </div>
                    )}

                    {/* Mobile-only Controls Section */}
                    {showMobileControls && (
                        <div className="lg:hidden flex flex-col gap-4 mt-2">
                            <div className="h-px w-full bg-white/10" />

                            {/* Admin Controls Mobile */}
                            {isAdmin && (
                                <div>
                                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Admin Controls</div>
                                    <div className="flex items-center justify-between gap-2">
                                        <button onClick={handleSync} className="flex-1 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center text-amber-500 gap-2"><Zap size={18} /> Sync</button>
                                        <button onClick={toggleUserControls} className={`flex-1 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center gap-2 ${userControlsAllowed ? "text-green-400" : "text-red-400"}`}>
                                            {userControlsAllowed ? <Unlock size={18} /> : <Lock size={18} />} Lock
                                        </button>
                                        <button onClick={toggleProxy} className={`flex-1 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center gap-2 ${proxyEnabled ? "text-indigo-400" : "text-zinc-400"}`}>
                                            <Globe size={18} /> Proxy
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Audio Controls Mobile */}
                            <div>
                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Audio</div>
                                <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                                    <button onClick={toggleMic} className={`p-2 rounded-lg ${isRecording ? "bg-red-500 text-white" : "bg-white/10 text-zinc-400"}`}>
                                        {isRecording ? <Mic size={18} /> : <MicOff size={18} />}
                                    </button>
                                    <div className="flex-1 flex items-center gap-2">
                                        <Volume2 size={18} className="text-zinc-400" />
                                        <div className="w-full h-8 flex items-center relative opacity-100">
                                            <input
                                                type="range"
                                                min="0"
                                                max="2"
                                                step="0.01"
                                                value={volume}
                                                onInput={(e) => setVolume(parseFloat(e.currentTarget.value))}
                                                className="absolute inset-0 w-full h-full opacity-0 z-[100] cursor-pointer"
                                            />
                                            <div className="w-full h-1 bg-white/30 !rounded-full relative cursor-pointer">
                                                <div className="absolute top-0 left-0 h-full bg-white !rounded-full pointer-events-none" style={{ width: `${(volume / 2) * 100}%` }} />
                                                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white !rounded-full pointer-events-none shadow-sm left-[var(--slider-fill)]" style={{ left: `${(volume / 2) * 100}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT: Desktop Controls & Profile */}
                <div className="flex items-center gap-4 z-10">

                    {/* Desktop Controls (Hidden on mobile & tablet) */}
                    <div className="hidden lg:flex items-center gap-2">
                        {isAdmin && (
                            <>
                                <button onClick={handleSync} className="hover:bg-white/10 p-2 rounded-lg text-zinc-400 hover:text-amber-500 transition-colors" title="Force Sync"><Zap size={18} /></button>
                                <button onClick={toggleUserControls} className={`hover:bg-white/10 p-2 rounded-lg transition-colors ${userControlsAllowed ? "text-green-400" : "text-red-400"}`} title="Lock Controls">
                                    {userControlsAllowed ? <Unlock size={18} /> : <Lock size={18} />}
                                </button>
                                <button onClick={toggleProxy} className={`hover:bg-white/10 p-2 rounded-lg transition-colors ${proxyEnabled ? "text-indigo-400" : "text-zinc-400 hover:text-white"}`} title="Proxy">
                                    <Globe size={18} />
                                </button>
                                <div className="w-px h-6 bg-white/10 mx-1" />
                            </>
                        )}

                        {/* Audio Desk */}
                        <div className="flex items-center gap-2">
                            <button onClick={toggleMic} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${isRecording ? "bg-red-500 text-white" : "hover:bg-white/10 text-zinc-400 hover:text-white"}`}>
                                {isRecording ? <Mic size={16} className="animate-pulse" /> : <MicOff size={16} />}
                                <span>{isRecording ? "LIVE" : "MUTE"}</span>
                            </button>
                            <div className="w-24 group flex items-center gap-2 p-1">
                                <Volume2 size={16} className="text-zinc-400" />
                                <div className="w-full h-8 flex items-center relative opacity-100">
                                    <input
                                        type="range"
                                        min="0"
                                        max="2"
                                        step="0.01"
                                        value={volume}
                                        onInput={(e) => setVolume(parseFloat(e.currentTarget.value))}
                                        className="absolute inset-0 w-full h-full opacity-0 z-[100] cursor-pointer"
                                    />
                                    <div className="w-full h-1 bg-white/30 !rounded-full relative cursor-pointer">
                                        <div className="absolute top-0 left-0 h-full bg-white !rounded-full pointer-events-none" style={{ width: `${(volume / 2) * 100}%` }} />
                                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white !rounded-full pointer-events-none shadow-sm left-[var(--slider-fill)]" style={{ left: `${(volume / 2) * 100}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {isAdmin && (
                            <>
                                <div className="w-px h-6 bg-white/10 mx-1" />
                                <button onClick={() => setShowAdminDashboard(true)} className="hover:bg-white/10 p-2 rounded-lg text-zinc-400 hover:text-white transition-colors" title="Dashboard">
                                    <Shield size={18} />
                                </button>
                            </>
                        )}
                    </div>

                    {/* Mobile Toggle */}
                    <div className="lg:hidden">
                        <button
                            className="p-2 text-zinc-400 hover:text-white bg-white/5 rounded-lg"
                            onClick={() => setShowMobileControls(!showMobileControls)}
                        >
                            {showMobileControls ? <X size={20} /> : <Settings2 size={20} />}
                        </button>
                    </div>

                    {/* Profile */}
                    <div className="flex items-center gap-3">
                        {userPicture ? (
                            <img src={userPicture} alt="Profile" className="w-8 h-8 rounded-full object-cover ring-2 ring-white/10" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs font-bold ring-2 ring-white/10">
                                {nickname.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- Main Layout --- */}
            <div className="app-container">
                <div className="main-content">

                    <VideoPlayer
                        activeSpeakers={activeSpeakers}
                        isRecording={isRecording}
                        toggleMic={toggleMic}
                    />



                </div>

                {/* --- Sidebar --- */}
                <div className="sidebar">
                    <div className="sidebar-tabs">
                        <button
                            className={`tab-btn ${activeTab === "chat" ? "active" : ""}`}
                            onClick={() => setActiveTab("chat")}
                        >
                            <MessageSquare size={18} strokeWidth={1.5} /> Chat
                        </button>
                        {isAdmin && (
                            <button
                                className={`tab-btn ${activeTab === "library" ? "active" : ""}`}
                                onClick={() => setActiveTab("library")}
                            >
                                <FolderOpen size={18} strokeWidth={1.5} /> Library
                            </button>
                        )}
                        <button
                            className={`tab-btn ${activeTab === "users" ? "active" : ""}`}
                            onClick={() => setActiveTab("users")}
                        >
                            <Users size={18} strokeWidth={1.5} /> Users
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col">
                        {activeTab === "chat" && <Chat />}
                        {activeTab === "library" && <Library />}
                        {activeTab === "users" && (
                            <UserList activeSpeakers={activeSpeakers} />
                        )}
                    </div>
                </div>

                {/* CSS for specific animations kept minimal, assuming index.css handles most */}
                {/* CSS for specific animations */}
                <style>{`
                    .pulse-anim { animation: pulse 1s infinite; }
                    @keyframes pulse { 
                        0% { opacity: 1; } 
                        50% { opacity: 0.5; } 
                        100% { opacity: 1; } 
                    }
                `}</style>
            </div>


        </div >
    );
};
