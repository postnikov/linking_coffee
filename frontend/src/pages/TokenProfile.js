import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Dashboard.css';

const API_URL = process.env.REACT_APP_API_URL || '';

const DAY_COLORS = {
    'Monday': '#fee2e2',
    'Tuesday': '#ffedd5',
    'Wednesday': '#fef9c3',
    'Thursday': '#dcfce7',
    'Friday': '#dbeafe',
    'Saturday': '#f3e8ff',
    'Sunday': '#fae8ff'
};

const getAvatarUrl = (avatarPath) => {
    if (!avatarPath) return null;
    if (avatarPath.startsWith('http') || avatarPath.startsWith('data:')) return avatarPath;
    return `${API_URL}${avatarPath}`;
};

const TokenProfile = () => {
    const { token } = useParams();
    const { t, i18n } = useTranslation();
    const [formData, setFormData] = useState(null);
    const [matchIntro, setMatchIntro] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [interests, setInterests] = useState({ professional: [], personal: [], categories: {} });

    useEffect(() => {
        // Fetch interests for localization
        const fetchInterests = async () => {
            try {
                const response = await fetch(`${API_URL}/api/interests`);
                const data = await response.json();
                if (data.success) {
                    setInterests(data.interests);
                }
            } catch (error) {
                console.error('Failed to fetch interests:', error);
            }
        };
        fetchInterests();
    }, []);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!token) return;

            try {
                setIsLoading(true);
                // Use the new /api/view/:token endpoint
                const response = await fetch(`${API_URL}/api/view/${token}`);
                const data = await response.json();

                if (data.success) {
                    setFormData(data.profile);
                    if (data.intro) {
                        setMatchIntro(data.intro);
                    }
                } else {
                    setError(data.message || 'Profile not found or expired');
                }
            } catch (error) {
                console.error('Failed to fetch token profile:', error);
                setError('Failed to load profile');
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [token]);

    // Helper to get localized interest name
    const getLocalizedInterest = (nameEn, type) => {
        if (!interests || !interests[type]) return nameEn;
        const item = interests[type].find(i => i.name_en === nameEn);
        return item && i18n.language === 'ru' ? item.name_ru : nameEn;
    };

    // Helper to get a consistent color for an interest string
    const getInterestColor = (str) => {
        const colors = Object.values(DAY_COLORS);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % colors.length;
        return colors[index];
    };

    if (isLoading) {
        return (
            <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div className="loading-spinner"></div>
            </div>
        );
    }

    if (error || !formData) {
        return (
            <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#fff' }}>
                <h2>{error || 'Profile not found'}</h2>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <h1 className="dashboard-title">
                {t('profile.title_view', { name: formData.name })}
            </h1>
            <p className="dashboard-subtitle">{t('profile.subtitle_view')}</p>

            <div className="profile-content-grid">
                {/* AI Intro / Icebreakers Match Info */}
                {matchIntro && (
                    <div className="profile-card ai-intro-card" style={{ gridColumn: '1 / -1', background: 'linear-gradient(135deg, #FFF5F5 0%, #FFF0F5 100%)', border: '1px solid #FFD1D1' }}>
                        <div className="match-compatibility">
                            <h3 className="section-title">✨ {t('dashboard.current_match.why_interesting', 'Why you matched')}</h3>
                            <p style={{ fontSize: '1.1rem', lineHeight: '1.6', color: '#1f2937', marginBottom: '1.5rem' }}>
                                {matchIntro.why_interesting}
                            </p>

                            <h3 className="section-title">💬 {t('dashboard.current_match.icebreakers', 'Icebreakers')}</h3>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {matchIntro.conversation_starters && matchIntro.conversation_starters.map((starter, idx) => (
                                    <li key={idx} style={{ 
                                        padding: '0.75rem 1rem', 
                                        background: 'rgba(255, 255, 255, 0.6)', 
                                        borderRadius: '8px', 
                                        marginBottom: '0.5rem', 
                                        fontSize: '1rem',
                                        color: '#374151',
                                        display: 'flex',
                                        alignItems: 'start'
                                    }}>
                                        <span style={{ marginRight: '0.5rem' }}>🔹</span>
                                        {starter}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                <div className="profile-column-left">
                    <div className="profile-card profile-header-card">
                        <div className="profile-avatar-container">
                            {formData.avatar ? (
                                <img
                                    src={getAvatarUrl(formData.avatar)}
                                    alt="Profile"
                                    className="profile-avatar-large"
                                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/150'; }}
                                />
                            ) : (
                                <div className="profile-avatar-placeholder-large">
                                    {formData.name ? formData.name.charAt(0).toUpperCase() : '?'}
                                </div>
                            )}
                        </div>
                        <h2 className="profile-name">{formData.name} {formData.family}</h2>
                        
                        {(formData.profession || formData.grade) && (
                            <div className="profile-role-badge">
                                {formData.grade && <span className="role-grade">{formData.grade}</span>}
                                {formData.profession && <span className="role-title">{formData.profession}</span>}
                            </div>
                        )}

                        {(formData.city || formData.country) && (
                            <div className="profile-location">
                                {formData.country?.flag} {formData.city?.name ? `${formData.city.name}, ` : ''}{formData.country?.name}
                            </div>
                        )}
                        
                        <div className="profile-social-links">
                            {formData.linkedin && (
                                <a href={formData.linkedin} target="_blank" rel="noopener noreferrer" className="social-link linkedin">
                                    LinkedIn
                                </a>
                            )}
                            {formData.tg_username && (
                                <a href={`https://t.me/${formData.tg_username.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="social-link telegram">
                                    Telegram
                                </a>
                            )}
                        </div>
                    </div>

                    {formData.languages && formData.languages.length > 0 && (
                        <div className="profile-card">
                            <h3 className="section-title">{t('profile.languages')}</h3>
                            <div className="tags-container">
                                {formData.languages.map((lang, index) => (
                                    <span key={index} className="tag-pill language-tag">
                                        {lang}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="profile-column-right">
                     {/* Professional Section */}
                     {(formData.professionalDesc || (formData.professionalInterests && formData.professionalInterests.length > 0)) && (
                        <div className="profile-card">
                            <h3 className="section-title">🚀 {t('profile.professional_section')}</h3>
                            
                            {formData.professionalDesc && (
                                <div className="profile-bio">
                                    <p>{formData.professionalDesc}</p>
                                </div>
                            )}

                            {formData.professionalInterests && formData.professionalInterests.length > 0 && (
                                <div className="interests-section">
                                    <h4>{t('profile.professional_interests')}</h4>
                                    <div className="tags-container">
                                        {formData.professionalInterests.map((interest, index) => (
                                            <span 
                                                key={index} 
                                                className="tag-pill"
                                                style={{ backgroundColor: getInterestColor(interest) }}
                                            >
                                                {getLocalizedInterest(interest, 'professional')}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Personal Section */}
                    {(formData.personalDesc || (formData.personalInterests && formData.personalInterests.length > 0)) && (
                        <div className="profile-card">
                            <h3 className="section-title">🌟 {t('profile.personal_section')}</h3>
                            
                            {formData.personalDesc && (
                                <div className="profile-bio">
                                    <p>{formData.personalDesc}</p>
                                </div>
                            )}

                            {formData.personalInterests && formData.personalInterests.length > 0 && (
                                <div className="interests-section">
                                    <h4>{t('profile.personal_interests')}</h4>
                                    <div className="tags-container">
                                        {formData.personalInterests.map((interest, index) => (
                                            <span 
                                                key={index} 
                                                className="tag-pill"
                                                style={{ backgroundColor: getInterestColor(interest) }}
                                            >
                                                {getLocalizedInterest(interest, 'personal')}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Goals / Help */}
                    {(formData.coffeeGoals || formData.helpWith) && (
                        <div className="profile-card">
                            <h3 className="section-title">🤝 {t('profile.networking_goals')}</h3>
                            {formData.coffeeGoals && (
                                <div className="profile-bio">
                                    <p>{formData.coffeeGoals}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TokenProfile;
