import React, { useCallback, useEffect, useRef, useState } from "react";
import "video.js/dist/video-js.css";
import "videojs-contrib-quality-levels";

import { VideoSurface } from "./VideoPlayer/VideoSurface";
import { PlayerControls } from "./VideoPlayer/PlayerControls";
import { StatusIndicators } from "./VideoPlayer/StatusIndicators";
import { ChatOverlay } from "./VideoPlayer/ChatOverlay";
import { SyncOverlay } from "./VideoPlayer/SyncOverlay";
import { useVideoSync } from "../hooks/useVideoSync";
import { useWebSocket } from "../context/WebSocketContext";
import { getAvatarColor } from "../utils/videoPlayer.utils";
import { CONTROLS_HIDE_DELAY, CHAT_MESSAGE_DURATION } from "../constants/videoPlayer.constants";
import type { VideoPlayerProps, FloatingMessage } from "../types/videoPlayer.types";

const VideoPlayerComponent: React.FC<VideoPlayerProps> = ({
  activeSpeakers,
  toggleMic,
  isRecording,
}) => {
  // Use custom hook for video state management
  const videoSync = useVideoSync();

  // WebSocket context
  const { lastMessage, isConnected, isAdmin, userControlsAllowed, nickname } = useWebSocket();

  // Local UI state
  const [controlsVisible, setControlsVisible] = useState(true);
  const [ambientMode, setAmbientMode] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [overlayChat, setOverlayChat] = useState<FloatingMessage[]>([]);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLocked = !isAdmin && !userControlsAllowed;

  // --- Controls Visibility ---
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (!videoSync.paused) {
      controlsTimeoutRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY);
    }
  }, [videoSync.paused]);

  // --- Fullscreen Toggle ---
  const toggleFullscreen = useCallback(() => {
    const el = document.querySelector(".video-player-root");
    if (!document.fullscreenElement) {
      el?.requestFullscreen().then(() => setFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setFullscreen(false));
    }
  }, []);

  // --- Overlay Chat ---
  // eslint-disable-next-line react-hooks/set-state-in-effect
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

    // This setState is intentional - we're responding to external WebSocket messages
    setOverlayChat((prev) => [...prev, newMsg]);

    const timer = setTimeout(() => {
      setOverlayChat((prev) => prev.filter((m) => m.id !== id));
    }, CHAT_MESSAGE_DURATION);

    return () => clearTimeout(timer);
  }, [lastMessage, nickname]);

  return (
    <div
      className={`video-player-root relative w-full h-full bg-black shadow-2xl font-sans overflow-hidden group/root ${controlsVisible || videoSync.paused ? "controls-active" : ""
        }`}
      onMouseMove={showControls}
      onClick={showControls}
      onMouseLeave={() => !videoSync.paused && setControlsVisible(false)}
    >
      {/* Video Surface (Canvas + Video.js Player) */}
      <VideoSurface
        playerRef={videoSync.playerRef}
        videoContainerRef={videoSync.videoContainerRef}
        canvasRef={videoSync.canvasRef}
        ambientMode={ambientMode}
        isPlayerReady={videoSync.isPlayerReady}
        isLocked={isLocked}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Status Indicators (Connection, Lock, Active Speakers) */}
      <StatusIndicators
        isConnected={isConnected}
        isLocked={isLocked}
        activeSpeakers={activeSpeakers}
        controlsVisible={controlsVisible}
        paused={videoSync.paused}
      />

      {/* Chat Overlay */}
      <ChatOverlay messages={overlayChat} />

      {/* Sync Overlay (Buffer Wait, Admin Toast) */}
      <SyncOverlay
        isBuffering={false}
        syncMessage={undefined}
        isAdmin={isAdmin}
        showAdminToast={false}
      />

      {/* Player Controls */}
      <PlayerControls
        paused={videoSync.paused}
        volume={videoSync.volume}
        muted={videoSync.muted}
        displayTime={videoSync.displayTime}
        duration={videoSync.duration}
        fullscreen={fullscreen}
        isRecording={isRecording}
        isLocked={isLocked}
        isIntro={videoSync.isIntro}
        ambientMode={ambientMode}
        controlsVisible={controlsVisible}
        qualities={videoSync.qualities}
        currentQuality={videoSync.currentQuality}
        audioTracks={videoSync.audioTracks}
        currentAudioTrack={videoSync.currentAudioTrack}
        subtitleTracks={videoSync.subtitleTracks}
        currentSubtitle={videoSync.currentSubtitle}
        timeSliderRef={videoSync.timeSliderRef}
        timeInputRef={videoSync.timeInputRef}
        playerRef={videoSync.playerRef}
        onPlayPause={videoSync.togglePlay}
        onSeek={videoSync.handleSeek}
        onVolumeChange={videoSync.handleVolumeChange}
        onToggleMute={videoSync.handleToggleMute}
        onToggleFullscreen={toggleFullscreen}
        onToggleMic={toggleMic}
        onToggleAmbient={() => setAmbientMode(!ambientMode)}
        onPlayIntro={videoSync.handlePlayIntro}
        onQualityChange={videoSync.setCurrentQuality}
        onSubtitleChange={videoSync.toggleSubtitle}
        onAudioTrackChange={videoSync.setCurrentAudioTrack}
      />
    </div>
  );
};

export const VideoPlayer = React.memo(VideoPlayerComponent);