
import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import GdprModal from '../components/GdprModal';
import './Dashboard.css'; // Reuse dashboard styles for glass card if needed, or App.css

const API_URL = process.env.REACT_APP_API_URL || '';

const LoginPage = ({ onLogin }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [step, setStep] = useState(1); // 1: Username, 2: OTP
    const [telegramUsername, setTelegramUsername] = useState('');
    const [otp, setOtp] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [hasTelegramId, setHasTelegramId] = useState(false);
    const [showGdprModal, setShowGdprModal] = useState(false);
    const [pendingUser, setPendingUser] = useState(null);

    // Get return URL from state or default to dashboard
    const from = location.state?.from?.pathname || '/';

    const handleUsernameSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        const cleanUsername = telegramUsername.replace('@', '').trim();

        if (!cleanUsername) {
            setIsLoading(false);
            return;
        }

        // Open window immediately to bypass popup blockers
        const botWindow = window.open('', '_blank');

        try {
            const response = await fetch(`${API_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegramUsername: cleanUsername }),
            });

            const data = await response.json();

            if (response.ok) {
                setTelegramUsername(cleanUsername);
                setHasTelegramId(data.hasTelegramId);
                setStep(2);
                setIsLoading(false);
                if (botWindow) {
                    botWindow.location.href = 'https://t.me/Linked_Coffee_Bot';
                }
            } else {
                setIsLoading(false);
                if (botWindow) botWindow.close();
                alert(data.message || t('form.error_generic'));
            }
        } catch (error) {
            setIsLoading(false);
            if (botWindow) botWindow.close();
            alert(t('form.error_generic'));
        }
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegramUsername,
                    otp: otp.replace(/\s+/g, '')
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setIsLoading(false);
                if (data.success) {
                    const finalizeLogin = (u) => {
                        onLogin(u);
                        navigate(from, { replace: true });
                    };

                    if (data.user.consentGdpr) {
                        finalizeLogin(data.user);
                    } else {
                        setPendingUser(data.user);
                        setShowGdprModal(true);
                    }
                } else {
                    alert(data.message || 'Verification failed');
                }
            } else {
                setIsLoading(false);
                alert(data.message || t('form.error_generic'));
            }
        } catch (error) {
            setIsLoading(false);
            alert(t('form.error_generic'));
        }
    };

    const resetFlow = () => {
        setStep(1);
        setIsLoading(false);
        setOtp('');
        setHasTelegramId(false);
    };

    const handleGdprAccept = async (modalData) => {
        if (!pendingUser || !pendingUser.username) {
            alert('Error: User session invalid. Please try logging in again.');
            return;
        }

        try {
            const payload = {
                username: pendingUser.username,
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
                navigate(from, { replace: true });
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

    return (
        <main className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '120px', minHeight: 'calc(100vh - 80px)' }}>
            {showGdprModal && <GdprModal onAccept={handleGdprAccept} onClose={handleGdprClose} initialName={pendingUser?.firstName} initialFamily={pendingUser?.lastName} />}

            <div className="glass-card" style={{ maxWidth: '400px', width: '100%', margin: '0 12px' }}>
                <div className="card-header">
                    <h2 className="card-title">{step === 1 ? 'Login' : t('form.step2_title')}</h2>
                    <p className="card-subtitle">
                        {step === 1 ? (
                            t('form.welcome_back')
                        ) : (
                            hasTelegramId ? (
                                t('form.verify_existing')
                            ) : (
                                <Trans
                                    i18nKey="form.step2_subtitle"
                                    components={{
                                        1: <strong />
                                    }}
                                />
                            )
                        )}
                    </p>
                    {step === 2 && (
                        <a
                            href="https://t.me/Linked_Coffee_Bot"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'block',
                                textAlign: 'center',
                                marginTop: '0.5rem',
                                color: '#6366f1',
                                textDecoration: 'none',
                                fontWeight: '500'
                            }}
                        >
                            {t('form.open_bot')}
                        </a>
                    )}
                </div>

                {step === 1 && (
                    <form className="registration-form" onSubmit={handleUsernameSubmit}>
                        <div className="input-group">
                            <label htmlFor="telegram-username" className="form-label">
                                {t('form.label')}
                            </label>
                            <div className="input-wrapper">
                                <span className="input-prefix">@</span>
                                <input
                                    type="text"
                                    id="telegram-username"
                                    className="form-input"
                                    placeholder={t('form.username_placeholder')}
                                    value={telegramUsername}
                                    onChange={(e) => setTelegramUsername(e.target.value)}
                                    disabled={isLoading}
                                    required
                                />
                            </div>
                        </div>
                        
                        {/* Warning Message */}
                        <div style={{ margin: '0.5rem 0 0.5rem', textAlign: 'center', fontSize: '0.9rem', color: '#15803d' }}>
                            <Trans
                                i18nKey="form.warning_msg"
                                components={{
                                    1: <strong />
                                }}
                            />
                        </div>

                        <button type="submit" className="submit-btn" disabled={isLoading}>
                            <div className="button-content">
                                {isLoading && <span className="spinner"></span>}
                                <span>{isLoading ? t('form.loading') : t('form.get_code')}</span>
                            </div>
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <form className="registration-form" onSubmit={handleOtpSubmit}>
                        <div className="input-group">
                            <label htmlFor="otp" className="form-label">
                                {t('form.otp_label')}
                            </label>
                            <div className="input-wrapper">
                                <input
                                    type="text"
                                    id="otp"
                                    className="form-input"
                                    placeholder={t('form.otp_placeholder')}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    disabled={isLoading}
                                    required
                                    style={{ textAlign: 'center', letterSpacing: '0.2em', fontSize: '1.2rem' }}
                                />
                            </div>
                        </div>
                        
                        {/* Important: Verify New User Instructions */}
                        {!hasTelegramId && (
                            <div style={{ 
                                margin: '1.5rem 0', 
                                textAlign: 'center', 
                                fontSize: '1.05rem', 
                                color: '#1e3a8a', 
                                lineHeight: '1.5',
                                backgroundColor: '#eff6ff',
                                padding: '1.25rem',
                                borderRadius: '0.75rem',
                                border: '1px solid #bfdbfe',
                                fontWeight: '500',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                            }}>
                                <Trans
                                    i18nKey="form.verify_new"
                                    components={{
                                        // eslint-disable-next-line jsx-a11y/anchor-has-content
                                        1: <a href="https://t.me/Linked_Coffee_Bot" target="_blank" rel="noopener noreferrer" style={{ color: '#7c3aed', textDecoration: 'underline', fontWeight: 'bold' }} />
                                    }}
                                />
                            </div>
                        )}

                        <button type="submit" className="submit-btn" disabled={isLoading}>
                            <div className="button-content">
                                {isLoading && <span className="spinner"></span>}
                                <span>{isLoading ? t('form.loading') : t('form.verify_btn')}</span>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={resetFlow}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--gray-600)',
                                marginTop: '1rem',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                width: '100%'
                            }}
                        >
                            Back
                        </button>
                    </form>
                )}
            </div>
        </main>
    );
};

export default LoginPage;
