import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

// --- CONFIGURATION ---
const TARGET_SAMPLE_RATE = 16000; 
const JITTER_BUFFER_MS = 0.06; 

// --- OPTIMIZED AUDIO WORKLET ---
const WORKLET_CODE = `
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 1. LOWER THRESHOLD:
    // Reduced from 0.01 to 0.008 to catch softer word endings better.
    this.silenceThreshold = 0.008; 
    
    // 2. LONGER HANG TIME (The Fix):
    // Increased from 3200 (200ms) to 8000 (500ms).
    // The mic will stay open for 0.5 seconds after you stop talking
    // so the "tail" of your voice is never cut off.
    this.HANG_TIME = 8000; 
    
    this.hangoverFrames = 0;
    this.chunkBuffer = new Int16Array(512); 
    this.chunkIndex = 0;

    this.prevIn = 0;
    this.prevOut = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channel = input[0];
    const alpha = 0.985; 
    const ratio = sampleRate / 16000; 

    for (let i = 0; i < channel.length; i += ratio) {
       const idx = Math.floor(i);
       if (idx >= channel.length) break;

       const x = channel[idx];
       
       // High Pass Filter
       const y = alpha * (this.prevOut + x - this.prevIn);
       this.prevIn = x;
       this.prevOut = y;

       // Gate Logic
       const absY = Math.abs(y);
       if (absY > this.silenceThreshold) {
           this.hangoverFrames = this.HANG_TIME;
       }

       if (this.hangoverFrames > 0) {
           if (absY <= this.silenceThreshold) this.hangoverFrames--;

           if (this.chunkIndex < this.chunkBuffer.length) {
                // Soft Clipping
                let sample = y;
                if (sample > 1.0) sample = 1.0;
                if (sample < -1.0) sample = -1.0;

                this.chunkBuffer[this.chunkIndex] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                this.chunkIndex++;
           }
       } else if (this.chunkIndex > 0) {
           this.flush();
       }

       if (this.chunkIndex >= this.chunkBuffer.length) {
           this.flush();
       }
    }
    
    return true;
  }

  flush() {
    if (this.chunkIndex === 0) return;
    const bufferToSend = this.chunkBuffer.slice(0, this.chunkIndex);
    this.port.postMessage(bufferToSend.buffer, [bufferToSend.buffer]);
    this.chunkIndex = 0;
  }
}
registerProcessor('mic-processor', MicProcessor);
`;

