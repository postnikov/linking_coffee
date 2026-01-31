
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import GdprModal from '../components/GdprModal';

const API_URL = process.env.REACT_APP_API_URL || '';

// Track last processed code to prevent double-execution in StrictMode
// but allow subsequent login attempts with new codes
let lastProcessedCode = null;

const LinkedinCallback = ({ onLogin }) => {
    const navigate = useNavigate();
    const location = useLocation();
    useTranslation();
    const [error, setError] = useState(null);
    const [showGdprModal, setShowGdprModal] = useState(false);
    const [pendingUser, setPendingUser] = useState(null);

    useEffect(() => {
        const processCallback = async () => {
            const params = new URLSearchParams(location.search);
            const code = params.get('code');
            const err = params.get('error');

            // Prevent double-execution in Dev/StrictMode
            if (!code || code === lastProcessedCode) return;
            lastProcessedCode = code;

            if (err) {
                console.error('LinkedIn Callback Error:', err);
                setError('Authentication declined or failed.');
                setTimeout(() => navigate('/login'), 3000);
                return;
            }

            try {
                const redirectUri = window.location.origin + '/auth/linkedin/callback';

                // Check if already logged in to support Explicit Linking
                const storedUser = localStorage.getItem('user');
                const currentUser = storedUser ? JSON.parse(storedUser) : null;
                const currentUserId = currentUser ? currentUser.id : null;

                const response = await fetch(`${API_URL}/api/auth/linkedin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, redirectUri, currentUserId })
                });

                const data = await response.json();

                if (data.success) {
                    if (data.user.consentGdpr) {
                        onLogin(data.user);
                        navigate('/');
                    } else {
                        setPendingUser(data.user);
                        setShowGdprModal(true);
                    }
                } else {
                    setError(data.message || 'Authentication failed');
                    setTimeout(() => navigate('/login'), 3000);
                }
            } catch (e) {
                console.error('LinkedIn Auth Exception:', e);
                setError('Network error during authentication.');
                setTimeout(() => navigate('/login'), 3000);
            }
        };

        processCallback();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleGdprAccept = async (modalData) => {
        if (!pendingUser) return;

        try {
            const payload = {
                id: pendingUser.id,
                email: pendingUser.email,
                linkedin: modalData?.linkedin || '',
                name: modalData?.name || '',
                family: modalData?.family || '',
                communityCode: modalData?.communityCode || ''
            };

            const response = await fetch(`${API_URL}/api/consent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success) {
                const updatedUser = { ...pendingUser, consentGdpr: true };
                onLogin(updatedUser);
                navigate('/');
            } else {
                alert('Failed to update consent. Please try again.');
            }
        } catch (error) {
            alert('An error occurred. Please try again.');
        }
    };

    const handleGdprClose = () => {
        setShowGdprModal(false);
        navigate('/login');
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            flexDirection: 'column',
            color: '#fff'
        }}>
            {showGdprModal && <GdprModal onAccept={handleGdprAccept} onClose={handleGdprClose} initialName={pendingUser?.firstName} initialFamily={pendingUser?.lastName} />}

            {!showGdprModal && (
                <>
                    {error ? (
                        <div style={{ color: '#ef4444', fontSize: '1.2rem' }}>{error}</div>
                    ) : (
                        <>
                            <div className="spinner" style={{ marginBottom: '20px' }}></div>
                            <div>Connecting with LinkedIn...</div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default LinkedinCallback;
