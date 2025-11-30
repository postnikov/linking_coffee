import React, { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';

const Home = ({ onLogin }) => {
    const { t } = useTranslation();
    const [step, setStep] = useState(1); // 1: Username, 2: OTP
    const [telegramUsername, setTelegramUsername] = useState('');
    const [otp, setOtp] = useState('');
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');
    const [hasTelegramId, setHasTelegramId] = useState(false);

    const handleUsernameSubmit = async (e) => {
        e.preventDefault();
        setStatus('loading');
        setMessage('');

        const cleanUsername = telegramUsername.replace('@', '').trim();

        if (!cleanUsername) {
            setStatus('idle');
            return;
        }

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegramUsername: cleanUsername }),
            });

            const data = await response.json();

            if (response.ok) {
                setTelegramUsername(cleanUsername);
                setHasTelegramId(data.hasTelegramId);
                setStep(2);
                setStatus('idle');
                // Optional: Set a message based on whether OTP was sent proactively
                if (data.hasTelegramId) {
                    setMessage(t('form.otp_sent_proactive') || "Code sent to your Telegram!");
                }
            } else {
                setStatus('error');
                setMessage(data.message || t('form.error_generic'));
            }
        } catch (error) {
            setStatus('error');
            setMessage(t('form.error_generic'));
        }
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        setStatus('loading');
        setMessage('');

        try {
            const response = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegramUsername,
                    otp: otp.replace(/\s+/g, '')
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setStatus('success');
                setMessage(t('form.success'));
                // Trigger login after short delay to show success message
                setTimeout(() => {
                    onLogin({ username: telegramUsername });
                }, 1500);
            } else {
                setStatus('error');
                setMessage(data.message || t('form.error_generic'));
            }
        } catch (error) {
            setStatus('error');
            setMessage(t('form.error_generic'));
        }
    };

    const resetFlow = () => {
        setStep(1);
        setStatus('idle');
        setMessage('');
        setOtp('');
        setHasTelegramId(false);
    };

    return (
        <main className="main-content">
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

                    <ul className="feature-list">
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
                                        <>
                                            <span>{t('form.otp_sent_proactive')}</span>
                                            <br />
                                            <span style={{ fontSize: '0.9em' }}>
                                                <Trans
                                                    i18nKey="form.check_bot"
                                                    components={{
                                                        1: <a href="https://t.me/linked_coffee_bot" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', fontWeight: 'bold' }} />
                                                    }}
                                                />
                                            </span>
                                        </>
                                    ) : (
                                        <Trans
                                            i18nKey="form.step2_subtitle"
                                            components={{
                                                1: <a href="https://t.me/linked_coffee_bot" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', fontWeight: 'bold' }} />
                                            }}
                                        />
                                    )
                                )}
                            </p>
                        </div>

                        {status === 'success' ? (
                            <div className="success-message">
                                <span className="success-icon">✅</span>
                                <p>{message}</p>
                            </div>
                        ) : (
                            <>
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
                                                    disabled={status === 'loading'}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <button type="submit" className="submit-btn" disabled={status === 'loading'}>
                                            <div className="button-content">
                                                {status === 'loading' && <span className="spinner"></span>}
                                                <span>{status === 'loading' ? t('form.loading') : t('form.step1_btn')}</span>
                                            </div>
                                        </button>
                                        {status === 'error' && <p className="error-message">{message}</p>}
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
                                                    disabled={status === 'loading'}
                                                    required
                                                    style={{ textAlign: 'center', letterSpacing: '0.2em', fontSize: '1.2rem' }}
                                                />
                                            </div>
                                        </div>

                                        <button type="submit" className="submit-btn" disabled={status === 'loading'}>
                                            <div className="button-content">
                                                {status === 'loading' && <span className="spinner"></span>}
                                                <span>{status === 'loading' ? t('form.loading') : t('form.verify_btn')}</span>
                                            </div>
                                        </button>

                                        {status === 'error' && <p className="error-message">{message}</p>}

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
                            </>
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
