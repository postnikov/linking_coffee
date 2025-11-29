
import React, { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import PageLayout from '../components/PageLayout';
import TelegramLoginButton from '../components/TelegramLoginButton';

const Register = () => {
    const { t } = useTranslation();
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');

    const handleTelegramAuth = async (user) => {
        setStatus('loading');
        setMessage('');

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ telegramUser: user }),
            });

            const data = await response.json();

            if (response.ok) {
                setStatus('success');
                setMessage(t('form.success'));
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
        <PageLayout title={t('header.register')}>
            <div className="register-page-content">
                <p className="register-intro">
                    <Trans i18nKey="form.subtitle" />
                </p>

                {status === 'success' ? (
                    <div className="success-message">
                        <span className="success-icon">✅</span>
                        <p>{message}</p>
                    </div>
                ) : (
                    <div className="registration-form-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>

                        <TelegramLoginButton
                            botName={process.env.REACT_APP_TELEGRAM_BOT_NAME || 'Linked_Coffee_Bot'}
                            onAuth={handleTelegramAuth}
                        />

                        {status === 'loading' && (
                            <div className="button-content">
                                <span className="spinner"></span>
                                <span>{t('form.loading')}</span>
                            </div>
                        )}

                        {status === 'error' && (
                            <p className="error-message">{message}</p>
                        )}
                    </div>
                )}

                <div style={{
                    marginTop: 'var(--spacing-lg)',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    color: 'var(--gray-600)'
                }}>
                    <p>{t('form.footer')}</p>
                </div>
            </div>
        </PageLayout>
    );
};

export default Register;
