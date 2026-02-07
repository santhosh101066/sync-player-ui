import React, { useLayoutEffect } from "react";
import type { VideoSurfaceProps } from "../../types/videoPlayer.types";
import { AMBIENT_FPS, AMBIENT_CANVAS_SIZE } from "../../constants/videoPlayer.constants";

export const VideoSurface: React.FC<VideoSurfaceProps> = ({
    playerRef,
    videoContainerRef,
    canvasRef,
    ambientMode,
    isPlayerReady,
    isLocked,
    onToggleFullscreen,
}) => {
    // Ambient Light Loop
    useLayoutEffect(() => {
        if (!ambientMode || !playerRef.current || !isPlayerReady) return;

        let animationFrameId: number;
        let lastFrameTime = 0;
        const interval = 1000 / AMBIENT_FPS;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { alpha: false });

        const loop = (timestamp: number) => {
            if (timestamp - lastFrameTime >= interval) {
                const player = playerRef.current;
                const videoEl = player?.el()?.querySelector("video");

                if (videoEl && canvas && ctx && !player?.paused() && !player?.ended()) {
                    if (canvas.width !== AMBIENT_CANVAS_SIZE) canvas.width = AMBIENT_CANVAS_SIZE;
                    if (canvas.height !== AMBIENT_CANVAS_SIZE) canvas.height = AMBIENT_CANVAS_SIZE;
                    try {
                        ctx.drawImage(videoEl, 0, 0, AMBIENT_CANVAS_SIZE, AMBIENT_CANVAS_SIZE);
                    } catch {
                        /* ignore CORS errors */
                    }
                    lastFrameTime = timestamp;
                }
            }
            animationFrameId = requestAnimationFrame(loop);
        };
        animationFrameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animationFrameId);
    }, [ambientMode, isPlayerReady, playerRef, canvasRef]);

    return (
        <>
            {/* Ambient Canvas */}
            <canvas
                ref={canvasRef as React.RefObject<HTMLCanvasElement>}
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full z-0 blur-[80px] saturate-[1.5] brightness-[0.8] transition-opacity duration-1000 pointer-events-none ${ambientMode ? "opacity-60" : "opacity-0"
                    }`}
                style={{ zIndex: 0 }}
            />

            {/* Video.js Styling */}
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

            {/* Video Container */}
            <div className="absolute inset-0 z-[5] w-full h-full">
                <div ref={videoContainerRef as React.RefObject<HTMLDivElement>} />
            </div>

            {/* Interaction Layer (for double-click fullscreen) */}
            <div
                className="absolute inset-0 z-[6] w-full h-full block"
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    onToggleFullscreen();
                }}
                style={{ pointerEvents: isLocked ? "none" : "auto" }}
            />
        </>
    );
};
