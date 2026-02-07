/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState, useEffect, useCallback } from "react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import { useWebSocket } from "../context/WebSocketContext";
import { updateSliderVisuals as updateSliderVisualsUtil, determineVideoType, extractYouTubeVideoId } from "../utils/videoPlayer.utils";
import {
    INTRO_URL,
    SOFT_SYNC_THRESHOLD,
    HARD_SYNC_THRESHOLD,
    PAUSE_SYNC_THRESHOLD,
    SOFT_SYNC_SPEED_UP,
    SOFT_SYNC_SLOW_DOWN,
    NORMAL_PLAYBACK_RATE,
    REMOTE_UPDATE_LOCK_DURATION,
    SOURCE_SWITCH_LOCK_DURATION,
    MAX_PACKET_AGE,
    LOCAL_INTERACTION_COOLDOWN,
} from "../constants/videoPlayer.constants";

export const useVideoSync = () => {
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

    // --- Helper: Direct CSS Update ---
    const updateSliderVisuals = useCallback((currentTime: number, maxDuration: number, buffered: number) => {
        updateSliderVisualsUtil(timeSliderRef, timeInputRef, currentTime, maxDuration, buffered);
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
                },
            },
        });

        playerRef.current = player;
        (window as any).player = player;

        setIsPlayerReady(true);

        // --- Quality Levels ---
        const qualityLevels = player.qualityLevels() as any;
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

            updateSliderVisualsUtil(timeSliderRef, timeInputRef, cur, dur, buff);
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
            updateSliderVisualsUtil(timeSliderRef, timeInputRef, player.currentTime() || 0, player.duration() || 0, 0);
            if (!isRemoteUpdate.current && !isIntro) sendSync("sync", player.currentTime() || 0, player.paused());
        });

        player.on("volumechange", () => {
            setVolume(player.volume() || 1);
            setMuted(player.muted() || false);
        });

        player.on("error", () => {
            console.error("VideoJS Error:", player.error());
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
        while (tracks.length > 0) {
            player.removeRemoteTextTrack(tracks[0]);
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
                if (autoPlay) {
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
    useEffect(() => {
        if (!isPlayerReady) return;

        const handleLocalLoad = (event: CustomEvent<{ url: string; autoPlay: boolean }>) => {
            loadVideo(event.detail.url, event.detail.autoPlay);
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
                if (player.paused() !== serverPaused) {
                    if (serverPaused) player.pause();
                    else player.play()?.catch(() => { });
                }
                player.currentTime(targetTime);
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
                if (absDrift > HARD_SYNC_THRESHOLD) {
                    isRemoteUpdate.current = true;
                    player.currentTime(targetTime);
                    player.playbackRate(NORMAL_PLAYBACK_RATE);
                    setTimeout(() => {
                        isRemoteUpdate.current = false;
                    }, 800);
                } else if (absDrift > SOFT_SYNC_THRESHOLD) {
                    const newRate = drift > 0 ? SOFT_SYNC_SPEED_UP : SOFT_SYNC_SLOW_DOWN;
                    if (player.playbackRate() !== newRate) {
                        console.log(`Soft Sync: Drift ${drift.toFixed(3)}s, Rate -> ${newRate}`);
                        player.playbackRate(newRate);
                    }
                } else {
                    if (player.playbackRate() !== NORMAL_PLAYBACK_RATE) {
                        console.log("Soft Sync Exit: Rate -> 1.0");
                        player.playbackRate(NORMAL_PLAYBACK_RATE);
                    }
                }
            } else {
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

        lastLocalInteractionRef.current = Date.now();
        isRemoteUpdate.current = false;

        try {
            if (player.paused()) await player.play();
            else player.pause();
        } catch (error) {
            console.warn("Interaction interrupted:", error);
        }
    }, []);

    const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        const player = playerRef.current;
        if (player) {
            lastLocalInteractionRef.current = Date.now();
            isRemoteUpdate.current = false;

            player.currentTime(val);
            updateSliderVisualsUtil(timeSliderRef, timeInputRef, val, duration, 0);
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
    };
};