export const useAudio = () => {
    const { sendAudio, myUserId, subscribeToAudio, userMap } = useWebSocket();
    const [isRecording, setIsRecording] = useState(false);
    const [volume, setVolume] = useState(1.0);
    const volumeRef = useRef(1.0);
    const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
    const [audioBlocked, setAudioBlocked] = useState(false);

    const audioCtxRef = useRef<AudioContext | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const peerAudioStateRef = useRef<Record<number, { nextTime: number }>>({});
    const isResumingRef = useRef(false);
    const speakerActivityRef = useRef<Map<number, number>>(new Map());
    const myUserIdRef = useRef<number | null>(myUserId);

    useEffect(() => {
        myUserIdRef.current = myUserId;
    }, [myUserId]);

    const handleSetVolume = (val: number) => { setVolume(val); volumeRef.current = val; };

    // --- RECEIVER INIT ---
    const initAudio = useCallback(() => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: TARGET_SAMPLE_RATE,
                latencyHint: 'interactive'
            });
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
        }
        return audioCtxRef.current;
    }, []);

    // --- RECEIVER LOGIC ---
    useEffect(() => {
        const handleAudioData = (data: ArrayBuffer) => {
            if (!audioCtxRef.current) initAudio();
            const ctx = audioCtxRef.current!;

            if (ctx.state === 'suspended' && !isResumingRef.current) {
                isResumingRef.current = true;
                ctx.resume().finally(() => isResumingRef.current = false);
            }

            const view = new DataView(data);
            const userId = view.getUint32(0, false);
            speakerActivityRef.current.set(userId, Date.now());

            if (ctx.state === 'suspended') return;

            const pcmBuffer = data.slice(4);
            const int16Data = new Int16Array(pcmBuffer);
            const float32Data = new Float32Array(int16Data.length);
            for (let i = 0; i < int16Data.length; i++) {
                float32Data[i] = int16Data[i] / 32768.0;
            }

            if (!peerAudioStateRef.current[userId]) {
                peerAudioStateRef.current[userId] = { nextTime: ctx.currentTime + JITTER_BUFFER_MS };
            }
            const peer = peerAudioStateRef.current[userId];
            
            const buffer = ctx.createBuffer(1, float32Data.length, TARGET_SAMPLE_RATE);
            buffer.getChannelData(0).set(float32Data);

            const source = ctx.createBufferSource();
            source.buffer = buffer;
            const gain = ctx.createGain();
            gain.gain.value = volumeRef.current;
            source.connect(gain);
            gain.connect(ctx.destination);

            const now = ctx.currentTime;
            
            if (peer.nextTime < now) {
                peer.nextTime = now; 
            }
            else if (peer.nextTime > now + 0.2) {
                peer.nextTime = now + JITTER_BUFFER_MS;
            }

            source.start(peer.nextTime);
            peer.nextTime += buffer.duration;
        };

        const unsubscribe = subscribeToAudio(handleAudioData);
        return () => unsubscribe();
    }, [subscribeToAudio, initAudio]);

    // --- MIC LOGIC ---
    const toggleMic = useCallback(async () => {
        if (isRecording) {
            micStreamRef.current?.getTracks().forEach(t => t.stop());
            micStreamRef.current = null;
            if (workletNodeRef.current) {
                workletNodeRef.current.port.postMessage('stop');
                workletNodeRef.current.disconnect();
            }
            workletNodeRef.current = null;
            setIsRecording(false);
        } else {
            try {
                if (!myUserId) {
                    alert("Not connected to server yet!");
                    return;
                }
                const ctx = initAudio();
                try {
                    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
                    await ctx.audioWorklet.addModule(URL.createObjectURL(blob));
                } catch (e) {
                    console.error("Worklet load error:", e);
                }

                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true, 
                        autoGainControl: false, 
                        noiseSuppression: false, 
                        //@ts-ignore
                        latency: 0,
                        sampleRate: TARGET_SAMPLE_RATE,
                        channelCount: 1,
                    }
                });
                micStreamRef.current = stream;

                const source = ctx.createMediaStreamSource(stream);
                const workletNode = new AudioWorkletNode(ctx, 'mic-processor');
                workletNodeRef.current = workletNode;

                workletNode.port.onmessage = (e) => {
                    const pcmData = e.data;
                    const totalLen = 4 + pcmData.byteLength;
                    const buffer = new ArrayBuffer(totalLen);
                    const view = new DataView(buffer);
                    
                    const currentId = myUserIdRef.current;
                    if (currentId === null) return;

                    view.setUint32(0, currentId, false);
                    const destInt16 = new Int16Array(buffer, 4);
                    const srcInt16 = new Int16Array(pcmData);
                    destInt16.set(srcInt16);

                    sendAudio(buffer);
                };

                source.connect(workletNode);
                setIsRecording(true);
            } catch (e) {
                console.error("Mic Error", e);
                alert("Mic Error: " + e);
            }
        }
    }, [isRecording, initAudio, sendAudio, myUserId]);

    // Active Speaker Poller
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const active: string[] = [];
            speakerActivityRef.current.forEach((lastTime, userId) => {
                if (now - lastTime < 1000) active.push(userMap[userId] || `User ${userId}`);
            });
            setActiveSpeakers(active);
        }, 500);
        return () => clearInterval(interval);
    }, [userMap]);

    return { isRecording, toggleMic, volume, setVolume: handleSetVolume, initAudio, activeSpeakers, audioBlocked };
};