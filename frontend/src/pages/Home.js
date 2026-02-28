
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

const BOT_NAME = process.env.REACT_APP_TELEGRAM_BOT_NAME || 'Linked_Coffee_Bot';

const Home = () => {
    const { t } = useTranslation();

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

                {/* Right side - Login Card */}
                <div className="form-section">
                    <div className="glass-card">
                        <div className="card-header">
                            <h2 className="card-title">{t('form.title')}</h2>
                            <p className="card-subtitle">
                                <Trans i18nKey="form.subtitle" />
                            </p>
                        </div>

                        {/* Telegram CTA — primary action */}
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
