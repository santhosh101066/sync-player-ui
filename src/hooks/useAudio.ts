import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

// We will capture at hardware rate (usually 48k) but only send 16k
const TARGET_SAMPLE_RATE = 16000; 
const JITTER_BUFFER_MS = 0.25; // 250ms buffer for stability

// --- WORKLET (Downsampling + Batching) ---
const WORKLET_CODE = `
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.silenceThreshold = 0.02;
    this.hangoverFrames = 0;
    this.HANG_TIME = 30; // ~200ms hold time
    
    // Buffer for the DOWNSAMPLED audio
    // We send chunks of 2048 samples (approx 128ms at 16kHz)
    this.chunkBuffer = new Int16Array(2048); 
    this.chunkIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channel = input[0];
      
      // 1. Calculate Volume (RMS)
      let sumSquares = 0;
      for (let i = 0; i < channel.length; i++) sumSquares += channel[i] * channel[i];
      const rms = Math.sqrt(sumSquares / channel.length);

      // 2. Gate Logic
      if (rms > this.silenceThreshold) this.hangoverFrames = this.HANG_TIME;
      
      if (this.hangoverFrames > 0) {
        if (rms <= this.silenceThreshold) this.hangoverFrames--;

        // 3. DOWNSAMPLE LOGIC (The Bandwidth Saver)
        // Most mics are 48kHz. We want 16kHz. 
        // 48000 / 16000 = 3. We take every 3rd sample.
        // We estimate the ratio dynamically just in case.
        
        // Note: In a real Worklet, sampleRate is a global variable
        const ratio = sampleRate / 16000; 
        
        for (let i = 0; i < channel.length; i += ratio) {
          // Simple decimation (taking every Nth sample)
          const idx = Math.floor(i);
          if (idx < channel.length) {
             const sample = channel[idx];

             if (this.chunkIndex < this.chunkBuffer.length) {
                // Float to Int16
                let s = Math.max(-1, Math.min(1, sample));
                this.chunkBuffer[this.chunkIndex] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                this.chunkIndex++;
             }
          }
        }

        // 4. Send when buffer is full
        if (this.chunkIndex >= this.chunkBuffer.length) this.flush();

      } else if (this.chunkIndex > 0) {
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
    const { sendBinary, subscribeToAudio, userMap } = useWebSocket();
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

    const handleSetVolume = (val: number) => { setVolume(val); volumeRef.current = val; };

    // 1. RECEIVER INIT (Standard 16kHz Context)
    const initAudio = useCallback(() => {
        if (!audioCtxRef.current) {
            // We set the context to 16kHz to match our downsampled data
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

    // 2. RECEIVER LOGIC
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

            let scheduleTime = peer.nextTime;
            const now = ctx.currentTime;
            
            // Sync Logic: If drifted too far, reset
            if (scheduleTime < now) scheduleTime = now + (JITTER_BUFFER_MS / 2);
            else if (scheduleTime > now + 1.0) scheduleTime = now + JITTER_BUFFER_MS;

            source.start(scheduleTime);
            peer.nextTime = scheduleTime + buffer.duration;
        };

        const unsubscribe = subscribeToAudio(handleAudioData);
        return () => unsubscribe();
    }, [subscribeToAudio, initAudio]);

    // 3. MICROPHONE LOGIC (With Downsampling Worklet)
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
                // Initialize audio context at native rate for Mic input
                // Note: We create a temporary context or reuse existing one, 
                // but capturing at 'default' hardware rate is safest.
                const ctx = initAudio();
                
                try {
                    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
                    await ctx.audioWorklet.addModule(URL.createObjectURL(blob));
                } catch(e) {}

                // Capture at default rate (e.g. 48k)
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: { 
                        echoCancellation: true, 
                        noiseSuppression: true, 
                        autoGainControl: true 
                    } 
                });
                micStreamRef.current = stream;
                
                const source = ctx.createMediaStreamSource(stream);
                const workletNode = new AudioWorkletNode(ctx, 'mic-processor');
                workletNodeRef.current = workletNode;

                workletNode.port.onmessage = (e) => {
                   sendBinary(e.data);
                };

                source.connect(workletNode);
                workletNode.connect(ctx.destination);
                setIsRecording(true);
            } catch (e) {
                console.error("Mic Error", e);
                alert("Mic Error: " + e);
            }
        }
    }, [isRecording, initAudio, sendBinary]);

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