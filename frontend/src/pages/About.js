import React from 'react';
import { useTranslation, Trans } from 'react-i18next';
import './About.css';

const About = () => {
    const { t } = useTranslation();
    return (
        <main className="main-content about-main">
            <div className="about-container">
                {/* Left Column - What is Linked.Coffee (2/3) */}
                <div className="glass-card about-left-column">
                    <h1 className="about-title">
                        {t('pages.about.title')}
                    </h1>

                    <div className="about-content">
                        <p>{t('pages.about.p1')}</p>
                        <p>{t('pages.about.p2')}</p>
                        <p>{t('pages.about.p3')}</p>
                        <p>{t('pages.about.p4')}</p>
                    </div>
                </div>

                {/* Right Column - Slogan & How it works (1/3) */}
                <div className="about-right-column">
                    {/* Slogan */}
                    <div className="glass-card about-slogan-card">
                        <div className="about-slogan-text">
                            <p>{t('pages.about.slogan_l1')}</p>
                            <p>{t('pages.about.slogan_l2')}</p>
                        </div>

                        <p className="about-slogan-copyright">
                            {t('pages.about.slogan_copyright')}
                        </p>
                    </div>

                    {/* How it works */}
                    <div className="glass-card about-how-it-works-card">
                        <h2 className="about-how-it-works-title">
                            {t('pages.about.how_it_works_title')}
                        </h2>

                        <ul className="about-steps-list">
                            {t('pages.about.how_it_works_steps', { returnObjects: true }).map((_, index) => (
                                <li key={index} className="about-step-item">
                                    <span className="about-step-number">
                                        {index + 1}.
                                    </span>
                                    <span>
                                        <Trans
                                            i18nKey={`pages.about.how_it_works_steps.${index}`}
                                            components={{
                                                1: <a href="https://t.me/Linked_Coffee_Bot" target="_blank" rel="noopener noreferrer" className="about-step-link">link</a>
                                            }}
                                        />
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default About;
