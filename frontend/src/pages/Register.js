import React, { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import PageLayout from '../components/PageLayout';

const Register = () => {
    const { t } = useTranslation();
    const [telegramUsername, setTelegramUsername] = useState('');
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('loading');
        setMessage('');

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
                    <form className="registration-form" onSubmit={handleSubmit} style={{ maxWidth: '400px', margin: '0 auto' }}>
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
                    <p>{t('form.footer')}</p>
                </div>
            </div>
        </PageLayout>
    );
};

export default Register;
