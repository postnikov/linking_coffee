
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import GdprModal from '../components/GdprModal';

const API_URL = process.env.REACT_APP_API_URL || '';
const POLL_INTERVAL_MS = 3000;

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
    const [linkingState, setLinkingState] = useState(null); // { token, telegram }
    const pollRef = useRef(null);
    const pollFailuresRef = useRef(0);

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    // Poll for linking status
    useEffect(() => {
        if (!linkingState) return;

        pollFailuresRef.current = 0;

        const pollStatus = async () => {
            if (!pollRef.current) return;
            try {
                const response = await fetch(`${API_URL}/api/auth/link-status/${linkingState.token}`);
                const data = await response.json();
                pollFailuresRef.current = 0;

                if (data.status === 'completed' && data.user) {
                    stopPolling();
                    if (data.user.consentGdpr) {
                        onLogin(data.user);
                        navigate('/');
                    } else {
                        setPendingUser(data.user);
                        setShowGdprModal(true);
                        setLinkingState(null);
                    }
                } else if (data.status === 'expired' || data.status === 'not_found') {
                    stopPolling();
                    setLinkingState(null);
                    setError('Linking expired. Please try again.');
                    setTimeout(() => navigate('/'), 3000);
                }
            } catch (e) {
                pollFailuresRef.current += 1;
                if (pollFailuresRef.current > 20) {
                    stopPolling();
                    setLinkingState(null);
                    setError('Connection lost. Please try again.');
                    setTimeout(() => navigate('/'), 3000);
                }
            }
        };

        pollRef.current = setInterval(pollStatus, POLL_INTERVAL_MS);
        return stopPolling;
    }, [linkingState, onLogin, navigate, stopPolling]);

    useEffect(() => {
        const processCallback = async () => {
            const params = new URLSearchParams(location.search);
            const code = params.get('code');
            const err = params.get('error');

            // Prevent double-execution in Dev/StrictMode
            if (!code || code === lastProcessedCode) return;
            lastProcessedCode = code;

            if (err) {
                setError('Authentication declined or failed.');
                setTimeout(() => navigate('/'), 3000);
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
                } else if (data.duplicateDetected && data.linkingInitiated && data.linkingToken) {
                    // Magic link sent to Telegram — start polling
                    setLinkingState({
                        token: data.linkingToken,
                        telegram: data.potentialMatch?.telegram || 'Telegram'
                    });
                } else {
                    setError(data.message || 'Authentication failed');
                    setTimeout(() => navigate('/'), 3000);
                }
            } catch (e) {
                setError('Network error during authentication.');
                setTimeout(() => navigate('/'), 3000);
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
                family: modalData?.family || ''
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
        } catch (err) {
            alert('An error occurred. Please try again.');
        }
    };

    const handleGdprClose = () => {
        setShowGdprModal(false);
        navigate('/');
    };

    const handleCancelLinking = () => {
        stopPolling();
        setLinkingState(null);
        navigate('/');
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
            {showGdprModal && (
                <GdprModal
                    onAccept={handleGdprAccept}
                    onClose={handleGdprClose}
                    initialName={pendingUser?.firstName}
                    initialFamily={pendingUser?.lastName}
                />
            )}

            {!showGdprModal && linkingState && (
                <div style={{
                    textAlign: 'center',
                    maxWidth: '420px',
                    padding: '0 20px'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📱</div>
                    <h2 style={{
                        fontSize: '1.4rem',
                        fontWeight: 600,
                        marginBottom: '12px',
                        color: '#fff'
                    }}>
                        Check your Telegram
                    </h2>
                    <p style={{
                        fontSize: '1rem',
                        color: 'rgba(255,255,255,0.8)',
                        lineHeight: 1.5,
                        marginBottom: '8px'
                    }}>
                        We found your existing account ({linkingState.telegram}).
                    </p>
                    <p style={{
                        fontSize: '1rem',
                        color: 'rgba(255,255,255,0.8)',
                        lineHeight: 1.5,
                        marginBottom: '24px'
                    }}>
                        We sent a confirmation to your Telegram. Tap <strong>"Yes, link my accounts"</strong> there to connect your LinkedIn.
                    </p>
                    <div className="spinner" style={{ marginBottom: '20px' }}></div>
                    <p style={{
                        fontSize: '0.85rem',
                        color: 'rgba(255,255,255,0.5)',
                        marginBottom: '24px'
                    }}>
                        Waiting for confirmation...
                    </p>
                    <button
                        onClick={handleCancelLinking}
                        style={{
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.3)',
                            color: 'rgba(255,255,255,0.7)',
                            padding: '8px 24px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        Cancel
                    </button>
                </div>
            )}

            {!showGdprModal && !linkingState && (
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
