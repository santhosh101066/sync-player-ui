import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { io, Socket } from "socket.io-client";
import type { ConnectedUser, ClientMessage, ServerMessage } from "../types/types";

// Define the shape of a chat message for the UI (History)
export interface UIChatMessage {
  nick: string;
  text: string;
  isAdmin?: boolean;
  isSystem?: boolean;
  timestamp: number;
}

export interface VideoState {
  url: string;
  time: number;
  paused: boolean;
  timestamp: number;
}

interface WebSocketContextType {
  socket: Socket | null;
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
  currentVideoState: VideoState | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // --- State & Refs ---
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // User State
  const [nickname, setNickname] = useState("Guest");
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // App State
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [userMap, setUserMap] = useState<Record<number, string>>({});
  const [userControlsAllowed, setUserControlsAllowed] = useState(false);
  const [proxyEnabled, setProxyEnabled] = useState(true);
  const [chatMessages, setChatMessages] = useState<UIChatMessage[]>([]);
  const [currentVideoState, setCurrentVideoState] = useState<VideoState | null>(null);

  // Refs for Audio
  const audioListenersRef = useRef<Set<(data: ArrayBuffer) => void>>(new Set());

  // --- 1. Audio Subscription Helper ---
  const subscribeToAudio = useCallback((callback: (data: ArrayBuffer) => void) => {
    audioListenersRef.current.add(callback);
    return () => {
      audioListenersRef.current.delete(callback);
    };
  }, []);

  // --- 2. Connection Logic (Socket.IO) ---
  const connect = useCallback((nick: string) => {
    setNickname(nick);

    if (socket) {
        socket.disconnect();
    }

    const host = import.meta.env.DEV ? "http://localhost:8000" : window.location.origin;
    console.log("Connecting to:", host);

    const newSocket = io(host, {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 20,
        reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
        console.log("🟢 Connected via Socket.IO");
        setIsConnected(true);
        newSocket.emit("message", { type: "identify", nick });
    });

    newSocket.on("disconnect", (reason) => {
        console.log("🔴 Disconnected:", reason);
        setIsConnected(false);
    });

    newSocket.on("connect_error", (err) => {
        console.error("Connection Error:", err.message);
    });

    // --- Handle Text Protocol ---
    newSocket.on("message", (msg: ServerMessage) => {
        try {
            if (msg.type === 'kick') {
                alert("🚫 You have been kicked from the session.");
                window.location.reload();
                return;
            }

            if (msg.type === "welcome") {
                setMyUserId(msg.userId);
            }

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

            // Chat: Filter own messages
            if (msg.type === 'chat') {
                if (msg.nick === nick && !msg.isSystem) {
                    return;
                }
                setChatMessages(prev => [...prev, {
                    nick: msg.nick,
                    text: msg.text,
                    isAdmin: msg.isAdmin,
                    isSystem: msg.isSystem,
                    timestamp: Date.now()
                }]);
            }

            // ADD THIS: Handle Chat History
            if (msg.type === 'chat-history') {
                // Convert to UI format and SET as state (don't append, replace)
                const history = msg.messages.map(m => ({
                    nick: m.nick,
                    text: m.text,
                    isAdmin: m.isAdmin,
                    isSystem: m.isSystem,
                    timestamp: m.timestamp
                }));
                setChatMessages(history);
            }
            if (msg.type === 'sync' || msg.type === 'forceSync') {
                setCurrentVideoState(prev => ({
                    url: msg.url || prev?.url || "", // Keep existing URL if update doesn't have one
                    time: msg.time,
                    paused: msg.paused,
                    timestamp: Date.now()
                }));
            }
            if (msg.type === 'load') {
                setCurrentVideoState({
                    url: msg.url,
                    time: 0,
                    paused: true,
                    timestamp: Date.now()
                });
            }

            setLastMessage(msg);
        } catch (e) {
            console.error("Message Error", e);
        }
    });

    newSocket.on("voice", (data: ArrayBuffer) => {
        audioListenersRef.current.forEach((cb) => cb(data));
    });

    setSocket(newSocket);
  }, [socket]); 

  // --- 3. Sending Functions ---
  const send = useCallback((data: ClientMessage) => {
    if (socket?.connected) {
        socket.emit("message", data);
    }
  }, [socket]);

  const sendAudio = useCallback((data: ArrayBuffer) => {
    if (socket?.connected) {
        socket.emit("voice", data);
    }
  }, [socket]);

  const addLocalMessage = useCallback((text: string) => {
    setChatMessages(prev => [...prev, {
      nick: nickname,
      text: text,
      isAdmin: false,
      timestamp: Date.now()
    }]);
  }, [nickname]);

  useEffect(() => {
    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        socket,
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
        addLocalMessage,
        currentVideoState
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