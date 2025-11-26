import React, { useState } from 'react';
import './App.css';

function App() {
    const [telegramUsername, setTelegramUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!telegramUsername.trim()) {
            setMessage({
                type: 'error',
                title: 'Oops!',
                text: 'Please enter your Telegram username'
            });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ telegramUsername }),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage({
                    type: 'success',
                    title: 'Welcome aboard! 🎉',
                    text: data.message
                });
                setTelegramUsername('');
            } else {
                setMessage({
                    type: 'error',
                    title: 'Registration failed',
                    text: data.message
                });
            }
        } catch (error) {
            setMessage({
                type: 'error',
                title: 'Connection error',
                text: 'Could not connect to the server. Please try again later.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="landing-page">
            {/* Animated background decorations */}
            <div className="background-decoration">
                <div className="bg-circle bg-circle-1"></div>
                <div className="bg-circle bg-circle-2"></div>
                <div className="bg-circle bg-circle-3"></div>
            </div>

            {/* Main content */}
            <div className="landing-content">
                <div className="content-wrapper">
                    {/* Left side - Hero */}
                    <div className="hero-section">


                        <h1 className="hero-title">
                            Linking Coffee
                        </h1>

                        <p className="hero-tagline">
                            Expand your world.
                            <br />
                            One conversation at a time.
                        </p>

                        <p className="hero-description">
                            Join our community of curious minds and build meaningful connections
                            through random coffee chats. Every week, we'll match you with someone
                            new for enriching conversations.
                        </p>

                        <ul className="features-list">
                            <li className="feature-item">
                                <span className="feature-icon">🤝</span>
                                <span>Connect with like-minded people</span>
                            </li>
                            <li className="feature-item">
                                <span className="feature-icon">🌍</span>
                                <span>Expand your network globally</span>
                            </li>
                            <li className="feature-item">
                                <span className="feature-icon">💬</span>
                                <span>Meaningful conversations via Zoom or Google Meet</span>
                            </li>
                            <li className="feature-item">
                                <span className="feature-icon">✨</span>
                                <span>Serendipitous connections every week</span>
                            </li>
                        </ul>
                    </div>

                    {/* Right side - Registration Form */}
                    <div className="registration-section">
                        <div className="registration-card">
                            <div className="card-header">
                                <div className="early-bird-badge">
                                    <span>🐦</span>
                                    <span>Early Bird Registration</span>
                                </div>
                                <h2 className="card-title">Get Early Access</h2>
                                <p className="card-subtitle">
                                    Sign up now and be among the first to experience Linking Coffee
                                </p>
                            </div>

                            {message && (
                                <div className={`alert alert-${message.type}`}>
                                    <div className="alert-title">{message.title}</div>
                                    <div>{message.text}</div>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="registration-form">
                                <div className="form-group">
                                    <label htmlFor="telegram-username" className="form-label">
                                        Telegram Username
                                    </label>
                                    <div className="input-wrapper">
                                        <span className="input-icon">@</span>
                                        <input
                                            type="text"
                                            id="telegram-username"
                                            className="form-input"
                                            placeholder="your_username"
                                            value={telegramUsername}
                                            onChange={(e) => setTelegramUsername(e.target.value)}
                                            disabled={loading}
                                        />
                                    </div>
                                    <span className="form-hint">
                                        Enter your Telegram username without "@"
                                    </span>
                                </div>

                                <button
                                    type="submit"
                                    className="submit-button"
                                    disabled={loading}
                                >
                                    <div className="button-content">
                                        {loading && <span className="spinner"></span>}
                                        <span>{loading ? 'Registering...' : 'Join the Waitlist'}</span>
                                    </div>
                                </button>
                            </form>

                            <div style={{
                                marginTop: 'var(--spacing-lg)',
                                textAlign: 'center',
                                fontSize: '0.875rem',
                                color: 'var(--gray-600)'
                            }}>
                                <p>
                                    By signing up, you'll receive exclusive early bird benefits
                                    when we launch! 🚀
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
