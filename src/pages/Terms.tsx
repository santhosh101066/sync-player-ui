import React from 'react';
import { Link } from 'react-router-dom';

export const TermsAndPolicy: React.FC = () => {
    return (
        <div className="page-container" style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', color: 'var(--text-primary)' }}>
            <h1>Terms & Policy</h1>
            <p>Welcome to SyncPlayer. By using our service, you agree to the following terms.</p>

            <h2>1. Usage</h2>
            <p>This application is for personal and synchronized video playback. Please use it responsibly.</p>

            <h2>2. Content</h2>
            <p>We do not host any video content. All content is provided by users via URLs.</p>

            <div style={{ marginTop: '40px' }}>
                <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none' }}>&larr; Back to Home</Link>
            </div>
        </div>
    );
};
