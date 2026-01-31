/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import "videojs-contrib-quality-levels";
import type Player from "video.js/dist/types/player";
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useWebSocket } from "../context/WebSocketContext";

// Override native HLS in modern browsers to use video.js VHS for consistent behavior (if desired)
// Or let video.js decide. Generally 'auto' is fine, but for quality levels we often need VHS/MSE.
// For Safari, native HLS is often used, which might strictly hide quality controls unless we override.
// videojs.options.html5.vhs.overrideNative = true; // Use with caution on iOS

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
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const INTRO_URL = "/intro.mp4";

interface VolumeControlsProps {
  volume: number;
  muted: boolean;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  showMobileVolume: boolean;
  onToggleMobileVolume: () => void;
}

const VolumeControls = React.memo(({
  volume,
  muted,
  onVolumeChange,
  onToggleMute,
  showMobileVolume,
  onToggleMobileVolume
}: VolumeControlsProps) => {
  const mobileVolumeRef = useRef<HTMLDivElement>(null);

  const handleMobileVolumeDrag = useCallback((e: React.PointerEvent) => {
    const slider = mobileVolumeRef.current;
    if (!slider) return;

    if (e.type === 'pointerdown') {
      slider.setPointerCapture(e.pointerId);
    }

    const rect = slider.getBoundingClientRect();
    const rawValue = 1 - ((e.clientY - rect.top) / rect.height);
    const newVolume = Math.max(0, Math.min(1, rawValue));

    // Call parent handler
    onVolumeChange(newVolume);
  }, [onVolumeChange]);

  return (
    <div className="flex items-center gap-2 relative max-[900px]:gap-0">
      {/* Mobile Popup Volume Slider */}
      {showMobileVolume && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-black/90 backdrop-blur-xl border border-white/10 rounded-full p-2 py-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200 flex flex-col items-center">
          {/* Custom Vertical Slider using Pointer Events */}
          <div
            ref={mobileVolumeRef}
            className="h-24 w-8 relative flex items-center justify-center cursor-pointer touch-none"
            onPointerDown={handleMobileVolumeDrag}
            onPointerMove={(e) => {
              if (e.buttons === 1) handleMobileVolumeDrag(e);
            }}
          >
            <div className="absolute inset-0 z-20" />
            <div className="w-1.5 h-full bg-white/20 rounded-full relative pointer-events-none overflow-hidden">
              <div className="absolute bottom-0 left-0 w-full bg-white rounded-full transition-none" style={{ height: `${(muted ? 0 : volume) * 100}%` }} />
            </div>
            <div
              className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-lg pointer-events-none transition-none"
              style={{ bottom: `calc(${(muted ? 0 : volume) * 100}% - 8px)` }}
            />
          </div>
        </div>
      )}

      <button
        className="vp-control-btn w-8 h-8 text-zinc-200 hover:text-white max-[900px]:w-8 max-[900px]:h-8 relative z-10"
        onClick={(e) => {
          if (window.innerWidth <= 900) {
            e.stopPropagation();
            onToggleMobileVolume();
          } else {
            onToggleMute();
          }
        }}
        title={muted ? "Unmute" : "Mute"}
      >
        {muted || volume === 0 ? (
          <VolumeX className="w-5 h-5 max-[900px]:w-5 max-[900px]:h-5" strokeWidth={1.5} />
        ) : volume < 0.5 ? (
          <Volume1 className="w-5 h-5 max-[900px]:w-5 max-[900px]:h-5" strokeWidth={1.5} />
        ) : (
          <Volume2 className="w-5 h-5 max-[900px]:w-5 max-[900px]:h-5" strokeWidth={1.5} />
        )}
      </button>

      {/* Desktop Inline Slider (Hidden on Mobile) */}
      <div className="w-20 h-8 flex items-center relative opacity-100 max-[900px]:hidden">
        <input
          type="range"
          min="0" max="1" step="0.05"
          value={muted ? 0 : volume}
          onInput={(e) => onVolumeChange(parseFloat((e.target as HTMLInputElement).value))}
          className="absolute inset-0 w-full h-full opacity-0 z-50 cursor-pointer appearance-none"
        />
        <div className="w-full h-1 bg-white/30 !rounded-full relative cursor-pointer">
          <div className="absolute top-0 left-0 h-full bg-white !rounded-full pointer-events-none" style={{ width: `${(muted ? 0 : volume) * 100}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white !rounded-full pointer-events-none shadow-sm left-[var(--slider-fill)]" style={{ left: `${(muted ? 0 : volume) * 100}%` }} />
        </div>
      </div>
    </div>
  );
});

const VideoPlayerComponent: React.FC<VideoPlayerProps> = ({
  activeSpeakers,
  toggleMic,
  isRecording,
}) => {
  // --- Refs ---
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
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
  const [settingsView, setSettingsView] = useState<'main' | 'quality' | 'captions' | 'audio'>('main');
  const [ambientMode, setAmbientMode] = useState(true);

  const [controlsVisible, setControlsVisible] = useState(true);
  const [showMobileVolume, setShowMobileVolume] = useState(false);

  // Player Readiness State to prevent race conditions
  const [isPlayerReady, setIsPlayerReady] = useState(false);

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

  // --- Sidecar Subtitles State ---
  const [subtitleTracks, setSubtitleTracks] = useState<any[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<number>(-1); // -1 = Off

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

  // Reset view when menu closes
  useEffect(() => {
    if (!showSettingsMenu) setSettingsView('main');
  }, [showSettingsMenu]);

  // --- Subtitles Toggle ---
  const toggleSubtitle = (index: number) => {
    setCurrentSubtitle(index);
    const player = playerRef.current;
    if (player) {
      const tracks = player.textTracks() as any;
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (index === -1) {
          track.mode = 'hidden';
        } else {
          // If our subtitleTracks[index] corresponds to this track
          const target = subtitleTracks[index];
          if (target && track.label === target.label && track.language === target.srclang) {
            track.mode = 'showing';
          } else {
            track.mode = 'hidden';
          }
        }
      }
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

  // --- Sync Logic Wrapper ---
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


  // --- PLAYER INITIALIZATION ---
  useEffect(() => {
    // Make sure the container exists
    if (!videoContainerRef.current) return;

    // Create element programmatically
    const videoElement = document.createElement("video-js");
    videoElement.classList.add('vjs-default-skin', 'vjs-fill');
    videoContainerRef.current.appendChild(videoElement);

    // Instantiate video.js
    const player = videojs(videoElement, {
      controls: false, // We use custom controls
      autoplay: false,
      preload: 'auto',
      responsive: true,
      fluid: false, // We control sizing via CSS
      fill: true,
      html5: {
        vhs: {
          overrideNative: !videojs.browser.IS_SAFARI, // Override on non-Safari for quality control
        }
      }
    });

    playerRef.current = player;
    (window as any).player = player; // Debugging

    // Mark as ready so other effects can run
    setIsPlayerReady(true);

    // --- Quality Levels ---
    // @ts-ignore
    const qualityLevels = player.qualityLevels();
    qualityLevels.on('addqualitylevel', () => {
      const levels: any[] = [];
      for (let i = 0; i < qualityLevels.length; i++) {
        levels.push(qualityLevels[i]);
      }
      // Deduplicate or just set
      setQualities(levels);
    });

    // --- Audio Tracks ---
    player.audioTracks().on('change', () => {
      // Update audio track state
      const tracks = player.audioTracks() as any;
      const arr = [];
      let activeIdx = -1;
      for (let i = 0; i < tracks.length; i++) {
        arr.push(tracks[i]);
        if (tracks[i].enabled) activeIdx = i;
      }
      setAudioTracks(arr);
      setCurrentAudioTrack(activeIdx);
    });
    player.audioTracks().on('addtrack', () => {
      const tracks = player.audioTracks() as any;
      const arr = [];
      for (let i = 0; i < tracks.length; i++) {
        arr.push(tracks[i]);
      }
      setAudioTracks(arr);
    });

    // --- Event Listeners ---
    player.on('timeupdate', () => {
      const cur = player.currentTime() || 0;
      const dur = player.duration() || 0;
      const buff = player.bufferedEnd() || 0;

      updateSliderVisuals(cur, dur, buff);
      setDisplayTime(cur);
    });

    player.on('durationchange', () => setDuration(player.duration() || 0));

    player.on('play', () => {
      // STRICT LOCK
      if (!permissionsRef.current.isAdmin && !permissionsRef.current.userControlsAllowed && !isRemoteUpdate.current) {
        player.pause();
        return;
      }
      setPaused(false);
      isSwitchingSource.current = false;
      if (!isRemoteUpdate.current && !isIntro) sendSync("sync", player.currentTime() || 0, false);
    });

    player.on('pause', () => {
      // STRICT LOCK
      if (!permissionsRef.current.isAdmin && !permissionsRef.current.userControlsAllowed && !isRemoteUpdate.current) {
        player.play()?.catch(() => { });
        return;
      }
      setPaused(true);
      if (isSwitchingSource.current) return;
      if (!isRemoteUpdate.current && !isIntro) sendSync("sync", player.currentTime() || 0, true);
    });

    player.on('seeked', () => {
      if (!permissionsRef.current.isAdmin && !permissionsRef.current.userControlsAllowed && !isRemoteUpdate.current) {
        return;
      }
      updateSliderVisuals(player.currentTime() || 0, player.duration() || 0, 0);
      if (!isRemoteUpdate.current && !isIntro) sendSync("sync", player.currentTime() || 0, player.paused());
    });

    player.on('volumechange', () => {
      setVolume(player.volume() || 1);
      setMuted(player.muted() || false);
    });

    player.on('error', () => {
      console.error("VideoJS Error:", player.error());
    });

    // Cleanup
    return () => {
      if (player) {
        player.dispose();
      }
      playerRef.current = null;
    };
  }, []);

  // --- Load Logic ---
  const loadVideo = useCallback((url: string, autoPlay = false, startTime = 0) => {
    const player = playerRef.current;
    if (!url || url === "#" || !player) return;

    const isNewIntro = url.includes(INTRO_URL) || url === INTRO_URL;
    setIsIntro(isNewIntro);
    isSwitchingSource.current = true;

    if (!isNewIntro && isIntro) {
      player.volume(userVolumeRef.current);
      player.loop(false);
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

    // --- Fetch Sidecar Subtitles ---
    setSubtitleTracks([]);
    // Clear existing remote tracks?
    // video.js keeps tracks unless we remove them.
    // video.js keeps tracks unless we remove them.
    const tracks = player.remoteTextTracks();
    // @ts-ignore
    while (tracks.length > 0) {
      // @ts-ignore
      player.removeRemoteTextTrack(tracks[0]);
    }

    if (finalSrc && !finalSrc.includes('blob:')) {
      try {
        const baseUrl = finalSrc.substring(0, finalSrc.lastIndexOf('/'));
        if (baseUrl) {
          const jsonUrl = `${baseUrl}/subtitles.json`;
          fetch(jsonUrl).then(res => {
            if (res.ok) return res.json();
            throw new Error("No manifest");
          }).then(data => {
            const mapped = data.map((t: any) => ({
              ...t,
              src: `${baseUrl}/${t.src}`
            }));
            setSubtitleTracks(mapped);
            // Add to player
            mapped.forEach((t: any) => {
              player.addRemoteTextTrack({
                kind: 'subtitles',
                src: t.src,
                srclang: t.srclang,
                label: t.label,
                default: t.default
              }, false);
            });
          }).catch(() => { });
        }
      } catch (e) { }
    }

    // Determine type
    let type = 'application/x-mpegURL'; // Default to HLS

    // Check for extension before query params (e.g. video.mp4?token=123)
    const cleanUrl = finalSrc.split('?')[0].toLowerCase();

    if (cleanUrl.endsWith('.mp4')) type = 'video/mp4';
    else if (cleanUrl.endsWith('.webm')) type = 'video/webm';
    else if (cleanUrl.endsWith('.mkv')) type = 'video/x-matroska';
    else if (cleanUrl.endsWith('.mov')) type = 'video/quicktime';

    // If you know you are strictly using MP4s but URLs don't show it, 
    // you might want to change the default from HLS to MP4.

    player.src({ src: finalSrc, type });

    if (autoPlay || permissionsRef.current.isAdmin || permissionsRef.current.userControlsAllowed) {
      // Need to wait for load? Video.js handles this logic better usually.
      // But we can use one('loadedmetadata') or similar.
      player.one('loadedmetadata', () => {
        if (startTime > 0) player.currentTime(startTime);
        if (autoPlay) {
          const p = player.play();
          if (p) p.catch(e => console.warn("Autoplay blocked", e));
        }
      });
    }

    if (isNewIntro) {
      player.loop(true);
      player.play()?.catch(() => { });
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
    if (!isPlayerReady) return; // Wait for player

    const handleLocalLoad = (event: CustomEvent<{ url: string; autoPlay: boolean }>) => {
      loadVideo(event.detail.url, event.detail.autoPlay);
    };
    window.addEventListener('play-video', handleLocalLoad as EventListener);
    const handleForceSync = () => {
      const player = playerRef.current;
      if (player) sendSync('forceSync', player.currentTime() || 0, player.paused());
    };
    window.addEventListener('trigger-force-sync', handleForceSync);

    return () => {
      window.removeEventListener('play-video', handleLocalLoad as EventListener);
      window.removeEventListener('trigger-force-sync', handleForceSync);
    };
  }, [loadVideo, sendSync, isPlayerReady]);

  // --- Overlay Chat (Unchanged) ---
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
    const player = playerRef.current;
    if (!isPlayerReady || !player || !currentVideoState) return; // Wait for player

    const { url, time: serverTime, paused: serverPaused, timestamp } = currentVideoState;

    const timeSinceInteraction = Date.now() - lastLocalInteractionRef.current;
    if (timeSinceInteraction < 1000) return;

    // Latency Compensation
    // If the packet is old, it might be irrelevant, but for sync we want to know what the server time IS NOW.
    const networkLatency = (Date.now() - timestamp) / 1000; // seconds
    const targetTime = serverPaused ? serverTime : serverTime + networkLatency;

    const packetAge = Date.now() - timestamp;
    if (packetAge > 2000 && url === currentSrcRef.current && !currentVideoState.isForce) return; // Drop very old packets

    // --- FORCE SYNC LOGIC ---
    if (currentVideoState.isForce) {
      console.log(`[ForceSync] Executing hard sync to ${targetTime} (Paused: ${serverPaused})`);
      isRemoteUpdate.current = true;

      // Ensure source is correct first
      if (url && url !== currentSrcRef.current) {
        loadVideo(url, !serverPaused, targetTime);
      } else {
        if (player.paused() !== serverPaused) {
          if (serverPaused) player.pause();
          else player.play()?.catch(() => { });
        }
        player.currentTime(targetTime);
      }

      setTimeout(() => { isRemoteUpdate.current = false; }, 1000);
      return;
    }

    if (url && url !== currentSrcRef.current) {
      isRemoteUpdate.current = true;
      loadVideo(url, !serverPaused, targetTime);
      setTimeout(() => { isRemoteUpdate.current = false; }, 1500);
      return;
    }

    if (url === currentSrcRef.current && (!isSwitchingSource.current || (!serverPaused && player.paused()))) {
      const cur = player.currentTime() || 0;
      const drift = targetTime - cur; // Positive = server is ahead, Negative = server is behind
      const absDrift = Math.abs(drift);
      const isPausedStateMatch = player.paused() === serverPaused;

      // --- ZERO LATENCY LOGIC ---

      // 1. Pause State Mismatch
      if (!isPausedStateMatch) {
        isRemoteUpdate.current = true;
        if (serverPaused) {
          player.pause();
          // If we drifted significantly while playing, snap back
          if (absDrift > 0.1) player.currentTime(targetTime);
        } else {
          player.play()?.catch(() => { });
          // If we are far behind/ahead starting, snap
          if (absDrift > 0.5) player.currentTime(targetTime);
        }
        setTimeout(() => { isRemoteUpdate.current = false; }, 800);
        return;
      }

      // 2. Playback Rate (Soft Sync) for small drifts
      // Only apply if playing
      if (!serverPaused) {
        if (absDrift > 0.5) {
          // HARD SYNC: Too far off, jump
          isRemoteUpdate.current = true;
          player.currentTime(targetTime);
          player.playbackRate(1.0); // Reset rate
          setTimeout(() => { isRemoteUpdate.current = false; }, 800);
        } else if (absDrift > 0.05) {
          // SOFT SYNC: Adjust speed
          // If drift > 0 (server ahead), speed up (1.05)
          // If drift < 0 (server behind), slow down (0.95)
          const newRate = drift > 0 ? 1.05 : 0.95;
          if (player.playbackRate() !== newRate) {
            console.log(`Soft Sync: Drift ${drift.toFixed(3)}s, Rate -> ${newRate}`);
            player.playbackRate(newRate);
          }
        } else {
          // PERFECT SYNC: Reset speed
          if (player.playbackRate() !== 1.0) {
            console.log("Soft Sync Exit: Rate -> 1.0");
            player.playbackRate(1.0);
          }
        }
      } else {
        // If paused, ensure we are at the exact frame
        if (absDrift > 0.1) {
          isRemoteUpdate.current = true;
          player.currentTime(targetTime);
          setTimeout(() => { isRemoteUpdate.current = false; }, 800);
        }
      }
    }
  }, [currentVideoState, loadVideo, isPlayerReady]);

  // --- Ambient Light Loop ---
  useLayoutEffect(() => {
    // Note: accessing video element from playerRef might be needed
    // player.el().querySelector('video') ? or generic logic
    // Actually canvas drawImage works on the video element itself.
    // video.js constructs: <div class='video-js ...'><video ... class='vjs-tech'></div>
    if (!ambientMode || !playerRef.current || !isPlayerReady) return; // Wait for player

    let animationFrameId: number;
    let lastFrameTime = 0;
    const interval = 1000 / 30; // 30 FPS
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });

    // We need the ACTUAL video element for drawImage
    // With video.js, player.tech().el() usually gives the MediaElement
    // We need the ACTUAL video element for drawImage
    // With video.js, player.tech().el() usually gives the MediaElement
    // const getTechEl = () => {
    //   return playerRef.current?.tech(true);
    //   // @ts-ignore
    //   // return playerRef.current?.el()?.querySelector('video'); 
    // }

    const loop = (timestamp: number) => {
      if (timestamp - lastFrameTime >= interval) {
        // Safe access
        const player = playerRef.current;
        const videoEl = player?.el()?.querySelector('video');

        if (videoEl && canvas && ctx && !player?.paused() && !player?.ended()) {
          if (canvas.width !== 50) canvas.width = 50;
          if (canvas.height !== 50) canvas.height = 50;
          try {
            ctx.drawImage(videoEl, 0, 0, 50, 50);
          } catch (e) { /* ignore */ }
          lastFrameTime = timestamp;
        }
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [ambientMode, isPlayerReady]);

  const isLocked = !isAdmin && !userControlsAllowed;

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

    const player = playerRef.current;
    if (!player) return;

    lastLocalInteractionRef.current = Date.now();
    isRemoteUpdate.current = false;

    try {
      if (player.paused()) await player.play();
      else player.pause();
    } catch (error) {
      console.warn("Interaction interrupted:", error);
    }
  }, []);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const player = playerRef.current;
    if (player) {
      lastLocalInteractionRef.current = Date.now();
      isRemoteUpdate.current = false;

      player.currentTime(val);
      updateSliderVisuals(val, duration, 0);
      setDisplayTime(val);
    }
  };

  const toggleFullscreen = () => {
    // With video.js we could use player.requestFullscreen() but that might affect only the video div
    // We want the whole ROOT (including chat/overlays) to be fullscreen.
    const el = document.querySelector('.video-player-root');
    if (!document.fullscreenElement) {
      el?.requestFullscreen().then(() => setFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setFullscreen(false));
    }
  };

  // --- Optimized Volume Handlers for Memoization ---
  // Replaces handleVolume and handleMobileVolumeDrag
  const handleVolumeChange = useCallback((newVol: number) => {
    setVolume(newVol);
    setMuted(newVol === 0);
    if (playerRef.current) {
      playerRef.current.volume(newVol);
      playerRef.current.muted(newVol === 0);
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (playerRef.current) playerRef.current.muted(next);
      return next;
    });
  }, []);

  const toggleMobileVolume = useCallback(() => {
    setShowMobileVolume(prev => !prev);
  }, []);

  return (
    <div
      className={`video-player-root relative w-full h-full bg-black shadow-2xl font-sans overflow-hidden group/root ${controlsVisible || paused ? "controls-active" : ""}`}
      onMouseMove={showControls}
      onClick={showControls}
      onMouseLeave={() => !paused && setControlsVisible(false)}
    >
      <canvas
        ref={canvasRef}
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full z-0 blur-[80px] saturate-[1.5] brightness-[0.8] transition-opacity duration-1000 pointer-events-none ${ambientMode ? 'opacity-60' : 'opacity-0'}`}
        style={{ zIndex: 0 }}
      />

      {/* Video.js Wrapper - Important: data-vjs-player helps if using react wrappers, but here we just ref the video tag */}
      <style>{`
          .video-js,
          .vjs-tech {
            width: 100% !important;
            height: 100% !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
          }
          .vjs-tech {
            object-fit: contain !important;
            display: block !important;
          }
        `}</style>
      <div className="absolute inset-0 z-[5] w-full h-full">
        <div ref={videoContainerRef} />
      </div>

      <div
        className="absolute inset-0 z-[6] w-full h-full block"
        onDoubleClick={(e) => {
          e.stopPropagation();
          toggleFullscreen();
        }}
        style={{ pointerEvents: isLocked ? 'none' : 'auto' }}
      />

      {/* --- SPEAKERS --- */}
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

              {/* VOLUME (Memoized) */}
              <VolumeControls
                volume={volume}
                muted={muted}
                onVolumeChange={handleVolumeChange}
                onToggleMute={handleToggleMute}
                showMobileVolume={showMobileVolume}
                onToggleMobileVolume={toggleMobileVolume}
              />

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
                  <div className="absolute bottom-full right-0 w-48 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl p-1 shadow-2xl z-50 mb-3 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-bottom-right" ref={settingsRef}>

                    {/* --- MAIN MENU --- */}
                    {settingsView === 'main' && (
                      <div className="flex flex-col gap-0.5">
                        {/* Quality Row */}
                        <button
                          className="w-full flex items-center justify-between px-3 py-2 text-[13px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white rounded-lg transition-all group"
                          onClick={() => setSettingsView('quality')}
                        >
                          <div className="flex items-center gap-2">
                            <span>Quality</span>
                          </div>
                          <div className="flex items-center gap-1 text-zinc-500 text-[11px] group-hover:text-zinc-400">
                            <span>{currentQuality === -1 ? 'Auto' : `${qualities[currentQuality]?.height}p`}</span>
                            <ChevronRight size={14} />
                          </div>
                        </button>

                        {/* Captions Row */}
                        <button
                          className="w-full flex items-center justify-between px-3 py-2 text-[13px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white rounded-lg transition-all group"
                          onClick={() => setSettingsView('captions')}
                        >
                          <div className="flex items-center gap-2">
                            <span>Captions</span>
                          </div>
                          <div className="flex items-center gap-1 text-zinc-500 text-[11px] group-hover:text-zinc-400">
                            <span>{currentSubtitle === -1 ? 'Off' : (subtitleTracks[currentSubtitle]?.label || 'On')}</span>
                            <ChevronRight size={14} />
                          </div>
                        </button>

                        {/* Audio Row (Conditional) */}
                        {audioTracks.length > 0 && (
                          <button
                            className="w-full flex items-center justify-between px-3 py-2 text-[13px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white rounded-lg transition-all group"
                            onClick={() => setSettingsView('audio')}
                          >
                            <div className="flex items-center gap-2">
                              <span>Audio</span>
                            </div>
                            <div className="flex items-center gap-1 text-zinc-500 text-[11px] group-hover:text-zinc-400">
                              <span className="max-w-[80px] truncate block text-right">
                                {currentAudioTrack === -1 ? 'Default' : (audioTracks[currentAudioTrack]?.name || audioTracks[currentAudioTrack]?.lang || `Track ${currentAudioTrack + 1}`)}
                              </span>
                              <ChevronRight size={14} />
                            </div>
                          </button>
                        )}
                      </div>
                    )}

                    {/* --- QUALITY SUBMENU --- */}
                    {settingsView === 'quality' && (
                      <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto">
                        <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-white/5">
                          <button
                            className="p-1 -ml-1 hover:bg-white/10 rounded-md text-zinc-400 hover:text-white transition-colors"
                            onClick={() => setSettingsView('main')}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <span className="text-xs font-bold text-white tracking-wide">Quality</span>
                        </div>

                        <button
                          className={`w-full flex items-center justify-between px-3 py-2 text-[12px] font-medium rounded-lg transition-all text-left ${currentQuality === -1 ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                          onClick={() => {
                            // @ts-ignore
                            const q = playerRef.current?.qualityLevels();
                            if (q) {
                              for (let i = 0; i < q.length; i++) q[i].enabled = true;
                            }
                            setCurrentQuality(-1);
                            setSettingsView('main');
                          }}
                        >
                          <span>Auto</span>
                          {currentQuality === -1 && <Check size={14} />}
                        </button>
                        {qualities.map((q, i) => (
                          <button
                            key={i}
                            className={`w-full flex items-center justify-between px-3 py-2 text-[12px] font-medium rounded-lg transition-all text-left ${currentQuality === i ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                            onClick={() => {
                              // @ts-ignore
                              const levels = playerRef.current?.qualityLevels();
                              if (levels) {
                                for (let j = 0; j < levels.length; j++) levels[j].enabled = (j === i);
                              }
                              setCurrentQuality(i);
                              setSettingsView('main');
                            }}
                          >
                            <span>{q.height}p</span>
                            {currentQuality === i && <Check size={14} />}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* --- CAPTIONS SUBMENU --- */}
                    {settingsView === 'captions' && (
                      <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto">
                        <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-white/5">
                          <button
                            className="p-1 -ml-1 hover:bg-white/10 rounded-md text-zinc-400 hover:text-white transition-colors"
                            onClick={() => setSettingsView('main')}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <span className="text-xs font-bold text-white tracking-wide">Captions</span>
                        </div>

                        <button
                          className={`w-full flex items-center justify-between px-3 py-2 text-[12px] font-medium rounded-lg transition-all text-left ${currentSubtitle === -1 ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                          onClick={() => {
                            toggleSubtitle(-1);
                            setSettingsView('main');
                          }}
                        >
                          <span>Off</span>
                          {currentSubtitle === -1 && <Check size={14} />}
                        </button>

                        {subtitleTracks.map((img, i) => (
                          <button
                            key={i}
                            className={`w-full flex items-center justify-between px-3 py-2 text-[12px] font-medium rounded-lg transition-all text-left ${currentSubtitle === i ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                            onClick={() => {
                              toggleSubtitle(i);
                              setSettingsView('main');
                            }}
                          >
                            <span>{img.label}</span>
                            {currentSubtitle === i && <Check size={14} />}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* --- AUDIO SUBMENU --- */}
                    {settingsView === 'audio' && (
                      <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto">
                        <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-white/5">
                          <button
                            className="p-1 -ml-1 hover:bg-white/10 rounded-md text-zinc-400 hover:text-white transition-colors"
                            onClick={() => setSettingsView('main')}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <span className="text-xs font-bold text-white tracking-wide">Audio</span>
                        </div>

                        {audioTracks.map((track, i) => (
                          <button
                            key={`audio-${i}`}
                            className={`w-full flex items-center justify-between px-3 py-2 text-[12px] font-medium rounded-lg transition-all text-left ${currentAudioTrack === i ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                            onClick={() => {
                              const tracks = playerRef.current?.audioTracks() as any;
                              if (tracks && tracks[i]) {
                                tracks[i].enabled = true;
                                setCurrentAudioTrack(i);
                              }
                              setSettingsView('main');
                            }}
                          >
                            <span className="truncate pr-2">{track.name || track.lang || `Track ${i + 1}`}</span>
                            {currentAudioTrack === i && <Check size={14} />}
                          </button>
                        ))}
                      </div>
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