/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import "@videojs/themes/dist/fantasy/index.css";
import { Mic, MicOff } from "lucide-react";
import { useWebSocket } from "../context/WebSocketContext";
import type { ServerMessage } from "../types/types";

interface PlayVideoDetail {
  url: string;
  autoPlay: boolean; // New flag
}

// Extend Video.js options if needed
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
    "#f87171",
    "#fb923c",
    "#fbbf24",
    "#a3e635",
    "#34d399",
    "#22d3ee",
    "#818cf8",
    "#c084fc",
    "#f472b6",
    "#f43f5e",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  activeSpeakers,
  toggleMic,
  isRecording,
}) => {
  // --- Refs ---
  const videoWrapperRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any | null>(null);
  const currentSrcRef = useRef<string>("");
  const isRemoteUpdate = useRef(false);

  // --- Context ---
  const { send, lastMessage, isConnected, isAdmin, userControlsAllowed } =
    useWebSocket();

  // Use a ref for permissions to access them inside Video.js event closures without dependency issues
  const permissionsRef = useRef({ isAdmin, userControlsAllowed, isConnected });

  // --- State ---
  const [overlayChat, setOverlayChat] = useState<FloatingMessage[]>([]);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // --- DOM Elements for Portals ---
  // We create these once. They will be injected into the Video.js DOM structure.
  const overlayElement = useMemo(() => {
    const el = document.createElement("div");
    el.className = "vjs-react-overlay-container";
    return el;
  }, []);

  const micControlElement = useMemo(() => {
    const el = document.createElement("div");
    el.className = "vjs-control vjs-react-mic-control";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.cursor = "pointer";
    return el;
  }, []);

  // --- Logic: Sync Helper ---
  const sendSync = useCallback((
    packetType: 'sync' | 'forceSync',
    time: number,
    paused: boolean
  ) => {
    const { isAdmin, userControlsAllowed, isConnected } = permissionsRef.current;

    if (!isConnected) return;
    // Only Admin or Allowed users can drive the session
    if (!isAdmin && !userControlsAllowed) return;

    send({
      type: packetType,
      time: time,
      paused: paused,
      url: currentSrcRef.current,
    });
  }, [send]);

  useEffect(() => {
    const handleForceSyncRequest = () => {
      const player = playerRef.current;
      if (!player) return;

      // Send a FORCE sync with current exact state
      console.log("⚡ Executing Force Sync");
      sendSync('forceSync', player.currentTime(), player.paused());
    };

    window.addEventListener('trigger-force-sync', handleForceSyncRequest);
    return () => {
      window.removeEventListener('trigger-force-sync', handleForceSyncRequest);
    };
  }, [send, sendSync]);

  const playVideo = (url: string, autoPlay: boolean = false) => {
    const player = playerRef.current;
    if (!player || !url) return;

    // Prevent reloading the same source repeatedly
    if (currentSrcRef.current === url && player.currentSrc().includes(url))
      return;
    currentSrcRef.current = url;

    let type = "application/x-mpegURL"; // Default to HLS
    if (url.match(/\.(mp4|webm|mkv)$/i)) type = "video/mp4";

    let src = url;
    if (
      !url.startsWith("/") &&
      !url.includes(window.location.host)
    ) {
      // Proxy both HLS and MP4/MKV/WebM to ensure CORS bypass and consistent behavior
      src = `/api/proxy?url=${btoa(url)}`;
    }

    player.src({ src, type });

    // [FIXED AUTOPLAY LOGIC] Use the flag passed from the Library click
    if (autoPlay || permissionsRef.current.isAdmin || permissionsRef.current.userControlsAllowed) {
      player.play()?.catch((e: unknown) => console.warn("Autoplay blocked:", e));
    }
  };

  // --- Effect: Update Permissions Ref ---
  useEffect(() => {
    permissionsRef.current = { isAdmin, userControlsAllowed, isConnected };
  }, [isAdmin, userControlsAllowed, isConnected]);

  useEffect(() => {
    const handleLocalLoad = (event: CustomEvent<PlayVideoDetail>) => {
      playVideo(event.detail.url, event.detail.autoPlay);
    };

    window.addEventListener('play-video', handleLocalLoad as EventListener);

    return () => {
      window.removeEventListener('play-video', handleLocalLoad as EventListener);
    };
  }, []);
  // --- Effect: Handle Chat Messages ---
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

    // Auto-remove chat bubble after 6 seconds
    // ✅ We do NOT assign this to a variable or return a cleanup.
    // We want this timer to run to completion regardless of new messages.
    setTimeout(() => {
      setOverlayChat((prev) => prev.filter((m) => m.id !== id));
    }, 6000);

  }, [lastMessage]);

  // --- Effect: Handle WebSocket Video Commands ---
  useEffect(() => {
    const player = playerRef.current;
    if (!lastMessage || !player) return;

    const msg: ServerMessage = lastMessage;

    if (msg.type === "load") {
      playVideo(msg.url);
    } else if (msg.type === "sync" || msg.type === "forceSync") {
      const { time, paused, url } = msg;

      // 1. URL Mismatch Check
      if (url && url !== currentSrcRef.current) {
        isRemoteUpdate.current = true;
        playVideo(url);
      }

      // 2. Time Sync Check
      const drift = Math.abs(player.currentTime()! - time);
      const threshold = msg.type === "forceSync" ? 0.1 : 1.5;

      if (drift > threshold) {
        isRemoteUpdate.current = true;
        player.currentTime(time);
      }

      // 3. Play/Pause State Check
      const isPlayerPaused = player.paused();
      if (paused && !isPlayerPaused) {
        isRemoteUpdate.current = true;
        player.pause();
      } else if (!paused && isPlayerPaused) {
        isRemoteUpdate.current = true;
        player.play()?.catch(() => { });
      }

      // Reset the "remote update" flag after a short delay to allow events to settle
      setTimeout(() => {
        isRemoteUpdate.current = false;
      }, 500);
    }
  }, [lastMessage]);

  // --- LayoutEffect: Initialize Video.js ---
  useLayoutEffect(() => {
    if (!videoWrapperRef.current) return;
    if (playerRef.current) return; // Prevent double init

    // 1. Create the DOM element
    const videoElement = document.createElement("video-js");
    videoElement.classList.add("vjs-big-play-centered", "vjs-theme-fantasy");
    videoWrapperRef.current.appendChild(videoElement);

    // 2. Initialize Player
    const player = videojs(videoElement, {
      controls: true,
      autoplay: false,
      preload: "auto",
      fluid: true,
      liveui: false,
      controlBar: {
        children: [
          "playToggle",
          "volumePanel",
          "currentTimeDisplay",
          "timeDivider",
          "durationDisplay",
          "progressControl",
          "liveDisplay",
          "remainingTimeDisplay",
          "customControlSpacer",
          "playbackRateMenuButton",
          "chaptersButton",
          "descriptionsButton",
          "subsCapsButton",
          "audioTrackButton",
          "videoTrackButton",
          "fullscreenToggle",
        ],
      },
    });

    playerRef.current = player;

    // 3. Inject React Portal Containers
    // Inject Overlays (Chat/Speakers)
    player.el().appendChild(overlayElement);

    // Inject Mic Button into Control Bar
    const controlBar = player.getChild("ControlBar");
    if (controlBar) {
      const fullscreenToggle = controlBar.getChild("FullscreenToggle");
      const fsNode = fullscreenToggle?.el();
      if (fsNode && fsNode.parentNode) {
        fsNode.parentNode.insertBefore(micControlElement, fsNode);
      } else {
        controlBar.el().appendChild(micControlElement);
      }
    }
    player.on("ready", () => {
      setIsPlayerReady(true);
      if (player.hasClass('vjs-live')) {
        player.removeClass('vjs-live');
      }
    });
    // 4. Bind Events (with Remote Loop Protection)
    player.on("play", () => {
      if (!isRemoteUpdate.current)
        sendSync("sync", player.currentTime() ?? 0, false);
    });
    player.on("pause", () => {
      if (!isRemoteUpdate.current)
        sendSync("sync", player.currentTime() ?? 0, true);
    });
    player.on("seeked", () => {
      if (!isRemoteUpdate.current)
        sendSync("sync", player.currentTime() ?? 0, player.paused());
    });
    player.on("fullscreenchange", () => {
      if (player.isFullscreen()) {
        // Attempt to lock to landscape
        try {
          if (screen.orientation && (screen.orientation as any).lock) {
            (screen.orientation as any).lock("landscape").catch((e: any) => {
              console.warn("Screen rotation lock failed:", e);
            });
          } else if ((window as any).screen.mozLockOrientation) {
            (window as any).screen.mozLockOrientation("landscape");
          } else if ((window as any).screen.msLockOrientation) {
            (window as any).screen.msLockOrientation("landscape");
          }
        } catch (e) {
          // Ignore errors (feature not supported on some browsers)
        }
      } else {
        // Unlock orientation on exit
        try {
          if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
          } else if ((window as any).screen.mozUnlockOrientation) {
            (window as any).screen.mozUnlockOrientation();
          } else if ((window as any).screen.msUnlockOrientation) {
            (window as any).screen.msUnlockOrientation();
          }
        } catch (e) {
          console.error(e);
        }
      }
    });

    // 5. Mark ready for Portals

    // Cleanup
    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
        setIsPlayerReady(false);
      }
    };
  }, []); // Run once on mount

  const isLocked = !isAdmin && !userControlsAllowed;

  return (
    <div className={`video-container ${isLocked ? "locked-mode" : ""}`}>
      {/* Video.js Mount Point */}
      <div data-vjs-player>
        <div ref={videoWrapperRef} />
      </div>

      {/* Render Portals only when Video.js is initialized */}
      {isPlayerReady && (
        <>
          {/* 1. Mic Button Portal */}
          {createPortal(
            <div
              onClick={(e) => {
                e.stopPropagation();
                toggleMic();
              }}
              title={isRecording ? "Mute Microphone" : "Unmute Microphone"}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
                color: isRecording ? "#ef4444" : "#fff",
              }}
            >
              {isRecording ? (
                <Mic size={20} className="pulse-anim" />
              ) : (
                <MicOff size={20} />
              )}
            </div>,
            micControlElement
          )}

          {/* 2. Overlays Portal */}
          {createPortal(
            <div className="vjs-overlay-content">
              {/* Chat Bubbles */}
              <div className="vjs-chat-overlay">
                {overlayChat.map((msg) => (
                  <div key={msg.id} className="vjs-chat-bubble">
                    <span
                      className="vjs-chat-nick"
                      style={{ color: msg.color }}
                    >
                      {msg.nick}
                    </span>
                    <span className="vjs-chat-text">{msg.text}</span>
                  </div>
                ))}
              </div>

              {/* Active Speakers List */}
              {activeSpeakers.length > 0 && (
                <div className="vjs-speaker-list">
                  {activeSpeakers.map((name, i) => (
                    <div key={i} className="vjs-speaker-item">
                      <div className="speaker-avatar">
                        <Mic size={12} color="white" />
                      </div>
                      <span className="speaker-name">{name}</span>
                      <div className="speaker-wave">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Lock Indicator */}
              {isLocked && (
                <div className="vjs-lock-indicator">
                  <span style={{ fontSize: "1.2rem" }}>🔒</span>
                  <span>Controls Locked</span>
                </div>
              )}
            </div>,
            overlayElement
          )}
        </>
      )}
    </div>
  );
};
