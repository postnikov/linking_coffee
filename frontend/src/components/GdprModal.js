import React, { useState } from 'react';

const GdprModal = ({ onAccept, onClose }) => {
    const [accepted, setAccepted] = useState(false);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
        }}>
            <div className="glass-card" style={{
                maxWidth: '900px', width: '95%', maxHeight: '80vh', overflowY: 'auto',
                background: 'white', color: '#333', textAlign: 'left', padding: '2rem',
                display: 'flex', flexDirection: 'column', position: 'relative'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: '1rem', right: '1rem',
                        background: 'none', border: 'none', fontSize: '2rem', lineHeight: '1', cursor: 'pointer', color: '#666',
                        zIndex: 10
                    }}
                    aria-label="Close"
                >
                    &times;
                </button>
                <h2 style={{ marginBottom: '1.5rem', color: '#111', flexShrink: 0, paddingRight: '2rem' }}>Privacy Policy (TL;DR)</h2>

                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '0.5rem' }}>
                    <div style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                        <p style={{ fontWeight: 'bold', marginBottom: '1rem' }}>The essence of the policy</p>
                        <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
                            <li style={{ marginBottom: '0.5rem' }}>Linked.Coffee connects people from the tech world for friendly “random coffee” chats via Telegram.</li>
                            <li style={{ marginBottom: '0.5rem' }}>You use the service through a Telegram bot. We don’t ask you for email to participate.</li>
                            <li style={{ marginBottom: '0.5rem' }}>We see what Telegram shows us (your Telegram ID, username, name, profile photo if available) and what you decide to tell the bot about yourself: interests, hobbies, professional background, career plans, and who you’d like to meet.</li>
                        </ul>

                        <p style={{ marginBottom: '0.5rem' }}>We use this information only to:</p>
                        <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
                            <li>match you with other people,</li>
                            <li>send you introductions and reminders,</li>
                            <li>keep the service running safely and improve it a bit over time.</li>
                        </ul>

                        <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
                            <li style={{ marginBottom: '0.5rem' }}>Your profile is only shown to people we match you with or to whom you explicitly allow it to be shown. We don’t sell your data and don’t spam you.</li>
                            <li style={{ marginBottom: '0.5rem' }}>Matching uses some simple “profiling” (we look at your interests and preferences to suggest people), but it does not make any decisions with big legal or financial impact.</li>
                            <li style={{ marginBottom: '0.5rem' }}>You can stop using the bot at any time and can ask us to delete your data or send you a copy of it.</li>
                            <li style={{ marginBottom: '0.5rem' }}>The service is run from Spain by Maxim Postnikov. GDPR applies, so you have all the usual privacy rights (access, correction, deletion, objection, etc.).</li>
                            <li style={{ marginBottom: '0.5rem' }}>If something is unclear or you want to use your data rights, you can contact us at m.postnikov@gmail.com or Telegram: @max_postnikov</li>
                        </ul>

                        <div style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                            <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Data controller:</p>
                            <p>Maxim Postnikov, NIE: Y6205622Y</p>
                            <p>Registered address: 08912, Spain, Badalona, Carrer de Guifré 510, D-5-1</p>
                            <p>Contact for data protection queries: m.postnikov@gmail.com</p>
                            <p>Country of registration: Spain</p>
                            <p style={{ marginTop: '0.5rem' }}>Minimum age: 18 years.</p>
                        </div>
                    </div>
                </div>

                <div style={{ flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        <input
                            type="checkbox"
                            id="gdpr-consent"
                            checked={accepted}
                            onChange={(e) => setAccepted(e.target.checked)}
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                        <label htmlFor="gdpr-consent" style={{ cursor: 'pointer' }}>I accept the <a href="/GDPR.pdf" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', textDecoration: 'underline' }}>Privacy Policy</a></label>
                    </div>

                    <button
                        className="submit-btn"
                        disabled={!accepted}
                        onClick={onAccept}
                        style={{
                            width: '100%',
                            opacity: accepted ? 1 : 0.5,
                            cursor: accepted ? 'pointer' : 'not-allowed',
                            background: accepted ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' : '#ccc'
                        }}
                    >
                        Proceed to Linked.Coffee
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GdprModal;
