import React from 'react';
import { useTranslation } from 'react-i18next';

const Dashboard = () => {
    const { t } = useTranslation();

    return (
        <main className="main-content">
            <div className="content-wrapper" style={{ justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div className="glass-card" style={{ maxWidth: '800px', width: '100%', textAlign: 'center', padding: '3rem' }}>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        {t('dashboard.welcome', 'Welcome to your Dashboard')}
                    </h1>
                    <p style={{ fontSize: '1.2rem', color: 'var(--gray-600)' }}>
                        {t('dashboard.empty_state', 'Your coffee matches will appear here soon. Stay tuned! ☕️')}
                    </p>
                </div>
            </div>
        </main>
    );
};

export default Dashboard;
