import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const Prices = ({ user }) => {
    const { t } = useTranslation();
    const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' or 'yearly'

    // Determine current plan
    // If user is logged in but has no explicit status, assume Free? 
    // Or check if status is 'Free'. 
    // Let's assume 'Free' is the default if logged in and not PRO/Premium.
    const currentPlan = user?.status || (user ? 'Free' : '');

    return (
        <main className="main-content">
            <div style={{
                width: '100%',
                maxWidth: '1200px',
                margin: '0 auto',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                <h1 style={{
                    fontSize: '2.5rem',
                    marginBottom: '3rem',
                    color: '#ffffff',
                    textAlign: 'center',
                    textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                    {t('pages.prices.title')}
                </h1>

                <div style={{
                    display: 'flex',
                    gap: '2rem',
                    width: '100%',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    alignItems: 'stretch'
                }}>
                    {/* Free Block */}
                    <div className="glass-card" style={{ flex: '1 1 300px', padding: '2rem', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                        {user && currentPlan === 'Free' && (
                            <div className="early-bird-badge" style={{ position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', zIndex: 2 }}>
                                {t('pages.prices.free.current')}
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1.5rem', height: '50px' }}>
                            <h2 style={{ fontSize: '2rem', margin: 0, textAlign: 'center' }}>{t('pages.prices.free.title')}</h2>
                        </div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '2rem', textAlign: 'center', color: '#10b981' }}>
                            {t('pages.prices.free.price')}
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, flex: 1 }}>
                            {t('pages.prices.free.features', { returnObjects: true }).map((feature, i) => (
                                <li key={i} style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                                    <span style={{ color: '#10b981', fontSize: '1.2rem' }}>✓</span> {feature}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* PRO Block */}
                    <div className="glass-card" style={{
                        flex: '1 1 300px',
                        padding: '2rem',
                        position: 'relative',
                        border: '2px solid #6366f1',
                        display: 'flex',
                        flexDirection: 'column',
                        zIndex: 1
                    }}>
                        {user && (currentPlan === 'PRO' || currentPlan === 'EarlyBird') && (
                            <div className="early-bird-badge" style={{ position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', zIndex: 2 }}>
                                {t('pages.prices.pro.current')}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: currentPlan === 'EarlyBird' ? 'center' : 'space-between', alignItems: 'center', marginBottom: '1.5rem', height: '50px' }}>
                            <h2 style={{ fontSize: '2rem', margin: 0, background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                {currentPlan === 'EarlyBird' ? 'Early Bird' : t('pages.prices.pro.title')}
                            </h2>
                            {/* Toggle Switch */}
                            {currentPlan !== 'EarlyBird' && (
                                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.3)', borderRadius: '20px', padding: '4px' }}>
                                    <button
                                        onClick={() => setBillingCycle('monthly')}
                                        style={{
                                            background: billingCycle === 'monthly' ? '#6366f1' : 'transparent',
                                            color: billingCycle === 'monthly' ? 'white' : 'var(--text-primary)',
                                            border: 'none',
                                            borderRadius: '16px',
                                            padding: '6px 12px',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            fontWeight: '600',
                                            transition: 'all 0.3s'
                                        }}
                                    >
                                        Month
                                    </button>
                                    <button
                                        onClick={() => setBillingCycle('yearly')}
                                        style={{
                                            background: billingCycle === 'yearly' ? '#6366f1' : 'transparent',
                                            color: billingCycle === 'yearly' ? 'white' : 'var(--text-primary)',
                                            border: 'none',
                                            borderRadius: '16px',
                                            padding: '6px 12px',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            fontWeight: '600',
                                            transition: 'all 0.3s'
                                        }}
                                    >
                                        Year
                                    </button>
                                </div>
                            )}
                        </div>

                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '2rem', textAlign: 'center', color: currentPlan === 'EarlyBird' ? '#10b981' : '#6366f1', marginTop: '-1px' }}>
                            {currentPlan === 'EarlyBird'
                                ? t('pages.prices.early_bird.price', 'Free for you')
                                : (billingCycle === 'monthly' ? t('pages.prices.pro.price_monthly') : t('pages.prices.pro.price_yearly'))
                            }
                        </div>

                        <ul style={{ listStyle: 'none', padding: 0, flex: 1, marginBottom: '2rem' }}>
                            {t('pages.prices.pro.features', { returnObjects: true }).map((feature, i) => (
                                <li key={i} style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                                    <span style={{ color: '#6366f1', fontSize: '1.2rem' }}>✓</span> {feature}
                                </li>
                            ))}
                        </ul>

                        {currentPlan !== 'PRO' && currentPlan !== 'EarlyBird' && (
                            <button className="submit-btn" style={{ width: '100%' }}>
                                {t('pages.prices.pro.button')}
                            </button>
                        )}
                    </div>

                    {/* Premium Block (Blurred) */}
                    <div className="glass-card" style={{
                        flex: '1 1 300px',
                        padding: '2rem',
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{ filter: 'blur(6px)', opacity: 0.6, pointerEvents: 'none', flex: 1, userSelect: 'none' }}>
                            <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', textAlign: 'center' }}>{t('pages.prices.premium.title')}</h2>
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                                    <span>✓</span> Unlimited Coffee
                                </li>
                                <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                                    <span>✓</span> VIP Support
                                </li>
                                <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                                    <span>✓</span> Exclusive Events
                                </li>
                                <li style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                                    <span>✓</span> Mentor Matching
                                </li>
                            </ul>
                        </div>
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            fontSize: '1.5rem',
                            fontWeight: 'bold',
                            color: 'var(--text-primary)',
                            background: 'rgba(255,255,255,0.9)',
                            padding: '1rem 2rem',
                            borderRadius: '1rem',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                        }}>
                            {t('pages.prices.premium.coming_soon')}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Prices;
