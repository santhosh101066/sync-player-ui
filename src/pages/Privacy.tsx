import React from 'react';
import { Link } from 'react-router-dom';

export const PrivacyPolicy: React.FC = () => {
    return (
        <div className="page-container p-10 max-w-3xl mx-auto text-gray-100">
            <h1 className="text-3xl font-bold mb-6 text-primary">Privacy Policy</h1>
            <p className="mb-4 leading-relaxed">
                Your privacy is important to us. This policy outlines how we handle your data.
            </p>
            <h2 className="text-xl font-semibold mt-6 mb-3 text-white">Data Collection</h2>
            <p className="mb-4 leading-relaxed">
                We only collect minimal data required for authentication (Google Identity) and session management.
                We do not store chat history tailored to your identity permanently, nor do we track your browsing habits.
            </p>
            <div className="mt-10">
                <Link to="/" className="text-primary hover:text-primary-hover no-underline font-medium">&larr; Back to Home</Link>
            </div>
        </div>
    );
};
