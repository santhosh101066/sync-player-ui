import React, { useState, useEffect, useCallback, useRef } from "react";
import { WebSocketProvider, useWebSocket } from "./context/WebSocketContext";
import { VideoPlayer } from "./components/VideoPlayer";
import { Chat } from "./components/Chat";
import { Library } from "./components/Library";
import { AdminDashboard } from "./components/AdminDashboard";
import { UserList } from "./components/UserList";
import { useAudio } from "./hooks/useAudio";
import {
  Mic,
  MicOff,
  Shield,
  MessageSquare,
  FolderOpen,
  Volume2,
  Link as LinkIcon,
  Zap,
  RefreshCw,
  VolumeX,
  Users,
  Unlock,
  Lock,
  Globe,
} from "lucide-react";
import "./App.css";


// Define a type guard for messages that might contain URLs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const msgHasUrl = (msg: any): msg is { url: string; type: string } => {
  return (
    msg &&
    (msg.type === "sync" || msg.type === "forceSync" || msg.type === "load") &&
    typeof msg.url === "string"
  );
};

const AppContent: React.FC = () => {
  // 1. Data Layer
  const {
    isConnected,
    connect,
    send,
    isAdmin,
    userControlsAllowed,
    proxyEnabled,
    lastMessage,
  } = useWebSocket();

  // 2. Audio Layer
  const {
    toggleMic,
    isRecording,
    setVolume,
    volume,
    initAudio,
    activeSpeakers,
    audioBlocked,
  } = useAudio();

  // 3. UI State
  const [showWelcome, setShowWelcome] = useState(true);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "library" | "users">(
    "chat"
  );

  // 4. Form Inputs
  const [nameInput, setNameInput] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const pendingAdminLogin = useRef(false);

  useEffect(() => {
    if (isConnected && pendingAdminLogin.current) {
      send({ type: "admin-login", password: adminPassword });
      pendingAdminLogin.current = false; // Stop waiting
      setTimeout(() => {
        setShowAdminLogin(false);
      }, 0); // Close modal
    }
  }, [isConnected, adminPassword, send]);

  // --- Effect: Sync Input Box with Actual Playing Video ---
  useEffect(() => {
    if (!lastMessage || !msgHasUrl(lastMessage)) return;

    // Update input if the server says we are playing a different URL
    if (lastMessage.url && lastMessage.url !== urlInput) {
      // Ignore intro URL updates in the input box to keep it clean
      if (!lastMessage.url.includes("/intro.mp4")) {
        setUrlInput(lastMessage.url);
      }
    }
  }, [lastMessage, urlInput]);

  // --- Actions ---
  const handleJoin = useCallback(() => {
    if (!nameInput.trim()) return;
    connect(nameInput);
    setShowWelcome(false);
    // Attempt to start audio context on user interaction
    initAudio();
  }, [nameInput, connect, initAudio]);

  const handleAdminLogin = useCallback(() => {
    if (isConnected) {
      // ✅ Happy Path: Already connected? Send immediately.
      send({ type: "admin-login", password: adminPassword });
      setShowAdminLogin(false);
    } else {
      // ⏳ Wait Path: Connect, then set the flag.
      // The useEffect above will take over once 'isConnected' becomes true.
      connect("Admin");
      pendingAdminLogin.current = true;
    }
  }, [isConnected, adminPassword, send, connect]);

  const toggleUserControls = () => {
    send({ type: "toggle-user-controls", value: !userControlsAllowed });
  };

  const toggleProxy = () => {
    send({ type: "toggle-proxy", value: !proxyEnabled });
  };

  const handleManualLoad = () => {
    if (urlInput) {
      // 1. Send load command via WebSocket for sync [cite: 353]
      send({ type: "load", url: urlInput });

      // 2. [FIX] Dispatch local event to force the VideoPlayer component to load/play immediately
      window.dispatchEvent(
        new CustomEvent("play-video", {
          detail: { url: urlInput, autoPlay: true },
        })
      );
    }
  };

  const handleSync = () => {
    // Dispatch a custom event that VideoPlayer will listen for
    window.dispatchEvent(new CustomEvent("trigger-force-sync"));
  };

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'admin-fail') {
      alert("❌ Wrong Password!");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowAdminLogin(true); // Re-open the modal so they can try again
    }
  }, [lastMessage]);


  return (
    <div className="app-layout">
      {/* --- Modals --- */}
      {(showWelcome || showAdminLogin) && (
        <div className="modal-overlay">
          <div className="modal">
            {showWelcome ? (
              <>
                <h2>👤 Identify Yourself</h2>
                <input
                  type="text"
                  placeholder="Enter a nickname..."
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleJoin()}
                  autoFocus
                />
                <button
                  className="primary"
                  style={{ width: "100%" }}
                  onClick={handleJoin}
                >
                  Enter Session
                </button>
                <div
                  style={{
                    textAlign: "center",
                    fontSize: "0.85em",
                    color: "#666",
                    cursor: "pointer",
                    marginTop: "8px",
                  }}
                  onClick={() => {
                    setShowWelcome(false);
                    setShowAdminLogin(true);
                  }}
                >
                  Switch to Admin Login
                </div>
              </>
            ) : (
              <>
                <h2>🛡️ Admin Access</h2>
                <input
                  type="password"
                  placeholder="Admin Password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAdminLogin()}
                  autoFocus
                />
                <button
                  className="primary"
                  style={{ width: "100%", marginTop: "10px" }}
                  onClick={handleAdminLogin}
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    setShowAdminLogin(false);
                    setShowWelcome(true);
                  }}
                  style={{
                    width: "100%",
                    marginTop: "10px",
                    background: "transparent",
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showAdminDashboard && (
        <AdminDashboard onClose={() => setShowAdminDashboard(false)} />
      )}

      {audioBlocked && (
        <div className="audio-blocked-toast" onClick={() => initAudio()}>
          <VolumeX size={20} strokeWidth={1.5} />
          <span style={{ fontWeight: 600 }}>
            Audio is blocked! Click here to listen.
          </span>
        </div>
      )}

      {/* --- Header --- */}
      <div className="video-header">
        <div className="controls">
          {/* GROUP 1: Primary (Visible to everyone, always on top row on mobile) */}
          <div className="header-primary">
            <div className="logo">
              <span style={{ color: "var(--primary)", fontSize: "1.5rem" }}>▶</span>
              SyncStream
            </div>

            {/* Spacer to push controls right on desktop, or managed via flex on mobile */}
            <div className="header-spacer"></div>

            {/* Mic and Volume */}
            <div className="primary-controls">
              <button
                className={`main-mic-btn ${isRecording ? "recording" : "muted"}`}
                onClick={toggleMic}
                title={isRecording ? "Mute Microphone" : "Unmute Microphone"}
              >
                {isRecording ? (
                  <>
                    {" "}
                    <Mic size={18} className="pulse-anim" strokeWidth={1.5} /> <span className="btn-text">LIVE</span>{" "}
                  </>
                ) : (
                  <>
                    {" "}
                    <MicOff size={18} strokeWidth={1.5} />{" "}
                    <span className="btn-text">Muted</span>{" "}
                  </>
                )}
              </button>

              <div
                className="volume-control"
                style={{ gap: "10px", paddingRight: "0" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Volume2
                    size={18}
                    color={volume === 0 ? "var(--danger)" : "var(--text-muted)"}
                    strokeWidth={1.5}
                  />
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      fontWeight: 500,
                    }}
                    className="btn-text"
                  >
                    VOL
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  defaultValue="1"
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  style={{
                    width: "80px",
                    background: `linear-gradient(to right, var(--primary) ${(volume / 2) * 100}%, var(--bg-dark) ${(volume / 2) * 100}%)`
                  }}
                />
              </div>
            </div>
          </div>

          {/* GROUP 2: Admin Tools (Second row on mobile) */}
          {isAdmin && (
            <div className="header-admin">
              <div className="input-group">
                <LinkIcon size={16} className="input-icon" strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="Stream URL..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
              </div>
              <button onClick={handleManualLoad} title="Load URL">
                <RefreshCw size={16} strokeWidth={1.5} /> <span className="btn-text">Load</span>
              </button>

              <div className="admin-actions">
                <button className="primary" id="syncBtn" onClick={handleSync}>
                  <Zap size={16} strokeWidth={1.5} /> <span className="btn-text">Sync</span>
                </button>
                <button
                  onClick={toggleUserControls}
                  style={{
                    background: userControlsAllowed
                      ? "rgba(34, 197, 94, 0.1)"
                      : "rgba(239, 68, 68, 0.1)",
                    color: userControlsAllowed ? "#22c55e" : "#ef4444",
                    borderColor: userControlsAllowed ? "#22c55e" : "#ef4444",
                    minWidth: "40px",
                    padding: "0 8px",
                  }}
                  title={
                    userControlsAllowed
                      ? "Lock User Controls"
                      : "Unlock User Controls"
                  }
                >
                  {userControlsAllowed ? (
                    <Unlock size={18} strokeWidth={1.5} />
                  ) : (
                    <Lock size={18} strokeWidth={1.5} />
                  )}
                </button>
                <button
                  onClick={toggleProxy}
                  style={{
                    background: proxyEnabled
                      ? "rgba(34, 197, 94, 0.1)"
                      : "rgba(239, 68, 68, 0.1)",
                    color: proxyEnabled ? "#22c55e" : "#ef4444",
                    borderColor: proxyEnabled ? "#22c55e" : "#ef4444",
                    minWidth: "40px",
                    padding: "0 8px",
                  }}
                  title={
                    proxyEnabled
                      ? "Disable Stream Proxy"
                      : "Enable Stream Proxy"
                  }
                >
                  <Globe size={18} strokeWidth={1.5} />
                  <span className="btn-text">{proxyEnabled ? " ON" : " OFF"}</span>
                </button>

                <button
                  onClick={() => setShowAdminDashboard(true)}
                  className="btn-primary-outline"
                  title="Admin Dashboard"
                >
                  <Shield size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- Main Layout --- */}
      <div className="app-container">
        <div className="main-content">
          <VideoPlayer
            activeSpeakers={activeSpeakers}
            isRecording={isRecording}
            toggleMic={toggleMic}
          />

          {/* Connection Status Overlay */}
          <div
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: isConnected
                ? "rgba(34, 197, 94, 0.2)"
                : "rgba(239, 68, 68, 0.2)",
              border: `1px solid ${isConnected ? "#22c55e" : "#ef4444"}`,
              padding: "6px 12px",
              borderRadius: "20px",
              fontSize: "0.8rem",
              color: isConnected ? "#22c55e" : "#ef4444",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              pointerEvents: "none",
              zIndex: 50, // Ensure above video
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "currentColor",
              }}
            />
            {isConnected ? "Live" : "Offline"}
          </div>
        </div>

        {/* --- Sidebar --- */}
        <div className="sidebar">
          <div className="sidebar-tabs">
            <button
              className={`tab-btn ${activeTab === "chat" ? "active" : ""}`}
              onClick={() => setActiveTab("chat")}
            >
              <MessageSquare size={18} strokeWidth={1.5} /> Chat
            </button>
            {isAdmin && (
              <button
                className={`tab-btn ${activeTab === "library" ? "active" : ""}`}
                onClick={() => setActiveTab("library")}
              >
                <FolderOpen size={18} strokeWidth={1.5} /> Library
              </button>
            )}
            <button
              className={`tab-btn ${activeTab === "users" ? "active" : ""}`}
              onClick={() => setActiveTab("users")}
            >
              <Users size={18} strokeWidth={1.5} /> Users
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {activeTab === "chat" && <Chat />}
            {activeTab === "library" && <Library />}
            {activeTab === "users" && (
              <UserList activeSpeakers={activeSpeakers} />
            )}
          </div>
        </div>

        {/* CSS for specific animations kept minimal, assuming index.css handles most */}
        <style>{`
                    .audio-blocked-toast {
                        position: fixed;
                        top: 80px; left: 50%; transform: translateX(-50%);
                        background: #ef4444; color: white; padding: 12px 24px;
                        border-radius: 30px; z-index: 2000;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        display: flex; align-items: center; gap: 12px;
                        cursor: pointer; animation: slideDown 0.3s ease-out;
                    }
                    @keyframes slideDown { 
                        from { transform: translate(-50%, -20px); opacity: 0; } 
                        to { transform: translate(-50%, 0); opacity: 1; } 
                    }
                    .pulse-anim { animation: pulse 1s infinite; }
                    @keyframes pulse { 
                        0% { opacity: 1; } 
                        50% { opacity: 0.5; } 
                        100% { opacity: 1; } 
                    }
                `}</style>
      </div>
    </div>
  );
};

function App() {
  return (
    <WebSocketProvider>
      <AppContent />
    </WebSocketProvider>
  );
}

export default App;
