/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState, useEffect, useCallback } from "react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import { useWebSocket } from "../context/WebSocketContext";
import { updateSliderVisuals as updateSliderVisualsUtil, determineVideoType, extractYouTubeVideoId } from "../utils/videoPlayer.utils";
import {
    INTRO_URL,
    HARD_SYNC_THRESHOLD,
    PAUSE_SYNC_THRESHOLD,
    NORMAL_PLAYBACK_RATE,

    REMOTE_UPDATE_LOCK_DURATION,
    SOURCE_SWITCH_LOCK_DURATION,
    MAX_PACKET_AGE,
    LOCAL_INTERACTION_COOLDOWN,
} from "../constants/videoPlayer.constants";
import { SyncState, type VideoSyncState } from "../types/videoPlayer.types";

export const useVideoSync = (): VideoSyncState => {
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

    // --- Context ---
    const { send, isConnected, isAdmin, userControlsAllowed, proxyEnabled, currentVideoState } =
        useWebSocket();

    const permissionsRef = useRef({ isAdmin, userControlsAllowed, isConnected, proxyEnabled });
    useEffect(() => {
        permissionsRef.current = { isAdmin, userControlsAllowed, isConnected, proxyEnabled };
    }, [isAdmin, userControlsAllowed, isConnected, proxyEnabled]);

    // --- React State ---
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [isIntro, setIsIntro] = useState(false);

    // Media UI State
    const [paused, setPaused] = useState(true);
    const [muted, setMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [displayTime, setDisplayTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const [qualities, setQualities] = useState<any[]>([]);
    const [currentQuality, setCurrentQuality] = useState<number>(-1);
    const [audioTracks, setAudioTracks] = useState<any[]>([]);
    const [currentAudioTrack, setCurrentAudioTrack] = useState<number>(-1);

    // --- Sidecar Subtitles State ---
    const [subtitleTracks, setSubtitleTracks] = useState<any[]>([]);
    const [currentSubtitle, setCurrentSubtitle] = useState<number>(-1); // -1 = Off

    // --- Sync State Management ---
    const [syncState, setSyncState] = useState<SyncState>(SyncState.IDLE);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showAdminToast, setShowAdminToast] = useState(false);
    const [isWaiting, setIsWaiting] = useState(false);
    const syncTimeoutRef = useRef<number | null>(null);

    // --- Helper: Direct CSS Update ---
    const updateSliderVisuals = useCallback((currentTime: number, maxDuration: number, buffered: number) => {
        updateSliderVisualsUtil(timeSliderRef as React.RefObject<HTMLDivElement>, timeInputRef as React.RefObject<HTMLInputElement>, currentTime, maxDuration, buffered);
    }, []);

    // --- Subtitles Toggle ---
    const toggleSubtitle = useCallback((index: number) => {
        setCurrentSubtitle(index);
        const player = playerRef.current;
        if (player) {
            const tracks = player.textTracks() as any;
            for (let i = 0; i < tracks.length; i++) {
                const track = tracks[i];
                if (index === -1) {
                    track.mode = "hidden";
                } else {
                    const target = subtitleTracks[index];
                    if (target && track.label === target.label && track.language === target.srclang) {
                        track.mode = "showing";
                    } else {
                        track.mode = "hidden";
                    }
                }
            }
        }
    }, [subtitleTracks]);

    // --- Sync Logic Wrapper ---
    const sendSync = useCallback(
        (packetType: "sync" | "forceSync", time: number, paused: boolean) => {
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
        },
        [send, isIntro]
    );

    // --- PLAYER INITIALIZATION ---
    useEffect(() => {
        if (!videoContainerRef.current) return;

        const videoElement = document.createElement("video-js");
        videoElement.classList.add("vjs-default-skin", "vjs-fill");
        videoContainerRef.current.appendChild(videoElement);

        const player = videojs(videoElement, {
            controls: false,
            autoplay: false,
            preload: "auto",
            responsive: true,
            fluid: false,
            fill: true,
            techOrder: ["html5"],
            html5: {
                vhs: {
                    overrideNative: !videojs.browser.IS_SAFARI,
                    enableLowInitialPlaylist: true,
                    smoothQualityChange: true,
                    useBandwidthFromLocalStorage: true,
                    limitRenditionByPlayerDimensions: true,
                },
            },
        });

        playerRef.current = player;
        (window as any).player = player;

        setIsPlayerReady(true);

        // --- Quality Levels ---
        const qualityLevels = (player as any).qualityLevels();
        qualityLevels.on("addqualitylevel", () => {
            const levels: any[] = [];
            for (let i = 0; i < qualityLevels.length; i++) {
                levels.push(qualityLevels[i]);
            }
            setQualities(levels);
        });

        // --- Audio Tracks ---
        player.audioTracks().on("change", () => {
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
        player.audioTracks().on("addtrack", () => {
            const tracks = player.audioTracks() as any;
            const arr = [];
            for (let i = 0; i < tracks.length; i++) {
                arr.push(tracks[i]);
            }
            setAudioTracks(arr);
        });

        // --- Event Listeners ---
        player.on("timeupdate", () => {
            const cur = player.currentTime() || 0;
            const dur = player.duration() || 0;
            const buff = player.bufferedEnd() || 0;

            updateSliderVisualsUtil(timeSliderRef as React.RefObject<HTMLDivElement>, timeInputRef as React.RefObject<HTMLInputElement>, cur, dur, buff);
            setDisplayTime(cur);
        });

        player.on("durationchange", () => setDuration(player.duration() || 0));

        player.on("play", () => {
            if (!permissionsRef.current.isAdmin && !permissionsRef.current.userControlsAllowed && !isRemoteUpdate.current) {
                player.pause();
                return;
            }
            setPaused(false);
            isSwitchingSource.current = false;
            if (!isRemoteUpdate.current && !isIntro) sendSync("sync", player.currentTime() || 0, false);
        });

        player.on("pause", () => {
            if (!permissionsRef.current.isAdmin && !permissionsRef.current.userControlsAllowed && !isRemoteUpdate.current) {
                player.play()?.catch(() => { });
                return;
            }
            setPaused(true);
            if (isSwitchingSource.current) return;
            if (!isRemoteUpdate.current && !isIntro) sendSync("sync", player.currentTime() || 0, true);
        });

        player.on("seeked", () => {
            if (!permissionsRef.current.isAdmin && !permissionsRef.current.userControlsAllowed && !isRemoteUpdate.current) {
                return;
            }
            updateSliderVisualsUtil(timeSliderRef as React.RefObject<HTMLDivElement>, timeInputRef as React.RefObject<HTMLInputElement>, player.currentTime() || 0, player.duration() || 0, 0);
            if (!isRemoteUpdate.current && !isIntro) sendSync("sync", player.currentTime() || 0, player.paused());
        });

        player.on("volumechange", () => {
            setVolume(player.volume() || 1);
            setMuted(player.muted() || false);
        });

        player.on("error", () => {
            console.error("VideoJS Error:", player.error());
        });

        player.on("ended", () => {
            console.log('[Player] Video ended');
            // Notify server for queue auto-advance
            if (!isIntro) {
                send({ type: 'video-ended' });
            }
        });

        // --- Buffering & Playback Stability Events ---
        player.on("waiting", () => {
            console.log('[Player] Waiting for data...');
            setIsWaiting(true);
        });

        player.on("playing", () => {
            setIsWaiting(false);
        });

        player.on("stalled", () => {
            console.warn('[Player] Stalled - attempting recovery');
            setIsWaiting(true);
            const currentTime = player.currentTime();

            // Force buffer refresh by micro-seeking
            if (currentTime && currentTime > 0.1) {
                player.currentTime(currentTime - 0.1);
                setTimeout(() => {
                    player.currentTime(currentTime);
                }, 100);
            }
        });

        player.on("suspend", () => {
            console.log('[Player] Suspend event');
        });

        player.on("canplay", () => {
            console.log('[Player] Can play');
            setIsWaiting(false);
            isSwitchingSource.current = false; // Clear switching flag
        });

        player.on("canplaythrough", () => {
            console.log('[Player] Can play through');
        });

        return () => {
            if (player) {
                player.dispose();
            }
            playerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- Load Logic ---
    const loadVideo = useCallback((url: string, autoPlay = false, startTime = 0) => {
        const player = playerRef.current;
        if (!url || url === "#" || !player) return;

        // GUARD: Prevent double-load of same source
        if (currentSrcRef.current === url && !url.includes(INTRO_URL)) {
            console.log('[LoadVideo] Same source, skipping reload:', url);
            return;
        }

        const isNewIntro = url.includes(INTRO_URL) || url === INTRO_URL;
        setIsIntro(isNewIntro);

        // ✅ SOURCE CLEANUP: Stop current playback before switching
        if (currentSrcRef.current && currentSrcRef.current !== url) {
            console.log('[LoadVideo] Cleaning up previous source:', currentSrcRef.current);
            player.pause();
            player.currentTime(0);
        }

        isSwitchingSource.current = true;

        // Enter INITIAL_SYNC state for non-intro videos
        if (!isNewIntro) {
            setSyncState(SyncState.INITIAL_SYNC);
            setIsSyncing(true);
            if (permissionsRef.current.isAdmin) {
                setShowAdminToast(true);
            }
            // Clear any existing timeout
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
                syncTimeoutRef.current = null;
            }
        }

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
            if (url.includes("youtube.com") || url.includes("youtu.be")) {
                const videoId = extractYouTubeVideoId(url);
                if (videoId) {
                    finalSrc = `/api/youtube/dash/manifest.mpd?id=${videoId}`;
                } else {
                    finalSrc = `/api/proxy?url=${btoa(url)}`;
                }
            } else {
                finalSrc = `/api/proxy?url=${btoa(url)}`;
            }
        }

        // --- Fetch Sidecar Subtitles ---
        setSubtitleTracks([]);
        const tracks = player.remoteTextTracks();
        while ((tracks as any).length > 0) {
            player.removeRemoteTextTrack((tracks as any)[0]);
        }

        if (finalSrc && !finalSrc.includes("blob:")) {
            try {
                const baseUrl = finalSrc.substring(0, finalSrc.lastIndexOf("/"));
                if (baseUrl) {
                    const jsonUrl = `${baseUrl}/subtitles.json`;
                    fetch(jsonUrl)
                        .then((res) => {
                            if (res.ok) return res.json();
                            throw new Error("No manifest");
                        })
                        .then((data) => {
                            const mapped = data.map((t: any) => ({
                                ...t,
                                src: `${baseUrl}/${t.src}`,
                            }));
                            setSubtitleTracks(mapped);
                            mapped.forEach((t: any) => {
                                player.addRemoteTextTrack(
                                    {
                                        kind: "subtitles",
                                        src: t.src,
                                        srclang: t.srclang,
                                        label: t.label,
                                        default: t.default,
                                    },
                                    false
                                );
                            });
                        })
                        .catch(() => {
                            // Ignore subtitle loading errors
                        });
                }
            } catch {
                // Ignore URL parsing errors
            }
        }

        const type = determineVideoType(finalSrc);
        player.src({ src: finalSrc, type });

        if (autoPlay || permissionsRef.current.isAdmin || permissionsRef.current.userControlsAllowed) {
            player.one("loadedmetadata", () => {
                if (startTime > 0) player.currentTime(startTime);

                // Transition to SYNCED after a short delay (simulating "all users ready")
                if (!isNewIntro) {
                    syncTimeoutRef.current = window.setTimeout(() => {
                        console.log('[Sync] All participants ready, transitioning to SYNCED state');
                        setSyncState(SyncState.SYNCED);
                        setIsSyncing(false);

                        // Show success message for 2 seconds before auto-dismiss
                        setTimeout(() => {
                            setShowAdminToast(false);
                        }, 2000);

                        if (autoPlay) {
                            // Ensure this play event is treated as a remote update to update UI state
                            isRemoteUpdate.current = true;
                            const p = player.play();
                            if (p) p.catch((e) => console.warn("Autoplay blocked", e));

                            // Reset flag shortly after play initiates
                            setTimeout(() => {
                                isRemoteUpdate.current = false;
                            }, 500);
                        }
                    }, 500); // 500ms delay for faster auto-play on manual load
                } else if (autoPlay) {
                    const p = player.play();
                    if (p) p.catch((e) => console.warn("Autoplay blocked", e));
                }
            });
        }

        if (isNewIntro) {
            player.loop(true);
            player.play()?.catch(() => { });
        }
    }, [isIntro]);

    const handlePlayIntro = useCallback(() => {
        loadVideo(INTRO_URL, true);
        const { isAdmin, userControlsAllowed } = permissionsRef.current;
        if (isAdmin || userControlsAllowed) {
            send({ type: "load", url: INTRO_URL });
            setTimeout(() => {
                send({ type: "forceSync", url: INTRO_URL, time: 0, paused: false });
            }, 200);
        }
    }, [loadVideo, send]);

    // --- Incoming Sync Events ---
    const syncStateRef = useRef(syncState);
    useEffect(() => { syncStateRef.current = syncState; }, [syncState]);

    useEffect(() => {
        if (!isPlayerReady) return;

        const handleLocalLoad = (event: CustomEvent<{ url: string; autoPlay: boolean }>) => {
            const { url, autoPlay } = event.detail;

            // GUARD: Don't reload if already in INITIAL_SYNC for this URL
            if (syncStateRef.current === SyncState.INITIAL_SYNC && currentSrcRef.current === url) {
                console.log('[LocalLoad] Already syncing this source, skipping:', url);
                return;
            }

            loadVideo(url, autoPlay);
        };
        window.addEventListener("play-video", handleLocalLoad as EventListener);
        const handleForceSync = () => {
            const player = playerRef.current;
            if (player) sendSync("forceSync", player.currentTime() || 0, player.paused());
        };
        window.addEventListener("trigger-force-sync", handleForceSync);

        return () => {
            window.removeEventListener("play-video", handleLocalLoad as EventListener);
            window.removeEventListener("trigger-force-sync", handleForceSync);
        };
    }, [loadVideo, sendSync, isPlayerReady]);

    // --- State Synchronization ---
    useEffect(() => {
        const player = playerRef.current;
        if (!isPlayerReady || !player || !currentVideoState) return;

        const { url, time: serverTime, paused: serverPaused, timestamp } = currentVideoState;

        const timeSinceInteraction = Date.now() - lastLocalInteractionRef.current;
        if (timeSinceInteraction < LOCAL_INTERACTION_COOLDOWN) return;

        const networkLatency = (Date.now() - timestamp) / 1000;
        const targetTime = serverPaused ? serverTime : serverTime + networkLatency;

        const packetAge = Date.now() - timestamp;
        if (packetAge > MAX_PACKET_AGE && url === currentSrcRef.current && !currentVideoState.isForce) return;

        // --- FORCE SYNC LOGIC ---
        if (currentVideoState.isForce) {
            console.log(`[ForceSync] Executing hard sync to ${targetTime} (Paused: ${serverPaused})`);
            isRemoteUpdate.current = true;

            if (url && url !== currentSrcRef.current) {
                loadVideo(url, !serverPaused, targetTime);
            } else {
                // 1. SEEK FIRST
                player.currentTime(targetTime);

                // 2. WAIT FOR SEEK TO COMPLETE (Buffer Load)
                // We use {once: true} to ensure this only fires for this specific seek
                player.one('seeked', () => {
                    console.log('[ForceSync] Seek completed, applying play/pause state');

                    if (serverPaused) {
                        if (!player.paused()) {
                            console.log('[ForceSync] Pausing player');
                            player.pause();
                        }
                    } else {
                        if (player.paused()) {
                            console.log('[ForceSync] Playing player');
                            const p = player.play();
                            if (p) p.catch(e => console.warn("[ForceSync] Autoplay blocked/error:", e));
                        }
                    }
                });
            }

            setTimeout(() => {
                isRemoteUpdate.current = false;
            }, REMOTE_UPDATE_LOCK_DURATION);
            return;
        }

        if (url && url !== currentSrcRef.current) {
            isRemoteUpdate.current = true;
            loadVideo(url, !serverPaused, targetTime);
            setTimeout(() => {
                isRemoteUpdate.current = false;
            }, SOURCE_SWITCH_LOCK_DURATION);
            return;
        }

        if (url === currentSrcRef.current && (!isSwitchingSource.current || (!serverPaused && player.paused()))) {
            const cur = player.currentTime() || 0;
            const drift = targetTime - cur;
            const absDrift = Math.abs(drift);
            const isPausedStateMatch = player.paused() === serverPaused;

            if (!isPausedStateMatch) {
                isRemoteUpdate.current = true;
                if (serverPaused) {
                    player.pause();
                    if (absDrift > PAUSE_SYNC_THRESHOLD) player.currentTime(targetTime);
                } else {
                    player.play()?.catch(() => { });
                    if (absDrift > HARD_SYNC_THRESHOLD) player.currentTime(targetTime);
                }
                setTimeout(() => {
                    isRemoteUpdate.current = false;
                }, 800);
                return;
            }

            if (!serverPaused) {
                // If drift is massive, HARD SYNC
                if (absDrift > HARD_SYNC_THRESHOLD) {
                    isRemoteUpdate.current = true;
                    player.currentTime(targetTime);
                    player.playbackRate(NORMAL_PLAYBACK_RATE); // Enforce 1.0
                    setTimeout(() => {
                        isRemoteUpdate.current = false;
                    }, 800);
                }
                // We are in sync
                else {
                    if (player.playbackRate() !== NORMAL_PLAYBACK_RATE) {
                        console.log("[SoftSync] Stabilized: Rate -> 1.0");
                        player.playbackRate(NORMAL_PLAYBACK_RATE);
                    }
                }
            } else {
                // Server is PAUSED
                // Important: Ensure we are at 1.0 rate even if we pause, so next play starts normal
                if (player.playbackRate() !== NORMAL_PLAYBACK_RATE) {
                    player.playbackRate(NORMAL_PLAYBACK_RATE);
                }

                if (absDrift > PAUSE_SYNC_THRESHOLD) {
                    isRemoteUpdate.current = true;
                    player.currentTime(targetTime);
                    setTimeout(() => {
                        isRemoteUpdate.current = false;
                    }, 800);
                }
            }
        }
    }, [currentVideoState, loadVideo, isPlayerReady]);

    // --- Interaction Handlers ---
    const togglePlay = useCallback(async (e?: React.MouseEvent | React.TouchEvent | any) => {
        if (e && e.stopPropagation) e.stopPropagation();

        const { isAdmin, userControlsAllowed } = permissionsRef.current;
        if (!isAdmin && !userControlsAllowed) return;

        const player = playerRef.current;
        if (!player) return;

        // GUARD: Block play during INITIAL_SYNC
        if (syncState === SyncState.INITIAL_SYNC) {
            console.log('[Sync Guard] Play blocked - waiting for initial sync');
            return;
        }

        lastLocalInteractionRef.current = Date.now();
        isRemoteUpdate.current = false;

        try {
            if (player.paused()) {
                await player.play();
                if (!isIntro) sendSync("sync", player.currentTime() || 0, false);
            } else {
                player.pause();
                if (!isIntro) sendSync("sync", player.currentTime() || 0, true);
            }
        } catch (error) {
            console.warn("Interaction interrupted:", error);
        }
    }, [syncState, isIntro, sendSync]);

    const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        const player = playerRef.current;
        if (player) {
            lastLocalInteractionRef.current = Date.now();
            isRemoteUpdate.current = false;

            player.currentTime(val);
            updateSliderVisualsUtil(timeSliderRef as React.RefObject<HTMLDivElement>, timeInputRef as React.RefObject<HTMLInputElement>, val, duration, 0);
            setDisplayTime(val);
        }
    }, [duration]);

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

    const dismissSyncToast = useCallback(() => {
        setShowAdminToast(false);
    }, []);

    return {
        // Refs
        playerRef,
        videoContainerRef,
        canvasRef,
        timeSliderRef,
        timeInputRef,

        // Player state
        isPlayerReady,
        paused,
        muted,
        volume,
        displayTime,
        duration,
        isIntro,

        // Quality & Tracks
        qualities,
        currentQuality,
        audioTracks,
        currentAudioTrack,
        subtitleTracks,
        currentSubtitle,

        // Sync state
        syncState,
        isSyncing,
        showAdminToast,
        isBuffering: isWaiting,

        // Handlers
        togglePlay,
        handleSeek,
        handleVolumeChange,
        handleToggleMute,
        handlePlayIntro,
        setCurrentQuality,
        setCurrentSubtitle,
        setCurrentAudioTrack,
        toggleSubtitle,
        updateSliderVisuals,
        dismissSyncToast,
    };
};
