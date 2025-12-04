import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Dashboard.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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

const PublicProfile = () => {
    const { username } = useParams();
    const { t, i18n } = useTranslation();
    const [formData, setFormData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [interests, setInterests] = useState({ professional: [], personal: [], categories: {} });

    useEffect(() => {
        // Fetch interests
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
            if (!username) return;

            // Get current user for requester check
            const storedUser = localStorage.getItem('user');
            const currentUser = storedUser ? JSON.parse(storedUser) : null;
            const requester = currentUser ? currentUser.username : '';

            try {
                setIsLoading(true);
                const response = await fetch(`${API_URL}/api/profile?username=${username}&requester=${requester}`);
                const data = await response.json();

                if (data.success) {
                    setFormData(data.profile);
                } else {
                    setError(data.message || 'User not found');
                }
            } catch (error) {
                console.error('Failed to fetch profile:', error);
                setError('Failed to load profile');
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [username]);

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
        <div className="dashboard-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="profile-section" style={{ width: '100%' }}>
                <div className="glass-card profile-view">
                    <div className="profile-view-header">
                        <div className="avatar-name-container">
                            <div className="profile-avatar-container">
                                {formData.avatar ? (
                                    <img
                                        src={getAvatarUrl(formData.avatar)}
                                        alt="Profile"
                                        className="profile-avatar"
                                    />
                                ) : (
                                    <div className="profile-avatar-placeholder">
                                        {formData.name ? formData.name.charAt(0).toUpperCase() : '?'}
                                    </div>
                                )}
                            </div>

                            <div className="name-family-row">
                                <h2 className="profile-name">
                                    {formData.name} {formData.family}
                                </h2>
                                <div className="profile-meta-row">
                                    {formData.country && (
                                        <span className="profile-location">
                                            {formData.country.flag} {formData.city ? formData.city.name : formData.country.name}
                                        </span>
                                    )}
                                    <span className="profile-timezone">
                                        {formData.timezone.split(' ')[0]}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="profile-view-content">
                        {formData.profession && (
                            <div className="profile-section-block">
                                <h4>{t('dashboard.profile.profession')}</h4>
                                <p className="profession-text">
                                    {formData.profession}
                                    {formData.grade && formData.grade !== 'Prefer not to say' && (
                                        <span className="grade-badge">{formData.grade}</span>
                                    )}
                                </p>
                            </div>
                        )}

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

                        <div className="profile-interests-grid">
                            {formData.professionalInterests?.length > 0 && (
                                <div>
                                    <h4>{t('dashboard.profile.professional_interests')}</h4>
                                    <div className="interest-chips">
                                        {formData.professionalInterests.map(interest => (
                                            <span key={interest} className="chip">
                                                {getLocalizedInterest(interest, 'professional')}
                                            </span>
                                        ))}
                                        {formData.otherProfessionalInterests && formData.otherProfessionalInterests.split(/[,\.;]+/).map(item => item.trim()).filter(item => item).map((item, index) => (
                                            <span key={`other-prof-${index}`} className="chip" style={{ backgroundColor: getInterestColor(item) }}>
                                                {item}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {formData.personalInterests?.length > 0 && (
                                <div>
                                    <h4>{t('dashboard.profile.personal_interests')}</h4>
                                    <div className="interest-chips">
                                        {formData.personalInterests.map(interest => (
                                            <span key={interest} className="chip">
                                                {getLocalizedInterest(interest, 'personal')}
                                            </span>
                                        ))}
                                        {formData.otherPersonalInterests && formData.otherPersonalInterests.split(/[,\.;]+/).map(item => item.trim()).filter(item => item).map((item, index) => (
                                            <span key={`other-pers-${index}`} className="chip" style={{ backgroundColor: getInterestColor(item) }}>
                                                {item}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {formData.coffeeGoals?.length > 0 && (
                            <div className="profile-section-block">
                                <h4>{t('dashboard.profile.coffee_goals')}</h4>
                                <p>{formData.coffeeGoals.join(', ')}</p>
                            </div>
                        )}

                        <div className="profile-interests-grid">
                            {formData.languages?.length > 0 && (
                                <div>
                                    <h4>{t('dashboard.profile.languages')}</h4>
                                    <div className="language-chips">
                                        {formData.languages.map(lang => (
                                            <span key={lang} className="chip">{lang}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {formData.bestMeetingDays?.length > 0 && (
                                <div>
                                    <h4>{t('dashboard.profile.best_days')}</h4>
                                    <div className="days-chips">
                                        {formData.bestMeetingDays.map(day => (
                                            <span
                                                key={day}
                                                className="chip day-chip"
                                                style={{ backgroundColor: DAY_COLORS[day] }}
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
        </div>
    );
};

export default PublicProfile;
