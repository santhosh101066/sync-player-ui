import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

// --- CONFIGURATION ---
const TARGET_SAMPLE_RATE = 16000;
const INACTIVITY_TIMEOUT_MS = 10000; // Cleanup nodes after 10s of silence

// --- OPTIMIZED AUDIO WORKLET ---
const WORKLET_CODE = `
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.silenceThreshold = 0.002; // More sensitive to pick up quiet speech
    this.HANG_TIME = 16000; // 1 second hang time to prevent choppy audio
    this.hangoverFrames = 0;
    this.chunkBuffer = new Int16Array(512); 
    this.chunkIndex = 0;
    this.prevIn = 0;
    this.prevOut = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    const ratio = sampleRate / 16000; 

    for (let i = 0; i < channel.length; i += ratio) {
       const idx = Math.floor(i);
       const x = channel[idx];
       const y = 0.995 * (this.prevOut + x - this.prevIn); // Smoother high-pass
       this.prevIn = x; this.prevOut = y;

       const absY = Math.abs(y);
       if (absY > this.silenceThreshold) this.hangoverFrames = this.HANG_TIME;

       if (this.hangoverFrames > 0) {
           if (absY <= this.silenceThreshold) this.hangoverFrames--;
           if (this.chunkIndex < this.chunkBuffer.length) {
                let sample = y;
                if (sample > 1.0) sample = 1.0;
                if (sample < -1.0) sample = -1.0;
                this.chunkBuffer[this.chunkIndex] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                this.chunkIndex++;
           }
       } else if (this.chunkIndex > 0) { this.flush(); }
       if (this.chunkIndex >= this.chunkBuffer.length) this.flush();
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

class ReceiverProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = Math.floor(sampleRate * 3);
    this.buffer = new Float32Array(this.bufferSize);
    this.writePtr = 0;
    this.readPtr = 0;
    this.isPlaying = false;
    this.minBuffer = Math.floor(0.15 * sampleRate); // Increased to 150ms to remove jitter
    this.maxBuffer = Math.floor(0.30 * sampleRate); // 300ms drift limit

    this.port.onmessage = (e) => {
        if (e.data === 'stop') { this.isPlaying = false; return; }
        const data = e.data;
        for (let i = 0; i < data.length; i++) {
            this.buffer[this.writePtr] = data[i];
            this.writePtr = (this.writePtr + 1) % this.bufferSize;
        }
    };
  }

  process(inputs, outputs) {
     const channel = outputs[0][0];
     if (!channel) return true;

     let available = (this.writePtr - this.readPtr + this.bufferSize) % this.bufferSize;

     if (!this.isPlaying) {
         if (available >= this.minBuffer) this.isPlaying = true;
         else { channel.fill(0); return true; }
     }

     if (available < channel.length) {
         this.isPlaying = false; // Underrun
         channel.fill(0);
         return true;
     }

     if (available > this.maxBuffer) {
         const skip = available - this.minBuffer;
         this.readPtr = (this.readPtr + skip) % this.bufferSize;
     }

     for (let i = 0; i < channel.length; i++) {
         channel[i] = this.buffer[this.readPtr];
         this.readPtr = (this.readPtr + 1) % this.bufferSize;
     }
     return true;
  }
}
registerProcessor('mic-processor', MicProcessor);
registerProcessor('receiver-processor', ReceiverProcessor);
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

    // Track Node + Gain for global volume control
    const receiverNodesRef = useRef<Map<string, { node: AudioWorkletNode, gain: GainNode }>>(new Map());
    const moduleLoadedRef = useRef(false);
    const speakerActivityRef = useRef<Map<string, number>>(new Map());

    const handleSetVolume = (val: number) => {
        setVolume(val);
        volumeRef.current = val;
        // Apply volume to all current speakers instantly
        receiverNodesRef.current.forEach(({ gain }) => {
            gain.gain.setTargetAtTime(val, audioCtxRef.current?.currentTime || 0, 0.01);
        });
    };

    const initAudio = useCallback(async () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: TARGET_SAMPLE_RATE,
                latencyHint: 'interactive'
            });
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') await ctx.resume().catch(() => setAudioBlocked(true));

        if (!moduleLoadedRef.current) {
            const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
            await ctx.audioWorklet.addModule(URL.createObjectURL(blob));
            moduleLoadedRef.current = true;
        }
        return ctx;
    }, []);

    useEffect(() => {
        const handleAudioData = async (data: ArrayBuffer) => {
            const ctx = await initAudio();
            if (!ctx || !moduleLoadedRef.current) return;

            const userIdBytes = new Uint8Array(data.slice(0, 64));
            let userId = "";
            for (let i = 0; i < 64; i++) {
                if (userIdBytes[i] === 0) break;
                userId += String.fromCharCode(userIdBytes[i]);
            }
            speakerActivityRef.current.set(userId, Date.now());

            let peer = receiverNodesRef.current.get(userId);
            if (!peer) {
                const node = new AudioWorkletNode(ctx, 'receiver-processor');
                const gain = ctx.createGain();
                gain.gain.value = volumeRef.current;
                node.connect(gain).connect(ctx.destination);
                peer = { node, gain };
                receiverNodesRef.current.set(userId, peer);
            }

            const float32Data = new Float32Array(new Int16Array(data.slice(64)).length);
            const int16 = new Int16Array(data.slice(64));
            for (let i = 0; i < int16.length; i++) float32Data[i] = int16[i] / 32768.0;

            peer.node.port.postMessage(float32Data);
        };

        const unsubscribe = subscribeToAudio(handleAudioData);
        return () => unsubscribe();
    }, [subscribeToAudio, initAudio]);

    // Active Speaker Poller & Cleanup
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const active: string[] = [];

            speakerActivityRef.current.forEach((lastTime, userId) => {
                // 1. Add to active speakers list
                if (now - lastTime < 1000) active.push(userMap[userId] || userId);

                // 2. Cleanup inactive nodes to save memory/CPU
                if (now - lastTime > INACTIVITY_TIMEOUT_MS) {
                    const peer = receiverNodesRef.current.get(userId);
                    if (peer) {
                        peer.node.disconnect();
                        peer.gain.disconnect();
                        receiverNodesRef.current.delete(userId);
                        speakerActivityRef.current.delete(userId);
                    }
                }
            });
            setActiveSpeakers(active);
        }, 1000);
        return () => clearInterval(interval);
    }, [userMap]);

    const toggleMic = useCallback(async () => {
        if (isRecording) {
            micStreamRef.current?.getTracks().forEach(t => t.stop());
            workletNodeRef.current?.disconnect();
            setIsRecording(false);
        } else {
            try {
                if (!myUserId) return alert("Connect first!");
                const ctx = await initAudio();
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: true,
                        autoGainControl: false, // Prevent volume pumping
                        sampleRate: TARGET_SAMPLE_RATE
                    }
                });
                micStreamRef.current = stream;
                const source = ctx.createMediaStreamSource(stream);
                const booster = ctx.createGain();
                booster.gain.value = 2.0; // Manual boost (200%)

                const workletNode = new AudioWorkletNode(ctx, 'mic-processor');
                workletNodeRef.current = workletNode;

                workletNode.port.onmessage = (e) => {
                    const userIdBytes = new Uint8Array(64);
                    for (let i = 0; i < Math.min(myUserId.length, 64); i++) userIdBytes[i] = myUserId.charCodeAt(i);
                    const buffer = new ArrayBuffer(64 + e.data.byteLength);
                    new Uint8Array(buffer).set(userIdBytes, 0);
                    new Int16Array(buffer, 64).set(new Int16Array(e.data));
                    sendAudio(buffer);
                };
                source.connect(booster).connect(workletNode);
                setIsRecording(true);
            } catch (e) { console.error("Mic Error", e); }
        }
    }, [isRecording, initAudio, sendAudio, myUserId]);

    return { isRecording, toggleMic, volume, setVolume: handleSetVolume, initAudio, activeSpeakers, audioBlocked };
};