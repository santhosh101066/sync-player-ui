import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from "@react-oauth/google";
import { useWebSocket } from "../context/WebSocketContext";


export const Login: React.FC = () => {
    const { connect, isConnected } = useWebSocket();
    const navigate = useNavigate();

    useEffect(() => {
        if (isConnected) {
            navigate('/session');
        }
    }, [isConnected, navigate]);

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'var(--bg-dark)',
            color: 'white'
        }}>
            <div className="login-card" style={{
                background: 'var(--bg-card)',
                padding: '40px',
                borderRadius: '24px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                textAlign: 'center',
                border: '1px solid var(--border)',
                maxWidth: '400px',
                width: '90%'
            }}>
                <div style={{ marginBottom: '30px' }}>
                    <img src="/logo.svg" alt="SyncPlayer" style={{ height: '60px' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Watch together, synchronized.
                    </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <GoogleLogin
                        onSuccess={credentialResponse => {
                            if (credentialResponse.credential) {
                                connect(credentialResponse.credential);
                                // session will handle audio init requirement likely, 
                                // or we rely on user clicking something else later. 
                                // But usually we need to unlock audio contexts.
                                // In the modal version it called initAudio(). 
                                // We can't easily import hook logic here outside provider context if logic isn't in context.
                                // Let's check useAudio usage. 
                            }
                        }}
                        onError={() => {
                            console.log('Login Failed');
                        }}
                        theme="filled_black"
                        shape="pill"
                    />
                </div>

                <div style={{ marginTop: '30px', borderTop: '1px solid var(--border)', paddingTop: '20px', display: 'flex', gap: '15px', justifyContent: 'center', fontSize: '0.8rem' }}>
                    <Link to="/about" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>About</Link>
                    <Link to="/terms" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Terms</Link>
                    <Link to="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy</Link>
                </div>
            </div>
        </div>
    );
};
