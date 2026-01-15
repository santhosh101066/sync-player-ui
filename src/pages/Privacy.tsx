import React from 'react';
import { Link } from 'react-router-dom';

export const PrivacyPolicy: React.FC = () => {
    return (
        <div className="page-container" style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', color: 'var(--text-primary)' }}>
            <h1>Privacy Policy</h1>
            <p>Your privacy is important to us.</p>

            <h2>1. Data Collection</h2>
            <p>We collect minimal data required for synchronization features, such as your chosen nickname and session ID.</p>

            <h2>2. Cookies</h2>
            <p>We use local storage to save your preferences (e.g., volume, nickname).</p>

            <div style={{ marginTop: '40px' }}>
                <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none' }}>&larr; Back to Home</Link>
            </div>
        </div>
    );
};
