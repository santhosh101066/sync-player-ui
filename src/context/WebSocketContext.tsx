import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import type { ConnectedUser, ClientMessage, ServerMessage } from "../types/types";

// Define the shape of a chat message for the UI (History)
export interface UIChatMessage {
  nick: string;
  text: string;
  isAdmin?: boolean;
  isSystem?: boolean;
  timestamp: number;
}

interface WebSocketContextType {
  ws: WebSocket | null;
  voiceWs: WebSocket | null;
  isConnected: boolean;
  connect: (nickname: string) => void;
  send: (data: ClientMessage) => void;
  sendAudio: (data: ArrayBuffer) => void;
  lastMessage: ServerMessage | null;
  nickname: string;
  isAdmin: boolean;
  setIsAdmin: (isAdmin: boolean) => void;
  subscribeToAudio: (callback: (data: ArrayBuffer) => void) => () => void;
  myUserId: number | null;
  userMap: Record<number, string>;
  connectedUsers: ConnectedUser[];
  userControlsAllowed: boolean;
  proxyEnabled: boolean;
  chatMessages: UIChatMessage[];
  addLocalMessage: (text: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // --- State & Refs ---
  const [signalingWs, setSignalingWs] = useState<WebSocket | null>(null);
  const [voiceWs, setVoiceWs] = useState<WebSocket | null>(null);
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [nickname, setNickname] = useState("Guest");
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userMap, setUserMap] = useState<Record<number, string>>({});
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [userControlsAllowed, setUserControlsAllowed] = useState(false);
  const [proxyEnabled, setProxyEnabled] = useState(true);
  const [chatMessages, setChatMessages] = useState<UIChatMessage[]>([]);

  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceKeepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectVoiceRef = useRef<((host: string, protocol: string) => void) | null>(null);
  const signalingRef = useRef<WebSocket | null>(null);
  const voiceRef = useRef<WebSocket | null>(null);
  const audioListenersRef = useRef<Set<(data: ArrayBuffer) => void>>(new Set());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<((nick: string) => void) | null>(null);

  // --- 1. Audio Subscription Helper ---
  const subscribeToAudio = useCallback((callback: (data: ArrayBuffer) => void) => {
    audioListenersRef.current.add(callback);
    return () => {
      audioListenersRef.current.delete(callback);
    };
  }, []);

