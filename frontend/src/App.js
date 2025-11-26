import React, { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import './App.css';

function App() {
    const { t, i18n } = useTranslation();
    const [telegramUsername, setTelegramUsername] = useState('');
    const [status, setStatus] = useState('idle'); // idle, loading, success, error
    const [message, setMessage] = useState('');

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('loading');
        setMessage('');

        // Basic validation: remove @ if present
        const cleanUsername = telegramUsername.replace('@', '').trim();

        if (!cleanUsername) {
            setStatus('idle');
            return;
        }

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ telegramUsername: cleanUsername }),
            });

            const data = await response.json();

            if (response.ok) {
                setStatus('success');
                setMessage(t('form.success'));
                setTelegramUsername('');
            } else {
                setStatus('error');
                if (response.status === 409) {
                    setMessage(t('form.error_duplicate'));
                } else {
                    setMessage(data.error || t('form.error_generic'));
                }
            }
        } catch (error) {
            setStatus('error');
            setMessage(t('form.error_generic'));
        }
    };

    return (
        <div className="app-container">
            <div className="language-switcher">
                <button
                    className={`lang-btn ${i18n.language === 'en' ? 'active' : ''}`}
                    onClick={() => changeLanguage('en')}
                >
                    EN
                </button>
                <span className="lang-divider">|</span>
                <button
                    className={`lang-btn ${i18n.language === 'ru' ? 'active' : ''}`}
                    onClick={() => changeLanguage('ru')}
                >
                    RU
                </button>
            </div>

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
                                <h2 className="card-title">{t('form.title')}</h2>
                                <p className="card-subtitle">
                                    {t('form.subtitle')}
                                </p>
                            </div>

                            {status === 'success' ? (
                                <div className="success-message">
                                    <span className="success-icon">✅</span>
                                    <p>{message}</p>
                                </div>
                            ) : (
                                <form className="registration-form" onSubmit={handleSubmit}>
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
                                        <span className="form-hint">
                                            {t('form.username_hint')}
                                        </span>
                                    </div>

                                    <button
                                        type="submit"
                                        className="submit-btn"
                                        disabled={status === 'loading'}
                                    >
                                        <div className="button-content">
                                            {status === 'loading' && <span className="spinner"></span>}
                                            <span>{status === 'loading' ? t('form.loading') : t('form.cta_button')}</span>
                                        </div>
                                    </button>

                                    {status === 'error' && (
                                        <p className="error-message">{message}</p>
                                    )}
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
        </div>
    );
}

export default App;
