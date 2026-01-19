/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import Hls from "hls.js";
import {
  Mic,
  MicOff,
  Lock,
  Play,
  Pause,
  VolumeX,
  Volume1,
  Volume2,
  Maximize,
  Minimize,
  Check,
  Lightbulb,
  Sparkles,
  Settings,
} from "lucide-react";
import { useWebSocket } from "../context/WebSocketContext";

interface VideoPlayerProps {
  activeSpeakers: string[];
  isRecording: boolean;
  toggleMic: () => void;
}

interface FloatingMessage {
  id: number;
  nick: string;
  text: string;
  color: string;
}

const getAvatarColor = (name: string) => {
  const colors = [
    "#f87171", "#fb923c", "#fbbf24", "#a3e635", "#34d399", "#22d3ee",
    "#818cf8", "#c084fc", "#f472b6", "#f43f5e", "#495057",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "0:00";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    // Format: H:MM:SS
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // Format: M:SS (Standard)
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const INTRO_URL = "/intro.mp4";

const VideoPlayerComponent: React.FC<VideoPlayerProps> = ({
  activeSpeakers,
  toggleMic,
  isRecording,
}) => {
  // --- Refs (Direct DOM Access) ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeSliderRef = useRef<HTMLDivElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  // Logic Refs
  const currentSrcRef = useRef<string>("");
  const isRemoteUpdate = useRef(false);
  const isSwitchingSource = useRef(false);
  const userVolumeRef = useRef<number>(1);
  const lastLocalInteractionRef = useRef<number>(0);
  const settingsRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Context ---
  const { send, lastMessage, isConnected, isAdmin, userControlsAllowed, proxyEnabled, nickname, currentVideoState } =
    useWebSocket();

  const permissionsRef = useRef({ isAdmin, userControlsAllowed, isConnected, proxyEnabled });
  useEffect(() => {
    permissionsRef.current = { isAdmin, userControlsAllowed, isConnected, proxyEnabled };
  }, [isAdmin, userControlsAllowed, isConnected, proxyEnabled]);

  // --- React State ---
  const [overlayChat, setOverlayChat] = useState<FloatingMessage[]>([]);
  const [isIntro, setIsIntro] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [ambientMode, setAmbientMode] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);

  // Media UI State
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [displayTime, setDisplayTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const [qualities, setQualities] = useState<any[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(-1);

  // --- Helper: Direct CSS Update ---
  const updateSliderVisuals = (currentTime: number, maxDuration: number, buffered: number) => {
    if (timeSliderRef.current) {
      const fillPercent = maxDuration > 0 ? (currentTime / maxDuration) * 100 : 0;
      const buffPercent = maxDuration > 0 ? (buffered / maxDuration) * 100 : 0;

      timeSliderRef.current.style.setProperty('--slider-fill', `${fillPercent}%`);
      timeSliderRef.current.style.setProperty('--slider-progress', `${buffPercent}%`);
    }
    if (timeInputRef.current) {
      timeInputRef.current.value = currentTime.toString();
    }
  };

  // --- Click Outside Settings ---
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
    }
    if (showSettingsMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showSettingsMenu]);

  // --- HLS & Video Initialization ---
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (src) {
      if (Hls.isSupported() && (src.endsWith('.m3u8') || src.includes('/proxy'))) {
        if (hlsRef.current) hlsRef.current.destroy();
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hlsRef.current = hls;

        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setQualities(hls.levels);
          if (isIntro) {
            video.loop = true;
            video.play().catch(() => { });
          }
        });
        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
          setAudioTracks(hls.audioTracks);
          setCurrentAudioTrack(hls.audioTrack + 1);
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl') || src) {
        video.src = src;
        video.load();
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, isIntro]);

  // --- Sync Logic ---
  const sendSync = useCallback((
    packetType: 'sync' | 'forceSync',
    time: number,
    paused: boolean
  ) => {
    if (isIntro) return;
    if (!permissionsRef.current.isConnected) return;
    if (!permissionsRef.current.isAdmin && !permissionsRef.current.userControlsAllowed) return;
    if (isRemoteUpdate.current) return;

    const urlToSend = currentSrcRef.current || undefined;
    send({
      type: packetType,
      time: time,
      paused: paused,
      url: urlToSend,
    });
  }, [send, isIntro]);

  // --- Video Event Listeners (Optimized) ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      const cur = video.currentTime;
      const dur = video.duration || 0;

      let buffEnd = 0;
      if (dur > 0 && video.buffered.length > 0) {
        for (let i = 0; i < video.buffered.length; i++) {
          if (video.buffered.start(i) <= cur && video.buffered.end(i) >= cur) {
            buffEnd = video.buffered.end(i);
            break;
          }
        }
      }

      updateSliderVisuals(cur, dur, buffEnd);

      setDisplayTime((prev) => {
        const floorCur = Math.floor(cur);
        if (Math.floor(prev) !== floorCur) return floorCur;
        return prev;
      });
    };

    const onDurationChange = () => setDuration(video.duration);

    const onPlayEvent = () => {
      // STRICT LOCK: If locked and not a remote update, force pause
      if (!permissionsRef.current.isAdmin && !permissionsRef.current.userControlsAllowed && !isRemoteUpdate.current) {
        video.pause();
        return;
      }

      setPaused(false);
      isSwitchingSource.current = false;
      if (!isRemoteUpdate.current && !isIntro) sendSync("sync", video.currentTime, false);
    };

    const onPauseEvent = () => {
      // STRICT LOCK: If locked and not a remote update, force play (if it was playing)
      if (!permissionsRef.current.isAdmin && !permissionsRef.current.userControlsAllowed && !isRemoteUpdate.current) {
        // We can attempts to revert, but infinite loops are risky. 
        // Generally, if they pause, they just desync. The auto-sync logic usually fixes it.
        // But let's try to block the INTENT first via media session. 
        // If we strictly force play here, it might fight the browser.
        // Let's rely on the media session block first, but if that fails:
        video.play().catch(() => { });
        return;
      }

      setPaused(true);
      if (isSwitchingSource.current) return;
      if (!isRemoteUpdate.current && !isIntro) sendSync("sync", video.currentTime, true);
    };

    const onSeeked = () => {
      // STRICT LOCK: If locked and not remote, revert seek? 
      // This is hard to revert perfectly without a "previous time" ref.
      // But usually 'seeking' event happens first. 
      // For now, let's just trigger a re-sync request if they drift too far?
      // Actually, if we just sendSync, the server might overwrite us (which is good).
      // But we don't want to SPAM the server with "I seeked!" if we are locked.
      if (!permissionsRef.current.isAdmin && !permissionsRef.current.userControlsAllowed && !isRemoteUpdate.current) {
        return; // Ignore sending sync
      }

      updateSliderVisuals(video.currentTime, video.duration, 0);
      if (!isRemoteUpdate.current && !isIntro) sendSync("sync", video.currentTime, video.paused);
    };

    const onVolumeChange = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('play', onPlayEvent);
    video.addEventListener('pause', onPauseEvent);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('volumechange', onVolumeChange);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('play', onPlayEvent);
      video.removeEventListener('pause', onPauseEvent);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('volumechange', onVolumeChange);
    };
  }, [isIntro, sendSync]);

  // --- Interaction Handlers ---
  const showControls = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (!paused) {
      controlsTimeoutRef.current = setTimeout(() => setControlsVisible(false), 2500);
    }
  };

  const togglePlay = useCallback(async (e?: React.MouseEvent | React.TouchEvent | any) => {
    if (e && e.stopPropagation) e.stopPropagation();

    const { isAdmin, userControlsAllowed } = permissionsRef.current;
    if (!isAdmin && !userControlsAllowed) return;

    const video = videoRef.current;
    if (!video) return;

    lastLocalInteractionRef.current = Date.now();
    isRemoteUpdate.current = false;

    try {
      if (video.paused) await video.play();
      else video.pause();
    } catch (error) {
      console.warn("Interaction interrupted:", error);
    }
  }, []);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      lastLocalInteractionRef.current = Date.now();
      isRemoteUpdate.current = false;

      videoRef.current.currentTime = val;
      updateSliderVisuals(val, duration, 0);
      setDisplayTime(val);
    }
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
  };

  const toggleFullscreen = () => {
    const { isAdmin, userControlsAllowed } = permissionsRef.current;
    if (!isAdmin && !userControlsAllowed) return; // Block fullscreen if locked

    const el = document.querySelector('.video-player-root');
    if (!document.fullscreenElement) {
      el?.requestFullscreen().then(() => setFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setFullscreen(false));
    }
  };

  // --- Strict Lock Enforcement (Keyboard & Media Keys) ---
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const { isAdmin, userControlsAllowed } = permissionsRef.current;
      const isLocked = !isAdmin && !userControlsAllowed;

      if (!isLocked) return;

      // List of keys to block
      const blockedKeys = [' ', 'k', 'j', 'l', 'm', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'f'];

      if (blockedKeys.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        console.log(`Blocked restricted key: ${e.key}`);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true }); // Capture phase to block early



    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
    };
  }, []);

  // Effect to toggle Media Session handlers based on lock state
  useEffect(() => {
    const { isAdmin, userControlsAllowed } = permissionsRef.current;
    const isLocked = !isAdmin && !userControlsAllowed;

    if ('mediaSession' in navigator) {
      const actions: MediaSessionAction[] = ['play', 'pause', 'seekbackward', 'seekforward', 'previoustrack', 'nexttrack', 'stop', 'seekto'];
      if (isLocked) {
        actions.forEach(action => {
          try {
            navigator.mediaSession.setActionHandler(action, () => {
              console.log(`Media Session action blocked: ${action}`);
            });
          } catch (e) { }
        });
      } else {
        // Reset to null to let browser handle or Video player default
        actions.forEach(action => {
          try {
            navigator.mediaSession.setActionHandler(action, null);
          } catch (e) { }
        });
      }
    }
  }, [isAdmin, userControlsAllowed]);



  // --- Load Logic ---
  const loadVideo = useCallback((url: string, autoPlay = false, startTime = 0) => {
    if (!url || url === "#") return;
    const isNewIntro = url.includes(INTRO_URL) || url === INTRO_URL;
    setIsIntro(isNewIntro);
    isSwitchingSource.current = true;

    if (!isNewIntro && isIntro && videoRef.current) {
      videoRef.current.volume = userVolumeRef.current;
      videoRef.current.loop = false;
    }

    currentSrcRef.current = url;
    let finalSrc = url;
    if (
      permissionsRef.current.proxyEnabled &&
      !url.startsWith("/") &&
      !url.includes(window.location.host)
    ) {
      finalSrc = `/api/proxy?url=${btoa(url)}`;
    }

    setSrc(finalSrc);

    if (autoPlay || permissionsRef.current.isAdmin || permissionsRef.current.userControlsAllowed) {
      setTimeout(() => {
        const video = videoRef.current;
        if (!video) return;

        const executePlay = () => {
          if (startTime > 0) video.currentTime = startTime;
          if (autoPlay) {
            video.play().catch((e) => console.warn("Autoplay blocked:", e));
          }
        };
        if (video.readyState >= 3) {
          executePlay();
        } else {
          video.addEventListener("canplay", executePlay, { once: true });
        }
      }, 100);
    }
  }, [isIntro]);

  const handlePlayIntro = () => {
    loadVideo(INTRO_URL, true);
    const { isAdmin, userControlsAllowed } = permissionsRef.current;
    if (isAdmin || userControlsAllowed) {
      send({ type: 'load', url: INTRO_URL });
      setTimeout(() => {
        send({ type: 'forceSync', url: INTRO_URL, time: 0, paused: false });
      }, 200);
    }
  };

  // --- Incoming Sync Events ---
  useEffect(() => {
    const handleLocalLoad = (event: CustomEvent<{ url: string; autoPlay: boolean }>) => {
      loadVideo(event.detail.url, event.detail.autoPlay);
    };
    window.addEventListener('play-video', handleLocalLoad as EventListener);
    const handleForceSync = () => {
      if (videoRef.current) sendSync('forceSync', videoRef.current.currentTime, videoRef.current.paused);
    };
    window.addEventListener('trigger-force-sync', handleForceSync);

    return () => {
      window.removeEventListener('play-video', handleLocalLoad as EventListener);
      window.removeEventListener('trigger-force-sync', handleForceSync);
    };
  }, [loadVideo, sendSync]);

  // --- Overlay Chat ---
  useEffect(() => {
    if (!lastMessage || lastMessage.type !== "chat") return;
    if (lastMessage.nick === nickname) return;
    if (lastMessage.isSystem && lastMessage.text.includes(nickname)) return;

    const id = Date.now() + Math.random();
    const newMsg: FloatingMessage = {
      id,
      nick: lastMessage.nick,
      text: lastMessage.text,
      color: getAvatarColor(lastMessage.nick),
    };
    setOverlayChat((prev) => [...prev, newMsg]);
    setTimeout(() => setOverlayChat((prev) => prev.filter((m) => m.id !== id)), 6000);
  }, [lastMessage, nickname]);

  // --- State Synchronization ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentVideoState) return;

    const { url, time: serverTime, paused: serverPaused, timestamp } = currentVideoState;

    const timeSinceInteraction = Date.now() - lastLocalInteractionRef.current;
    if (timeSinceInteraction < 1000) return;

    const packetAge = Date.now() - timestamp;
    if (packetAge > 2000 && url === currentSrcRef.current) return;

    if (url && url !== currentSrcRef.current) {
      isRemoteUpdate.current = true;
      loadVideo(url, !serverPaused, serverTime);
      setTimeout(() => { isRemoteUpdate.current = false; }, 1500);
      return;
    }

    if (url === currentSrcRef.current && (!isSwitchingSource.current || (!serverPaused && video.paused))) {
      const drift = Math.abs(video.currentTime - serverTime);
      const isPausedStateMatch = video.paused === serverPaused;

      if (drift < 0.5 && isPausedStateMatch) return;

      isRemoteUpdate.current = true;
      if (serverPaused) {
        if (!video.paused) video.pause();
        if (drift > 0.1) video.currentTime = serverTime;
      } else {
        if (video.paused) video.play().catch(() => { });
        if (drift > 1.0) video.currentTime = serverTime;
      }
      setTimeout(() => { isRemoteUpdate.current = false; }, 800);
    }
  }, [currentVideoState, loadVideo]);

  // --- Ambient Light Loop ---
  useLayoutEffect(() => {
    if (!ambientMode || !videoRef.current) return;
    let animationFrameId: number;
    let lastFrameTime = 0;
    const interval = 1000 / 30; // 30 FPS
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });

    const loop = (timestamp: number) => {
      if (timestamp - lastFrameTime >= interval) {
        const video = videoRef.current;
        if (video && canvas && ctx && !video.paused && !video.ended) {
          if (canvas.width !== 50) canvas.width = 50;
          if (canvas.height !== 50) canvas.height = 50;
          try {
            ctx.drawImage(video, 0, 0, 50, 50);
          } catch (e) { /* ignore */ }
          lastFrameTime = timestamp;
        }
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [ambientMode, src]);

  const isLocked = !isAdmin && !userControlsAllowed;

  // Note: style handled via inline in JSX now

  return (
    <div
      className={`video-player-root relative w-full h-full bg-black shadow-2xl font-sans overflow-hidden group/root ${isLocked ? "pointer-events-none" : ""}`}
      onMouseMove={showControls}
      onClick={showControls}
      onMouseLeave={() => !paused && setControlsVisible(false)}
    >
      {/* Z-INDEX STACKING:
         0: Ambient Canvas
         5: Video Element
         6: Gestures Layer (Invisible, captures double clicks)
         20: Speakers, Chat, Overlays, Controls (Must be > 6)
      */}

      <canvas
        ref={canvasRef}
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full z-0 blur-[80px] saturate-[1.5] brightness-[0.8] transition-opacity duration-1000 pointer-events-none ${ambientMode ? 'opacity-60' : 'opacity-0'}`}
        style={{ zIndex: 0 }}
      />

      <video
        ref={videoRef}
        className="block w-full h-full object-contain relative z-[5]"
        playsInline
        crossOrigin="anonymous"
      />

      <div
        className="absolute inset-0 z-[6] w-full h-full block"
        onDoubleClick={(e) => {
          e.stopPropagation();
          toggleFullscreen();
        }}
        style={{ pointerEvents: isLocked ? 'none' : 'auto' }}
      />

      {/* --- SPEAKERS (Now Visible on Top) --- */}
      {activeSpeakers.length > 0 && (
        <div className="absolute top-[60px] right-5 flex flex-col items-end gap-2 z-20">
          {activeSpeakers.map((name, i) => (
            <div key={i} className="flex items-center gap-2 bg-green-500/40 border border-green-500/20 px-1 py-1 pr-2.5 rounded-full text-white text-sm font-medium shadow-sm animate-in fade-in zoom-in duration-300">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(34,197,94,0.4)]">
                <Mic size={14} color="white" strokeWidth={1.5} />
              </div>
              <span>{name}</span>
              <div className="flex gap-[2px] h-3 items-end">
                <div className="w-0.5 bg-white rounded-full animate-pulse h-[60%]" style={{ animationDelay: '0s' }}></div>
                <div className="w-0.5 bg-white rounded-full animate-pulse h-full" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-0.5 bg-white rounded-full animate-pulse h-[50%]" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- CHAT OVERLAY --- */}
      <div className="absolute bottom-20 right-5 w-[280px] max-w-[70%] max-h-[60%] flex flex-col justify-end items-end gap-2 pointer-events-none z-20 [mask-image:linear-gradient(to_bottom,transparent,black_15%)]">
        {overlayChat.map((msg) => (
          <div key={msg.id} className="bg-[#141414]/60 backdrop-blur-[4px] border border-white/10 py-1.5 px-3 rounded-[12px_12px_2px_12px] text-zinc-200 text-sm shadow-sm animate-in slide-in-from-right-5 duration-200 max-w-full break-words">
            <span className="font-semibold text-xs mr-1.5 uppercase opacity-90" style={{ color: msg.color }}>{msg.nick}</span>
            <span className="text-white">{msg.text}</span>
          </div>
        ))}
      </div>

      {/* --- STATUS OVERLAY --- */}
      <div className={`absolute inset-0 z-20 pointer-events-none transition-opacity duration-300 ${controlsVisible || paused ? 'opacity-100' : 'opacity-0'} group-hover/root:opacity-100`}>
        <div className={`absolute top-5 right-5 px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 shadow-sm ${!isConnected ? "bg-red-500/20 border border-red-500 text-red-500" : "bg-green-500/20 border border-green-500 text-green-500"}`}>
          <div className="w-2 h-2 rounded-full bg-current" />
          {isConnected ? "Live" : "Offline"}
        </div>
        {isLocked && (
          <div className="absolute top-6 left-6 text-white/40 p-1 flex items-center justify-center">
            <Lock size={16} strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* --- CONTROLS --- */}
      <div className={`absolute inset-0 z-30 flex flex-col justify-end pointer-events-none transition-opacity duration-300 ${controlsVisible || paused ? 'opacity-100' : 'opacity-0'}`} data-visible={controlsVisible || paused}>
        <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent px-6 pb-5 flex flex-col gap-3 pointer-events-auto max-[900px]:px-3 max-[900px]:pb-2.5 max-[900px]:gap-1.5">

          {/* TIME SLIDER (Optimized Ref) */}
          <div className="w-full relative h-3.5 mb-2 max-[900px]:h-3 max-[900px]:mb-0.5">
            <div
              ref={timeSliderRef}
              className="w-full h-5 flex items-center cursor-pointer relative group/slider max-[900px]:h-3"
              style={{
                pointerEvents: isLocked ? 'none' : 'auto',
                opacity: isLocked ? 0.5 : 1,
              }}
            >
              <input
                ref={timeInputRef}
                type="range"
                min="0"
                max={duration || 100}
                step="0.1"
                defaultValue="0"
                onInput={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
              />
              <div className="w-full h-1 bg-white/30 !rounded-full relative group-hover/slider:h-1.5 transition-all max-[900px]:h-[3px]">
                {/* Fill */}
                <div className="absolute left-0 top-0 h-full bg-[var(--primary)] !rounded-full z-[2] w-[var(--slider-fill,0%)] pointer-events-none" />
                {/* Buffer */}
                <div className="absolute left-0 top-0 h-full bg-white/50 !rounded-full z-[1] w-[var(--slider-progress,0%)] pointer-events-none" />
                {/* Thumb */}
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white !rounded-full shadow-md z-[3] pointer-events-none transition-transform group-hover/slider:scale-125 left-[var(--slider-fill)] max-[900px]:w-2.5 max-[900px]:h-2.5" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between w-full mt-1 max-[900px]:mt-0.5">
            <div className="flex items-center gap-3 max-[900px]:gap-2">
              {/* PLAY */}
              <button
                className="vp-control-btn vp-play-btn w-10 h-10 flex items-center justify-center shrink-0 max-[900px]:w-7 max-[900px]:h-7"
                onClick={togglePlay}
                title={isLocked ? "Controls Locked" : (paused ? "Play" : "Pause")}
                style={{
                  opacity: isLocked ? 0.5 : 1,
                  cursor: isLocked ? 'not-allowed' : 'pointer'
                }}
                disabled={isLocked}
              >
                {paused ? (
                  <Play className="w-5 h-5 fill-white text-white max-[900px]:w-3.5 max-[900px]:h-3.5" strokeWidth={1.5} />
                ) : (
                  <Pause className="w-5 h-5 fill-white text-white max-[900px]:w-3.5 max-[900px]:h-3.5" strokeWidth={1.5} />
                )}
              </button>

              {/* VOLUME */}
              <div className="flex items-center gap-2 relative max-[900px]:gap-1">
                <button
                  className="vp-control-btn w-8 h-8 text-zinc-200 hover:text-white max-[900px]:w-7 max-[900px]:h-7"
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.muted = !muted;
                      setMuted(!muted);
                    }
                  }}
                  title={muted ? "Unmute" : "Mute"}
                >
                  {muted || volume === 0 ? (
                    <VolumeX className="w-5 h-5 max-[900px]:w-4 max-[900px]:h-4" strokeWidth={1.5} />
                  ) : volume < 0.5 ? (
                    <Volume1 className="w-5 h-5 max-[900px]:w-4 max-[900px]:h-4" strokeWidth={1.5} />
                  ) : (
                    <Volume2 className="w-5 h-5 max-[900px]:w-4 max-[900px]:h-4" strokeWidth={1.5} />
                  )}
                </button>
                <div className="w-20 h-8 flex items-center relative opacity-100 max-[900px]:w-9">
                  <input
                    type="range"
                    min="0" max="1" step="0.05"
                    value={muted ? 0 : volume}
                    onInput={handleVolume}
                    className="absolute inset-0 w-full h-full opacity-0 z-50 cursor-pointer appearance-none"
                  />
                  <div className="w-full h-1 bg-white/30 !rounded-full relative cursor-pointer">
                    <div className="absolute top-0 left-0 h-full bg-white !rounded-full pointer-events-none" style={{ width: `${(muted ? 0 : volume) * 100}%` }} />
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white !rounded-full pointer-events-none shadow-sm left-[var(--slider-fill)]" style={{ left: `${(muted ? 0 : volume) * 100}%` }} />
                  </div>
                </div>
              </div>

              <div className="flex gap-1 font-mono text-sm text-zinc-300 pointer-events-none ml-2 max-[900px]:text-xs max-[900px]:ml-1">
                <span>{formatTime(displayTime)}</span>
                <span className="opacity-50">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 max-[900px]:gap-0.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleMic(); }}
                title={isRecording ? "Mute Mic" : "Unmute Mic"}
                className={`vp-control-btn w-8 h-8 max-[900px]:w-7 max-[900px]:h-7 ${isRecording ? 'active-mic animate-pulse' : 'text-zinc-200 hover:text-white'}`}
              >
                {isRecording ? <Mic size={20} strokeWidth={1.5} className="max-[900px]:w-4 max-[900px]:h-4" /> : <MicOff size={20} strokeWidth={1.5} className="max-[900px]:w-4 max-[900px]:h-4" />}
              </button>

              <div className="relative">
                <button
                  className={`vp-control-btn w-8 h-8 max-[900px]:w-7 max-[900px]:h-7 ${showSettingsMenu ? 'active-settings' : 'text-zinc-200 hover:text-white'}`}
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  title="Settings"
                >
                  <Settings strokeWidth={1.5} className="w-5 h-5 max-[900px]:w-4 max-[900px]:h-4" />
                </button>

                {showSettingsMenu && (
                  <div className="absolute bottom-full right-0 w-40 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl p-1 flex flex-col gap-1 shadow-2xl z-50 mb-3 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-bottom-right" ref={settingsRef}>
                    <div className="text-[10px] font-bold text-zinc-500 uppercase px-3 py-2 tracking-wider">Quality</div>
                    <button
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-all text-left ${currentQuality === -1 ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                      onClick={() => {
                        if (hlsRef.current) hlsRef.current.currentLevel = -1;
                        setCurrentQuality(-1);
                        setShowSettingsMenu(false);
                      }}
                    >
                      <span>Auto</span>
                      {currentQuality === -1 && <Check size={14} />}
                    </button>
                    {qualities.map((q, i) => (
                      <button
                        key={i}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-all text-left ${currentQuality === i ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                        onClick={() => {
                          if (hlsRef.current) hlsRef.current.currentLevel = i;
                          setCurrentQuality(i);
                          setShowSettingsMenu(false);
                        }}
                      >
                        <span>{q.height}p</span>
                        {currentQuality === i && <Check size={14} />}
                      </button>
                    ))}
                    {audioTracks.length > 0 && (
                      <>
                        <div className="h-px bg-white/5 mx-2 my-1"></div>
                        <div className="text-[10px] font-bold text-zinc-500 uppercase px-3 py-2 tracking-wider">Audio</div>
                        {audioTracks.map((track, i) => (
                          <button
                            key={`audio-${i}`}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-all text-left ${currentAudioTrack === i ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                            onClick={() => {
                              if (hlsRef.current) {
                                hlsRef.current.audioTrack = i;
                                setCurrentAudioTrack(i);
                                setShowSettingsMenu(false);
                              }
                            }}
                          >
                            <span>{track.name || track.lang || `Track ${i + 1}`}</span>
                            {currentAudioTrack === i && <Check size={14} />}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              <button
                className={`vp-control-btn w-8 h-8 max-[900px]:w-7 max-[900px]:h-7 ${ambientMode ? 'active-ambient' : 'text-zinc-200 hover:text-white'}`}
                onClick={() => setAmbientMode(!ambientMode)}
                title="Toggle Ambient Mode"
              >
                <Lightbulb size={20} strokeWidth={1.5} className={`w-5 h-5 max-[900px]:w-4 max-[900px]:h-4 ${ambientMode ? "fill-current" : ""}`} />
              </button>

              {!isLocked && (
                <button
                  className={`vp-control-btn w-8 h-8 max-[900px]:w-7 max-[900px]:h-7 ${isIntro ? 'active-ambient' : 'text-zinc-200 hover:text-white'}`}
                  onClick={handlePlayIntro}
                  title="Play Intro Loop"
                >
                  <Sparkles size={20} strokeWidth={1.5} className="w-5 h-5 max-[900px]:w-4 max-[900px]:h-4" />
                </button>
              )}

              <button
                className="vp-control-btn w-8 h-8 text-zinc-200 hover:text-white max-[900px]:w-7 max-[900px]:h-7"
                onClick={toggleFullscreen}
                title={fullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {fullscreen ? (
                  <Minimize className="w-5 h-5 max-[900px]:w-4 max-[900px]:h-4" strokeWidth={1.5} />
                ) : (
                  <Maximize className="w-5 h-5 max-[900px]:w-4 max-[900px]:h-4" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const VideoPlayer = React.memo(VideoPlayerComponent);