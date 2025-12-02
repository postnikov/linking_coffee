import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './Dashboard.css';

const TIMEZONES = [
    "HST (UTC-10)", "AKST (UTC-9)", "PST (UTC-8)", "MST (UTC-7)", "CST (UTC-6)", "EST (UTC-5)",
    "AST (UTC-4)", "GMT (UTC+0)", "UTC (UTC+0)", "BST (UTC+1)", "CET (UTC+1)", "CEST (UTC+2)",
    "EET (UTC+2)", "EEST (UTC+3)", "MSK (UTC+3)", "IST (UTC+5.5)", "AWST (UTC+8)", "JST (UTC+9)",
    "KST (UTC+9)", "ACST (UTC+9.5)", "AEST (UTC+10)", "NZST (UTC+12)"
];

const GRADES = [
    "Prefer not to say", "Junior", "Middle", "Senior", "Lead / Head of",
    "C-Level Executive", "Founder", "Entrepreneur"
];

const LANGUAGES = ["English", "Russian", "Spanish", "French", "German"];

const COFFEE_GOALS = ["Casual Chat", "Professional Chat"];

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const Dashboard = () => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        name: '',
        family: '',
        country: '',
        city: '',
        timezone: 'UTC (UTC+0)',
        bestTime: '',
        languages: [],
        profession: '',
        grade: 'Prefer not to say',
        professionalDesc: '',
        personalDesc: '',
        professionalInterests: '',
        personalInterests: '',
        coffeeGoals: []
    });

    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [initialFormData, setInitialFormData] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        if (message.type === 'success' && message.text) {
            const timer = setTimeout(() => {
                setMessage({ type: '', text: '' });
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    useEffect(() => {
        const fetchProfile = async () => {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) return;

            const user = JSON.parse(storedUser);
            if (!user.username) return;

            try {
                setIsLoading(true);
                const response = await fetch(`${API_URL}/api/profile?username=${user.username}`);
                const data = await response.json();

                if (data.success) {
                    const profileData = {
                        ...formData, // Keep defaults for missing fields
                        ...data.profile
                    };
                    setFormData(profileData);
                    setInitialFormData(profileData);
                }
            } catch (error) {
                console.error('Failed to fetch profile:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, []);

    // Check for changes whenever formData updates
    useEffect(() => {
        if (!initialFormData) return;

        const isChanged = JSON.stringify(formData) !== JSON.stringify(initialFormData);
        setHasChanges(isChanged);
    }, [formData, initialFormData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleMultiSelectChange = (name, value) => {
        setFormData(prev => {
            const current = prev[name] || [];
            if (current.includes(value)) {
                return { ...prev, [name]: current.filter(item => item !== value) };
            } else {
                return { ...prev, [name]: [...current, value] };
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        const storedUser = localStorage.getItem('user');
        if (!storedUser) return;
        const user = JSON.parse(storedUser);

        try {
            setIsSaving(true);
            const response = await fetch(`${API_URL}/api/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: user.username,
                    profile: formData
                }),
            });

            const data = await response.json();

            if (data.success) {
                setInitialFormData(formData); // Update initial state to new saved state
                setHasChanges(false);
                setShowSuccess(true);

                // Hide success message after 2 seconds
                setTimeout(() => {
                    setShowSuccess(false);
                }, 2000);
            } else {
                setMessage({ type: 'error', text: data.message || 'Failed to save profile' });
            }
        } catch (error) {
            console.error('Error saving profile:', error);
            setMessage({ type: 'error', text: 'An error occurred while saving' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const storedUser = localStorage.getItem('user');
        if (!storedUser) return;
        const user = JSON.parse(storedUser);

        const formDataUpload = new FormData();
        formDataUpload.append('avatar', file);
        formDataUpload.append('username', user.username);

        try {
            // Don't set global loading, just maybe local? 
            // Actually existing logic used global isLoading, let's keep it simple or use a specific one.
            // For now, let's keep using isLoading for avatar as it's a separate action.
            setIsLoading(true);
            const response = await fetch(`${API_URL}/api/upload-avatar`, {
                method: 'POST',
                body: formDataUpload
            });

            const data = await response.json();

            if (data.success) {
                setFormData(prev => ({ ...prev, avatar: data.avatarUrl }));
                // Also update initialFormData so "Save Changes" doesn't appear just for avatar
                setInitialFormData(prev => ({ ...prev, avatar: data.avatarUrl }));

                setMessage({ type: 'success', text: t('dashboard.profile.avatar_updated', 'Avatar updated successfully!') });
            } else {
                setMessage({ type: 'error', text: data.message || 'Failed to upload avatar' });
            }
        } catch (error) {
            console.error('Error uploading avatar:', error);
            setMessage({ type: 'error', text: 'An error occurred while uploading' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="main-content" style={{ paddingTop: '8rem', alignItems: 'flex-start' }}>
            <div className="dashboard-container">
                {/* Left Side: Profile */}
                <div className="profile-section glass-card">
                    <h2 className="section-title">{t('dashboard.profile.title', 'Your Profile')}</h2>

                    {/* Only show error messages here now, success is handled by button replacement */}
                    {message.text && message.type === 'error' && (
                        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
                            {message.text}
                        </div>
                    )}
                    {/* Keep avatar success message for now as it's separate? Or maybe remove it too? 
                        User asked about "Save changes" button specifically. 
                        Let's keep general messages for Avatar for now.
                    */}
                    {message.text && message.type === 'success' && !showSuccess && (
                        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="profile-form">
                        {/* Avatar */}
                        <div className="avatar-upload">
                            <label className="avatar-wrapper">
                                <div className="avatar-preview">
                                    {formData.avatar ? (
                                        <img src={formData.avatar} alt="Avatar" />
                                    ) : (
                                        <span>👤</span>
                                    )}
                                </div>
                                <div className="avatar-overlay">
                                    <span>{t('dashboard.profile.upload_avatar', 'Upload Photo')}</span>
                                </div>
                                <input
                                    type="file"
                                    accept="image/png, image/jpeg, image/jpg"
                                    onChange={handleAvatarChange}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>

                        {/* Name & Family */}
                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('dashboard.profile.name', 'Name')}</label>
                                <input
                                    type="text"
                                    name="name"
                                    className="form-control"
                                    value={formData.name}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('dashboard.profile.family', 'Family Name')}</label>
                                <input
                                    type="text"
                                    name="family"
                                    className="form-control"
                                    value={formData.family}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        {/* Location */}
                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('dashboard.profile.country', 'Country')}</label>
                                <input
                                    type="text"
                                    name="country"
                                    className="form-control"
                                    value={formData.country}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('dashboard.profile.city', 'City')}</label>
                                <input
                                    type="text"
                                    name="city"
                                    className="form-control"
                                    value={formData.city}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        {/* Timezone & Best Time */}
                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('dashboard.profile.timezone', 'Time Zone')}</label>
                                <select
                                    name="timezone"
                                    className="form-control"
                                    value={formData.timezone}
                                    onChange={handleChange}
                                >
                                    {TIMEZONES.map(tz => (
                                        <option key={tz} value={tz}>{tz}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>{t('dashboard.profile.best_time', 'Best time for meetings')}</label>
                                <input
                                    type="text"
                                    name="bestTime"
                                    className="form-control"
                                    placeholder="e.g. Weekdays 10-12 AM"
                                    value={formData.bestTime}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        {/* Languages */}
                        <div className="form-group">
                            <label>{t('dashboard.profile.languages', 'Languages')}</label>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                {LANGUAGES.map(lang => (
                                    <label key={lang} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.languages.includes(lang)}
                                            onChange={() => handleMultiSelectChange('languages', lang)}
                                        />
                                        {lang}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Profession & Grade */}
                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('dashboard.profile.profession', 'Profession')}</label>
                                <input
                                    type="text"
                                    name="profession"
                                    className="form-control"
                                    value={formData.profession}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('dashboard.profile.grade', 'Grade')}</label>
                                <select
                                    name="grade"
                                    className="form-control"
                                    value={formData.grade}
                                    onChange={handleChange}
                                >
                                    {GRADES.map(grade => (
                                        <option key={grade} value={grade}>{grade}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Descriptions */}
                        <div className="form-group">
                            <label>{t('dashboard.profile.professional_desc', 'Professional Description')}</label>
                            <textarea
                                name="professionalDesc"
                                className="form-control"
                                value={formData.professionalDesc}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="form-group">
                            <label>{t('dashboard.profile.personal_desc', 'Personal Description')}</label>
                            <textarea
                                name="personalDesc"
                                className="form-control"
                                value={formData.personalDesc}
                                onChange={handleChange}
                            />
                        </div>

                        {/* Interests */}
                        <div className="form-group">
                            <label>{t('dashboard.profile.professional_interests', 'Professional Interests')}</label>
                            <input
                                type="text"
                                name="professionalInterests"
                                className="form-control"
                                placeholder="e.g. AI, Startups, Fintech"
                                value={formData.professionalInterests}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="form-group">
                            <label>{t('dashboard.profile.personal_interests', 'Personal Interests')}</label>
                            <input
                                type="text"
                                name="personalInterests"
                                className="form-control"
                                placeholder="e.g. Hiking, Chess, Jazz"
                                value={formData.personalInterests}
                                onChange={handleChange}
                            />
                        </div>

                        {/* Coffee Goals */}
                        <div className="form-group">
                            <label>{t('dashboard.profile.coffee_goals', 'Coffee Goals')}</label>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                {COFFEE_GOALS.map(goal => (
                                    <label key={goal} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.coffeeGoals.includes(goal)}
                                            onChange={() => handleMultiSelectChange('coffeeGoals', goal)}
                                        />
                                        {goal}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div style={{ minHeight: '3rem', display: 'flex', alignItems: 'center' }}>
                            {showSuccess ? (
                                <div className="success-message" style={{ color: 'var(--success)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>✅</span> {t('dashboard.profile.saved_success', 'All changes are saved')}
                                </div>
                            ) : (
                                (hasChanges || isSaving) && (
                                    <button
                                        type="submit"
                                        className="save-btn"
                                        disabled={isSaving}
                                        style={{ marginTop: 0 }}
                                    >
                                        {isSaving ? (
                                            <>
                                                <span className="spinner-small"></span>
                                                {t('dashboard.profile.saving', 'Saving...')}
                                            </>
                                        ) : (
                                            t('dashboard.profile.save', 'Save Changes')
                                        )}
                                    </button>
                                )
                            )}
                        </div>
                    </form>
                </div>

                {/* Right Side: Matching */}
                <div className="matching-section">
                    <div className="glass-card" style={{ height: '100%', padding: '2rem' }}>
                        <h2 className="section-title">{t('dashboard.matching.title', 'Matching')}</h2>
                        <div className="matching-placeholder">
                            <p>{t('dashboard.matching.placeholder', 'Matching features coming soon...')}</p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Dashboard;
