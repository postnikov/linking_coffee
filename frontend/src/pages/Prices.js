import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ContentLayout } from '../layouts/BaseLayout';
import '../styles/page-components.css';
import './Prices.css';

const Prices = ({ user }) => {
    const { t } = useTranslation();
    const [billingCycle, setBillingCycle] = useState('monthly');

    const currentPlan = user?.status || (user ? 'Free' : '');

    return (
        <ContentLayout>
            <header className="page-header">
                <h1 className="page-title">{t('pages.prices.title')}</h1>
            </header>

            <div className="card-grid card-grid-3">
                {/* Free Plan */}
                <div className="content-card price-card">
                    {user && currentPlan === 'Free' && (
                        <div className="price-card-current-badge early-bird-badge">
                            {t('pages.prices.free.current')}
                        </div>
                    )}
                    <div className="price-card-header price-card-header-centered">
                        <h2 className="price-card-title">{t('pages.prices.free.title')}</h2>
                    </div>
                    <div className="price-card-amount price-card-amount-early-bird">
                        {t('pages.prices.free.price')}
                    </div>
                    <ul className="price-feature-list">
                        {t('pages.prices.free.features', { returnObjects: true }).map((feature, i) => (
                            <li key={i} className="price-feature-item">
                                <span className="price-feature-check price-feature-check-green">✓</span>
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* PRO Plan */}
                <div className="content-card price-card price-card-highlighted">
                    {user && (currentPlan === 'PRO' || currentPlan === 'EarlyBird') && (
                        <div className="price-card-current-badge early-bird-badge">
                            {t('pages.prices.pro.current')}
                        </div>
                    )}

                    <div className={`price-card-header ${currentPlan === 'EarlyBird' ? 'price-card-header-centered' : ''}`}>
                        <h2 className={`price-card-title ${currentPlan !== 'EarlyBird' ? 'price-card-title-gradient' : ''}`}>
                            {currentPlan === 'EarlyBird' ? 'Early Bird' : t('pages.prices.pro.title')}
                        </h2>
                        {currentPlan !== 'EarlyBird' && (
                            <div className="billing-toggle">
                                <button
                                    onClick={() => setBillingCycle('monthly')}
                                    className={`billing-toggle-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
                                >
                                    Month
                                </button>
                                <button
                                    onClick={() => setBillingCycle('yearly')}
                                    className={`billing-toggle-btn ${billingCycle === 'yearly' ? 'active' : ''}`}
                                >
                                    Year
                                </button>
                            </div>
                        )}
                    </div>

                    <div className={`price-card-amount ${currentPlan === 'EarlyBird' ? 'price-card-amount-early-bird' : 'price-card-amount-pro'}`}>
                        {currentPlan === 'EarlyBird'
                            ? t('pages.prices.early_bird.price', 'Free for you')
                            : (billingCycle === 'monthly' ? t('pages.prices.pro.price_monthly') : t('pages.prices.pro.price_yearly'))
                        }
                    </div>

                    <ul className="price-feature-list price-feature-list-with-margin">
                        {t('pages.prices.pro.features', { returnObjects: true }).map((feature, i) => (
                            <li key={i} className="price-feature-item">
                                <span className="price-feature-check price-feature-check-purple">✓</span>
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>

                    {currentPlan !== 'PRO' && currentPlan !== 'EarlyBird' && (
                        <button className="submit-btn price-upgrade-btn">
                            {t('pages.prices.pro.button')}
                        </button>
                    )}
                </div>

                {/* Premium Plan (Blurred) */}
                <div className="content-card price-card price-card-blurred">
                    <div className="price-card-blur-overlay">
                        <h2 className="price-card-title">{t('pages.prices.premium.title')}</h2>
                        <ul className="price-feature-list">
                            <li className="price-feature-item">
                                <span>✓</span> Unlimited Coffee
                            </li>
                            <li className="price-feature-item">
                                <span>✓</span> VIP Support
                            </li>
                            <li className="price-feature-item">
                                <span>✓</span> Exclusive Events
                            </li>
                            <li className="price-feature-item">
                                <span>✓</span> Mentor Matching
                            </li>
                        </ul>
                    </div>
                    <div className="price-card-coming-soon">
                        {t('pages.prices.premium.coming_soon')}
                    </div>
                </div>
            </div>
        </ContentLayout>
    );
};

export default Prices;
