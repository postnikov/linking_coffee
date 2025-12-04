import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ReactDOM from 'react-dom';
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

const DAYS_OF_WEEK = [
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
];

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

const Dashboard = () => {
    const { t, i18n } = useTranslation();
    const [formData, setFormData] = useState({
        name: '',
        family: '',
        country: null,
        city: null,
        timezone: 'UTC (UTC+0)',
        bestMeetingDays: [],
        languages: [],
        profession: '',
        grade: 'Prefer not to say',
        professionalDesc: '',
        personalDesc: '',
        professionalInterests: [],
        otherProfessionalInterests: '',
        personalInterests: [],
        otherPersonalInterests: '',
        coffeeGoals: [],
        serendipity: 5,
        proximity: 5,
        nextWeekStatus: 'Active'
    });

    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [initialFormData, setInitialFormData] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showLanguageModal, setShowLanguageModal] = useState(false);
    const [showTimezoneModal, setShowTimezoneModal] = useState(false);
    const [showDaysModal, setShowDaysModal] = useState(false);
    const [showCountryModal, setShowCountryModal] = useState(false);
    const [showCityModal, setShowCityModal] = useState(false);
    const [showProfessionalInterestsModal, setShowProfessionalInterestsModal] = useState(false);
    const [showPersonalInterestsModal, setShowPersonalInterestsModal] = useState(false);
    const [countries, setCountries] = useState([]);
    const [cities, setCities] = useState([]);
    const [interests, setInterests] = useState({ professional: [], personal: [], categories: {} });
    const [countrySearch, setCountrySearch] = useState('');
    const [newCityName, setNewCityName] = useState('');
    const [savedSections, setSavedSections] = useState({});
    const [isEditMode, setIsEditMode] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [currentMatch, setCurrentMatch] = useState(null);

    useEffect(() => {
        setImageError(false);
    }, [formData.avatar]);

    useEffect(() => {
        // Fetch countries
        const fetchCountries = async () => {
            try {
                const response = await fetch(`${API_URL}/api/countries`);
                const data = await response.json();
                if (data.success) {
                    setCountries(data.countries);
                }
            } catch (error) {
                console.error('Failed to fetch countries:', error);
            }
        };
        fetchCountries();

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

    // Prevent body scroll when any modal is open
    useEffect(() => {
        const isAnyModalOpen = showLanguageModal || showTimezoneModal || showDaysModal || showCountryModal || showCityModal || showProfessionalInterestsModal || showPersonalInterestsModal;

        if (isAnyModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showLanguageModal, showTimezoneModal, showDaysModal, showCountryModal, showCityModal, showProfessionalInterestsModal, showPersonalInterestsModal]);

    // Fetch cities when country changes or modal opens
    useEffect(() => {
        const fetchCities = async () => {
            if (!formData.country || !formData.country.iso) {
                setCities([]);
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/cities?countryIso=${formData.country.iso}`);
                const data = await response.json();
                if (data.success) {
                    setCities(data.cities);
                }
            } catch (error) {
                console.error('Failed to fetch cities:', error);
            }
        };

        if (showCityModal || (formData.country && formData.country.iso)) {
            fetchCities();
        }
    }, [formData.country, showCityModal]);

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
                const response = await fetch(`${API_URL}/api/profile?username=${user.username}&requester=${user.username}`);
                const data = await response.json();

                if (data.success) {
                    const profileData = {
                        ...formData, // Keep defaults for missing fields
                        ...data.profile
                    };
                    setFormData(profileData);
                    setInitialFormData(profileData);
                    if (data.currentMatch) {
                        setCurrentMatch(data.currentMatch);
                    }
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

    const handleRemoveOtherInterest = (field, interestToRemove) => {
        const currentString = formData[field];
        const items = currentString.split(/[,\.;]+/).map(s => s.trim()).filter(s => s.length > 0);
        const newItems = items.filter(item => item !== interestToRemove);
        const newString = newItems.join(', ');
        setFormData(prev => ({ ...prev, [field]: newString }));
    };

    const getCurrentWeekDateRange = () => {
        const today = new Date();
        const currentMonday = new Date(today);
        const dayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)
        const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        currentMonday.setDate(today.getDate() - diffToMonday);

        const currentSunday = new Date(currentMonday);
        currentSunday.setDate(currentMonday.getDate() + 6);

        const options = { month: 'short', day: 'numeric' };
        const start = currentMonday.toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', options);
        const end = currentSunday.toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', options);

        return `(${start} — ${end})`;
    };

    const getNextWeekDateRange = () => {
        const today = new Date();
        const nextMonday = new Date(today);
        nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));

        const nextSunday = new Date(nextMonday);
        nextSunday.setDate(nextMonday.getDate() + 6);

        const options = { month: 'short', day: 'numeric' };
        const start = nextMonday.toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', options);
        const end = nextSunday.toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US', options);

        return `(${start} — ${end})`;
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

    const autoSaveProfile = async (updatedData, section) => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) return;
        const user = JSON.parse(storedUser);

        try {
            const response = await fetch(`${API_URL}/api/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: user.username,
                    profile: updatedData
                }),
            });

            const data = await response.json();

            if (data.success) {
                setInitialFormData(updatedData);
                setHasChanges(false);

                setSavedSections(prev => ({ ...prev, [section]: true }));
                setTimeout(() => {
                    setSavedSections(prev => ({ ...prev, [section]: false }));
                }, 3000);
            } else {
                console.error('Auto-save failed:', data.message);
            }
        } catch (error) {
            console.error('Auto-save error:', error);
        }
    };

    const handleAddCity = async () => {
        if (!newCityName.trim() || !formData.country) return;

        try {
            const response = await fetch(`${API_URL}/api/cities`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newCityName,
                    countryIso: formData.country.iso
                }),
            });

            const data = await response.json();

            if (data.success) {
                // Add to cities list and select it
                setCities(prev => [...prev, data.city]);
                const newData = { ...formData, city: data.city };
                setFormData(newData);
                setNewCityName('');
                // Optional: Close modal? User might want to see it selected.
                // User requirement: "For this user we show his city even if it is not Approved"
                // So keeping it open or closing is fine. Let's keep it open to show selection or close it?
                // Usually selecting an item closes the modal in this UI.
                // But here we just added it. Let's select it and close it to be consistent with other selections.
                setShowCityModal(false);
                autoSaveProfile(newData, 'city');
            } else {
                alert(data.message || 'Failed to add city');
            }
        } catch (error) {
            console.error('Error adding city:', error);
            alert('An error occurred while adding the city');
        }
    };

    if (isLoading) {
        return (
            <main className="main-content" style={{ paddingTop: '8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid rgba(0,0,0,0.1)', borderLeftColor: '#7c3aed', borderRadius: '50%' }}></div>
            </main>
        );
    }

    return (
        <main className="main-content" style={{ paddingTop: '8rem', alignItems: 'flex-start' }}>
            <div className="dashboard-container">
                {/* Left Side: Profile */}
                <div className="profile-section glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 className="section-title" style={{ marginBottom: 0 }}>{t('dashboard.profile.title', 'Your Profile')}</h2>
                        <button
                            className="add-language-btn"
                            onClick={() => setIsEditMode(!isEditMode)}
                            style={{ padding: '0.5rem 1rem' }}
                        >
                            {isEditMode ? 'View Mode' : 'Edit Mode'}
                        </button>
                    </div>

                    {message.text && message.type === 'error' && (
                        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
                            {message.text}
                        </div>
                    )}

                    {isEditMode ? (
                        <form onSubmit={handleSubmit} className="profile-form">
                            {/* Avatar and Name Row */}
                            <div className="avatar-name-container">
                                {/* Avatar */}
                                <div className="avatar-upload">
                                    <label className="avatar-wrapper">
                                        <div className="avatar-preview">
                                            {formData.avatar && !imageError ? (
                                                <img
                                                    src={getAvatarUrl(formData.avatar)}
                                                    alt="Avatar"
                                                    onError={() => setImageError(true)}
                                                />
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
                                <div className="form-row name-family-row">
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
                            </div>

                            {/* Location */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label>{t('dashboard.profile.country', 'Country')}</label>
                                    <div className="language-chips">
                                        {formData.country && (
                                            <div className="chip">
                                                {formData.country.flag} {formData.country.name}
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            className={`add-language-btn ${savedSections.country ? 'saved' : ''}`}
                                            onClick={() => {
                                                setShowCountryModal(true);
                                                setCountrySearch('');
                                            }}
                                            style={savedSections.country ? { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' } : {}}
                                        >
                                            {savedSections.country ? (
                                                <>
                                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                    {t('common.saved', 'Saved')}
                                                </>
                                            ) : (
                                                <>
                                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M1.5 8.5L1 11L3.5 10.5L9.75 4.25L7.75 2.25L1.5 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                        <path d="M9.75 4.25L7.75 2.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                    {t('dashboard.profile.change_country', 'Change')}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>{t('dashboard.profile.city', 'City')}</label>
                                    <div className="language-chips">
                                        {formData.city && (
                                            <div className="chip">
                                                {formData.city.name}
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            className={`add-language-btn ${savedSections.city ? 'saved' : ''}`}
                                            onClick={() => {
                                                if (!formData.country) {
                                                    alert(t('dashboard.profile.select_country_first', 'Please select a country first'));
                                                    return;
                                                }
                                                setShowCityModal(true);
                                            }}
                                            style={savedSections.city ? { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' } : {}}
                                        >
                                            {savedSections.city ? (
                                                <>
                                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                    {t('common.saved', 'Saved')}
                                                </>
                                            ) : (
                                                <>
                                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M1.5 8.5L1 11L3.5 10.5L9.75 4.25L7.75 2.25L1.5 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                        <path d="M9.75 4.25L7.75 2.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                    {t('dashboard.profile.change_city', 'Change')}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Country Modal */}
                            {showCountryModal && ReactDOM.createPortal(
                                <div className="modal-overlay" onClick={() => setShowCountryModal(false)}>
                                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                                        <div className="modal-header">
                                            <h3>{t('dashboard.profile.select_country', 'Select Country')}</h3>
                                            <button className="close-btn" onClick={() => setShowCountryModal(false)}>×</button>
                                        </div>
                                        <div className="modal-body">
                                            <input
                                                type="text"
                                                placeholder={t('dashboard.profile.search_country', 'Search country...')}
                                                className="form-control"
                                                style={{ marginBottom: '1rem', width: '100%' }}
                                                value={countrySearch}
                                                onChange={(e) => setCountrySearch(e.target.value)}
                                                autoFocus
                                            />
                                            <div className="language-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'auto', gridAutoFlow: 'row' }}>
                                                {countries
                                                    .filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()))
                                                    .map(country => (
                                                        <label key={country.id} className={`language-option ${formData.country?.id === country.id ? 'selected' : ''}`}>
                                                            <input
                                                                type="radio"
                                                                name="country-modal"
                                                                checked={formData.country?.id === country.id}
                                                                onChange={() => {
                                                                    const newData = { ...formData, country: country, city: null };
                                                                    setFormData(newData);
                                                                    setShowCountryModal(false);
                                                                    setCountrySearch('');
                                                                    autoSaveProfile(newData, 'country');
                                                                }}
                                                                style={{ display: 'none' }}
                                                            />
                                                            <span>{country.flag} {country.name}</span>
                                                            {formData.country?.id === country.id && <span className="check-icon">✓</span>}
                                                        </label>
                                                    ))}
                                            </div>
                                        </div>
                                        <div className="modal-footer">
                                            <button className="save-btn" onClick={() => setShowCountryModal(false)} style={{ width: '100%', marginTop: 0 }}>
                                                {t('common.cancel', 'Cancel')}
                                            </button>
                                        </div>
                                    </div>
                                </div>,
                                document.body
                            )}

                            {/* City Modal */}
                            {showCityModal && ReactDOM.createPortal(
                                <div className="modal-overlay" onClick={() => setShowCityModal(false)}>
                                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                                        <div className="modal-header">
                                            <h3>{t('dashboard.profile.select_city', 'Select City')}</h3>
                                            <button className="close-btn" onClick={() => setShowCityModal(false)}>×</button>
                                        </div>
                                        <div className="modal-body">
                                            <div className="language-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'auto', gridAutoFlow: 'row' }}>
                                                {cities.map(city => (
                                                    <label key={city.id} className={`language-option ${formData.city?.id === city.id ? 'selected' : ''}`}>
                                                        <input
                                                            type="radio"
                                                            name="city-modal"
                                                            checked={formData.city?.id === city.id}
                                                            onChange={() => {
                                                                const newData = { ...formData, city: city };
                                                                setFormData(newData);
                                                                setShowCityModal(false);
                                                                autoSaveProfile(newData, 'city');
                                                            }}
                                                            style={{ display: 'none' }}
                                                        />
                                                        <span>{city.name}</span>
                                                        {formData.city?.id === city.id && <span className="check-icon">✓</span>}
                                                    </label>
                                                ))}

                                                {/* Show selected city if not in list (e.g. unapproved or just added) */}
                                                {formData.city && !cities.find(c => c.id === formData.city.id) && (
                                                    <label key={formData.city.id} className="language-option selected">
                                                        <input
                                                            type="radio"
                                                            name="city-modal"
                                                            checked={true}
                                                            readOnly
                                                            style={{ display: 'none' }}
                                                        />
                                                        <span>{formData.city.name}</span>
                                                        <span className="check-icon">✓</span>
                                                    </label>
                                                )}

                                                {cities.length === 0 && !formData.city && (
                                                    <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#888' }}>
                                                        {t('dashboard.profile.no_cities', 'No cities found for this country.')}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Add City Section */}
                                            <div style={{ marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666', fontWeight: 600 }}>
                                                    {t('dashboard.profile.add_city_label', 'Add your City')}
                                                </label>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <input
                                                        type="text"
                                                        className="form-control"
                                                        placeholder={t('dashboard.profile.add_city_placeholder', 'Enter city name')}
                                                        value={newCityName}
                                                        onChange={(e) => setNewCityName(e.target.value)}
                                                        style={{ flex: 1 }}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="save-btn"
                                                        onClick={handleAddCity}
                                                        style={{ marginTop: 0, padding: '0 1.5rem', whiteSpace: 'nowrap', alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        disabled={!newCityName.trim()}
                                                    >
                                                        {t('common.add', 'Add')}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="modal-footer">
                                            <button className="save-btn" onClick={() => setShowCityModal(false)} style={{ width: '100%', marginTop: 0 }}>
                                                {t('common.cancel', 'Cancel')}
                                            </button>
                                        </div>
                                    </div>
                                </div>,
                                document.body
                            )}

                            {/* Professional Interests Modal */}
                            {showProfessionalInterestsModal && ReactDOM.createPortal(
                                <div className="modal-overlay" onClick={() => setShowProfessionalInterestsModal(false)}>
                                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                                        <div className="modal-header">
                                            <h3>{t('dashboard.profile.select_professional_interests', 'Select Professional Interests')}</h3>
                                            <button className="close-btn" onClick={() => setShowProfessionalInterestsModal(false)}>×</button>
                                        </div>
                                        {formData.professionalInterests.length > 0 && (
                                            <div className="modal-selected-section">
                                                <h4 style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                                                    {t('common.selected', 'Selected')} ({formData.professionalInterests.length})
                                                </h4>
                                                <div className="language-chips">
                                                    {formData.professionalInterests.map(interest => (
                                                        <div key={interest} className="chip" style={{ backgroundColor: getInterestColor(interest) }}>
                                                            {getLocalizedInterest(interest, 'professional')}
                                                            <button
                                                                type="button"
                                                                className="chip-remove"
                                                                onClick={() => handleMultiSelectChange('professionalInterests', interest)}
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div className="modal-body" style={{ overflowY: 'auto', padding: '1rem' }}>
                                            {interests.categories.professional && interests.categories.professional.map(category => (
                                                <div key={category.id} style={{ marginBottom: '1.5rem' }}>
                                                    <h4 style={{ fontSize: '1rem', color: '#666', marginBottom: '0.5rem', borderBottom: '1px solid #eee', paddingBottom: '0.25rem' }}>
                                                        {i18n.language === 'ru' ? category.name_ru : category.name_en}
                                                    </h4>
                                                    <div className="language-grid">
                                                        {interests.professional
                                                            .filter(item => item.category === category.id)
                                                            .map(item => {
                                                                const displayName = i18n.language === 'ru' ? item.name_ru : item.name_en;
                                                                const storedValue = item.name_en;
                                                                return (
                                                                    <label key={item.id} className={`language-option ${formData.professionalInterests.includes(storedValue) ? 'selected' : ''}`}>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={formData.professionalInterests.includes(storedValue)}
                                                                            onChange={() => handleMultiSelectChange('professionalInterests', storedValue)}
                                                                            style={{ display: 'none' }}
                                                                        />
                                                                        {displayName}
                                                                        {formData.professionalInterests.includes(storedValue) && <span className="check-icon">✓</span>}
                                                                    </label>
                                                                );
                                                            })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="modal-footer">
                                            <button className="save-btn" onClick={() => {
                                                setShowProfessionalInterestsModal(false);
                                                autoSaveProfile(formData, 'professionalInterests');
                                            }} style={{ width: '100%', marginTop: 0 }}>
                                                {t('common.done', 'Done')}
                                            </button>
                                        </div>
                                    </div>
                                </div>,
                                document.body
                            )}

                            {/* Personal Interests Modal */}
                            {showPersonalInterestsModal && ReactDOM.createPortal(
                                <div className="modal-overlay" onClick={() => setShowPersonalInterestsModal(false)}>
                                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                                        <div className="modal-header">
                                            <h3>{t('dashboard.profile.select_personal_interests', 'Select Personal Interests')}</h3>
                                            <button className="close-btn" onClick={() => setShowPersonalInterestsModal(false)}>×</button>
                                        </div>
                                        {formData.personalInterests.length > 0 && (
                                            <div className="modal-selected-section">
                                                <h4 style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                                                    {t('common.selected', 'Selected')} ({formData.personalInterests.length})
                                                </h4>
                                                <div className="language-chips">
                                                    {formData.personalInterests.map(interest => (
                                                        <div key={interest} className="chip" style={{ backgroundColor: getInterestColor(interest) }}>
                                                            {getLocalizedInterest(interest, 'personal')}
                                                            <button
                                                                type="button"
                                                                className="chip-remove"
                                                                onClick={() => handleMultiSelectChange('personalInterests', interest)}
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div className="modal-body" style={{ overflowY: 'auto', padding: '1rem' }}>
                                            {interests.categories.personal && interests.categories.personal.map(category => (
                                                <div key={category.id} style={{ marginBottom: '1.5rem' }}>
                                                    <h4 style={{ fontSize: '1rem', color: '#666', marginBottom: '0.5rem', borderBottom: '1px solid #eee', paddingBottom: '0.25rem' }}>
                                                        {i18n.language === 'ru' ? category.name_ru : category.name_en}
                                                    </h4>
                                                    <div className="language-grid">
                                                        {interests.personal
                                                            .filter(item => item.category === category.id)
                                                            .map(item => {
                                                                const displayName = i18n.language === 'ru' ? item.name_ru : item.name_en;
                                                                const storedValue = item.name_en;
                                                                return (
                                                                    <label key={item.id} className={`language-option ${formData.personalInterests.includes(storedValue) ? 'selected' : ''}`}>
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={formData.personalInterests.includes(storedValue)}
                                                                            onChange={() => handleMultiSelectChange('personalInterests', storedValue)}
                                                                            style={{ display: 'none' }}
                                                                        />
                                                                        {displayName}
                                                                        {formData.personalInterests.includes(storedValue) && <span className="check-icon">✓</span>}
                                                                    </label>
                                                                );
                                                            })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="modal-footer">
                                            <button className="save-btn" onClick={() => {
                                                setShowPersonalInterestsModal(false);
                                                autoSaveProfile(formData, 'personalInterests');
                                            }} style={{ width: '100%', marginTop: 0 }}>
                                                {t('common.done', 'Done')}
                                            </button>
                                        </div>
                                    </div>
                                </div>,
                                document.body
                            )}

                            {/* Timezone */}
                            <div className="form-group">
                                <label>{t('dashboard.profile.timezone', 'Time Zone')}</label>
                                <div className="language-chips">
                                    {formData.timezone && (
                                        <div className="chip">
                                            {formData.timezone}
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        className={`add-language-btn ${savedSections.timezone ? 'saved' : ''}`}
                                        onClick={() => setShowTimezoneModal(true)}
                                        style={savedSections.timezone ? { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' } : {}}
                                    >
                                        {savedSections.timezone ? (
                                            <>
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                {t('common.saved', 'Saved')}
                                            </>
                                        ) : (
                                            <>
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M1.5 8.5L1 11L3.5 10.5L9.75 4.25L7.75 2.25L1.5 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    <path d="M9.75 4.25L7.75 2.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                {t('dashboard.profile.change_timezone', 'Change')}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Days Modal */}
                            {showDaysModal && ReactDOM.createPortal(
                                <div className="modal-overlay" onClick={() => setShowDaysModal(false)}>
                                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                                        <div className="modal-header">
                                            <h3>{t('dashboard.profile.select_days', 'Select Days')}</h3>
                                            <button className="close-btn" onClick={() => setShowDaysModal(false)}>×</button>
                                        </div>
                                        <div className="modal-body">
                                            <div className="language-grid" style={{ gridTemplateColumns: 'repeat(1, 1fr)', gridTemplateRows: 'auto', gridAutoFlow: 'row' }}>
                                                {DAYS_OF_WEEK.map(day => (
                                                    <label key={day} className={`language-option ${formData.bestMeetingDays.includes(day) ? 'selected' : ''}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.bestMeetingDays.includes(day)}
                                                            onChange={() => handleMultiSelectChange('bestMeetingDays', day)}
                                                            style={{ display: 'none' }}
                                                        />
                                                        {t(`days.${day}`, day)}
                                                        {formData.bestMeetingDays.includes(day) && <span className="check-icon">✓</span>}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="modal-footer">
                                            <button className="save-btn" onClick={() => {
                                                setShowDaysModal(false);
                                                autoSaveProfile(formData, 'bestMeetingDays');
                                            }} style={{ width: '100%', marginTop: 0 }}>
                                                {t('common.done', 'Done')}
                                            </button>
                                        </div>
                                    </div>
                                </div>,
                                document.body
                            )}

                            {/* Timezone Modal */}
                            {showTimezoneModal && ReactDOM.createPortal(
                                <div className="modal-overlay" onClick={() => setShowTimezoneModal(false)}>
                                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                                        <div className="modal-header">
                                            <h3>{t('dashboard.profile.select_timezone', 'Select Time Zone')}</h3>
                                            <button className="close-btn" onClick={() => setShowTimezoneModal(false)}>×</button>
                                        </div>
                                        <div className="modal-body">
                                            <div className="language-grid">
                                                {TIMEZONES.map(tz => (
                                                    <label key={tz} className={`language-option ${formData.timezone === tz ? 'selected' : ''}`}>
                                                        <input
                                                            type="radio"
                                                            name="timezone-modal"
                                                            checked={formData.timezone === tz}
                                                            onChange={() => {
                                                                const newData = { ...formData, timezone: tz };
                                                                setFormData(newData);
                                                                setShowTimezoneModal(false);
                                                                autoSaveProfile(newData, 'timezone');
                                                            }}
                                                            style={{ display: 'none' }}
                                                        />
                                                        {tz}
                                                        {formData.timezone === tz && <span className="check-icon">✓</span>}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="modal-footer">
                                            <button className="save-btn" onClick={() => setShowTimezoneModal(false)} style={{ width: '100%', marginTop: 0 }}>
                                                {t('common.cancel', 'Cancel')}
                                            </button>
                                        </div>
                                    </div>
                                </div>,
                                document.body
                            )}

                            {/* Best Meeting Days */}
                            <div className="form-group">
                                <label>{t('dashboard.profile.best_days', 'Best Meeting Days')}</label>
                                <div className="language-chips">
                                    {formData.bestMeetingDays.map(day => (
                                        <div key={day} className="chip" style={{ backgroundColor: DAY_COLORS[day] || '#f3f4f6' }}>
                                            {t(`days.${day}`, day)}
                                            <button
                                                type="button"
                                                className="chip-remove"
                                                onClick={() => handleMultiSelectChange('bestMeetingDays', day)}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        className={`add-language-btn ${savedSections.bestMeetingDays ? 'saved' : ''}`}
                                        onClick={() => setShowDaysModal(true)}
                                        style={savedSections.bestMeetingDays ? { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' } : {}}
                                    >
                                        {savedSections.bestMeetingDays ? (
                                            <>
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                {t('common.saved', 'Saved')}
                                            </>
                                        ) : (
                                            <>
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M1.5 8.5L1 11L3.5 10.5L9.75 4.25L7.75 2.25L1.5 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    <path d="M9.75 4.25L7.75 2.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                {t('dashboard.profile.change_days', 'Change')}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Languages */}
                            <div className="form-group">
                                <label>{t('dashboard.profile.languages', 'Languages')}</label>
                                <div className="language-chips">
                                    {formData.languages.map(lang => (
                                        <div key={lang} className="chip">
                                            {lang}
                                            <button
                                                type="button"
                                                className="chip-remove"
                                                onClick={() => handleMultiSelectChange('languages', lang)}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        className={`add-language-btn ${savedSections.languages ? 'saved' : ''}`}
                                        onClick={() => setShowLanguageModal(true)}
                                        style={savedSections.languages ? { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' } : {}}
                                    >
                                        {savedSections.languages ? (
                                            <>
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                {t('common.saved', 'Saved')}
                                            </>
                                        ) : (
                                            <>
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M1.5 8.5L1 11L3.5 10.5L9.75 4.25L7.75 2.25L1.5 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    <path d="M9.75 4.25L7.75 2.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                {t('dashboard.profile.change_languages', 'Change')}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Language Modal */}
                            {showLanguageModal && ReactDOM.createPortal(
                                <div className="modal-overlay" onClick={() => setShowLanguageModal(false)}>
                                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                                        <div className="modal-header">
                                            <h3>{t('dashboard.profile.select_languages', 'Select Languages')}</h3>
                                            <button className="close-btn" onClick={() => setShowLanguageModal(false)}>×</button>
                                        </div>
                                        <div className="modal-body">
                                            <div className="language-grid">
                                                {LANGUAGES.map(lang => (
                                                    <label key={lang} className={`language-option ${formData.languages.includes(lang) ? 'selected' : ''}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.languages.includes(lang)}
                                                            onChange={() => handleMultiSelectChange('languages', lang)}
                                                            style={{ display: 'none' }}
                                                        />
                                                        {lang}
                                                        {formData.languages.includes(lang) && <span className="check-icon">✓</span>}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="modal-footer">
                                            <button className="save-btn" onClick={() => {
                                                setShowLanguageModal(false);
                                                autoSaveProfile(formData, 'languages');
                                            }} style={{ width: '100%', marginTop: 0 }}>
                                                {t('common.done', 'Done')}
                                            </button>
                                        </div>
                                    </div>
                                </div>,
                                document.body
                            )}

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
                                <div className="language-chips" style={{ marginBottom: '1rem' }}>
                                    {formData.professionalInterests.map(interest => (
                                        <div key={interest} className="chip" style={{ backgroundColor: getInterestColor(interest) }}>
                                            {getLocalizedInterest(interest, 'professional')}
                                            <button
                                                type="button"
                                                className="chip-remove"
                                                onClick={() => handleMultiSelectChange('professionalInterests', interest)}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                    {formData.otherProfessionalInterests.split(/[,\.;]+/).map(item => item.trim()).filter(item => item.length > 0).map((item, index) => (
                                        <div key={`other-${index}`} className="chip" style={{ backgroundColor: getInterestColor(item) }}>
                                            {item}
                                            <button
                                                type="button"
                                                className="chip-remove"
                                                onClick={() => handleRemoveOtherInterest('otherProfessionalInterests', item)}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        className={`add-language-btn ${savedSections.professionalInterests ? 'saved' : ''}`}
                                        onClick={() => setShowProfessionalInterestsModal(true)}
                                        style={savedSections.professionalInterests ? { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' } : {}}
                                    >
                                        {savedSections.professionalInterests ? (
                                            <>
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                {t('common.saved', 'Saved')}
                                            </>
                                        ) : (
                                            <>
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M1.5 8.5L1 11L3.5 10.5L9.75 4.25L7.75 2.25L1.5 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    <path d="M9.75 4.25L7.75 2.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                {t('dashboard.profile.change_interests', 'Change')}
                                            </>
                                        )}
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    name="otherProfessionalInterests"
                                    className="form-control"
                                    placeholder={t('dashboard.profile.other_professional_interests_placeholder', 'Other professional interests...')}
                                    value={formData.otherProfessionalInterests}
                                    onChange={handleChange}
                                    onBlur={() => autoSaveProfile(formData, 'otherProfessionalInterests')}
                                />
                            </div>

                            <div className="form-group">
                                <label>{t('dashboard.profile.personal_interests', 'Personal Interests')}</label>
                                <div className="language-chips" style={{ marginBottom: '1rem' }}>
                                    {formData.personalInterests.map(interest => (
                                        <div key={interest} className="chip" style={{ backgroundColor: getInterestColor(interest) }}>
                                            {getLocalizedInterest(interest, 'personal')}
                                            <button
                                                type="button"
                                                className="chip-remove"
                                                onClick={() => handleMultiSelectChange('personalInterests', interest)}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                    {formData.otherPersonalInterests.split(/[,\.;]+/).map(item => item.trim()).filter(item => item.length > 0).map((item, index) => (
                                        <div key={`other-${index}`} className="chip" style={{ backgroundColor: getInterestColor(item) }}>
                                            {item}
                                            <button
                                                type="button"
                                                className="chip-remove"
                                                onClick={() => handleRemoveOtherInterest('otherPersonalInterests', item)}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        className={`add-language-btn ${savedSections.personalInterests ? 'saved' : ''}`}
                                        onClick={() => setShowPersonalInterestsModal(true)}
                                        style={savedSections.personalInterests ? { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' } : {}}
                                    >
                                        {savedSections.personalInterests ? (
                                            <>
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                {t('common.saved', 'Saved')}
                                            </>
                                        ) : (
                                            <>
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M1.5 8.5L1 11L3.5 10.5L9.75 4.25L7.75 2.25L1.5 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    <path d="M9.75 4.25L7.75 2.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                {t('dashboard.profile.change_interests', 'Change')}
                                            </>
                                        )}
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    name="otherPersonalInterests"
                                    className="form-control"
                                    placeholder={t('dashboard.profile.other_personal_interests_placeholder', 'Other personal interests...')}
                                    value={formData.otherPersonalInterests}
                                    onChange={handleChange}
                                    onBlur={() => autoSaveProfile(formData, 'otherPersonalInterests')}
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

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                                {showSuccess ? (
                                    <button
                                        type="button"
                                        className="save-btn"
                                        style={{ marginTop: 0, background: '#10b981', cursor: 'default' }}
                                    >
                                        {t('dashboard.profile.saved_success', 'All changes are saved')}
                                    </button>
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
                    ) : (
                        <div className="profile-view">
                            <div className="profile-view-header">
                                <div className="avatar-preview view-mode-avatar">
                                    {formData.avatar && !imageError ? (
                                        <img
                                            src={getAvatarUrl(formData.avatar)}
                                            alt="Profile"
                                            onError={() => setImageError(true)}
                                        />
                                    ) : (
                                        <div className="avatar-placeholder">
                                            {formData.name?.[0]}
                                        </div>
                                    )}
                                </div>
                                <div className="profile-view-info">
                                    <h3>{formData.name} {formData.family}</h3>
                                    <p className="profile-subtitle">
                                        {formData.profession}
                                        {formData.grade && <span style={{ opacity: 0.7 }}> • {formData.grade}</span>}
                                    </p>
                                    {formData.country && (
                                        <div className="profile-location">
                                            <span style={{ fontSize: '1.2rem' }}>{formData.country.flag}</span>
                                            <span>{formData.country.name}</span>
                                            {formData.city && <span>• {formData.city.name}</span>}
                                            {formData.timezone && <span>• {formData.timezone}</span>}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="profile-content-grid">
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

                                {(formData.professionalInterests.length > 0 || formData.otherProfessionalInterests || formData.personalInterests.length > 0 || formData.otherPersonalInterests) && (
                                    <div className="profile-interests-grid">
                                        {(formData.professionalInterests.length > 0 || formData.otherProfessionalInterests) && (
                                            <div>
                                                <h4>{t('dashboard.profile.professional_interests')}</h4>
                                                <div className="language-chips" style={{ flexWrap: 'wrap' }}>
                                                    {formData.professionalInterests.map(item => (
                                                        <span key={item} className="chip" style={{ backgroundColor: getInterestColor(item) }}>
                                                            {getLocalizedInterest(item, 'professional')}
                                                        </span>
                                                    ))}
                                                    {formData.otherProfessionalInterests && formData.otherProfessionalInterests.split(/[,\.;]+/).map(item => item.trim()).filter(item => item).map((item, index) => (
                                                        <span key={`other-${index}`} className="chip" style={{ backgroundColor: getInterestColor(item) }}>
                                                            {item}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {(formData.personalInterests.length > 0 || formData.otherPersonalInterests) && (
                                            <div>
                                                <h4>{t('dashboard.profile.personal_interests')}</h4>
                                                <div className="language-chips" style={{ flexWrap: 'wrap' }}>
                                                    {formData.personalInterests.map(item => (
                                                        <span key={item} className="chip" style={{ backgroundColor: getInterestColor(item) }}>
                                                            {getLocalizedInterest(item, 'personal')}
                                                        </span>
                                                    ))}
                                                    {formData.otherPersonalInterests && formData.otherPersonalInterests.split(/[,\.;]+/).map(item => item.trim()).filter(item => item).map((item, index) => (
                                                        <span key={`other-${index}`} className="chip" style={{ backgroundColor: getInterestColor(item) }}>
                                                            {item}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {formData.coffeeGoals && formData.coffeeGoals.length > 0 && (
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
                                                    <span key={lang} className="chip">{lang}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {formData.bestMeetingDays?.length > 0 && (
                                        <div>
                                            <h4>{t('dashboard.profile.best_days')}</h4>
                                            <div className="language-chips" style={{ flexWrap: 'wrap' }}>
                                                {formData.bestMeetingDays.map(day => (
                                                    <span key={day} className="chip" style={{ backgroundColor: DAY_COLORS[day] || '#f3f4f6' }}>
                                                        {t(`days.${day}`, day)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Side: Matching */}
                <div className="matching-section">
                    {/* Current Match Block */}
                    {currentMatch && (
                        <div className="glass-card" style={{ padding: '2rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)' }}>
                            <h2 className="section-title" style={{ marginBottom: '0.5rem' }}>{t('dashboard.matching.current_match', 'Current match')}</h2>
                            <div style={{
                                textTransform: 'uppercase',
                                color: '#374151',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                marginBottom: '1.5rem',
                                letterSpacing: '0.05em'
                            }}>
                                {t('dashboard.matching.this_week', 'This week')} <span style={{ color: '#6b7280', fontWeight: 'normal' }}>{getCurrentWeekDateRange()}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                <div style={{
                                    width: '60px',
                                    height: '60px',
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    border: '3px solid #fff',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                    flexShrink: 0
                                }}>
                                    {currentMatch.avatar ? (
                                        <img
                                            src={currentMatch.avatar}
                                            alt={`${currentMatch.name} ${currentMatch.family}`}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: '100%',
                                            height: '100%',
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#fff',
                                            fontSize: '2rem',
                                            fontWeight: 'bold'
                                        }}>
                                            {currentMatch.name ? currentMatch.name.charAt(0).toUpperCase() : '?'}
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <Link
                                        to={`/profile/${currentMatch.username.replace('@', '')}`}
                                        style={{ textDecoration: 'none' }}
                                    >
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1f2937', cursor: 'pointer' }}>
                                            {currentMatch.name} {currentMatch.family}
                                        </h3>
                                    </Link>
                                    {currentMatch.username && (
                                        <a
                                            href={`https://t.me/${currentMatch.username.replace('@', '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                color: '#3b82f6',
                                                textDecoration: 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.25rem',
                                                fontSize: '0.95rem',
                                                fontWeight: '500'
                                            }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"></path><path d="M22 2l-7 20-4-9-9-4 20-7z"></path></svg>
                                            @{currentMatch.username.replace('@', '')}
                                        </a>
                                    )}
                                    <Link
                                        to={`/profile/${currentMatch.username.replace('@', '')}`}
                                        style={{
                                            color: '#6b7280',
                                            textDecoration: 'none',
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            marginTop: '0.25rem'
                                        }}
                                    >
                                        {t('dashboard.matching.view_profile', 'View Profile')} &rarr;
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="glass-card" style={{ height: '100%', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 className="section-title" style={{ marginBottom: 0 }}>{t('dashboard.matching.title', 'Matching Settings')}</h2>
                        </div>

                        {/* Next Week Status Switch */}
                        <div className="input-group" style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                            <label className="form-label" style={{ textAlign: 'left', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                {savedSections['nextWeekStatus'] ? (
                                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        {t('dashboard.profile.saved', 'Saved')}
                                    </span>
                                ) : (
                                    <span>{t('dashboard.matching.next_week_status', 'Next week')} <span style={{ fontWeight: 'normal', fontSize: '0.9em', color: '#666' }}>{getNextWeekDateRange()}</span></span>
                                )}
                            </label>

                            <div
                                style={{
                                    display: 'flex',
                                    background: '#f3f4f6',
                                    borderRadius: '0.5rem',
                                    padding: '0.25rem',
                                    cursor: 'pointer',
                                    position: 'relative'
                                }}
                            >
                                <div
                                    onClick={() => {
                                        const newState = 'Active';
                                        setFormData(prev => ({ ...prev, nextWeekStatus: newState }));
                                        autoSaveProfile({ ...formData, nextWeekStatus: newState }, 'nextWeekStatus');
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        textAlign: 'center',
                                        borderRadius: '0.375rem',
                                        background: formData.nextWeekStatus === 'Active' ? '#fff' : 'transparent',
                                        boxShadow: formData.nextWeekStatus === 'Active' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                        color: formData.nextWeekStatus === 'Active' ? '#10b981' : '#6b7280',
                                        fontWeight: formData.nextWeekStatus === 'Active' ? '600' : '400',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    {t('dashboard.matching.status_active', "I'm in")} <span style={{ filter: formData.nextWeekStatus === 'Active' ? 'none' : 'grayscale(100%) opacity(0.5)' }}>✅</span>
                                </div>
                                <div
                                    onClick={() => {
                                        const newState = 'Passive';
                                        setFormData(prev => ({ ...prev, nextWeekStatus: newState }));
                                        autoSaveProfile({ ...formData, nextWeekStatus: newState }, 'nextWeekStatus');
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        textAlign: 'center',
                                        borderRadius: '0.375rem',
                                        background: formData.nextWeekStatus === 'Passive' ? '#fff' : 'transparent',
                                        boxShadow: formData.nextWeekStatus === 'Passive' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                        color: formData.nextWeekStatus === 'Passive' ? '#ef4444' : '#6b7280',
                                        fontWeight: formData.nextWeekStatus === 'Passive' ? '600' : '400',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    {t('dashboard.matching.status_passive', "I'll skip")} <span style={{ filter: formData.nextWeekStatus === 'Passive' ? 'none' : 'grayscale(100%) opacity(0.5)' }}>❌</span>
                                </div>
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="form-label" style={{ textAlign: 'left', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                                {savedSections['serendipity'] ? (
                                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        {t('dashboard.profile.saved', 'Saved')}
                                    </span>
                                ) : (
                                    <span>{t('dashboard.matching.serendipity', 'Serendipity Level')}</span>
                                )}
                                <span style={{ color: '#7c3aed', fontWeight: 'bold' }}>{formData.serendipity}</span>
                            </label>

                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={formData.serendipity}
                                onChange={(e) => setFormData({ ...formData, serendipity: parseInt(e.target.value) })}
                                onMouseUp={() => autoSaveProfile({ ...formData }, 'serendipity')}
                                onTouchEnd={() => autoSaveProfile({ ...formData }, 'serendipity')}
                                style={{
                                    width: '100%',
                                    accentColor: '#7c3aed',
                                    height: '6px',
                                    borderRadius: '3px',
                                    marginBottom: '0.5rem',
                                    cursor: 'pointer'
                                }}
                            />

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#666' }}>
                                <span>{t('dashboard.matching.low', 'Low (like me)')}</span>
                                <span>{t('dashboard.matching.high', 'High')}</span>
                            </div>
                        </div>

                        <div className="input-group" style={{ marginTop: '2rem' }}>
                            <label className="form-label" style={{ textAlign: 'left', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                                {savedSections['proximity'] ? (
                                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        {t('dashboard.profile.saved', 'Saved')}
                                    </span>
                                ) : (
                                    <span>{t('dashboard.matching.geography', 'Geography')}</span>
                                )}
                                <span style={{ color: '#7c3aed', fontWeight: 'bold' }}>{formData.proximity}</span>
                            </label>

                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={formData.proximity}
                                onChange={(e) => setFormData({ ...formData, proximity: parseInt(e.target.value) })}
                                onMouseUp={() => autoSaveProfile({ ...formData }, 'proximity')}
                                onTouchEnd={() => autoSaveProfile({ ...formData }, 'proximity')}
                                style={{
                                    width: '100%',
                                    accentColor: '#7c3aed',
                                    height: '6px',
                                    borderRadius: '3px',
                                    marginBottom: '0.5rem',
                                    cursor: 'pointer'
                                }}
                            />

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#666' }}>
                                <span>{t('dashboard.matching.near_me', 'Near me')}</span>
                                <span>{t('dashboard.matching.far_away', 'Far away')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Dashboard;
