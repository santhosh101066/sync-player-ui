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

// Import the external CSS
import "./VideoPlayer.css";

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
      setPaused(false);
      isSwitchingSource.current = false;
      if (!isRemoteUpdate.current && !isIntro) sendSync("sync", video.currentTime, false);
    };

    const onPauseEvent = () => {
      setPaused(true);
      if (isSwitchingSource.current) return;
      if (!isRemoteUpdate.current && !isIntro) sendSync("sync", video.currentTime, true);
    };

    const onSeeked = () => {
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
    const el = document.querySelector('.video-player-root');
    if (!document.fullscreenElement) {
      el?.requestFullscreen().then(() => setFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setFullscreen(false));
    }
  };

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
    if (isAdmin || userControlsAllowed) send({ type: 'load', url: INTRO_URL });
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

  // -- Pre-calculate Volume Styles --
  const volumePercent = (muted ? 0 : volume) * 100;
  const volumeStyle = { '--slider-fill': `${volumePercent}%` } as React.CSSProperties;

  return (
    <div
      className={`video-player-root ${isLocked ? "locked-mode" : ""}`}
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

      <canvas ref={canvasRef} className={`ambient-canvas ${ambientMode ? 'active' : ''}`} style={{ zIndex: 0 }} />

      <video
        ref={videoRef}
        className="media-player"
        playsInline
        crossOrigin="anonymous"
        // onClick={togglePlay}
        style={{ position: 'relative', zIndex: 5 }}
      />

      <div
        className="gestures-layer"
        onDoubleClick={(e) => {
          e.stopPropagation();
          toggleFullscreen();
        }}
        style={{ zIndex: 6 }}
      />

      {/* --- SPEAKERS (Now Visible on Top) --- */}
      {activeSpeakers.length > 0 && (
        <div className="speaker-list" style={{ zIndex: 20 }}>
          {activeSpeakers.map((name, i) => (
            <div key={i} className="speaker-pill">
              <div className="speaker-icon-circle">
                <Mic size={14} color="white" strokeWidth={1.5} />
              </div>
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

      {/* --- CHAT OVERLAY --- */}
      <div className="vp-chat-container" style={{ zIndex: 20 }}>
        {overlayChat.map((msg) => (
          <div key={msg.id} className="vp-chat-bubble">
            <span className="vp-chat-nick" style={{ color: msg.color }}>{msg.nick}</span>
            <span className="vp-chat-text">{msg.text}</span>
          </div>
        ))}
      </div>

      {/* --- STATUS OVERLAY --- */}
      <div className="overlays-layer" style={{ zIndex: 20 }}>
        <div className={`live-status-indicator ${!isConnected ? "offline" : ""}`}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor" }} />
          {isConnected ? "Live" : "Offline"}
        </div>
        {isLocked && (
          <div className="lock-indicator">
            <Lock size={16} strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* --- CONTROLS --- */}
      <div className="controls-layer" data-visible={controlsVisible || paused} style={{ zIndex: 20 }}>
        <div className="controls-gradient">

          {/* TIME SLIDER (Optimized Ref) */}
          <div style={{ width: '100%', position: 'relative', height: '14px', marginBottom: '8px' }}>
            <div
              ref={timeSliderRef}
              className="time-slider group"
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
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  zIndex: 20,
                  cursor: 'pointer'
                }}
              />
              <div className="time-slider-track">
                <div className="time-slider-fill" />
                <div className="time-slider-progress" />
                <div className="time-slider-thumb" />
              </div>
            </div>
          </div>

          <div className="buttons-row">
            <div className="control-group">
              <button
                className="control-btn play-btn"
                onClick={togglePlay}
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

              <div className="volume-group" style={{ position: 'relative' }}>
                <button
                  className="control-btn volume-btn"
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.muted = !muted;
                      setMuted(!muted);
                    }
                  }}
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
                <div className="volume-slider-container" style={{ ...volumeStyle, width: '80px' }}>
                  <input
                    type="range"
                    min="0" max="1" step="0.05"
                    value={muted ? 0 : volume}
                    onInput={handleVolume}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      zIndex: 20,
                      cursor: 'pointer'
                    }}
                  />
                  <div className="volume-track">
                    <div className="volume-fill" />
                    <div className="volume-thumb" />
                  </div>
                </div>
              </div>

              <div className="time-display">
                <span>{formatTime(displayTime)}</span>
                <span className="time-divider">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="control-group">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleMic(); }}
                title={isRecording ? "Mute Mic" : "Unmute Mic"}
                className={`control-btn mic-btn ${isRecording ? 'recording' : ''}`}
              >
                {isRecording ? <Mic size={32} strokeWidth={1.5} /> : <MicOff size={32} strokeWidth={1.5} />}
              </button>

              <div className="relative">
                <button
                  className={`control-btn settings-btn ${showSettingsMenu ? 'active' : ''}`}
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  title="Settings"
                >
                  <Settings strokeWidth={1.5} />
                </button>

                {showSettingsMenu && (
                  <div className="audio-menu settings-menu" ref={settingsRef}>
                    <div className="audio-menu-header">Quality</div>
                    <button
                      className={`audio-track-item ${currentQuality === -1 ? 'active' : ''}`}
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
                        className={`audio-track-item ${currentQuality === i ? 'active' : ''}`}
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
                onClick={toggleFullscreen}
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
      </div>
    </div>
  );
};

export const VideoPlayer = React.memo(VideoPlayerComponent);