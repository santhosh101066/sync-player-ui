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
        <div className="h-screen flex flex-col justify-center items-center bg-zinc-950 text-white relative overflow-hidden">
            {/* Background Gradients to match the index.css feel */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900/20 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 bg-zinc-900/60 backdrop-blur-xl p-10 rounded-3xl shadow-2xl text-center border border-white/10 max-w-sm w-[90%] flex flex-col gap-6">
                <div>
                    <img src="/logo.svg" alt="SyncPlayer" className="h-16 mx-auto mb-3" />
                    <p className="text-white/60 text-sm">
                        Watch together, synchronized.
                    </p>
                </div>

                <div className="flex justify-center">
                    <GoogleLogin
                        onSuccess={credentialResponse => {
                            if (credentialResponse.credential) {
                                connect(credentialResponse.credential);
                            }
                        }}
                        onError={() => {
                            console.log('Login Failed');
                        }}
                        theme="filled_black"
                        shape="pill"
                    />
                </div>

                <div className="pt-6 border-t border-white/10 flex gap-4 justify-center text-xs text-white/40 font-medium">
                    <Link to="/about" className="hover:text-white transition-colors">About</Link>
                    <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
                    <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                </div>
            </div>
        </div>
    );
};
