import React from 'react';
import { useTranslation } from 'react-i18next';
import { WideLayout } from '../layouts/BaseLayout';
import '../styles/page-components.css';

const Rules = () => {
    const { t } = useTranslation();

    return (
        <WideLayout>
            <header className="page-header">
                <h1 className="page-title">{t('pages.rules.title')}</h1>
            </header>

            <div className="card-grid card-grid-2">
                {/* The Basics */}
                <div className="content-card">
                    <h2 className="section-header">{t('pages.rules.basics.title')}</h2>
                    <ul className="feature-list">
                        {t('pages.rules.basics.items', { returnObjects: true }).map((item, index) => (
                            <li key={index} className="feature-list-item">
                                <span className="feature-list-bullet">•</span>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Making it great */}
                <div className="content-card">
                    <h2 className="section-header">{t('pages.rules.tips.title')}</h2>
                    <ul className="feature-list">
                        {t('pages.rules.tips.items', { returnObjects: true }).map((item, index) => (
                            <li key={index} className="feature-list-item">
                                <span className="feature-list-bullet">•</span>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </WideLayout>
    );
};

export default Rules;
