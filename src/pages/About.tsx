import React from 'react';
import { Link } from 'react-router-dom';

export const About: React.FC = () => {
    return (
        <div className="page-container" style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', color: 'var(--text-primary)' }}>
            <h1>About SyncPlayer</h1>
            <p>SyncPlayer is a tool for watching videos together with friends, synchronized in real-time.</p>

            <h2>Features</h2>
            <ul>
                <li>Real-time video synchronization</li>
                <li>Live chat</li>
                <li>Voice chat</li>
            </ul>

            <div style={{ marginTop: '40px' }}>
                <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none' }}>&larr; Back to Home</Link>
            </div>
        </div>
    );
};
