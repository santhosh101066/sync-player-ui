import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

export interface ConnectedUser {
    id: number;
    nick: string;
    isAdmin: boolean;
    isMuted: boolean;
}
interface WebSocketContextType {
    ws: WebSocket | null;
    isConnected: boolean;
    connect: (nickname: string) => void;
    send: (data: any) => void;
    sendBinary: (data: ArrayBuffer) => void;
    lastMessage: any;
    nickname: string;
    isAdmin: boolean;
    setIsAdmin: (isAdmin: boolean) => void;
    // NEW: Allow components to subscribe to raw audio stream directly
    subscribeToAudio: (callback: (data: ArrayBuffer) => void) => () => void;
    userMap: Record<number, string>;
    connectedUsers: ConnectedUser[];
    userControlsAllowed: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [nickname, setNickname] = useState("Guest");
    const [lastMessage, setLastMessage] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [userMap, setUserMap] = useState<Record<number, string>>({});
    const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
    const [userControlsAllowed, setUserControlsAllowed] = useState(false);


    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // NEW: Store audio listeners
    const audioListenersRef = useRef<Set<(data: ArrayBuffer) => void>>(new Set());

    const subscribeToAudio = useCallback((callback: (data: ArrayBuffer) => void) => {
        audioListenersRef.current.add(callback);
        return () => {
            audioListenersRef.current.delete(callback);
        };
    }, []);

    const connect = useCallback((nick: string) => {
        setNickname(nick);
        if (wsRef.current) wsRef.current.close();

        // DEV vs PROD path logic
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let host = window.location.host;
        if (import.meta.env.DEV) host = 'localhost:8000';

        // Connect to /sync
        const socket = new WebSocket(`${protocol}//${host}/sync`);
        socket.binaryType = 'arraybuffer';

        socket.onopen = () => {
            console.log("🟢 WS Connected");
            setIsConnected(true);
            socket.send(JSON.stringify({ type: 'identify', nick }));
        };

        socket.onmessage = (event) => {
            if (typeof event.data === 'string') {
                try {
                    const msg = JSON.parse(event.data);
                    setLastMessage(msg);

                    // NEW: Update User Map when list arrives
                    if (msg.type === 'user-list') {
                        setConnectedUsers(msg.users); // Save list

                        // Create Map for Audio
                        const map: Record<number, string> = {};
                        msg.users.forEach((u: any) => map[u.id] = u.nick);
                        setUserMap(map);
                    }
                    if (msg.type === 'system-state') {
                        setUserControlsAllowed(msg.usersControlsAllowed ?? msg.userControlsAllowed);
                    }
                    if(msg.type === 'admin-success'){
                        setIsAdmin(true)
                    }
                } catch (e) { console.error("WS JSON Error", e); }
            } else {
                audioListenersRef.current.forEach(cb => cb(event.data));
            }
        };

        socket.onclose = () => {
            console.log("🔴 WS Disconnected");
            setIsConnected(false);
            wsRef.current = null;
            setWs(null);
            reconnectTimeoutRef.current = setTimeout(() => connect(nick), 3000);
        };

        wsRef.current = socket;
        setWs(socket);
    }, []);

    const send = useCallback((data: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    const sendBinary = useCallback((data: ArrayBuffer) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(data);
        }
    }, []);

    useEffect(() => {
        return () => {
            wsRef.current?.close();
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        };
    }, []);

    

    return (
        <WebSocketContext.Provider value={{
            ws, isConnected, connect, send, sendBinary,
            lastMessage, nickname, isAdmin, setIsAdmin, subscribeToAudio, userMap, connectedUsers,userControlsAllowed
        }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) throw new Error("useWebSocket must be used within a WebSocketProvider");
    return context;
};