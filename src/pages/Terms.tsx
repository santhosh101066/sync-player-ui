import React from 'react';
import { Link } from 'react-router-dom';

export const TermsAndPolicy: React.FC = () => {
    return (
        <div className="page-container p-10 max-w-3xl mx-auto text-gray-100">
            <h1 className="text-3xl font-bold mb-6 text-primary">Terms and Conditions</h1>
            <p className="mb-4 leading-relaxed">
                Welcome to SyncStream. By using this application, you agree to the following terms.
            </p>
            <h2 className="text-xl font-semibold mt-6 mb-3 text-white">Usage</h2>
            <p className="mb-4 leading-relaxed">
                You agree to use this service responsibly. harassment, hate speech, or sharing illegal content
                via the synchronized player or chat is strictly prohibited.
            </p>
            <h2 className="text-xl font-semibold mt-6 mb-3 text-white">Disclaimer</h2>
            <p className="mb-4 leading-relaxed">
                This service is provided "as is" without any warranties. We are not responsible for any content
                streamed through the platform by users.
            </p>
            <div className="mt-10">
                <Link to="/" className="text-primary hover:text-primary-hover no-underline font-medium">&larr; Back to Home</Link>
            </div>
        </div>
    );
};
