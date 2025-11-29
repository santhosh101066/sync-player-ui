import React, { useState, useEffect } from 'react';
import { WebSocketProvider, useWebSocket } from './context/WebSocketContext';
import { VideoPlayer } from './components/VideoPlayer';
import { Chat } from './components/Chat';
import { Library } from './components/Library';
import { AdminDashboard } from './components/AdminDashboard';
import { useAudio } from './hooks/useAudio';
import { 
  Mic, MicOff, Shield, MessageSquare, 
  FolderOpen, Volume2, Link as LinkIcon, Zap, RefreshCw, 
  VolumeX,
  Users,
  Unlock,
  Lock
} from 'lucide-react';
import { UserList } from './components/UserList';

const AppContent: React.FC = () => {
  const { isConnected, connect, send, isAdmin, userControlsAllowed } = useWebSocket();
  const { toggleMic, isRecording, setVolume, initAudio, activeSpeakers,audioBlocked } = useAudio();
  // Modal States
  const [showWelcome, setShowWelcome] = useState(true);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  
  // UI States
  const [activeTab, setActiveTab] = useState<'chat' | 'library' | 'users'>('chat');
  const [nameInput, setNameInput] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [pendingAdminLogin, setPendingAdminLogin] = useState(false);

  useEffect(() => {
    if (isConnected && pendingAdminLogin) {
      send({ type: 'admin-login', password: adminPassword });
      setPendingAdminLogin(false);
      setShowAdminLogin(false);
    }
  }, [isConnected, pendingAdminLogin, adminPassword, send]);

  const handleJoin = () => {
    if (!nameInput.trim()) return;
    connect(nameInput);
    setShowWelcome(false);
  };

  const toggleUserControls = () => {
      send({ type: 'toggle-user-controls', value: !userControlsAllowed });
  };

 const handleAdminLogin = () => {
    if (isConnected) {
      // If already connected (e.g. was guest), just send password
      send({ type: 'admin-login', password: adminPassword });
      setShowAdminLogin(false);
    } else {
      // If not connected, connect first, then let useEffect handle the rest
      connect("Admin");
      setPendingAdminLogin(true);
    }
  };

  const handleManualLoad = () => {
    if (urlInput) {
      window.dispatchEvent(new CustomEvent('play-video', { detail: { url: urlInput } }));
      send({ type: 'load', url: urlInput });
    }
  };

  const handleSync = () => {
    // Send event to request sync
    window.dispatchEvent(new CustomEvent('request-sync')); 
  };

  // Listen for Library file selection
  useEffect(() => {
    const handler = (e: any) => setUrlInput(e.detail.url);
    window.addEventListener('play-video', handler);
    return () => window.removeEventListener('play-video', handler);
  }, []);

  return (
    <div className="app-layout">
      {/* --- Modals (Welcome / Admin) --- */}
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
                  onChange={e => setNameInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleJoin()}
                  autoFocus
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
                <button className="primary" style={{ width: '100%' }} onClick={handleJoin}>
                  Enter Session
                </button>
                <div 
                  style={{ textAlign: 'center', fontSize: '0.85em', color: '#666', cursor: 'pointer', marginTop: '8px' }} 
                  onClick={() => { setShowWelcome(false); setShowAdminLogin(true); }}
                >
                  Switch to Admin Login
                </div>
              </>
            ) : (
              /* ... Keep Admin Login Part ... */
              <>
                <h2>🛡️ Admin Access</h2>
                <input
                  type="password"
                  placeholder="Admin Password"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleAdminLogin()}
                  autoFocus
                />
                <button className="primary" style={{width: '100%', marginTop: '10px'}} onClick={handleAdminLogin}>Login</button>
                <button onClick={() => { setShowAdminLogin(false); setShowWelcome(true); }} 
                        style={{ width: '100%', marginTop: '10px', background: 'transparent' }}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}
      

      {showAdminDashboard && <AdminDashboard onClose={() => setShowAdminDashboard(false)} />}

        {audioBlocked && (
        <div style={{
          position: 'fixed',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#ef4444',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '30px',
          zIndex: 2000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
          animation: 'slideDown 0.3s ease-out'
        }} onClick={() => initAudio()}>
          <VolumeX size={20} />
          <span style={{ fontWeight: 600 }}>Audio is blocked! Click here to listen.</span>
        </div>
      )}

      {/* --- Top Navigation --- */}
      <div className="video-header">
        <div className="logo">
          <span style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>▶</span> 
          SyncStream
        </div>
        
        <div className="controls">
          {/* URL Input Group */}
          {isAdmin && (
                <div className="input-group">
                    <LinkIcon size={16} className="input-icon" />
                    <input
                    type="text"
                    placeholder="Stream URL..."
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    />
                </div>
            )}
            
            {/* 2. Load Button - ONLY ADMIN */}
            {isAdmin && (
                <button onClick={handleManualLoad} title="Load URL">
                    <RefreshCw size={16} /> Load
                </button>
            )}

            {/* 3. Sync Button - ONLY ADMIN */}
            {isAdmin && (
                <button className="primary" id="syncBtn" onClick={handleSync}>
                    <Zap size={16} /> Sync
                </button>
            )}

            {/* 4. NEW: User Permission Toggle - ONLY ADMIN */}
            {isAdmin && (
                <button 
                    onClick={toggleUserControls}
                    style={{ 
                        background: userControlsAllowed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: userControlsAllowed ? '#22c55e' : '#ef4444',
                        borderColor: userControlsAllowed ? '#22c55e' : '#ef4444',
                        minWidth: '40px', padding: '0 8px'
                    }}
                    title={userControlsAllowed ? "Lock User Controls" : "Unlock User Controls"}
                >
                    {userControlsAllowed ? <Unlock size={18} /> : <Lock size={18} />}
                    <span style={{ fontSize: '0.8rem', marginLeft: '6px' }}>
                        {userControlsAllowed ? 'Users Allowed' : 'Users Locked'}
                    </span>
                </button>
            )}
          
          {/* Mic Button */}
          <button 
            className={isRecording ? 'recording' : ''} 
            onClick={toggleMic}
            title="Toggle Microphone"
            style={{ width: '40px', padding: 0 }} /* Square button for mic */
          >
            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          {/* Volume Control */}
          <div className="volume-control">
            <Volume2 size={18} color="var(--text-muted)" />
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              defaultValue="1"
              onChange={(e) => setVolume(parseFloat(e.target.value))}
            />
          </div>

          {isAdmin && (
            <button onClick={() => setShowAdminDashboard(true)} style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}>
              <Shield size={16} />
            </button>
          )}
        </div>
      </div>

      {/* --- Main Area --- */}
      <div className="app-container">
        <div className="main-content">
          <VideoPlayer src={urlInput} activeSpeakers={activeSpeakers} />
          
          {/* Status Overlay */}
          <div style={{
            position: 'absolute', top: 20, right: 20, 
            background: isConnected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            border: `1px solid ${isConnected ? '#22c55e' : '#ef4444'}`,
            padding: '6px 12px', borderRadius: '20px', 
            fontSize: '0.8rem', color: isConnected ? '#22c55e' : '#ef4444',
            display: 'flex', alignItems: 'center', gap: '6px', pointerEvents: 'none'
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />
            {isConnected ? 'Live' : 'Offline'}
          </div>
        </div>

        {/* --- Tabbed Sidebar --- */}
        <div className="sidebar">
          <div className="sidebar-tabs">
            <button 
              className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare size={18} /> Chat
            </button>
            {isAdmin && (
                    <button 
                        className={`tab-btn ${activeTab === 'library' ? 'active' : ''}`}
                        onClick={() => setActiveTab('library')}
                    >
                        <FolderOpen size={18} /> Library
                    </button>
                )}
            <button 
              className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <Users size={18} /> Users
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'chat' && <Chat />}
            {activeTab === 'library' && <Library />}
            {activeTab === 'users' && <UserList activeSpeakers={activeSpeakers} />}
          </div>
          </div>
        </div>
        <style>{`
        @keyframes slideDown { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .pulse-anim { animation: pulse 1s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
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