import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { GoogleLogin } from '@react-oauth/google';
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
        linkedin: '',
        serendipity: 5,
        proximity: 5,
        nextWeekStatus: 'Active'
    });

    const isProfileComplete = (data) => {
        if (!data.name?.trim()) return false;
        if (!data.family?.trim()) return false;
        if (!data.country) return false;
        if (!data.city) return false;
        if (!data.timezone) return false;
        if (!data.bestMeetingDays?.length) return false;
        if (!data.languages?.length) return false;
        if (!data.profession?.trim()) return false;
        if (!data.grade) return false;
        return true;
    };

    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [initialFormData, setInitialFormData] = useState(null);
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
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [user, setUser] = useState(() => {
        const storedUser = localStorage.getItem('user');
        return storedUser ? JSON.parse(storedUser) : { username: '', email: null };
    });

    const [connectedAccounts, setConnectedAccounts] = useState({
        telegram: false,
        google: false,
        linkedin: false
    });
    const [showTelegramConnectModal, setShowTelegramConnectModal] = useState(false);
    const [telegramConnectUsername, setTelegramConnectUsername] = useState('');
    const [telegramConnectOtp, setTelegramConnectOtp] = useState('');
    const [telegramConnectError, setTelegramConnectError] = useState('');
    const [showDisconnectTelegramModal, setShowDisconnectTelegramModal] = useState(false);
    const [showMergeConfirmModal, setShowMergeConfirmModal] = useState(false);
    const [pendingMergeProfile, setPendingMergeProfile] = useState(null);

    // Profile Completion Logic
    const [showCompletionSuccess, setShowCompletionSuccess] = useState(false);
    const [wasIncomplete, setWasIncomplete] = useState(false);

    const completionFields = useMemo(() => [
        { key: 'telegram', label: t('dashboard.connected_accounts.telegram', 'Telegram'), done: !!(user?.username || user?.telegramConnected) },
        { key: 'name', label: t('dashboard.profile.name', 'Name'), done: !!formData.name?.trim() },
        { key: 'family', label: t('dashboard.profile.family', 'Family (Last Name)'), done: !!formData.family?.trim() },
        { key: 'country', label: t('dashboard.profile.country', 'Country'), done: !!formData.country },
        { key: 'city', label: t('dashboard.profile.city', 'City'), done: !!formData.city },
        { key: 'timezone', label: t('dashboard.profile.timezone', 'Time Zone'), done: !!formData.timezone },
        { key: 'bestMeetingDays', label: t('dashboard.profile.best_days', 'Best Meeting Days'), done: formData.bestMeetingDays?.length > 0 },
        { key: 'languages', label: t('dashboard.profile.languages', 'Languages'), done: formData.languages?.length > 0 },
        { key: 'profession', label: t('dashboard.profile.profession', 'Profession'), done: !!formData.profession?.trim() },
        { key: 'grade', label: t('dashboard.profile.grade', 'Grade'), done: !!formData.grade }
    ], [formData, t, user]);

    const improvementFields = useMemo(() => [
        { key: 'professionalDesc', label: t('dashboard.profile.professional_desc', 'Professional Description'), done: !!formData.professionalDesc?.trim() },
        { key: 'personalDesc', label: t('dashboard.profile.personal_desc', 'Personal Description'), done: !!formData.personalDesc?.trim() },
        { key: 'professionalInterests', label: t('dashboard.profile.professional_interests', 'Professional Interests'), done: formData.professionalInterests?.length > 0 || !!formData.otherProfessionalInterests?.trim() },
        { key: 'personalInterests', label: t('dashboard.profile.personal_interests', 'Personal Interests'), done: formData.personalInterests?.length > 0 || !!formData.otherPersonalInterests?.trim() },
        { key: 'coffeeGoals', label: t('dashboard.profile.coffee_goals', 'Your coffee goals'), done: formData.coffeeGoals?.length > 0 }
    ], [formData, t]);

    const allImprovementsDone = improvementFields.every(f => f.done);

    const allFieldsDone = completionFields.every(f => f.done);

    useEffect(() => {
        if (!initialFormData) return;

        if (!allFieldsDone) {
            setWasIncomplete(true);
            setShowCompletionSuccess(false);
            if (formData.nextWeekStatus !== 'Passive') {
                const newData = { ...formData, nextWeekStatus: 'Passive' };
                setFormData(newData);
                autoSaveProfile(newData, 'nextWeekStatus');
            }
        } else if (allFieldsDone && wasIncomplete) {
            setShowCompletionSuccess(true);
            if (formData.nextWeekStatus !== 'Active') {
                const newData = { ...formData, nextWeekStatus: 'Active' };
                setFormData(newData);
                autoSaveProfile(newData, 'nextWeekStatus');
            }
            const timer = setTimeout(() => {
                setShowCompletionSuccess(false);
                setWasIncomplete(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [allFieldsDone, wasIncomplete, formData.nextWeekStatus, formData, initialFormData]);

    useEffect(() => {
        if (user) {
            setConnectedAccounts({
                telegram: !!user.telegramConnected,
                google: user.linkedAccounts && user.linkedAccounts.includes('google'),
                linkedin: user.linkedAccounts && user.linkedAccounts.includes('linkedin')
            });

            // Populate form data
            setFormData(prev => ({
                ...prev,
                name: user.firstName || '',
                family: user.lastName || '',
                // ... other fields are populated via fetchProfile
            }));
        }
    }, [user]);

    const showCompletionBlock = !allFieldsDone || showCompletionSuccess;

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
            // Relaxed check: need username OR id OR email
            if (!user.username && !user.id && !user.email) return;

            try {
                setIsLoading(true);
                // Construct URL with available identifiers
                let url = `${API_URL}/api/profile?`;
                if (user.username) url += `username=${user.username}&requester=${user.username}`;
                else if (user.id) url += `id=${user.id}`;
                else if (user.email) url += `email=${user.email}`;

                const response = await fetch(url);
                const data = await response.json();

                if (data.success) {
                    const profileData = {
                        ...formData, // Keep defaults for missing fields
                        ...data.profile
                    };
                    setFormData(profileData);
                    setFormData(profileData);
                    setInitialFormData(profileData);

                    // Update user state with email if it exists in profile
                    if (data.profile.email) {
                        setUser(prevUser => ({ ...prevUser, email: data.profile.email }));
                    }

                    // Force edit mode if profile is incomplete
                    if (!isProfileComplete(profileData)) {
                        setIsEditMode(true);
                        // Optional: show a message explaining why
                        // setMessage({ type: 'info', text: t('dashboard.profile.please_complete', 'Please complete your profile to continue.') });
                    }

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Check for changes whenever formData updates
    useEffect(() => {
        if (!initialFormData) return;

        // Changes are tracked but not currently displayed in UI
        // const isChanged = JSON.stringify(formData) !== JSON.stringify(initialFormData);
    }, [formData, initialFormData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Keep ref in sync with formData to avoid stale closures in onBlur
    const formDataRef = useRef(formData);
    useEffect(() => {
        formDataRef.current = formData;
    }, [formData]);

    const handleInputBlur = (section) => {
        autoSaveProfile(formDataRef.current, section);
    };

    const handleMultiSelectChange = (name, value) => {
        const current = formData[name] || [];
        let newValues;
        if (current.includes(value)) {
            newValues = current.filter(item => item !== value);
        } else {
            newValues = [...current, value];
        }
        const updatedData = { ...formData, [name]: newValues };

        setFormData(updatedData);
        autoSaveProfile(updatedData, name);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

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
                    profile: formData
                }),
            });

            const data = await response.json();

            if (data.success) {
                setInitialFormData(formData); // Update initial state to new saved state
                // Success state not currently displayed in UI
            } else {
                setMessage({ type: 'error', text: data.message || 'Failed to save profile' });
            }
        } catch (error) {
            console.error('Error saving profile:', error);
            setMessage({ type: 'error', text: 'An error occurred while saving' });
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
        const items = currentString.split(/[,.;]+/).map(s => s.trim()).filter(s => s.length > 0);
        const newItems = items.filter(item => item !== interestToRemove);
        const newString = newItems.join(', ');

        const updatedData = { ...formData, [field]: newString };
        setFormData(updatedData);
        autoSaveProfile(updatedData, field);
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

        if (file.size > 5 * 1024 * 1024) {
            setMessage({ type: 'error', text: t('dashboard.profile.avatar_too_big', 'The photo is too large. Max size is 5MB.') });
            return;
        }

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
        // Prevent saving if mandatory fields were somehow cleared (e.g. valid data loss bug)
        if (!updatedData || !updatedData.name || !updatedData.family) {
            return;
        }

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
                    id: user.id,
                    email: user.email,
                    profile: updatedData
                }),
            });

            const data = await response.json();

            if (data.success) {
                setInitialFormData(updatedData);

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

    // Google Account Linking Handlers
    const handleLinkGoogle = () => {
        setShowLinkModal(true);
    };

    const handleGoogleLinkSuccess = async (credentialResponse) => {
        try {
            const response = await fetch(`${API_URL}/api/link-google-account`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: credentialResponse.credential,
                    username: user.username
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Update local user state
                const updatedUser = { ...user, email: data.user.email };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                setUser(updatedUser);
                setShowLinkModal(false);
                setSuccessMessage(t('dashboard.connected_accounts.link_success'));
                setShowSuccessModal(true);
            } else {
                setErrorMessage(data.message || t('dashboard.connected_accounts.link_error', 'Failed to link Google account'));
                setShowErrorModal(true);
            }
        } catch (error) {
            console.error('Link error:', error);
            setErrorMessage('An error occurred while linking');
            setShowErrorModal(true);
        }
    };

    const handleUnlinkGoogle = () => {
        setShowConfirmModal(true);
    };

    const confirmUnlinkGoogle = async () => {
        setShowConfirmModal(false);

        try {
            const response = await fetch(`${API_URL}/api/unlink-google-account`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user.username }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Update local user state
                const updatedUser = { ...user, email: null };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                setUser(updatedUser);
                setSuccessMessage(t('dashboard.connected_accounts.unlink_success'));
                setShowSuccessModal(true);
            } else {
                setErrorMessage(data.message || t('dashboard.connected_accounts.unlink_error', 'Failed to unlink Google account'));
                setShowErrorModal(true);
            }
        } catch (error) {
            console.error('Unlink error:', error);
            setErrorMessage('An error occurred while unlinking');
            setShowErrorModal(true);
        }
    };

    // Connect Telegram Handlers
    const handleConnectTelegram = () => {
        setTelegramConnectOtp('');
        setTelegramConnectError('');
        setShowTelegramConnectModal(true);
    };

    const handleVerifyTelegramOtp = async () => {
        setTelegramConnectError('');
        if (!telegramConnectUsername) {
            setTelegramConnectError(t('dashboard.connect_telegram.error_username_required', 'Username is required'));
            return;
        }
        if (!telegramConnectOtp) {
            setTelegramConnectError(t('dashboard.connect_telegram.error_otp_required', 'OTP is required'));
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/connect-telegram`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegramUsername: telegramConnectUsername,
                    otp: telegramConnectOtp,
                    currentEmail: user.email
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Update local storage and user state
                const updatedUser = {
                    ...user,
                    ...data.user, // Merge new data (username, tgId, telegramConnected)
                    merged: data.merged
                };

                // If merged, we might want to refresh the whole profile helper
                // But setting user state will trigger re-render
                localStorage.setItem('user', JSON.stringify(updatedUser));
                setUser(updatedUser);

                setShowTelegramConnectModal(false);
                setSuccessMessage(data.message || 'Telegram connected successfully!');
                setShowSuccessModal(true);

                // Refresh profile data to get full fields if they changed (e.g. merge)
                window.location.reload(); // Simple way to ensure clean state after critical merge
            } else if (data.requiresMerge) {
                // Telegram username already exists - ask for confirmation
                setShowTelegramConnectModal(false);
                setPendingMergeProfile(data.existingProfile);
                setShowMergeConfirmModal(true);
            } else {
                setTelegramConnectError(data.message || 'Verification failed');
            }
        } catch (error) {
            console.error('Connect Telegram Error:', error);
            setTelegramConnectError('An error occurred. Please try again.');
        }
    };

    const confirmMergeAccounts = async () => {
        setShowMergeConfirmModal(false);

        try {
            const response = await fetch(`${API_URL}/api/connect-telegram`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegramUsername: telegramConnectUsername,
                    otp: telegramConnectOtp,
                    currentEmail: user.email,
                    confirmMerge: true
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Update local storage and user state with merged profile
                const updatedUser = {
                    ...user,
                    ...data.user,
                    merged: true
                };

                localStorage.setItem('user', JSON.stringify(updatedUser));
                setUser(updatedUser);

                setSuccessMessage(t('dashboard.connect_telegram.merge_success', 'Accounts merged successfully!'));
                setShowSuccessModal(true);

                // Refresh to get clean state
                window.location.reload();
            } else {
                alert(data.message || 'Failed to merge accounts');
            }
        } catch (error) {
            console.error('Merge Accounts Error:', error);
            alert('An error occurred. Please try again.');
        }
    };

    const cancelMerge = () => {
        setShowMergeConfirmModal(false);
        setPendingMergeProfile(null);
        // Reset the form
        setTelegramConnectUsername('');
        setTelegramConnectOtp('');
    };

    const handleDisconnectTelegram = () => {
        setShowDisconnectTelegramModal(true);
    };

    const confirmDisconnectTelegram = async () => {
        setShowDisconnectTelegramModal(false);

        try {
            const response = await fetch(`${API_URL}/api/disconnect-telegram`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: user.id,
                    email: user.email
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Update local user state
                const updatedUser = {
                    ...user,
                    username: null,
                    telegramConnected: false,
                    tgId: null
                };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                setUser(updatedUser);
                setSuccessMessage(t('dashboard.connect_telegram.disconnect_success', 'Telegram disconnected successfully'));
                setShowSuccessModal(true);
            } else {
                alert(data.message || 'Failed to disconnect Telegram');
            }
        } catch (error) {
            console.error('Disconnect Telegram Error:', error);
            alert('An error occurred. Please try again.');
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
        <main className="main-content" style={{ paddingTop: '120px', display: 'block', minHeight: '100vh', paddingLeft: 0, paddingRight: 0 }}>
            <div className="dashboard-container">
                {/* Left Column */}
                <div className="left-column" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Left Side: Profile */}
                    <div className="profile-section glass-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 className="section-title" style={{ marginBottom: 0 }}>{t('dashboard.profile.title', 'Your Profile')}</h2>
                            <button
                                className="add-language-btn"
                                onClick={() => {
                                    if (isEditMode) {
                                        if (isProfileComplete(formData)) {
                                            setIsEditMode(false);
                                            setMessage({ type: '', text: '' });
                                        } else {
                                            setMessage({ type: 'error', text: t('dashboard.profile.error_incomplete', 'Please fill in all mandatory fields before switching to view mode.') });
                                            // Scroll to top to see error
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }
                                    } else {
                                        setIsEditMode(true);
                                    }
                                }}
                                style={{ padding: '0.5rem 1rem' }}
                            >
                                {isEditMode ? t('dashboard.profile.view_mode', 'View Mode') : t('dashboard.profile.edit_mode', 'Edit Mode')}
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
                                                onBlur={() => handleInputBlur('name')}
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
                                                onBlur={() => handleInputBlur('family')}
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
                                                        {formData.country ? t('dashboard.profile.change_country', 'Change') : t('common.select', 'Select')}
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    {formData.country && (
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
                                                            {formData.city ? t('dashboard.profile.change_city', 'Change') : t('common.select', 'Select')}
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}
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
                                                    {formData.bestMeetingDays.length > 0 ? t('dashboard.profile.change_days', 'Change') : t('common.select', 'Select')}
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
                                                    {formData.languages.length > 0 ? t('dashboard.profile.change_languages', 'Change') : t('common.select', 'Select')}
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
                                        <label>
                                            {t('dashboard.profile.profession', 'Profession')}
                                            {savedSections.profession && (
                                                <span style={{ color: '#166534', fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 'normal' }}>
                                                    ✓ {t('common.saved', 'Saved')}
                                                </span>
                                            )}
                                        </label>
                                        <input
                                            type="text"
                                            name="profession"
                                            className="form-control"
                                            value={formData.profession}
                                            onChange={handleChange}
                                            onBlur={() => handleInputBlur('profession')}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            {t('dashboard.profile.grade', 'Grade')}
                                            {savedSections.grade && (
                                                <span style={{ color: '#166534', fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 'normal' }}>
                                                    ✓ {t('common.saved', 'Saved')}
                                                </span>
                                            )}
                                        </label>
                                        <select
                                            name="grade"
                                            className="form-control"
                                            value={formData.grade}
                                            onChange={(e) => {
                                                handleChange(e);
                                                const newData = { ...formData, grade: e.target.value };
                                                autoSaveProfile(newData, 'grade');
                                            }}
                                        >
                                            {GRADES.map(grade => (
                                                <option key={grade} value={grade}>{grade}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* LinkedIn */}
                                <div className="form-group">
                                    <label>
                                        LinkedIn
                                        {savedSections.linkedin && (
                                            <span style={{ color: '#166534', fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 'normal' }}>
                                                ✓ {t('common.saved', 'Saved')}
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type="text"
                                        name="linkedin"
                                        className="form-control"
                                        placeholder="https://linkedin.com/in/..."
                                        value={formData.linkedin || ''}
                                        onChange={handleChange}
                                        onBlur={() => handleInputBlur('linkedin')}
                                    />
                                </div>

                                {/* Descriptions */}
                                <div className="form-group">
                                    <label>
                                        {t('dashboard.profile.professional_desc', 'Professional Description')}
                                        {savedSections.professionalDesc && (
                                            <span style={{ color: '#166534', fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 'normal' }}>
                                                ✓ {t('common.saved', 'Saved')}
                                            </span>
                                        )}
                                    </label>
                                    <textarea
                                        name="professionalDesc"
                                        className="form-control"
                                        value={formData.professionalDesc}
                                        onChange={handleChange}
                                        onBlur={() => handleInputBlur('professionalDesc')}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>
                                        {t('dashboard.profile.personal_desc', 'Personal Description')}
                                        {savedSections.personalDesc && (
                                            <span style={{ color: '#166534', fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 'normal' }}>
                                                ✓ {t('common.saved', 'Saved')}
                                            </span>
                                        )}
                                    </label>
                                    <textarea
                                        name="personalDesc"
                                        className="form-control"
                                        value={formData.personalDesc}
                                        onChange={handleChange}
                                        onBlur={() => handleInputBlur('personalDesc')}
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
                                        {formData.otherProfessionalInterests.split(/[,.;]+/).map(item => item.trim()).filter(item => item.length > 0).map((item, index) => (
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
                                        onBlur={() => handleInputBlur('otherProfessionalInterests')}
                                    />
                                    {savedSections.otherProfessionalInterests && (
                                        <div style={{ color: '#166534', fontSize: '0.75rem', marginTop: '0.25rem', textAlign: 'right' }}>
                                            ✓ {t('common.saved', 'Saved')}
                                        </div>
                                    )}
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
                                        {formData.otherPersonalInterests.split(/[,.;]+/).map(item => item.trim()).filter(item => item.length > 0).map((item, index) => (
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
                                        onBlur={() => handleInputBlur('otherPersonalInterests')}
                                    />
                                    {savedSections.otherPersonalInterests && (
                                        <div style={{ color: '#166534', fontSize: '0.75rem', marginTop: '0.25rem', textAlign: 'right' }}>
                                            ✓ {t('common.saved', 'Saved')}
                                        </div>
                                    )}
                                </div>

                                {/* Coffee Goals */}
                                <div className="form-group">
                                    <label>
                                        {t('dashboard.profile.coffee_goals', 'Coffee Goals')}
                                        {savedSections.coffeeGoals && (
                                            <span style={{ color: '#166534', fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 'normal' }}>
                                                ✓ {t('common.saved', 'Saved')}
                                            </span>
                                        )}
                                    </label>
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
                                        <p className="profile-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            {formData.profession}
                                            {formData.grade && <span style={{ opacity: 0.7 }}> • {formData.grade}</span>}
                                            {formData.linkedin && (
                                                <>
                                                    <span style={{ opacity: 0.7 }}> • </span>
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
                                                        {formData.otherProfessionalInterests && formData.otherProfessionalInterests.split(/[,.;]+/).map(item => item.trim()).filter(item => item).map((item, index) => (
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
                                                        {formData.otherPersonalInterests && formData.otherPersonalInterests.split(/[,.;]+/).map(item => item.trim()).filter(item => item).map((item, index) => (
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

                    {/* Connected Accounts Section */}
                    <div className="glass-card" style={{ padding: '2rem' }}>
                        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>{t('dashboard.connected_accounts.title')}</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                            {/* Telegram Account */}
                            {user.username || user.telegramConnected ? (
                                <div style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '1.25rem',
                                    background: 'rgba(255, 255, 255, 0.8)',
                                    backdropFilter: 'blur(10px)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(124, 58, 237, 0.2)',
                                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '12px',
                                            background: 'linear-gradient(135deg, #0088cc 0%, #229ED9 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 4px 12px rgba(0, 136, 204, 0.3)',
                                            fontSize: '1.5rem'
                                        }}>
                                            📱
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '1rem', color: '#1f2937', marginBottom: '0.25rem' }}>
                                                {t('dashboard.connected_accounts.telegram')}
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                                @{user.username || 'Linked'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '0.125rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <span>✓</span> {t('dashboard.connected_accounts.linked', 'Linked account')}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Only show disconnect if user has Google connected */}
                                    {user.email && (
                                        <button
                                            onClick={handleDisconnectTelegram}
                                            onMouseEnter={(e) => {
                                                e.target.style.background = '#fee2e2';
                                                e.target.style.borderColor = '#fca5a5';
                                                e.target.style.color = '#dc2626';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.target.style.background = 'white';
                                                e.target.style.borderColor = '#d1d5db';
                                                e.target.style.color = '#6b7280';
                                            }}
                                            style={{
                                                padding: '0.625rem 1.25rem',
                                                backgroundColor: 'white',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '8px',
                                                fontSize: '0.875rem',
                                                fontWeight: '600',
                                                color: '#6b7280',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                                            }}
                                        >
                                            {t('dashboard.connected_accounts.unlink_button', 'Unlink')}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '1.25rem',
                                    background: 'rgba(254, 242, 242, 0.9)',
                                    backdropFilter: 'blur(10px)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '12px',
                                            background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
                                            fontSize: '1.5rem',
                                            color: '#ef4444'
                                        }}>
                                            ⚠️
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '1rem', color: '#7f1d1d', marginBottom: '0.25rem' }}>
                                                {t('dashboard.connect_telegram.title', 'Connect Telegram')}
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: '#991b1b' }}>
                                                {t('dashboard.connect_telegram.required', 'Required for matching')}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleConnectTelegram}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            background: '#ef4444',
                                            color: 'white',
                                            borderRadius: '8px',
                                            fontSize: '0.875rem',
                                            fontWeight: '600',
                                            border: 'none',
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)'
                                        }}
                                    >
                                        {t('dashboard.connect_telegram.btn', 'Connect')}
                                    </button>
                                </div>
                            )}

                            {/* Google Account */}
                            {user.email ? (
                                <div style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '1.25rem',
                                    background: 'rgba(255, 255, 255, 0.8)',
                                    backdropFilter: 'blur(10px)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(34, 197, 94, 0.2)',
                                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '12px',
                                            background: 'linear-gradient(135deg, #4285F4 0%, #34A853 50%, #FBBC05 75%, #EA4335 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 4px 12px rgba(66, 133, 244, 0.3)',
                                            fontSize: '1.5rem'
                                        }}>
                                            📧
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '1rem', color: '#1f2937', marginBottom: '0.25rem' }}>
                                                {t('dashboard.connected_accounts.google')}
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                                {user.email}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '0.125rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <span>✓</span> {t('dashboard.connected_accounts.linked', 'Linked account')}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleUnlinkGoogle}
                                        onMouseEnter={(e) => {
                                            e.target.style.background = '#fee2e2';
                                            e.target.style.borderColor = '#fca5a5';
                                            e.target.style.color = '#dc2626';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.background = 'white';
                                            e.target.style.borderColor = '#d1d5db';
                                            e.target.style.color = '#6b7280';
                                        }}
                                        style={{
                                            padding: '0.625rem 1.25rem',
                                            backgroundColor: 'white',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '8px',
                                            fontSize: '0.875rem',
                                            fontWeight: '600',
                                            color: '#6b7280',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease',
                                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                                        }}
                                    >
                                        {t('dashboard.connected_accounts.unlink_button')}
                                    </button>
                                </div>
                            ) : (
                                <div style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '1.25rem',
                                    background: 'rgba(255, 255, 255, 0.6)',
                                    backdropFilter: 'blur(10px)',
                                    borderRadius: '12px',
                                    border: '1px dashed rgba(156, 163, 175, 0.5)',
                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '12px',
                                            background: 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '1.5rem',
                                            opacity: '0.7'
                                        }}>
                                            📧
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '1rem', color: '#1f2937', marginBottom: '0.25rem' }}>
                                                {t('dashboard.connected_accounts.google')}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <span style={{ fontSize: '0.875rem' }}>○</span> {t('dashboard.connected_accounts.not_linked')}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleLinkGoogle}
                                        onMouseEnter={(e) => {
                                            e.target.style.transform = 'translateY(-2px)';
                                            e.target.style.boxShadow = '0 6px 16px rgba(124, 58, 237, 0.5)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.transform = 'translateY(0)';
                                            e.target.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.4)';
                                        }}
                                        style={{
                                            padding: '0.625rem 1.25rem',
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontSize: '0.875rem',
                                            fontWeight: '600',
                                            color: 'white',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.4)',
                                            transition: 'all 0.3s ease'
                                        }}
                                    >
                                        {t('dashboard.connected_accounts.link_button')}
                                    </button>
                                </div>
                            )}

                            {/* LinkedIn Account */}
                            {connectedAccounts.linkedin ? (
                                <div style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '1.25rem',
                                    background: 'rgba(255, 255, 255, 0.8)',
                                    backdropFilter: 'blur(10px)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(0, 119, 181, 0.2)', // LinkedIn Blue
                                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '12px',
                                            background: '#0077b5', // LinkedIn Blue
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 4px 12px rgba(0, 119, 181, 0.3)',
                                            fontSize: '1.5rem'
                                        }}>
                                            <svg viewBox="0 0 24 24" fill="white" width="24" height="24">
                                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '1rem', color: '#1f2937', marginBottom: '0.25rem' }}>
                                                LinkedIn
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                                Linked Profile
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '0.125rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <span>✓</span> {t('dashboard.connected_accounts.linked', 'Linked account')}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (window.confirm(t('dashboard.confirm_unlink_linkedin', 'Unlink LinkedIn account?'))) {
                                                try {
                                                    const res = await fetch(`${API_URL}/api/unlink-linkedin-account`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ id: user.id })
                                                    });
                                                    const data = await res.json();
                                                    if (data.success) {
                                                        const newAccounts = { ...connectedAccounts, linkedin: false };
                                                        setConnectedAccounts(newAccounts);
                                                        // Update session
                                                        const updatedUser = { ...user, linkedAccounts: user.linkedAccounts.filter(a => a !== 'linkedin') };
                                                        setUser(updatedUser);
                                                        localStorage.setItem('user', JSON.stringify(updatedUser));
                                                    } else {
                                                        alert(data.message);
                                                    }
                                                } catch (e) {
                                                    alert('Error unlinking account');
                                                }
                                            }
                                        }}
                                        onMouseEnter={(e) => {
                                            e.target.style.background = '#fee2e2';
                                            e.target.style.borderColor = '#fca5a5';
                                            e.target.style.color = '#dc2626';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.background = 'white';
                                            e.target.style.borderColor = '#d1d5db';
                                            e.target.style.color = '#6b7280';
                                        }}
                                        style={{
                                            padding: '0.625rem 1.25rem',
                                            backgroundColor: 'white',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '8px',
                                            fontSize: '0.875rem',
                                            fontWeight: '600',
                                            color: '#6b7280',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease',
                                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
                                        }}
                                    >
                                        {t('dashboard.connected_accounts.unlink_button', 'Unlink')}
                                    </button>
                                </div>
                            ) : (
                                <div style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '1.25rem',
                                    background: 'rgba(255, 255, 255, 0.6)',
                                    backdropFilter: 'blur(10px)',
                                    borderRadius: '12px',
                                    border: '1px dashed rgba(156, 163, 175, 0.5)',
                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '12px',
                                            background: '#e5e7eb',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '1.5rem',
                                            opacity: '0.7'
                                        }}>
                                            <svg viewBox="0 0 24 24" fill="#666" width="24" height="24">
                                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '1rem', color: '#1f2937', marginBottom: '0.25rem' }}>
                                                LinkedIn
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <span style={{ fontSize: '0.875rem' }}>○</span> {t('dashboard.connected_accounts.not_linked', 'Not linked')}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            try {
                                                const redirectUri = window.location.origin + '/auth/linkedin/callback';
                                                const res = await fetch(`${API_URL}/api/auth/linkedin/url?redirectUri=${encodeURIComponent(redirectUri)}`);
                                                const data = await res.json();
                                                if (data.url) {
                                                    window.location.href = data.url;
                                                }
                                            } catch (e) {
                                                console.error(e);
                                            }
                                        }}
                                        onMouseEnter={(e) => {
                                            e.target.style.transform = 'translateY(-2px)';
                                            e.target.style.boxShadow = '0 6px 16px rgba(0, 119, 181, 0.5)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.transform = 'translateY(0)';
                                            e.target.style.boxShadow = '0 4px 12px rgba(0, 119, 181, 0.4)';
                                        }}
                                        style={{
                                            padding: '0.625rem 1.25rem',
                                            background: '#0077b5', // LinkedIn Blue
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontSize: '0.875rem',
                                            fontWeight: '600',
                                            color: 'white',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 12px rgba(0, 119, 181, 0.4)',
                                            transition: 'all 0.3s ease'
                                        }}
                                    >
                                        {t('dashboard.connect', 'Connect')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div> {/* Closing left-column wrapper */}

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

                            {/* AI Intro / Context */}
                            {currentMatch.intro && (
                                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                                    <h4 style={{ fontSize: '0.95rem', color: '#4b5563', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        ✨ Why you matched
                                    </h4>
                                    <p style={{ fontSize: '0.9rem', color: '#374151', lineHeight: '1.5', fontStyle: 'italic', marginBottom: '1rem' }}>
                                        "{currentMatch.intro.why_interesting}"
                                    </p>

                                    {currentMatch.intro.conversation_starters && currentMatch.intro.conversation_starters.length > 0 && (
                                        <div>
                                            <h4 style={{ fontSize: '0.95rem', color: '#4b5563', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                💬 Icebreakers
                                            </h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {currentMatch.intro.conversation_starters.map((starter, idx) => (
                                                    <div key={idx} style={{
                                                        background: 'white',
                                                        padding: '0.5rem 0.75rem',
                                                        borderRadius: '0.5rem',
                                                        fontSize: '0.85rem',
                                                        color: '#4b5563',
                                                        border: '1px solid rgba(0,0,0,0.05)'
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
                    )}

                    {/* Connect Telegram Warning Block - Shows when Telegram is not connected */}
                    {!(user?.username || user?.telegramConnected) && (
                        <div className="glass-card" style={{
                            background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                            borderRadius: '0.75rem',
                            padding: '1rem 1.25rem',
                            marginBottom: '1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem',
                            border: '1px solid #fecaca',
                            boxShadow: '0 1px 3px rgba(239, 68, 68, 0.1)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '0.5rem',
                                    background: '#fef3c7',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.25rem'
                                }}>
                                    ⚠️
                                </div>
                                <div>
                                    <div style={{ fontWeight: '600', color: '#991b1b', fontSize: '0.95rem' }}>
                                        {t('dashboard.connect_telegram.title', 'Connect Telegram')}
                                    </div>
                                    <div style={{ color: '#dc2626', fontSize: '0.85rem' }}>
                                        {t('dashboard.connect_telegram.required', 'Required for matching')}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleConnectTelegram}
                                style={{
                                    background: '#dc2626',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    padding: '0.5rem 1.25rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => e.target.style.background = '#b91c1c'}
                                onMouseOut={(e) => e.target.style.background = '#dc2626'}
                            >
                                {t('dashboard.connect_telegram.btn', 'Connect')}
                            </button>
                        </div>
                    )}

                    {/* Profile Completion Block */}
                    {showCompletionBlock && (
                        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', animation: 'fadeIn 0.5s ease-out' }}>
                            {showCompletionSuccess ? (
                                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                                    <h3 style={{ color: '#10b981', fontSize: '1.25rem', marginBottom: '0.5rem' }}>{t('dashboard.profile.ready', 'Yes! Your profile is ready!')}</h3>
                                    <div style={{ fontSize: '3rem' }}>🎉</div>
                                </div>
                            ) : (
                                <>
                                    <h2 className="section-title" style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>
                                        {t('dashboard.profile.complete_profile', 'Complete the profile')}
                                    </h2>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {completionFields.map(field => (
                                            <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem' }}>
                                                {field.done ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12"></polyline>
                                                    </svg>
                                                ) : (
                                                    <div style={{ width: '20px', height: '20px', border: '2px solid #e5e7eb', borderRadius: '4px', flexShrink: 0 }}></div>
                                                )}
                                                <span style={{ color: field.done ? '#1f2937' : '#6b7280', textDecoration: field.done ? 'none' : 'none' }}>
                                                    {field.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Improvement Block (Only show if mandatory fields are done but improvements are not) */}
                    {allFieldsDone && !allImprovementsDone && (
                        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', animation: 'fadeIn 0.5s ease-out' }}>
                            <h2 className="section-title" style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>
                                {t('dashboard.profile.improve_profile', 'Improve your profile')}
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {improvementFields.map(field => (
                                    <div
                                        key={field.key}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem', cursor: 'pointer' }}
                                        onClick={() => {
                                            // Scroll to relevant section if in edit mode, or switch to edit mode
                                            if (!isEditMode) setIsEditMode(true);
                                            // We can't easily scroll to specific fields without refs, but entering edit mode is a good start.
                                            // If we wanted to be fancy we could add IDs to fields and scroll.
                                            // keeping it simple for now as requested.
                                        }}
                                    >
                                        {field.done ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        ) : (
                                            <div style={{ width: '20px', height: '20px', border: '2px solid #e5e7eb', borderRadius: '4px', flexShrink: 0 }}></div>
                                        )}
                                        <span style={{ color: field.done ? '#1f2937' : '#6b7280' }}>
                                            {field.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="glass-card" style={{
                        padding: '1.5rem',
                        opacity: allFieldsDone ? 1 : 0.6,
                        filter: allFieldsDone ? 'none' : 'blur(4px)',
                        pointerEvents: allFieldsDone ? 'auto' : 'none',
                        transition: 'all 0.3s ease'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 className="section-title" style={{ marginBottom: 0 }}>{t('dashboard.matching.title', 'Matching Settings')}</h2>
                        </div>

                        {/* Community Block */}
                        {formData.community && (
                            <div className="input-group" style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <label className="form-label" style={{ textAlign: 'left', margin: 0, display: 'flex', alignItems: 'center' }}>
                                        {t('dashboard.matching.your_community', 'Your Community')}
                                    </label>
                                </div>
                                <div style={{
                                    background: '#f8fafc',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid #e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    color: '#1f2937',
                                    fontWeight: '500'
                                }}>
                                    <span style={{ fontSize: '1.2rem' }}>🏙️</span>
                                    {formData.community.name}
                                </div>
                            </div>
                        )}

                        {/* Next Week Status Switch */}
                        <div className="input-group" style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', minHeight: '27px' }}>
                                <label className="form-label" style={{ textAlign: 'left', margin: 0, display: 'flex', alignItems: 'center' }}>
                                    {t('dashboard.matching.next_week_status', 'Next week')}
                                    {savedSections['nextWeekStatus'] ? (
                                        <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9em', marginLeft: '0.5rem', fontWeight: 'normal' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            {t('dashboard.profile.saved', 'Saved')}
                                        </span>
                                    ) : (
                                        <span style={{ fontWeight: 'normal', fontSize: '0.9em', color: '#666', marginLeft: '0.5rem' }}>{getNextWeekDateRange()}</span>
                                    )}
                                </label>
                            </div>

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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <label className="form-label" style={{ textAlign: 'left', margin: 0 }}>
                                    {t('dashboard.matching.serendipity', 'Serendipity Level')}
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {savedSections['serendipity'] && (
                                        <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            {t('dashboard.profile.saved', 'Saved')}
                                        </span>
                                    )}
                                    <span style={{ color: '#7c3aed', fontWeight: 'bold' }}>{formData.serendipity}</span>
                                </div>
                            </div>

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

                        <div className="input-group" style={{ marginTop: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <label className="form-label" style={{ textAlign: 'left', margin: 0 }}>
                                    {t('dashboard.matching.geography', 'Geography')}
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {savedSections['proximity'] && (
                                        <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            {t('dashboard.profile.saved', 'Saved')}
                                        </span>
                                    )}
                                    <span style={{ color: '#7c3aed', fontWeight: 'bold' }}>{formData.proximity}</span>
                                </div>
                            </div>

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

            {/* Disconnect Telegram Confirmation Modal */}
            {showDisconnectTelegramModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'white', borderRadius: '16px', padding: '2rem',
                        maxWidth: '400px', width: '90%', boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.5rem' }}>
                                {t('dashboard.connect_telegram.disconnect_title', 'Disconnect Telegram?')}
                            </h3>
                            <p style={{ color: '#6b7280', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                {t('dashboard.connect_telegram.disconnect_confirm', 'Are you sure you want to disconnect your Telegram account? You will need to reconnect it to participate in matching.')}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={() => setShowDisconnectTelegramModal(false)}
                                style={{
                                    flex: 1, padding: '0.75rem 1rem',
                                    background: '#f3f4f6', border: 'none', borderRadius: '8px',
                                    fontSize: '0.95rem', fontWeight: '600', color: '#6b7280',
                                    cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={confirmDisconnectTelegram}
                                style={{
                                    flex: 1, padding: '0.75rem 1rem',
                                    background: '#ef4444', border: 'none', borderRadius: '8px',
                                    fontSize: '0.95rem', fontWeight: '600', color: 'white',
                                    cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                {t('dashboard.connect_telegram.disconnect_btn', 'Disconnect')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Merge Accounts Confirmation Modal */}
            {showMergeConfirmModal && pendingMergeProfile && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'white', borderRadius: '16px', padding: '2rem',
                        maxWidth: '450px', width: '90%', boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔄</div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.75rem' }}>
                                {t('dashboard.connect_telegram.merge_title', 'Account Already Exists')}
                            </h3>
                            <p style={{ color: '#6b7280', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '1rem' }}>
                                {t('dashboard.connect_telegram.merge_message', 'A profile with this Telegram account already exists:')}
                            </p>
                            <div style={{
                                background: '#f3f4f6',
                                borderRadius: '12px',
                                padding: '1rem',
                                marginBottom: '1rem'
                            }}>
                                <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '1rem' }}>
                                    {pendingMergeProfile.name} {pendingMergeProfile.family}
                                </div>
                                <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                                    @{pendingMergeProfile.username}
                                </div>
                            </div>
                            <p style={{ color: '#6b7280', fontSize: '0.9rem', lineHeight: '1.5' }}>
                                {t('dashboard.connect_telegram.merge_question', 'Do you want to switch to that profile? Your current account will be merged with it.')}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={cancelMerge}
                                style={{
                                    flex: 1, padding: '0.75rem 1rem',
                                    background: '#f3f4f6', border: 'none', borderRadius: '8px',
                                    fontSize: '0.95rem', fontWeight: '600', color: '#6b7280',
                                    cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                {t('common.no', 'No')}
                            </button>
                            <button
                                onClick={confirmMergeAccounts}
                                style={{
                                    flex: 1, padding: '0.75rem 1rem',
                                    background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                                    border: 'none', borderRadius: '8px',
                                    fontSize: '0.95rem', fontWeight: '600', color: 'white',
                                    cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                {t('common.yes', 'Yes')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Connect Telegram Modal */}
            {showTelegramConnectModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        backgroundColor: 'white', padding: '2rem', borderRadius: '1rem',
                        maxWidth: '400px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
                    }}>
                        <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
                            {t('dashboard.connect_telegram.modal_title', 'Connect Telegram')}
                        </h3>
                        <p style={{ marginBottom: '1.5rem', color: '#6b7280', fontSize: '0.9rem' }}>
                            {t('dashboard.connect_telegram.instructions', 'Please start the @Linked_Coffee_Bot on Telegram and enter the OTP code along with your username below.')}
                        </p>

                        {telegramConnectError && (
                            <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                                {telegramConnectError}
                            </div>
                        )}

                        <div style={{ marginBottom: '1rem' }}>
                            <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Telegram Username</label>
                            <div className="input-wrapper">
                                <span className="input-prefix">@</span>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="username"
                                    value={telegramConnectUsername}
                                    onChange={(e) => setTelegramConnectUsername(e.target.value)}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>OTP Code</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="123456"
                                value={telegramConnectOtp}
                                onChange={(e) => setTelegramConnectOtp(e.target.value)}
                                style={{ width: '100%', letterSpacing: '2px', textAlign: 'center', fontSize: '1.2rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={() => setShowTelegramConnectModal(false)}
                                style={{
                                    flex: 1, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem',
                                    background: 'white', color: '#4b5563', cursor: 'pointer', fontWeight: '500'
                                }}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleVerifyTelegramOtp}
                                style={{
                                    flex: 1, padding: '0.75rem', border: 'none', borderRadius: '0.5rem',
                                    background: '#7c3aed', color: 'white', cursor: 'pointer', fontWeight: '500'
                                }}
                            >
                                {t('common.verify')}
                            </button>
                        </div>

                        <a
                            href="https://t.me/Linked_Coffee_Bot"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'block', marginTop: '1rem', textAlign: 'center', color: '#7c3aed', fontSize: '0.875rem' }}
                        >
                            Open Telegram Bot
                        </a>
                    </div>
                </div>
            )}

            {/* Google Link Modal */}
            {showLinkModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '2rem',
                        borderRadius: '0.75rem',
                        maxWidth: '400px',
                        width: '90%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                    }}>
                        <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: '600' }}>{t('dashboard.connected_accounts.modal_title')}</h3>
                        <p style={{ marginBottom: '1.5rem', color: '#6b7280' }}>
                            {t('dashboard.connected_accounts.modal_description', 'Sign in with Google to link your account. You\'ll be able to use either Telegram or Google to log in.')}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                            <GoogleLogin
                                onSuccess={handleGoogleLinkSuccess}
                                onError={() => {
                                    console.log('Google linking failed');
                                    setErrorMessage(t('dashboard.connected_accounts.link_error', 'Failed to link Google account'));
                                    setShowErrorModal(true);
                                }}
                                useOneTap={false}
                            />
                        </div>
                        <button
                            onClick={() => setShowLinkModal(false)}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                backgroundColor: 'white',
                                border: '1px solid #d1d5db',
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: '#374151',
                                cursor: 'pointer'
                            }}
                        >
                            {t('common.cancel')}
                        </button>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1001,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '2.5rem',
                        borderRadius: '1rem',
                        maxWidth: '420px',
                        width: '90%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        animation: 'slideUp 0.3s ease-out',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            margin: '0 auto 1.5rem',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        <h3 style={{
                            marginBottom: '0.75rem',
                            fontSize: '1.5rem',
                            fontWeight: '700',
                            color: '#1f2937'
                        }}>
                            {t('dashboard.connected_accounts.success_title')}
                        </h3>
                        <p style={{
                            marginBottom: '2rem',
                            color: '#6b7280',
                            fontSize: '1rem',
                            lineHeight: '1.6'
                        }}>
                            {successMessage}
                        </p>
                        <button
                            onClick={() => setShowSuccessModal(false)}
                            style={{
                                width: '100%',
                                padding: '0.875rem',
                                background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
                                border: 'none',
                                borderRadius: '0.5rem',
                                fontSize: '1rem',
                                fontWeight: '600',
                                color: 'white',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 6px 16px rgba(124, 58, 237, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.3)';
                            }}
                        >
                            {t('dashboard.connected_accounts.ok_button')}
                        </button>
                    </div>
                </div>
            )}

            {/* Error Modal */}
            {showErrorModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1001,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '2.5rem',
                        borderRadius: '1rem',
                        maxWidth: '420px',
                        width: '90%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        animation: 'slideUp 0.3s ease-out',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            margin: '0 auto 1.5rem',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 10px 25px rgba(239, 68, 68, 0.3)'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </div>
                        <h3 style={{
                            marginBottom: '0.75rem',
                            fontSize: '1.5rem',
                            fontWeight: '700',
                            color: '#1f2937'
                        }}>
                            {t('common.error', 'Error')}
                        </h3>
                        <p style={{
                            marginBottom: '2rem',
                            color: '#6b7280',
                            fontSize: '1rem',
                            lineHeight: '1.6'
                        }}>
                            {errorMessage}
                            {errorMessage && errorMessage.includes('linked to another account') && (
                                <span style={{ display: 'block', marginTop: '1rem', fontSize: '0.9rem', color: '#4b5563', fontStyle: 'italic' }}>
                                    💡 {t('dashboard.connected_accounts.try_logout_tip', 'Try logging out and then log in with Google account')}
                                </span>
                            )}
                        </p>
                        <button
                            onClick={() => setShowErrorModal(false)}
                            style={{
                                width: '100%',
                                padding: '0.875rem',
                                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                border: 'none',
                                borderRadius: '0.5rem',
                                fontSize: '1rem',
                                fontWeight: '600',
                                color: 'white',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                            }}
                        >
                            {t('common.close', 'Close')}
                        </button>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1001,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '2.5rem',
                        borderRadius: '1rem',
                        maxWidth: '440px',
                        width: '90%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        animation: 'slideUp 0.3s ease-out'
                    }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            margin: '0 auto 1.5rem',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 10px 25px rgba(245, 158, 11, 0.3)'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                        </div>
                        <h3 style={{
                            marginBottom: '0.75rem',
                            fontSize: '1.5rem',
                            fontWeight: '700',
                            color: '#1f2937',
                            textAlign: 'center'
                        }}>
                            {t('dashboard.connected_accounts.confirm_unlink_title')}
                        </h3>
                        <p style={{
                            marginBottom: '2rem',
                            color: '#6b7280',
                            fontSize: '1rem',
                            lineHeight: '1.6',
                            textAlign: 'center'
                        }}>
                            {t('dashboard.connected_accounts.confirm_unlink_message')}
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                style={{
                                    flex: 1,
                                    padding: '0.875rem',
                                    backgroundColor: 'white',
                                    border: '2px solid #e5e7eb',
                                    borderRadius: '0.5rem',
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    color: '#6b7280',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = '#f9fafb';
                                    e.target.style.borderColor = '#d1d5db';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = 'white';
                                    e.target.style.borderColor = '#e5e7eb';
                                }}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={confirmUnlinkGoogle}
                                style={{
                                    flex: 1,
                                    padding: '0.875rem',
                                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    color: 'white',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.transform = 'translateY(-2px)';
                                    e.target.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.transform = 'translateY(0)';
                                    e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                                }}
                            >
                                {t('dashboard.connected_accounts.unlink_button')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default Dashboard;