  // --- 2. Voice Connection Logic (Now defined first) ---
  const connectVoice = useCallback((host: string, protocol: string) => {
    // Check if a voice socket is already open before creating a new one
    if (voiceRef.current && voiceRef.current.readyState === WebSocket.OPEN) return;

    const vSocket = new WebSocket(`${protocol}//${host}/voice`);
    vSocket.binaryType = "arraybuffer";

    voiceRef.current = vSocket;
    setVoiceWs(vSocket);

    vSocket.onopen = () => {
      console.log("🎤 Voice Channel Ready");
      setVoiceWs(vSocket);
      voiceKeepAliveRef.current = setInterval(() => {
        if (vSocket.readyState === WebSocket.OPEN) {
          vSocket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 20000);
    };

    vSocket.onmessage = (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        audioListenersRef.current.forEach((cb) => cb(event.data));
      }
    };

    vSocket.onclose = () => {
      console.log("🎤 Voice Channel Closed. Attempting reconnect...");
      setVoiceWs(null);


      // If signaling is still open, try reconnecting the voice channel after a delay.
      if (signalingRef.current && signalingRef.current.readyState === WebSocket.OPEN) {
        // Clear the ref to ensure next call creates a new socket
        voiceRef.current = null;
        setTimeout(() => {
          // Safe recursive call via ref
          if (connectVoiceRef.current) {
            connectVoiceRef.current(host, protocol);
          }
        }, 2000); // Reduced delay to 2s for faster recovery
      }
    };
    vSocket.onerror = (err) => {
      console.error("Mic Socket Error:", err);
      vSocket.close(); // Force close to trigger onclose logic
    };

  }, []);

  // --- 3. Signaling Connection Logic (Now defined second) ---
  const connect = useCallback((nick: string) => {
    setNickname(nick);

    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (signalingRef.current) signalingRef.current.close();
    if (voiceRef.current) voiceRef.current.close();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = import.meta.env.DEV ? "localhost:8000" : window.location.host;

    const socket = new WebSocket(`${protocol}//${host}/sync`);

    socket.onopen = () => {
      console.log("🟢 Signaling Connected");
      setIsConnected(true);
      const identityMsg: ClientMessage = { type: "identify", nick };
      socket.send(JSON.stringify(identityMsg));

      // Heartbeat: Send ping every 30 seconds
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    socket.onmessage = (event: MessageEvent) => {
      try {
        if (typeof event.data !== 'string') return;
        const msg = JSON.parse(event.data) as ServerMessage;

        // Heartbeat: Respond to server ping
        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        }

        // A. Handle Handshake
        if (msg.type === "welcome") {
          setMyUserId(msg.userId);
          connectVoice(host, protocol);
        }

        // B. Handle State Updates
        if (msg.type === 'user-list') {
          setConnectedUsers(msg.users);
          const map: Record<number, string> = {};
          msg.users.forEach((u) => map[u.id] = u.nick);
          setUserMap(map);
        }
        if (msg.type === 'system-state') {
          setUserControlsAllowed(msg.userControlsAllowed);
          if (msg.proxyEnabled !== undefined) setProxyEnabled(msg.proxyEnabled);
        }
        if (msg.type === 'admin-success') {
          setIsAdmin(true);
        }

        // Global Chat Handler (Fixes tab switch duplication)
        if (msg.type === 'chat') {
          setChatMessages(prev => [...prev, {
            nick: msg.nick,
            text: msg.text,
            isAdmin: msg.isAdmin,
            isSystem: msg.isSystem,
            timestamp: Date.now()
          }]);
        }

        setLastMessage(msg);
      } catch (e) {
        console.error("WS Message Error", e);
      }
    };

    socket.onclose = () => {
      console.log("🔴 Signaling Disconnected");
      setIsConnected(false);
      setSignalingWs(null);

      // Cleanly close voice channel and stop heartbeat on primary disconnect
      if (voiceRef.current) {
        voiceRef.current.close();
        setVoiceWs(null);
      }
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

      // Auto-reconnect signaling
      reconnectTimeoutRef.current = setTimeout(() => {
        if (connectRef.current) connectRef.current(nick);
      }, 3000);
    };

    signalingRef.current = socket;
    setSignalingWs(socket);
  }, [connectVoice]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // --- 4. Sending Functions ---
  const send = useCallback((data: ClientMessage) => {
    if (signalingRef.current?.readyState === WebSocket.OPEN) {
      signalingRef.current.send(JSON.stringify(data));
    }
  }, []);

  const sendAudio = useCallback((data: ArrayBuffer) => {
    if (voiceRef.current?.readyState === WebSocket.OPEN) {
      voiceRef.current.send(data);
    }
  }, []);

  // Helper to add local messages (optimistic UI)
  const addLocalMessage = useCallback((text: string) => {
    setChatMessages(prev => [...prev, {
      nick: nickname,
      text: text,
      isAdmin: false,
      timestamp: Date.now()
    }]);
  }, [nickname]);

  // --- Cleanup ---
  useEffect(() => {
    return () => {
      signalingRef.current?.close();
      voiceRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (voiceKeepAliveRef.current) clearInterval(voiceKeepAliveRef.current);
    };
  }, []);

  useEffect(() => {
    connectVoiceRef.current = connectVoice;
  }, [connectVoice]);

  return (
    <WebSocketContext.Provider
      value={{
        ws: signalingWs,
        voiceWs,
        isConnected,
        connect,
        send,
        sendAudio,
        lastMessage,
        nickname,
        isAdmin,
        setIsAdmin,
        subscribeToAudio,
        myUserId,
        userMap,
        connectedUsers,
        userControlsAllowed,
        proxyEnabled,
        chatMessages,
        addLocalMessage
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context)
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  return context;
};