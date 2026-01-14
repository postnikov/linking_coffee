import React from 'react';
import { useTranslation, Trans } from 'react-i18next';


const About = () => {
    const { t } = useTranslation();
    return (
        <main className="main-content">
            <div style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                paddingTop: '6rem'
            }}>
                <div style={{
                    display: 'flex',
                    gap: '2rem',
                    maxWidth: '1200px',
                    width: '100%',
                    flexDirection: 'row',
                    flexWrap: 'wrap' // Allow wrapping on small screens
                }}>
                    {/* Left Column - What is Linked.Coffee (2/3) */}
                    <div className="glass-card" style={{
                        flex: '2 1 600px', // Grow: 2, Shrink: 1, Basis: 600px
                        padding: '3rem'
                    }}>
                        <h1 style={{
                            fontSize: '2.5rem',
                            marginBottom: '2rem',
                            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>
                            {t('pages.about.title')}
                        </h1>

                        <div style={{ fontSize: '1.1rem', lineHeight: '1.8', color: 'var(--text-primary)' }}>
                            <p style={{ marginBottom: '1.5rem' }}>{t('pages.about.p1')}</p>
                            <p style={{ marginBottom: '1.5rem' }}>{t('pages.about.p2')}</p>
                            <p style={{ marginBottom: '1.5rem' }}>{t('pages.about.p3')}</p>
                            <p>{t('pages.about.p4')}</p>
                        </div>
                    </div>

                    {/* Right Column - Slogan & How it works (1/3) */}
                    <div style={{
                        flex: '1 1 300px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.5rem'
                    }}>
                        {/* Slogan */}
                        <div className="glass-card" style={{
                            padding: '1.5rem',
                            textAlign: 'left',
                            background: 'rgba(255, 255, 255, 0.8)',
                            border: '1px solid rgba(99, 102, 241, 0.3)'
                        }}>
                            <div style={{
                                fontSize: '1.1rem',
                                fontWeight: 'bold',
                                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                marginBottom: '1rem'
                            }}>
                                <p style={{ marginBottom: '0.2rem' }}>{t('pages.about.slogan_l1')}</p>
                                <p>{t('pages.about.slogan_l2')}</p>
                            </div>

                            <p style={{
                                fontSize: '0.85rem',
                                color: 'var(--gray-500)',
                                fontStyle: 'italic',
                                textAlign: 'right'
                            }}>
                                {t('pages.about.slogan_copyright')}
                            </p>
                        </div>

                        {/* How it works */}
                        <div className="glass-card" style={{
                            padding: '2rem',
                            height: 'fit-content'
                        }}>
                            <h2 style={{
                                fontSize: '1.8rem',
                                marginBottom: '1.5rem',
                                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}>
                                {t('pages.about.how_it_works_title')}
                            </h2>

                            <ul style={{
                                listStyle: 'none',
                                padding: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem'
                            }}>
                                {t('pages.about.how_it_works_steps', { returnObjects: true }).map((_, index) => (
                                    <li key={index} style={{
                                        display: 'flex',
                                        gap: '1rem',
                                        fontSize: '1rem',
                                        lineHeight: '1.5',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        <span style={{
                                            color: '#6366f1',
                                            fontWeight: 'bold',
                                            minWidth: '1.5rem'
                                        }}>
                                            {index + 1}.
                                        </span>
                                        <span>
                                            <Trans
                                                i18nKey={`pages.about.how_it_works_steps.${index}`}
                                                components={{
                                                    1: <a href="https://t.me/Linked_Coffee_Bot" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', textDecoration: 'underline' }}>link</a>
                                                }}
                                            />
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default About;
