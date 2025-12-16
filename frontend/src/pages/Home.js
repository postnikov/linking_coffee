
import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import GdprModal from '../components/GdprModal';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const Home = ({ onLogin }) => {
    const { t } = useTranslation();
    const [step, setStep] = useState(1); // 1: Username, 2: OTP
    const [telegramUsername, setTelegramUsername] = useState('');
    const [otp, setOtp] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [hasTelegramId, setHasTelegramId] = useState(false);
    const [showGdprModal, setShowGdprModal] = useState(false);
    const [pendingUser, setPendingUser] = useState(null);

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
                // Optional: Set a message based on whether OTP was sent proactively
                // if (data.hasTelegramId) {
                //     setMessage(t('form.otp_sent_proactive') || "Code sent to your Telegram!");
                // }
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
                    if (data.user.consentGdpr) {
                        onLogin(data.user);
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
        console.log('handleGdprAccept called. PendingUser:', pendingUser, 'ModalData:', modalData);
        if (!pendingUser || !pendingUser.username) {
            console.error('Missing pendingUser or username');
            alert('Error: User session invalid. Please try logging in again.');
            return;
        }

        try {
            console.log(`Sending consent for ${pendingUser.username} to ${API_URL}/api/consent`);
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

            console.log('Consent response status:', response.status);
            const data = await response.json();
            console.log('Consent response data:', data);

            if (data.success) {
                const updatedUser = { ...pendingUser, consentGdpr: true };
                setShowGdprModal(false);
                onLogin(updatedUser);
            } else {
                console.error('Consent failed:', data.message);
                alert('Failed to update consent. Please try again.');
            }
        } catch (error) {
            console.error('Consent error:', error);
            alert('An error occurred. Please try again.');
        }
    };

    const handleGdprClose = () => {
        setShowGdprModal(false);
        setPendingUser(null);
    };

    return (
        <main className="main-content">
            {showGdprModal && <GdprModal onAccept={handleGdprAccept} onClose={handleGdprClose} initialName={pendingUser?.firstName} initialFamily={pendingUser?.lastName} />}
            <div className="content-wrapper">
                {/* Left side - Hero */}
                <div className="hero-section">
                    <h1 className="hero-title">
                        {t('hero.title')}
                    </h1>

                    <p className="hero-tagline">
                        <Trans i18nKey="hero.tagline" />
                    </p>

                    <p className="hero-description">
                        {t('hero.description')}
                    </p>

                    <ul className="features-list">
                        <li className="feature-item">
                            <span className="feature-icon">☕️</span>
                            <span>{t('features.connect')}</span>
                        </li>
                        <li className="feature-item">
                            <span className="feature-icon">💬</span>
                            <span>{t('features.conversations')}</span>
                        </li>
                        <li className="feature-item">
                            <span className="feature-icon">✨</span>
                            <span>{t('features.community')}</span>
                        </li>
                    </ul>
                </div>

                {/* Right side - Form Card */}
                <div className="form-section">
                    <div className="glass-card">
                        <div className="card-header">
                            <h2 className="card-title">{step === 1 ? t('form.title') : t('form.step2_title')}</h2>
                            <p className="card-subtitle">
                                {step === 1 ? (
                                    <Trans i18nKey="form.subtitle" />
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
                                        <span>{isLoading ? t('form.loading') : t('form.step1_btn')}</span>
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
                                        textDecoration: 'underline'
                                    }}
                                >
                                    Back
                                </button>
                            </form>
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
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Home;
