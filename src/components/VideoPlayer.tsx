/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import {
  MediaPlayer,
  MediaProvider,
  TimeSlider,
  VolumeSlider,
  Controls,
  Gesture,
  Time,
  useMediaState,
  useMediaRemote,
  type MediaPlayerInstance,
} from "@vidstack/react";
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

// Import styles
import "@vidstack/react/player/styles/base.css";
import "./VideoPlayer.css";

// Interface Definitions
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

// Helpers
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

// USER CONFIG: Adjust Intro Volume here (0.0 to 1.0)
const INTRO_VOLUME = 0.15;
const INTRO_URL = "/intro.mp4"; // Replace with local file e.g., "/intro.mp4"

const VideoPlayerComponent: React.FC<VideoPlayerProps> = ({
  activeSpeakers,
  toggleMic,
  isRecording,
}) => {
  // --- Refs ---
  const playerRef = useRef<MediaPlayerInstance>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentSrcRef = useRef<string>(INTRO_URL);
  const isRemoteUpdate = useRef(false);
  const isSwitchingSource = useRef(false);
  // Store user's preferred volume to restore after intro
  const userVolumeRef = useRef<number>(1);

  // --- Context ---
  const { send, lastMessage, isConnected, isAdmin, userControlsAllowed, proxyEnabled } =
    useWebSocket();

  // Permissions Ref
  const permissionsRef = useRef({ isAdmin, userControlsAllowed, isConnected, proxyEnabled });
  useEffect(() => {
    permissionsRef.current = { isAdmin, userControlsAllowed, isConnected, proxyEnabled };
  }, [isAdmin, userControlsAllowed, isConnected, proxyEnabled]);

  // --- State ---
  const [overlayChat, setOverlayChat] = useState<FloatingMessage[]>([]);
  // Use proper INTRO_URL initialization
  const [src, setSrc] = useState<string>(INTRO_URL);
  const [isIntro, setIsIntro] = useState(true);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

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
  // Renamed/Removed individual states in favor of consolidated menu
  // const [showCaptionMenu, setShowCaptionMenu] = useState(false);
  // const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [ambientMode, setAmbientMode] = useState(true);

  // --- Media State ---
  const audioTracks = useMediaState("audioTracks", playerRef);
  const currentAudioTrack = useMediaState("audioTrack", playerRef);
  const textTracks = useMediaState("textTracks", playerRef);
  const currentTextTrack = useMediaState("textTrack", playerRef);
  const paused = useMediaState("paused", playerRef);
  const muted = useMediaState("muted", playerRef);
  const volume = useMediaState("volume", playerRef);
  const fullscreen = useMediaState("fullscreen", playerRef);
  const remote = useMediaRemote(playerRef);

  // --- Sync Logic ---
  const sendSync = useCallback((
    packetType: 'sync' | 'forceSync',
    time: number,
    paused: boolean
  ) => {
    // Debug blocking conditions
    if (isIntro) { console.warn("[SendSync] Blocked: Intro mode"); return; }
    if (!isConnected) { console.warn("[SendSync] Blocked: Not connected"); return; }
    if (!isAdmin && !userControlsAllowed) { console.warn("[SendSync] Blocked: No permissions"); return; }
    if (isRemoteUpdate.current) { console.warn("[SendSync] Blocked: Remote update in progress"); return; }

    console.log(`[SendSync] Sending ${packetType}: time=${time}, paused=${paused}, url=${currentSrcRef.current}`);
    send({
      type: packetType,
      time: time,
      paused: paused,
      url: currentSrcRef.current,
    });
  }, [send, isIntro]);

  // --- Event Handlers ---
  const onPlay = () => {
    console.log("[Event] onPlay");
    // We are playing, so switching is done.
    isSwitchingSource.current = false;
    if (playerRef.current && !isIntro) sendSync("sync", playerRef.current.currentTime, false);
  };

  const onPause = () => {
    console.log("[Event] onPause");
    // Ignore pause events triggered by source switching
    if (isSwitchingSource.current) return;
    if (playerRef.current && !isIntro) sendSync("sync", playerRef.current.currentTime, true);
  };

  const onSeeked = (time: any) => {
    // Vidstack onSeeked emits the time as number, but let's be safe and read from reference
    // Actually Vidstack docs say onSeeked payload is void/event in some versions, but we should rely on current state.
    // However, if the payload IS time, we can use it. But safest is referencing player.currentTime.
    if (playerRef.current && !isIntro) sendSync("sync", playerRef.current.currentTime, playerRef.current.paused);
  };

  // --- Load Logic ---
  const loadVideo = useCallback((url: string, autoPlay = false, startTime = 0) => {
    if (!url || url === "#") return;

    // Check if loading Intro (allow partial match for local file or full URL)
    const isNewIntro = url.includes(INTRO_URL) || url === INTRO_URL;
    setIsIntro(isNewIntro);

    // Flag start of source switch to suppress phantom pauses
    isSwitchingSource.current = true;

    // If switching to standard video from intro, reset volume
    if (!isNewIntro && isIntro && playerRef.current) {
      playerRef.current.volume = userVolumeRef.current;
      (playerRef.current as any).loop = false; // Disable loop for normal video
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
      if (playerRef.current) {
        const player = playerRef.current;
        const attemptPlay = () => {
          if (startTime > 0) {
            console.log("[LoadVideo] Seeking to start time:", startTime);
            player.currentTime = startTime;
          }
          player.play().catch(e => console.warn("Load autoplay blocked:", e));
        };

        if (startTime > 0) {
          // Check if metadata is ALREADY loaded (canPlay is a good proxy, or readyState)
          // @ts-ignore
          const isReady = player.state?.canPlay || player.readyState >= 1;

          if (isReady) {
            console.log("[LoadVideo] Metadata ready immediately, attempting seek");
            attemptPlay();
          } else {
            // Wait for metadata to ensure we can seek reliably
            // @ts-ignore
            player.addEventListener('loaded-metadata', attemptPlay, { once: true });

            // Fallback in case event already fired or is missed
            setTimeout(() => {
              // If we haven't advanced past near-zero, try forcing it
              if (player.currentTime < 0.1) attemptPlay();
            }, 1000);
          }
        } else {
          // No seek needed, just play after a tick for DOM update
          setTimeout(attemptPlay, 100);
        }
      }
    }
  }, [isIntro]);

  // --- Intro Volume Initialization ---
  useEffect(() => {
    if (isIntro && playerRef.current) {
      const player = playerRef.current;

      // Save current user volume to restore later
      // Only if current volume is NOT the intro volume (avoid overwriting valid user volume with 0.15)
      if (player.volume !== INTRO_VOLUME) {
        userVolumeRef.current = player.volume;
      }

      // Enforce Intro Settings
      const enforce = () => {
        if (isIntro && playerRef.current) {
          player.volume = INTRO_VOLUME;
          (player as any).loop = true;
        }
      };

      // 1. Immediate
      player.volume = INTRO_VOLUME;
      (player as any).loop = true;
      player.muted = false;
      player.play().catch(e => console.warn("Intro autoplay blocked:", e));

      // 2. On Metadata Load
      // @ts-ignore
      player.addEventListener('loaded-metadata', enforce);

      // 3. On Can Play (sometimes persistence hits here)
      // @ts-ignore
      player.addEventListener('can-play', enforce);

      // 4. Safety Timeout (overrides slow async persistence)
      const timeoutId = setTimeout(enforce, 500);

      // 5. Watch for volume changes that might be system-restored
      const handleVolChange = () => {
        // If volume jumps high while in intro, clamp it back down ONCE
        // We assume the first jump is system-restore. 
        // Subsequent jumps might be user interaction, so we don't lock it forever.
        // But to be safe, if it's > 0.2 within the first second, we clamp it.
        if (isIntro && player.volume > 0.2) {
          console.log("System restored high volume, clamping back to Intro Volume");
          player.volume = INTRO_VOLUME;
        }
      };
      // @ts-ignore
      player.addEventListener('volume-change', handleVolChange, { once: true });

      return () => {
        clearTimeout(timeoutId);
        // @ts-ignore
        player.removeEventListener('loaded-metadata', enforce);
        // @ts-ignore
        player.removeEventListener('can-play', enforce);
        // @ts-ignore
        player.removeEventListener('volume-change', handleVolChange);
      };
    }
  }, [isIntro]);

  const handlePlayIntro = () => {
    // 1. Always play locally immediately to ensure Autoplay works (captures user gesture)
    loadVideo(INTRO_URL, true);

    // 2. If Admin, also broadcast to others
    const { isAdmin, userControlsAllowed } = permissionsRef.current;
    if (isAdmin || userControlsAllowed) {
      send({ type: 'load', url: INTRO_URL });
    }
  };

  // --- Listeners ---
  useEffect(() => {
    const handleLocalLoad = (event: CustomEvent<{ url: string; autoPlay: boolean }>) => {
      loadVideo(event.detail.url, event.detail.autoPlay);
    };
    window.addEventListener('play-video', handleLocalLoad as EventListener);
    return () => {
      window.removeEventListener('play-video', handleLocalLoad as EventListener);
    };
  }, [loadVideo]);

  useEffect(() => {
    const handleForceSync = () => {
      const player = playerRef.current;
      if (!player) return;
      sendSync('forceSync', player.currentTime, player.state.paused);
    };
    window.addEventListener('trigger-force-sync', handleForceSync);
    return () => window.removeEventListener('trigger-force-sync', handleForceSync);
  }, [sendSync]);

  // --- Periodic Sync Heartbeat (Perfect Sync) ---
  useEffect(() => {
    /* 
    // DISABLED PER USER REQUEST: "dont sync with others"
    // We will only sync on explicit events (Play/Pause/Seek) to avoid constant jitter/fighting.
    
    const interval = setInterval(() => {
      if (
        playerRef.current &&
        !playerRef.current.state.paused &&
        !isIntro &&
        (permissionsRef.current.isAdmin || permissionsRef.current.userControlsAllowed)
      ) {
        // Send a lightweight sync packet
        sendSync('sync', playerRef.current.currentTime, false);
      }
    }, 2000); // 2 second interval for tight sync

    return () => clearInterval(interval);
    */
  }, [sendSync, isIntro]);

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== "chat") return;
    const id = Date.now() + Math.random();
    const newMsg: FloatingMessage = {
      id,
      nick: lastMessage.nick,
      text: lastMessage.text,
      color: getAvatarColor(lastMessage.nick),
    };
    setOverlayChat((prev) => [...prev, newMsg]);
    setTimeout(() => {
      setOverlayChat((prev) => prev.filter((m) => m.id !== id));
    }, 6000);
  }, [lastMessage]);

  useEffect(() => {
    const player = playerRef.current;
    if (!lastMessage || !player) return;

    if (lastMessage.type === "load") {
      loadVideo(lastMessage.url, true); // Load command normally implies play checking
    } else if (lastMessage.type === "sync" || lastMessage.type === "forceSync") {
      const { time: serverTime, paused, url } = lastMessage;

      // 0 LATENCY OPTIMIZATION
      const ESTIMATED_LATENCY = 0;
      const targetTime = paused ? serverTime : (serverTime + ESTIMATED_LATENCY);

      if (url && url !== currentSrcRef.current) {
        console.log("[Sync] URL change detected, loading:", url);
        isRemoteUpdate.current = true;
        loadVideo(url, !paused, targetTime);
        // Ensure we reset remote update flag even after load
        setTimeout(() => { isRemoteUpdate.current = false; }, 1000);
        return; // loadVideo handles starting play and time in this case
      }

      // SIMPLIFIED SYNC:
      // Since we disabled the heartbeat, every 'sync' packet is an explicit user action (Play/Pause/Seek).
      // We unconditionally apply the state and time to match the Admin.

      isRemoteUpdate.current = true;

      // 1. Apply Time (Seek)
      if (Math.abs(player.currentTime - targetTime) > 0.05) {
        player.currentTime = targetTime;
      }

      // 2. Apply State (Play/Pause)
      if (paused) {
        player.pause();
      } else {
        player.play().catch(e => console.warn("Sync autoplay blocked:", e));
      }

      // Reset flag after a short delay to allow events to settle
      setTimeout(() => { isRemoteUpdate.current = false; }, 500);
    }
  }, [lastMessage, loadVideo]);

  const isLocked = !isAdmin && !userControlsAllowed;

  // --- Ambient Light Loop ---
  useLayoutEffect(() => {
    if (!ambientMode || !playerRef.current) return;

    let animationFrameId: number;
    let lastFrameTime = 0;
    const FPS_LIMIT = 30;
    const interval = 1000 / FPS_LIMIT;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false }); // Optimize for no alpha

    const loop = (timestamp: number) => {
      // Throttle to 30 FPS
      if (timestamp - lastFrameTime >= interval) {
        // Access the raw video element from Vidstack
        // @ts-ignore - Internal access
        const video = playerRef.current?.el?.querySelector('video');

        if (video && canvas && ctx && !video.paused && !video.ended) {
          // Draw low-res for performance (blur hides details)
          if (canvas.width !== 50) canvas.width = 50;
          if (canvas.height !== 50) canvas.height = 50;

          ctx.drawImage(video, 0, 0, 50, 50);
          lastFrameTime = timestamp;
        }
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [ambientMode, src]); // Re-run if src changes or toggled

  return (
    <div className={`video-player-root ${isLocked ? "locked-mode" : ""}`}>
      <MediaPlayer
        ref={playerRef}
        src={src || undefined}
        title="SyncPlayer"
        load="eager"
        crossOrigin
        playsInline
        className="media-player"
        onPlay={onPlay}
        onPause={onPause}
        onSeeked={onSeeked}
        loop={isIntro}
        // @ts-ignore
        disableRemotePlayback={true}
      >
        {/* Ambient Canvas - Must be inside to show in Fullscreen */}
        <canvas
          ref={canvasRef}
          className={`ambient-canvas ${ambientMode ? 'active' : ''}`}
        />
        <MediaProvider />

        {/* Gestures */}
        {/* Changed to 'click' for better mobile handling */}
        <Gesture className="gestures-layer" event="click" action="toggle:controls" />
        <Gesture className="gestures-layer" event="dblpointerup" action="toggle:fullscreen" />

        {/* Speakers - Always Visible Layer (Moved outside overlays) */}
        {activeSpeakers.length > 0 && (
          <div className="speaker-list">
            {activeSpeakers.map((name, i) => (
              <div key={i} className="speaker-pill">
                <div className="speaker-icon-circle">
                  <Mic size={14} color="white" strokeWidth={1.5} />
                </div>
                {/* Reduced font size handled in CSS */}
                <span>{name}</span>
                <div className="flex gap-[2px] h-3 items-end">
                  <div className="wave-bar" style={{ height: '60%', animationDelay: '0s' }}></div>
                  <div className="wave-bar" style={{ height: '100%', animationDelay: '0.1s' }}></div>
                  <div className="wave-bar" style={{ height: '50%', animationDelay: '0.2s' }}></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Overlays Layer - Will fade with controls */}
        <div className="overlays-layer">
          {/* Live Status (Moved from App.tsx) */}
          <div className={`live-status-indicator ${!isConnected ? "offline" : ""}`}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "currentColor",
              }}
            />
            {isConnected ? "Live" : "Offline"}
          </div>

          {/* Chat */}
          <div className="vp-chat-container">
            {overlayChat.map((msg) => (
              <div key={msg.id} className="vp-chat-bubble">
                <span className="vp-chat-nick" style={{ color: msg.color }}>{msg.nick}</span>
                <span className="vp-chat-text">{msg.text}</span>
              </div>
            ))}
          </div>



          {/* Lock Indicator */}
          {isLocked && (
            <div className="lock-indicator">
              <Lock size={16} strokeWidth={1.5} />
            </div>
          )}
        </div>

        {/* Controls Layer */}
        <Controls.Root className="controls-layer">
          <div className="controls-gradient">

            {/* Time Slider */}
            <div style={{ width: '100%' }}>
              <TimeSlider.Root
                className="time-slider group"
                style={{
                  pointerEvents: isLocked ? 'none' : 'auto',
                  opacity: isLocked ? 0.5 : 1
                }}
              >
                <TimeSlider.Track className="time-slider-track">
                  <TimeSlider.TrackFill className="time-slider-fill" />
                  <TimeSlider.Progress className="time-slider-progress" />
                </TimeSlider.Track>
                <TimeSlider.Thumb className="time-slider-thumb" />
              </TimeSlider.Root>
            </div>

            {/* Buttons Row */}
            <div className="buttons-row">
              {/* Left Group */}
              <div className="control-group">
                <button
                  className="control-btn play-btn"
                  onClick={() => !isLocked && remote.togglePaused()}
                  title={isLocked ? "Controls Locked" : (paused ? "Play" : "Pause")}
                  style={{
                    opacity: isLocked ? 0.5 : 1,
                    cursor: isLocked ? 'not-allowed' : 'pointer'
                  }}
                  disabled={isLocked}
                >
                  {paused ? (
                    <Play className="play-icon" strokeWidth={1.5} />
                  ) : (
                    <Pause className="pause-icon" strokeWidth={1.5} />
                  )}
                </button>

                <div className="volume-group">
                  <button
                    className="control-btn volume-btn"
                    onClick={() => remote.toggleMuted()}
                    title={muted ? "Unmute" : "Mute"}
                  >
                    {muted || volume === 0 ? (
                      <VolumeX className="mute-icon" strokeWidth={1.5} />
                    ) : volume < 0.5 ? (
                      <Volume1 className="vol-low-icon" strokeWidth={1.5} />
                    ) : (
                      <Volume2 className="vol-high-icon" strokeWidth={1.5} />
                    )}
                  </button>
                  <VolumeSlider.Root className="volume-slider-container">
                    <VolumeSlider.Track className="volume-track">
                      <VolumeSlider.TrackFill className="volume-fill" />
                      <VolumeSlider.Thumb className="volume-thumb" />
                    </VolumeSlider.Track>
                  </VolumeSlider.Root>
                </div>

                <div className="time-display">
                  <Time type="current" />
                  <span className="time-divider">/</span>
                  <Time type="duration" />
                </div>
              </div>

              {/* Right Group */}
              <div className="control-group">
                {/* Mic Toggle */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleMic(); }}
                  title={isRecording ? "Mute Mic" : "Unmute Mic"}
                  className={`control-btn mic-btn ${isRecording ? 'recording' : ''}`}
                >
                  {isRecording ? <Mic size={32} strokeWidth={1.5} /> : <MicOff size={32} strokeWidth={1.5} />}
                </button>

                {/* Captions - Show for Admin even if empty, to debug */}
                {/* Consolidated Settings Menu (Captions + Audio) */}
                <div className="relative">
                  <button
                    className={`control-btn settings-btn ${showSettingsMenu ? 'active' : ''}`}
                    onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                    title="Settings"
                  >
                    <Settings strokeWidth={1.5} />
                  </button>

                  {showSettingsMenu && (
                    <div className="audio-menu settings-menu">

                      {/* --- Captions Section --- */}
                      <div className="audio-menu-header">Captions</div>
                      {textTracks.length === 0 && <div className="p-2 text-xs text-zinc-500">No captions</div>}

                      {textTracks.length > 0 && (
                        <button
                          className={`audio-track-item ${!currentTextTrack ? 'active' : ''}`}
                          onClick={() => {
                            if (playerRef.current) {
                              Array.from(playerRef.current.textTracks).forEach((t: any) => {
                                t.mode = 'disabled';
                              });
                            }
                            // Don't close immediately, let user toggle other things if needed? 
                            // Or close for better UX. Let's keep open for now or close? 
                            // Usually separate clicks. Let's close for simplicity.
                            // setShowSettingsMenu(false); 
                          }}
                        >
                          <span>Off</span>
                          {!currentTextTrack && <Check size={14} strokeWidth={1.5} />}
                        </button>
                      )}

                      {textTracks.map((track) => (
                        <button
                          key={track.id || track.label}
                          className={`audio-track-item ${currentTextTrack?.id === track.id ? 'active' : ''}`}
                          onClick={() => {
                            if (playerRef.current) {
                              Array.from(playerRef.current.textTracks).forEach((t: any) => {
                                t.mode = (t.id === track.id) ? 'showing' : 'disabled';
                              });
                            }
                            setShowSettingsMenu(false);
                          }}
                        >
                          <span>{track.label || track.language}</span>
                          {currentTextTrack?.id === track.id && <Check size={14} strokeWidth={1.5} />}
                        </button>
                      ))}

                      <div className="menu-divider"></div>

                      {/* --- Audio Section --- */}
                      <div className="audio-menu-header">Audio</div>
                      {audioTracks.length <= 1 && <div className="p-2 text-xs text-zinc-500">Default</div>}

                      {audioTracks.map((track) => (
                        <button
                          key={track.id || track.label}
                          className={`audio-track-item ${currentAudioTrack?.id === track.id ? 'active' : ''}`}
                          onClick={() => {
                            if (playerRef.current) {
                              Array.from(playerRef.current.audioTracks).forEach((t: any) => {
                                if (t.id === track.id) t.selected = true;
                              });
                            }
                            setShowSettingsMenu(false);
                          }}
                        >
                          <span>{track.label || track.language || `Track ${track.id}`}</span>
                          {currentAudioTrack?.id === track.id && <Check size={14} strokeWidth={1.5} />}
                        </button>
                      ))}

                    </div>
                  )}
                </div>

                <button
                  className={`control-btn ${ambientMode ? 'active-glow' : ''}`}
                  onClick={() => setAmbientMode(!ambientMode)}
                  title="Toggle Ambient Mode"
                >
                  <Lightbulb size={20} strokeWidth={1.5} className={ambientMode ? "fill-current text-yellow-400" : ""} />
                </button>

                {!isLocked && (
                  <button
                    className={`control-btn ${isIntro ? 'active-glow' : ''}`}
                    onClick={handlePlayIntro}
                    title="Play Intro Loop"
                  >
                    <Sparkles size={20} strokeWidth={1.5} />
                  </button>
                )}

                <button
                  className="control-btn fs-btn"
                  onClick={() => remote.toggleFullscreen()}
                  title={fullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                  {fullscreen ? (
                    <Minimize className="minimize-icon" strokeWidth={1.5} />
                  ) : (
                    <Maximize className="maximize-icon" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </Controls.Root>
      </MediaPlayer>

    </div>
  );
};

export const VideoPlayer = React.memo(VideoPlayerComponent);
