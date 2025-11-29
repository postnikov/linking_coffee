import React, { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import PageLayout from '../components/PageLayout';

const Register = () => {
    const { t } = useTranslation();
    const [step, setStep] = useState(1); // 1: Username, 2: OTP
    const [telegramUsername, setTelegramUsername] = useState('');
    const [otp, setOtp] = useState('');
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');

    const handleUsernameSubmit = (e) => {
        e.preventDefault();
        const cleanUsername = telegramUsername.replace('@', '').trim();
        if (!cleanUsername) return;

        setTelegramUsername(cleanUsername);
        setStep(2);
        setMessage('');
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        setStatus('loading');
        setMessage('');

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    telegramUsername,
                    otp: otp.trim()
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setStatus('success');
                setMessage(t('form.success'));
                setTelegramUsername('');
                setOtp('');
            } else {
                setStatus('error');
                if (response.status === 409) {
                    setMessage(t('form.error_duplicate'));
                } else {
                    setMessage(data.error || data.message || t('form.error_generic'));
                }
            }
        } catch (error) {
            setStatus('error');
            setMessage(t('form.error_generic'));
        }
    };

    const resetFlow = () => {
        setStep(1);
        setStatus('idle');
        setMessage('');
        setOtp('');
    };

    return (
        <PageLayout title={step === 1 ? t('header.register') : t('form.step2_title')}>
            <div className="register-page-content">
                <p className="register-intro">
                    {step === 1 ? (
                        <Trans i18nKey="form.subtitle" />
                    ) : (
                        <Trans
                            i18nKey="form.step2_subtitle"
                            components={{
                                1: <a href="https://t.me/linked_coffee_bot" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', fontWeight: 'bold' }} />
                            }}
                        />
                    )}
                </p>

                {status === 'success' ? (
                    <div className="success-message">
                        <span className="success-icon">✅</span>
                        <p>{message}</p>
                    </div>
                ) : (
                    <>
                        {step === 1 && (
                            <form className="registration-form" onSubmit={handleUsernameSubmit} style={{ maxWidth: '400px', margin: '0 auto' }}>
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
                                            required
                                        />
                                    </div>
                                </div>

                                <button type="submit" className="submit-btn">
                                    <div className="button-content">
                                        <span>{t('form.step1_btn')}</span>
                                    </div>
                                </button>
                            </form>
                        )}

                        {step === 2 && (
                            <form className="registration-form" onSubmit={handleOtpSubmit} style={{ maxWidth: '400px', margin: '0 auto' }}>
                                <div className="input-group">
                                    <label htmlFor="otp" className="form-label">
                                        {t('form.otp_label')}
                                    </label>
                                    <div className="input-wrapper">
                                        <input
                                            type="text"
                                            id="otp"
                                            className="form-input"
                                            placeholder={t('form.otp_placeholder')}
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            disabled={status === 'loading'}
                                            required
                                            style={{ textAlign: 'center', letterSpacing: '0.2em', fontSize: '1.2rem' }}
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
                                        <span>{status === 'loading' ? t('form.loading') : t('form.verify_btn')}</span>
                                    </div>
                                </button>

                                {status === 'error' && (
                                    <p className="error-message">{message}</p>
                                )}

                                <button
                                    type="button"
                                    onClick={resetFlow}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--gray-600)',
                                        marginTop: '1rem',
                                        cursor: 'pointer',
                                        textDecoration: 'underline'
                                    }}
                                >
                                    Back
                                </button>
                            </form>
                        )}
                    </>
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
