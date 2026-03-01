
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import GdprModal from '../components/GdprModal';

const API_URL = process.env.REACT_APP_API_URL || '';
const BOT_NAME = process.env.REACT_APP_TELEGRAM_BOT_NAME || 'Linked_Coffee_Bot';

const LoginPage = ({ onLogin }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoading, setIsLoading] = useState(false);
    const [showGdprModal, setShowGdprModal] = useState(false);
    const [pendingUser, setPendingUser] = useState(null);
    const [devUsername, setDevUsername] = useState('');
    const [autoVerifyError, setAutoVerifyError] = useState('');
    const [autoVerifying, setAutoVerifying] = useState(false);
    const autoVerifyAttemptedRef = useRef(false);

    const from = location.state?.from?.pathname
        || localStorage.getItem('pendingReturnTo')
        || '/';

    const navigateAndClear = useCallback((path, options) => {
        localStorage.removeItem('pendingReturnTo');
        navigate(path, options);
    }, [navigate]);

    // Auto-verify when both code and user come from URL (magic link from bot)
    const autoVerify = useCallback(async (username, code) => {
        if (autoVerifyAttemptedRef.current) return;
        autoVerifyAttemptedRef.current = true;
        setIsLoading(true);
        setAutoVerifying(true);
        setAutoVerifyError('');

        try {
            const response = await fetch(`${API_URL}/api/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegramUsername: username,
                    otp: code.replace(/\s+/g, '')
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                if (data.user.consentGdpr) {
                    onLogin(data.user);
                    navigateAndClear(from, { replace: true });
                } else {
                    setPendingUser(data.user);
                    setShowGdprModal(true);
                    setIsLoading(false);
                    setAutoVerifying(false);
                }
            } else {
                setAutoVerifyError(data.message || 'Verification failed');
                setIsLoading(false);
                setAutoVerifying(false);
            }
        } catch (error) {
            setAutoVerifyError(t('form.error_generic'));
            setIsLoading(false);
            setAutoVerifying(false);
        }
    }, [from, navigateAndClear, onLogin, t]);

    // Parse URL parameters for magic link auto-verify
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const codeParam = params.get('code');
        const userParam = params.get('user');

        if (codeParam && userParam) {
            autoVerify(userParam, codeParam);
        }
    }, [location.search, autoVerify]);

    const handleGdprAccept = async (modalData) => {
        if (!pendingUser || (!pendingUser.username && !pendingUser.id && !pendingUser.email)) {
            alert('Error: User session invalid. Please try logging in again.');
            return;
        }

        try {
            const payload = {
                username: pendingUser.username,
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
                setShowGdprModal(false);
                onLogin(updatedUser);
                navigateAndClear(from, { replace: true });
            } else {
                alert('Failed to update consent. Please try again.');
            }
        } catch (error) {
            alert('An error occurred. Please try again.');
        }
    };

    const handleGdprClose = () => {
        setShowGdprModal(false);
        setPendingUser(null);
    };

    // Dev login handler - only works on localhost
    const handleDevLogin = async (username) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/dev-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username }),
            });
            const data = await response.json();
            if (data.success) {
                if (data.user.consentGdpr) {
                    onLogin(data.user);
                    navigateAndClear(from, { replace: true });
                } else {
                    setPendingUser(data.user);
                    setShowGdprModal(true);
                }
            } else {
                alert(data.message || 'Dev login failed');
            }
        } catch (e) {
            alert('Dev login error');
        } finally {
            setIsLoading(false);
        }
    };

    // E2E test user login - auto-seeds if needed, only works on localhost
    const handleTestUserLogin = async (key) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/dev/seed-test-users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key }),
            });
            const data = await response.json();
            if (data.success) {
                if (data.user.consentGdpr) {
                    onLogin(data.user);
                    navigateAndClear(from, { replace: true });
                } else {
                    setPendingUser(data.user);
                    setShowGdprModal(true);
                }
            } else {
                alert(data.message || 'Test user login failed');
            }
        } catch (e) {
            alert('Test user login error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '2rem', minHeight: 'calc(100vh - 80px)' }}>
            {showGdprModal && <GdprModal onAccept={handleGdprAccept} onClose={handleGdprClose} initialName={pendingUser?.firstName} initialFamily={pendingUser?.lastName} />}

            <div className="glass-card" style={{ maxWidth: '400px', width: '100%', margin: '0 12px' }}>
                {/* Auto-verify spinner */}
                {autoVerifying && !autoVerifyError && (
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <span className="spinner" style={{ width: '32px', height: '32px', display: 'inline-block' }}></span>
                        <p style={{ marginTop: '1rem', color: '#6b7280' }}>
                            {t('form.auto_verifying', 'Verifying your account...')}
                        </p>
                    </div>
                )}

                {/* Main login UI — hidden during auto-verify */}
                {!autoVerifying && (
                    <>
                        <div className="card-header">
                            <h2 className="card-title">{t('form.title')}</h2>
                            <p className="card-subtitle">
                                {t('form.welcome_back')}
                            </p>
                        </div>

                        {autoVerifyError && (
                            <div style={{
                                margin: '0 0 1rem',
                                padding: '0.75rem',
                                backgroundColor: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '0.5rem',
                                color: '#dc2626',
                                textAlign: 'center',
                                fontSize: '0.9rem'
                            }}>
                                {autoVerifyError}
                            </div>
                        )}

                        {/* Telegram CTA — same as Home page */}
                        <div style={{ textAlign: 'center', padding: '16px 0 0' }}>
                            <a
                                href={`https://t.me/${BOT_NAME}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-block',
                                    marginBottom: '12px',
                                    color: '#6366f1',
                                    fontWeight: '500',
                                    textDecoration: 'none'
                                }}
                            >
                                @{BOT_NAME}
                            </a>
                            <a
                                href={`https://t.me/${BOT_NAME}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="submit-btn"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    textDecoration: 'none',
                                    width: '100%',
                                    gap: '8px',
                                    fontSize: '1rem'
                                }}
                            >
                                <svg style={{ width: '20px', height: '20px', fill: 'currentColor' }} viewBox="0 0 24 24">
                                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                                </svg>
                                <span>{t('form.go_to_bot', 'Continue with Telegram')}</span>
                            </a>
                            <p style={{
                                marginTop: '12px',
                                fontSize: '0.85rem',
                                color: 'var(--gray-600)',
                                lineHeight: '1.4'
                            }}>
                                {t('form.bot_instructions', 'Open the bot, press Start — you\'ll get a magic link to log in instantly.')}
                            </p>
                        </div>

                        {/* Dev Login - Only on localhost */}
                        {window.location.hostname === 'localhost' && (
                            <div style={{
                                marginTop: '24px',
                                padding: '12px',
                                border: '2px dashed #f59e0b',
                                borderRadius: '12px',
                                backgroundColor: 'rgba(245, 158, 11, 0.1)'
                            }}>
                                <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '8px', fontWeight: '600', textAlign: 'center' }}>
                                    DEV MODE ONLY
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleDevLogin('max_postnikov')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '100%',
                                        height: '40px',
                                        backgroundColor: '#f59e0b',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '20px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        marginBottom: '8px'
                                    }}
                                    disabled={isLoading}
                                >
                                    Quick Login (@max_postnikov)
                                </button>

                                <div style={{ marginTop: '8px', borderTop: '1px solid #fbbf24', paddingTop: '8px' }}>
                                    <div style={{ fontSize: '11px', color: '#92400e', marginBottom: '6px' }}>
                                        E2E Test Accounts (auto-created):
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                        {['alice', 'bob', 'charlie_noconsent'].map(key => (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => handleTestUserLogin(key)}
                                                disabled={isLoading}
                                                style={{
                                                    padding: '4px 8px',
                                                    backgroundColor: '#d97706',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: isLoading ? 'not-allowed' : 'pointer',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                {key}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                    <input
                                        type="text"
                                        placeholder="Other username..."
                                        value={devUsername}
                                        onChange={(e) => setDevUsername(e.target.value)}
                                        style={{
                                            flex: 1,
                                            padding: '8px 12px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '8px',
                                            fontSize: '14px'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => devUsername && handleDevLogin(devUsername)}
                                        disabled={!devUsername || isLoading}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: devUsername ? '#f59e0b' : '#e5e7eb',
                                            color: devUsername ? 'white' : '#9ca3af',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: devUsername ? 'pointer' : 'not-allowed',
                                            fontSize: '14px',
                                            fontWeight: '500'
                                        }}
                                    >
                                        Login
                                    </button>
                                </div>
                            </div>
                        )}

                        <div style={{
                            marginTop: 'var(--spacing-lg)',
                            textAlign: 'center',
                            fontSize: '0.875rem',
                            color: 'var(--gray-600)'
                        }}>
                            <p>
                                {t('form.footer')}
                            </p>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
};

export default LoginPage;
