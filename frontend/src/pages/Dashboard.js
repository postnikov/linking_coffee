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

const DAYS_OF_WEEK = [
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
];

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const Dashboard = () => {
    const { t } = useTranslation();
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
    const [showLanguageModal, setShowLanguageModal] = useState(false);
    const [showTimezoneModal, setShowTimezoneModal] = useState(false);
    const [showDaysModal, setShowDaysModal] = useState(false);
    const [showCountryModal, setShowCountryModal] = useState(false);
    const [showCityModal, setShowCityModal] = useState(false);
    const [countries, setCountries] = useState([]);
    const [cities, setCities] = useState([]);
    const [countrySearch, setCountrySearch] = useState('');
    const [newCityName, setNewCityName] = useState('');

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
    }, []);

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
                setFormData(prev => ({ ...prev, city: data.city }));
                setNewCityName('');
                // Optional: Close modal? User might want to see it selected.
                // User requirement: "For this user we show his city even if it is not Approved"
                // So keeping it open or closing is fine. Let's keep it open to show selection or close it?
                // Usually selecting an item closes the modal in this UI.
                // But here we just added it. Let's select it and close it to be consistent with other selections.
                setShowCityModal(false);
            } else {
                alert(data.message || 'Failed to add city');
            }
        } catch (error) {
            console.error('Error adding city:', error);
            alert('An error occurred while adding the city');
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
                        {/* Avatar and Name Row */}
                        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                            {/* Avatar */}
                            <div className="avatar-upload" style={{ marginBottom: 0 }}>
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
                            <div className="form-row" style={{ flex: 1, marginBottom: 0 }}>
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
                                        className="add-language-btn"
                                        onClick={() => {
                                            setShowCountryModal(true);
                                            setCountrySearch('');
                                        }}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M1.5 8.5L1 11L3.5 10.5L9.75 4.25L7.75 2.25L1.5 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M9.75 4.25L7.75 2.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        {t('dashboard.profile.change_country', 'Change')}
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
                                        className="add-language-btn"
                                        onClick={() => {
                                            if (!formData.country) {
                                                alert(t('dashboard.profile.select_country_first', 'Please select a country first'));
                                                return;
                                            }
                                            setShowCityModal(true);
                                        }}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M1.5 8.5L1 11L3.5 10.5L9.75 4.25L7.75 2.25L1.5 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M9.75 4.25L7.75 2.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        {t('dashboard.profile.change_city', 'Change')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Country Modal */}
                        {showCountryModal && (
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
                                                                setFormData(prev => ({ ...prev, country: country, city: null })); // Reset city on country change
                                                                setShowCountryModal(false);
                                                                setCountrySearch('');
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
                            </div>
                        )}

                        {/* City Modal */}
                        {showCityModal && (
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
                                                            setFormData(prev => ({ ...prev, city: city }));
                                                            setShowCityModal(false);
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
                            </div>
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
                                    className="add-language-btn"
                                    onClick={() => setShowTimezoneModal(true)}
                                >
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M1.5 8.5L1 11L3.5 10.5L9.75 4.25L7.75 2.25L1.5 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M9.75 4.25L7.75 2.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    {t('dashboard.profile.change_timezone', 'Change')}
                                </button>
                            </div>
                        </div>

                        {/* Days Modal */}
                        {showDaysModal && (
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
                                                    {day}
                                                    {formData.bestMeetingDays.includes(day) && <span className="check-icon">✓</span>}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="modal-footer">
                                        <button className="save-btn" onClick={() => setShowDaysModal(false)} style={{ width: '100%', marginTop: 0 }}>
                                            {t('common.done', 'Done')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Timezone Modal */}
                        {showTimezoneModal && (
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
                                                            setFormData(prev => ({ ...prev, timezone: tz }));
                                                            setShowTimezoneModal(false);
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
                            </div>
                        )}

                        {/* Best Meeting Days */}
                        <div className="form-group">
                            <label>{t('dashboard.profile.best_days', 'Best Meeting Days')}</label>
                            <div className="language-chips">
                                {formData.bestMeetingDays.map(day => (
                                    <div key={day} className="chip">
                                        {day}
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
                                    className="add-language-btn"
                                    onClick={() => setShowDaysModal(true)}
                                >
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M1.5 8.5L1 11L3.5 10.5L9.75 4.25L7.75 2.25L1.5 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M9.75 4.25L7.75 2.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    {t('dashboard.profile.change_days', 'Change')}
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
                                    className="add-language-btn"
                                    onClick={() => setShowLanguageModal(true)}
                                >
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M1.5 8.5L1 11L3.5 10.5L9.75 4.25L7.75 2.25L1.5 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M9.75 4.25L7.75 2.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    {t('dashboard.profile.change_languages', 'Change')}
                                </button>
                            </div>
                        </div>

                        {/* Language Modal */}
                        {showLanguageModal && (
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
                                        <button className="save-btn" onClick={() => setShowLanguageModal(false)} style={{ width: '100%', marginTop: 0 }}>
                                            {t('common.done', 'Done')}
                                        </button>
                                    </div>
                                </div>
                            </div>
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
                                <button
                                    type="button"
                                    className="save-btn success"
                                    disabled={true}
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
