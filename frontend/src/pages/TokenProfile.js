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
    const [myInterests, setMyInterests] = useState({
        professionalInterests: [],
        otherProfessionalInterests: '',
        personalInterests: [],
        otherPersonalInterests: '',
        languages: [],
        bestMeetingDays: []
    });

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

    // Fetch current user's interests for highlighting matches (if logged in)
    useEffect(() => {
        const fetchMyInterests = async () => {
            const storedUser = localStorage.getItem('user');
            const currentUser = storedUser ? JSON.parse(storedUser) : null;
            if (!currentUser || !currentUser.username) return;
            const myUsername = currentUser.username.replace('@', '').trim().toLowerCase();

            try {
                const response = await fetch(`${API_URL}/api/profile?username=${myUsername}&requester=${myUsername}`);
                const data = await response.json();
                if (data.success && data.profile) {
                    setMyInterests({
                        professionalInterests: data.profile.professionalInterests || [],
                        otherProfessionalInterests: data.profile.otherProfessionalInterests || '',
                        personalInterests: data.profile.personalInterests || [],
                        otherPersonalInterests: data.profile.otherPersonalInterests || '',
                        languages: data.profile.languages || [],
                        bestMeetingDays: data.profile.bestMeetingDays || []
                    });
                }
            } catch (error) {
                console.error('Failed to fetch own interests:', error);
            }
        };
        fetchMyInterests();
    }, [token]);

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

    // Helper to check if an interest is shared with the current user
    const isMatchingInterest = (item, type) => {
        if (type === 'professional') {
            return myInterests.professionalInterests.includes(item);
        }
        if (type === 'personal') {
            return myInterests.personalInterests.includes(item);
        }
        if (type === 'language') {
            return myInterests.languages.includes(item);
        }
        if (type === 'day') {
            return myInterests.bestMeetingDays.includes(item);
        }
        if (type === 'other-professional') {
            const myOthers = myInterests.otherProfessionalInterests
                .split(/[,.;]+/).map(i => i.trim().toLowerCase()).filter(Boolean);
            return myOthers.includes(item.trim().toLowerCase());
        }
        if (type === 'other-personal') {
            const myOthers = myInterests.otherPersonalInterests
                .split(/[,.;]+/).map(i => i.trim().toLowerCase()).filter(Boolean);
            return myOthers.includes(item.trim().toLowerCase());
        }
        return false;
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
        <main className="main-content" style={{ paddingTop: '120px', display: 'block', minHeight: '100vh', paddingLeft: 0, paddingRight: 0 }}>
            <div className="public-profile-container">
                <div className="public-profile-section">
                    <div className="glass-card profile-view" style={{ padding: '2rem' }}>
                        <div className="profile-view-header">
                            <div className="avatar-preview view-mode-avatar">
                                {formData.avatar ? (
                                    <img
                                        src={getAvatarUrl(formData.avatar)}
                                        alt="Profile"
                                    />
                                ) : (
                                    <div className="avatar-placeholder">
                                        {formData.name ? formData.name.charAt(0).toUpperCase() : '?'}
                                    </div>
                                )}
                            </div>
                            <div className="profile-view-info">
                                <h3>{formData.name} {formData.family}</h3>
                                <p className="profile-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {formData.profession && <span>{formData.profession}</span>}

                                    {formData.grade && (
                                        <>
                                            {formData.profession && <span style={{ opacity: 0.7 }}>•</span>}
                                            <span>{formData.grade}</span>
                                        </>
                                    )}

                                    {formData.linkedin && (
                                        <>
                                            {(formData.profession || formData.grade) && <span style={{ opacity: 0.7 }}>•</span>}
                                            <a
                                                href={formData.linkedin}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: '#0077b5', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
                                                LinkedIn
                                            </a>
                                        </>
                                    )}
                                </p>
                                {(formData.city || formData.country) && (
                                    <div className="profile-location">
                                        {formData.country?.flag ? <span style={{ fontSize: '1.2rem' }}>{formData.country.flag}</span> : null}
                                        {formData.country?.name && <span>{formData.country.name}</span>}
                                        {formData.city && <span>• {formData.city.name}</span>}
                                        {formData.timezone && <span>• {formData.timezone}</span>}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="profile-content-grid">
                            {/* AI Match Context */}


                            {formData.professionalDesc && (
                                <div className="profile-section-block">
                                    <h4>{t('dashboard.profile.professional_desc')}</h4>
                                    <p>{formData.professionalDesc}</p>
                                </div>
                            )}

                            {formData.personalDesc && (
                                <div className="profile-section-block">
                                    <h4>{t('dashboard.profile.personal_desc')}</h4>
                                    <p>{formData.personalDesc}</p>
                                </div>
                            )}

                            {(formData.professionalInterests?.length > 0 || formData.otherProfessionalInterests || formData.personalInterests?.length > 0 || formData.otherPersonalInterests) && (
                                <div className="profile-interests-grid">
                                    {(formData.professionalInterests?.length > 0 || formData.otherProfessionalInterests) && (
                                        <div>
                                            <h4>{t('dashboard.profile.professional_interests')}</h4>
                                            <div className="language-chips" style={{ flexWrap: 'wrap' }}>
                                                {formData.professionalInterests?.map(item => (
                                                    <span key={item} className={`chip${isMatchingInterest(item, 'professional') ? ' chip-match' : ''}`} style={{ backgroundColor: getInterestColor(item) }}>
                                                        {getLocalizedInterest(item, 'professional')}
                                                    </span>
                                                ))}
                                                {formData.otherProfessionalInterests && formData.otherProfessionalInterests.split(/[,.;]+/).map(item => item.trim()).filter(item => item).map((item, index) => (
                                                    <span key={`other-prof-${index}`} className={`chip${isMatchingInterest(item, 'other-professional') ? ' chip-match' : ''}`} style={{ backgroundColor: getInterestColor(item) }}>
                                                        {item}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {(formData.personalInterests?.length > 0 || formData.otherPersonalInterests) && (
                                        <div>
                                            <h4>{t('dashboard.profile.personal_interests')}</h4>
                                            <div className="language-chips" style={{ flexWrap: 'wrap' }}>
                                                {formData.personalInterests?.map(item => (
                                                    <span key={item} className={`chip${isMatchingInterest(item, 'personal') ? ' chip-match' : ''}`} style={{ backgroundColor: getInterestColor(item) }}>
                                                        {getLocalizedInterest(item, 'personal')}
                                                    </span>
                                                ))}
                                                {formData.otherPersonalInterests && formData.otherPersonalInterests.split(/[,.;]+/).map(item => item.trim()).filter(item => item).map((item, index) => (
                                                    <span key={`other-pers-${index}`} className={`chip${isMatchingInterest(item, 'other-personal') ? ' chip-match' : ''}`} style={{ backgroundColor: getInterestColor(item) }}>
                                                        {item}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {formData.coffeeGoals?.length > 0 && (
                                <div className="profile-section-block">
                                    <h4>{t('dashboard.profile.coffee_goals')}</h4>
                                    <p>{Array.isArray(formData.coffeeGoals) ? formData.coffeeGoals.join(', ') : formData.coffeeGoals}</p>
                                </div>
                            )}

                            <div className="profile-interests-grid">
                                {formData.languages?.length > 0 && (
                                    <div>
                                        <h4>{t('dashboard.profile.languages')}</h4>
                                        <div className="language-chips" style={{ flexWrap: 'wrap' }}>
                                            {formData.languages.map(lang => (
                                                <span key={lang} className={`chip${isMatchingInterest(lang, 'language') ? ' chip-match' : ''}`}>{lang}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {formData.bestMeetingDays?.length > 0 && (
                                    <div>
                                        <h4>{t('dashboard.profile.best_days')}</h4>
                                        <div className="language-chips" style={{ flexWrap: 'wrap' }}>
                                            {formData.bestMeetingDays.map(day => (
                                                <span
                                                    key={day}
                                                    className={`chip${isMatchingInterest(day, 'day') ? ' chip-match' : ''}`}
                                                    style={{ backgroundColor: DAY_COLORS[day] || '#f3f4f6' }}
                                                >
                                                    {t(`dashboard.days.${day.toLowerCase()}`, day)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="public-match-section">
                    <div className="glass-card" style={{ padding: '2rem', position: 'sticky', top: '5rem' }}>
                        <h3 className="section-title" style={{ fontSize: '1.2rem', marginBottom: '1rem', background: 'none', WebkitTextFillColor: 'initial', color: '#1f2937' }}>Match of the Week</h3>
                        <p style={{ marginBottom: '1.5rem', color: '#4b5563' }}>
                            This is your match for the week.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: matchIntro ? '2rem' : '0' }}>
                            <a
                                href={formData.tg_username ? `https://t.me/${formData.tg_username.replace('@', '')}` : '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="save-btn"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textDecoration: 'none', width: '100%', boxSizing: 'border-box', marginTop: 0 }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 11.944 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.638z" /></svg>
                                Message
                            </a>
                        </div>

                        {/* AI Intro / Icebreakers Match Info (Moved to Sidebar) */}
                        {matchIntro && (
                            <div style={{
                                marginTop: '1.5rem',
                                paddingTop: '1.5rem',
                                borderTop: '1px solid #e5e7eb'
                            }}>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{
                                        color: '#9333ea',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontSize: '0.95rem',
                                        fontWeight: '600',
                                        marginBottom: '0.5rem'
                                    }}>
                                        ✨ {t('dashboard.current_match.why_interesting', 'Why you matched')}
                                    </h4>
                                    <p style={{ fontStyle: 'italic', color: '#4b5563', lineHeight: '1.5', fontSize: '0.9rem' }}>
                                        "{matchIntro.why_interesting}"
                                    </p>
                                </div>

                                {matchIntro.conversation_starters && matchIntro.conversation_starters.length > 0 && (
                                    <div>
                                        <h5 style={{
                                            color: '#6b7280',
                                            fontSize: '0.8rem',
                                            fontWeight: '600',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: '0.75rem'
                                        }}>
                                            💬 {t('dashboard.current_match.icebreakers', 'Icebreakers')}
                                        </h5>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {matchIntro.conversation_starters.map((starter, idx) => (
                                                <div key={idx} style={{
                                                    background: '#f9fafb',
                                                    padding: '0.75rem',
                                                    borderRadius: '0.5rem',
                                                    fontSize: '0.85rem',
                                                    color: '#374151',
                                                    border: '1px solid #f3f4f6'
                                                }}>
                                                    {starter}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
};

export default TokenProfile;
