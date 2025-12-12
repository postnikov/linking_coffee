import React from 'react';
import { useTranslation } from 'react-i18next';

const Rules = () => {
    const { t } = useTranslation();

    return (
        <main className="main-content">
            <div className="content-page-container" style={{ gap: '2rem' }}>
                <h1 style={{
                    fontSize: '2.5rem',
                    marginBottom: '1rem',
                    color: '#ffffff',
                    textAlign: 'center',
                    textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                    {t('pages.rules.title')}
                </h1>

                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: '2rem',
                    width: '100%',
                    justifyContent: 'center',
                    alignItems: 'stretch'
                }}>
                    {/* The Basics */}
                    <div className="glass-card" style={{ padding: '2rem', flex: '1 1 400px' }}>
                        <h2 style={{
                            fontSize: '1.8rem',
                            marginBottom: '1.5rem',
                            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            {t('pages.rules.basics.title')}
                        </h2>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {t('pages.rules.basics.items', { returnObjects: true }).map((item, index) => (
                                <li key={index} style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', fontSize: '1.1rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                                    <span style={{ color: '#6366f1', fontSize: '1.5rem', lineHeight: '1' }}>•</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Making it great */}
                    <div className="glass-card" style={{ padding: '2rem', flex: '1 1 400px' }}>
                        <h2 style={{
                            fontSize: '1.8rem',
                            marginBottom: '1.5rem',
                            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            {t('pages.rules.tips.title')}
                        </h2>
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {t('pages.rules.tips.items', { returnObjects: true }).map((item, index) => (
                                <li key={index} style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', fontSize: '1.1rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                                    <span style={{ color: '#6366f1', fontSize: '1.5rem', lineHeight: '1' }}>•</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Rules;
