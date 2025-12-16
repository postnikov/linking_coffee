import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Dashboard.css'; // Reusing dashboard styles for now
import './AdminPage.css'; // Admin specific overrides
import AdminHealth from './AdminHealth';

const API_URL = process.env.REACT_APP_API_URL || '';

const AdminPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState({ users: [], matches: [] });
    const [activeTab, setActiveTab] = useState('users');
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAdminData = async () => {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) {
                navigate('/');
                return;
            }
            const user = JSON.parse(storedUser);

            try {
                const response = await fetch(`${API_URL}/api/admin/data?requester=${user.username}`);
                const result = await response.json();

                if (result.success) {
                    setData({ users: result.users, matches: result.matches });
                } else {
                    setError(result.message);
                    if (response.status === 403) {
                        setTimeout(() => navigate('/'), 3000); // Redirect after 3s
                    }
                }
            } catch (err) {
                console.error('Failed to fetch admin data:', err);
                setError('Failed to load admin data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAdminData();
    }, [navigate]);

    if (isLoading) {
        return (
            <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div className="loading-spinner"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-container">
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
                    <h2>Access Denied or Error</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <main className="main-content" style={{ paddingTop: '20px', display: 'block', minHeight: '100vh', background: '#f9fafb' }}>
            <div className="dashboard-container admin-dashboard-container" style={{ display: 'block' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h1 className="hero-title" style={{ fontSize: '2.5rem', marginBottom: 0, color: '#1f2937' }}>
                        Admin Dashboard
                    </h1>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button 
                            onClick={() => navigate('/')}
                            style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: '0.375rem', cursor: 'pointer' }}
                        >
                            Back to App
                        </button>
                        <button 
                            onClick={() => {
                                localStorage.removeItem('user');
                                navigate('/');
                            }}
                            style={{ padding: '0.5rem 1rem', border: 'none', background: '#ef4444', color: 'white', borderRadius: '0.375rem', cursor: 'pointer' }}
                        >
                            Logout
                        </button>
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem' }}>
                        <button
                            onClick={() => setActiveTab('users')}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '1.1rem',
                                fontWeight: activeTab === 'users' ? 'bold' : 'normal',
                                color: activeTab === 'users' ? '#6366f1' : '#4b5563',
                                cursor: 'pointer',
                                padding: '0.5rem 1rem'
                            }}
                        >
                            GDPR Users ({data.users.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('matches')}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '1.1rem',
                                fontWeight: activeTab === 'matches' ? 'bold' : 'normal',
                                color: activeTab === 'matches' ? '#6366f1' : '#4b5563',
                                cursor: 'pointer',
                                padding: '0.5rem 1rem'
                            }}
                        >
                            Current Matches ({data.matches.length})
                        </button>
                        <button
                             onClick={() => setActiveTab('health')}
                             style={{
                                 background: 'none',
                                 border: 'none',
                                 fontSize: '1.1rem',
                                 fontWeight: activeTab === 'health' ? 'bold' : 'normal',
                                 color: activeTab === 'health' ? '#6366f1' : '#4b5563',
                                 cursor: 'pointer',
                                 padding: '0.5rem 1rem'
                             }}
                        >
                            System Health
                        </button>
                    </div>

                    {activeTab === 'users' && (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                        <th style={{ padding: '1rem' }}>Name</th>
                                        <th style={{ padding: '1rem' }}>Family</th>
                                        <th style={{ padding: '1rem' }}>Username</th>
                                        <th style={{ padding: '1rem' }}>Profile</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.users.map(user => (
                                        <tr key={user.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '1rem' }}>{user.name}</td>
                                            <td style={{ padding: '1rem' }}>{user.family}</td>
                                            <td style={{ padding: '1rem' }}>{user.username}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <button
                                                    onClick={() => navigate(`/profile/${user.username}`)}
                                                    style={{
                                                        padding: '0.25rem 0.75rem',
                                                        borderRadius: '4px',
                                                        border: '1px solid #6366f1',
                                                        background: 'none',
                                                        color: '#6366f1',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'matches' && (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                        <th style={{ padding: '1rem' }}>Member 1</th>
                                        <th style={{ padding: '1rem' }}>Member 2</th>
                                        <th style={{ padding: '1rem' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.matches.map(match => (
                                        <tr key={match.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: 'bold' }}>{match.member1.name}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>@{match.member1.username}</div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: 'bold' }}>{match.member2.name}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>@{match.member2.username}</div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '999px',
                                                    backgroundColor: '#dcfce7',
                                                    color: '#166534',
                                                    fontSize: '0.85rem'
                                                }}>
                                                    {match.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {data.matches.length === 0 && (
                                        <tr>
                                            <td colSpan="3" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                                                No matches found for this week.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'health' && (() => {
                        const stored = localStorage.getItem('user');
                        const user = stored ? JSON.parse(stored) : null;
                        if (!user) return null;
                        // Determine tg_username: locally it seems user.username is used in fetchAdminData, 
                        // so we assume user.username is the telegram username.
                        const adminUser = { ...user, tg_username: user.username };
                        return <AdminHealth user={adminUser} isAdmin={true} />;
                    })()}
                </div>
            </div>
        </main>
    );
};

export default AdminPage;
