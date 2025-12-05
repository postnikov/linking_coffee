import React, { useState } from 'react';

const GdprModal = ({ onAccept, onClose }) => {
    const [agreements, setAgreements] = useState({
        terms: false,
        age: false,
        messages: false
    });

    const allAccepted = agreements.terms && agreements.age && agreements.messages;

    const toggleAgreement = (key) => {
        setAgreements(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem',
            backdropFilter: 'blur(5px)'
        }}>
            <div className="glass-card" style={{
                maxWidth: '600px', width: '100%',
                background: 'rgba(255, 255, 255, 0.95)',
                color: '#1f2937',
                padding: '3rem 2.5rem',
                borderRadius: '24px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                display: 'flex', flexDirection: 'column',
                position: 'relative'
            }}>
                <h1 style={{
                    fontSize: '2.5rem',
                    fontWeight: '700',
                    marginBottom: '1rem',
                    color: '#000',
                    lineHeight: 1.2,
                    textAlign: 'left'
                }}>
                    Get started
                </h1>

                <p style={{
                    fontSize: '1.1rem',
                    color: '#6b7280',
                    marginBottom: '2.5rem',
                    textAlign: 'left'
                }}>
                    Please accept our terms of service to continue
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>

                    {/* Item 1: Terms & Privacy */}
                    <div
                        style={{ display: 'flex', gap: '1rem', cursor: 'pointer', alignItems: 'flex-start' }}
                        onClick={() => toggleAgreement('terms')}
                    >
                        <div style={{ flexShrink: 0, marginTop: '2px' }}>
                            <CheckIcon checked={agreements.terms} />
                        </div>
                        <span style={{ fontSize: '1rem', lineHeight: '1.5', color: '#374151', textAlign: 'left' }}>
                            I accept the <a href="#" onClick={(e) => e.stopPropagation()} style={{ color: '#000', textDecoration: 'underline', fontWeight: '500' }}>Terms of Service</a> and <a href="/GDPR.pdf" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: '#000', textDecoration: 'underline', fontWeight: '500' }}>Privacy Policy</a>, as may be modified from time to time.
                        </span>
                    </div>

                    {/* Item 2: Age */}
                    <div
                        style={{ display: 'flex', gap: '1rem', cursor: 'pointer', alignItems: 'flex-start' }}
                        onClick={() => toggleAgreement('age')}
                    >
                        <div style={{ flexShrink: 0, marginTop: '2px' }}>
                            <CheckIcon checked={agreements.age} />
                        </div>
                        <span style={{ fontSize: '1rem', lineHeight: '1.5', color: '#374151', textAlign: 'left' }}>
                            I certify that I am over the age of 18.
                        </span>
                    </div>

                    {/* Item 3: Messages */}
                    <div
                        style={{ display: 'flex', gap: '1rem', cursor: 'pointer', alignItems: 'flex-start' }}
                        onClick={() => toggleAgreement('messages')}
                    >
                        <div style={{ flexShrink: 0, marginTop: '2px' }}>
                            <CheckIcon checked={agreements.messages} />
                        </div>
                        <span style={{ fontSize: '1rem', lineHeight: '1.5', color: '#374151', textAlign: 'left' }}>
                            I agree to receive Telegram messages from or on behalf of Linked.Coffee
                        </span>
                    </div>

                </div>

                <button
                    onClick={onAccept}
                    disabled={!allAccepted}
                    style={{
                        width: '100%',
                        padding: '1rem',
                        borderRadius: '8px',
                        background: allAccepted ? '#000' : '#e5e7eb',
                        color: allAccepted ? '#fff' : '#9ca3af',
                        border: 'none',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: allAccepted ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s'
                    }}
                >
                    Create an account
                </button>

            </div>
        </div>
    );
};

const CheckIcon = ({ checked }) => (
    <div style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        border: checked ? '2px solid #000' : '2px solid #d1d5db',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
        background: 'transparent'
    }}>
        {checked && (
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 5L4.5 8.5L13 1" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )}
    </div>
);

export default GdprModal;
