import React from 'react';
import { Link } from 'react-router-dom';

export const About: React.FC = () => {
    return (
        <div className="page-container p-10 max-w-3xl mx-auto text-gray-100">
            <h1 className="text-3xl font-bold mb-6 text-primary">About SyncStream</h1>
            <p className="mb-4 leading-relaxed">
                SyncStream is a real-time synchronized video player designed for seamless group watching experiences.
                It features low-latency synchronization, voice chat, and a modern glassmorphic interface.
            </p>
            <h2 className="text-xl font-semibold mt-6 mb-3 text-white">Version</h2>
            <p className="mb-4 leading-relaxed">
                v1.0.0 (Beta)
            </p>
            <h2 className="text-xl font-semibold mt-6 mb-3 text-white">Contact</h2>
            <p className="mb-4 leading-relaxed">
                Created by Santhosh Manohar.
            </p>
            <div className="mt-10">
                <Link to="/" className="text-primary hover:text-primary-hover no-underline font-medium">&larr; Back to Home</Link>
            </div>
        </div>
    );
};
