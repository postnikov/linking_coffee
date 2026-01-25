import React, { useState } from 'react';

const GdprModal = ({ onAccept, onClose, initialName, initialFamily }) => {
    const [agreements, setAgreements] = useState({
        terms: false,
        age: false,
        messages: false
    });

    const [linkedinUrl, setLinkedinUrl] = useState('');
    const [name, setName] = useState(initialName || '');
    const [family, setFamily] = useState(initialFamily || '');
    const [communityCode, setCommunityCode] = useState('');

    const allAccepted = agreements.terms && agreements.age && agreements.messages;

    const toggleAgreement = (key) => {
        setAgreements(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const inputStyle = {
        padding: '0.75rem',
        borderRadius: '12px',
        border: '2px solid #e5e7eb',
        fontSize: '1rem',
        width: '100%',
        outline: 'none',
        transition: 'all 0.2s',
        color: '#374151',
        background: '#f9fafb'
    };

    const handleFocus = (e) => {
        e.target.style.borderColor = '#7c3aed';
        e.target.style.background = '#fff';
        e.target.style.boxShadow = '0 0 0 4px rgba(124, 58, 237, 0.1)';
    };

    const handleBlur = (e) => {
        e.target.style.borderColor = '#e5e7eb';
        e.target.style.background = '#f9fafb';
        e.target.style.boxShadow = 'none';
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
                position: 'relative',
                maxHeight: '90vh',
                overflowY: 'auto'
            }}>
                <h1 style={{
                    fontSize: '2.5rem',
                    fontWeight: '700',
                    marginBottom: '2rem',
                    color: '#111827',
                    lineHeight: 1.2,
                    textAlign: 'left'
                }}>
                    Get started
                </h1>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>

                    {/* Name & Family Row */}
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', textAlign: 'left' }}>
                                Name
                            </label>
                            <input
                                type="text"
                                placeholder="Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                style={inputStyle}
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                            />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', textAlign: 'left' }}>
                                Last Name
                            </label>
                            <input
                                type="text"
                                placeholder="Last Name"
                                value={family}
                                onChange={(e) => setFamily(e.target.value)}
                                style={inputStyle}
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                            />
                        </div>
                    </div>

                    {/* LinkedIn Input */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', textAlign: 'left' }}>
                            LinkedIn Profile URL <span style={{ color: '#9ca3af', fontWeight: '400', fontSize: '0.9rem' }}>(Optional)</span>
                        </label>
                        <input
                            type="url"
                            placeholder="https://www.linkedin.com/in/..."
                            value={linkedinUrl}
                            onChange={(e) => setLinkedinUrl(e.target.value)}
                            style={inputStyle}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                    </div>

                    {/* Community Code Input (Optional) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', textAlign: 'left' }}>
                            Community code <span style={{ color: '#9ca3af', fontWeight: '400', fontSize: '0.9rem' }}>(If you have it)</span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. PRO2025"
                            value={communityCode}
                            onChange={(e) => setCommunityCode(e.target.value)}
                            style={inputStyle}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                    </div>
                </div>

                <p style={{
                    fontSize: '1.1rem',
                    color: '#6b7280',
                    marginBottom: '1.5rem',
                    textAlign: 'left'
                }}>
                    Please accept our terms of service to continue
                </p>

                <div style={{ height: '1px', background: '#e5e7eb', margin: '0 0 1.5rem 0' }}></div>

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
                            I accept the <a href="/terms_and_privacy" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: '#7c3aed', textDecoration: 'underline', fontWeight: '600' }}>Terms of Service and Privacy Policy</a>, as may be modified from time to time.
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
                    onClick={() => onAccept({ name, family, linkedin: linkedinUrl, communityCode })}
                    disabled={!allAccepted}
                    style={{
                        width: '100%',
                        padding: '1rem',
                        borderRadius: '12px',
                        background: allAccepted ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' : '#e5e7eb',
                        color: allAccepted ? '#fff' : '#9ca3af',
                        border: 'none',
                        fontSize: '1.1rem',
                        fontWeight: '600',
                        cursor: allAccepted ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s',
                        boxShadow: allAccepted ? '0 4px 6px -1px rgba(124, 58, 237, 0.3), 0 2px 4px -1px rgba(124, 58, 237, 0.1)' : 'none',
                        marginTop: 'auto'
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
        border: checked ? '2px solid #7c3aed' : '2px solid #d1d5db',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
        background: checked ? '#7c3aed' : 'transparent'
    }}>
        {checked && (
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 5L4.5 8.5L13 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        )}
    </div>
);

export default GdprModal;
