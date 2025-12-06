import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

// We will capture at hardware rate but only send 16k
const TARGET_SAMPLE_RATE = 16000;
const JITTER_BUFFER_MS = 0.25; // 250ms buffer for stability

// --- OPTIMIZED AUDIO WORKLET ---
const WORKLET_CODE = `
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // OPTIMIZATION 1: Sensitivity
    // Lowered from 0.02 to 0.002 to capture whispers/soft endings
    this.silenceThreshold = 0.01; 
    
    // OPTIMIZATION 2: Hangover Time
    // 150 frames * ~2.9ms per frame = ~435ms. 
    // This keeps the mic open long enough for the "tails" of words.
    this.HANG_TIME = 150; 
    
    this.hangoverFrames = 0;
    
    // Buffer for the DOWNSAMPLED audio
    this.chunkBuffer = new Int16Array(2048); 
    this.chunkIndex = 0;

    // OPTIMIZATION 3: High-Pass Filter State (Removes mud/rumble)
    this.prevIn = 0;
    this.prevOut = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channel = input[0];
    
    // We create a temporary buffer for the filtered audio
    // This ensures we calculate volume based on the CLEAN signal
    const processedChannel = new Float32Array(channel.length);

    // --- STEP A: High-Pass Filter (80Hz cutoff @ 48kHz) ---
    // Algorithm: y[i] = alpha * (y[i-1] + x[i] - x[i-1])
    const alpha = 0.985; 

    for (let i = 0; i < channel.length; i++) {
        const x = channel[i];
        const y = alpha * (this.prevOut + x - this.prevIn);
        
        processedChannel[i] = y;
        this.prevIn = x;
        this.prevOut = y;
    }

    // --- STEP B: Calculate Volume (RMS) on Filtered Data ---
    let sumSquares = 0;
    for (let i = 0; i < processedChannel.length; i++) {
        sumSquares += processedChannel[i] * processedChannel[i];
    }
    const rms = Math.sqrt(sumSquares / processedChannel.length);

    // --- STEP C: Noise Gate Logic ---
    if (rms > this.silenceThreshold) {
        this.hangoverFrames = this.HANG_TIME;
    }

    if (this.hangoverFrames > 0) {
      // If gate is open, decrement timer if below threshold
      if (rms <= this.silenceThreshold) {
          this.hangoverFrames--;
      }

      // --- STEP D: Downsampling (48k -> 16k) ---
      // We use the 'processedChannel' (filtered audio) here
      const ratio = sampleRate / 16000; 
      
      for (let i = 0; i < processedChannel.length; i += ratio) {
        const idx = Math.floor(i);
        if (idx < processedChannel.length) {
           let sample = processedChannel[idx];

           if (this.chunkIndex < this.chunkBuffer.length) {
              // OPTIMIZATION 4: Soft Clipping
              // Instead of hard-clipping at 1.0, we clamp safely
              // to prevent crackling if someone yells.
              if (sample > 1.0) sample = 1.0;
              if (sample < -1.0) sample = -1.0;
              
              // Convert Float to Int16
              this.chunkBuffer[this.chunkIndex] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
              this.chunkIndex++;
           }
        }
      }

      // Send when buffer is full
      if (this.chunkIndex >= this.chunkBuffer.length) this.flush();

    } else if (this.chunkIndex > 0) {
      // Flush leftover data if gate closes so packets don't get stuck
      this.flush();
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
    // 1. Get all necessary items from Context
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

    const handleSetVolume = (val: number) => { setVolume(val); volumeRef.current = val; };

    // 2. RECEIVER INIT (Standard 16kHz Context)
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

    // 3. RECEIVER LOGIC
    useEffect(() => {
        const handleAudioData = (data: ArrayBuffer) => {
            if (!audioCtxRef.current) initAudio();
            const ctx = audioCtxRef.current!;

            if (ctx.state === 'suspended' && !isResumingRef.current) {
                isResumingRef.current = true;
                ctx.resume().finally(() => isResumingRef.current = false);
            }

            const view = new DataView(data);
            const userId = view.getUint32(0, false); // Read User ID from first 4 bytes

            // Mark speaker as active
            speakerActivityRef.current.set(userId, Date.now());

            if (ctx.state === 'suspended') return;

            // Extract PCM (skip first 4 bytes)
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

            // Sync Logic
            if (scheduleTime < now) scheduleTime = now + (JITTER_BUFFER_MS / 2);
            else if (scheduleTime > now + 1.0) scheduleTime = now + JITTER_BUFFER_MS;

            source.start(scheduleTime);
            peer.nextTime = scheduleTime + buffer.duration;
        };

        const unsubscribe = subscribeToAudio(handleAudioData);
        return () => unsubscribe();
    }, [subscribeToAudio, initAudio]);

    // 4. MICROPHONE LOGIC
    const toggleMic = useCallback(async () => {
        if (isRecording) {
            // STOP RECORDING
            micStreamRef.current?.getTracks().forEach(t => t.stop());
            micStreamRef.current = null;
            if (workletNodeRef.current) {
                workletNodeRef.current.port.postMessage('stop');
                workletNodeRef.current.disconnect();
            }
            workletNodeRef.current = null;
            setIsRecording(false);
        } else {
            // START RECORDING
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
                    console.error(e);
                }

                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        autoGainControl: true,
                        noiseSuppression: true,
                        // @ts-ignore
                        voiceIsolation: true,
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
                    // e.data is the Int16Array PCM buffer
                    const pcmData = e.data;

                    // Construct Packet: [UserID (4 bytes)] + [PCM Data]
                    const totalLen = 4 + pcmData.byteLength;
                    const buffer = new ArrayBuffer(totalLen);
                    const view = new DataView(buffer);

                    // Write UserID (Big Endian to match receiver)
                    view.setUint32(0, myUserId, false);

                    // Copy PCM
                    const destInt16 = new Int16Array(buffer, 4);
                    const srcInt16 = new Int16Array(pcmData);
                    destInt16.set(srcInt16);

                    sendAudio(buffer);
                };

                source.connect(workletNode);
                // Do NOT connect to ctx.destination (no self-monitoring)

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