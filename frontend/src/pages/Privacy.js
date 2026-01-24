import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

const Privacy = () => {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/privacy.md')
            .then(res => res.text())
            .then(text => {
                setContent(text);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <main className="main-content">
                <div style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    paddingTop: '6rem'
                }}>
                    <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="main-content">
            <div style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                paddingTop: '6rem'
            }}>
                <div className="glass-card" style={{
                    maxWidth: '900px',
                    width: '100%',
                    padding: '3rem'
                }}>
                    <div className="privacy-content">
                        <ReactMarkdown>{content}</ReactMarkdown>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Privacy;
