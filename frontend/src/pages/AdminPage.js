import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css'; // Reusing dashboard styles for now
import './AdminPage.css'; // Admin specific overrides
import AdminHealth from './AdminHealth';
import StatisticsTab from './components/StatisticsTab';

const API_URL = process.env.REACT_APP_API_URL || '';

const AdminPage = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState({ users: [], matches: [] });
    const [activeTab, setActiveTab] = useState('users');
    const [error, setError] = useState(null);

    // Matching State
    const [matcherOptions, setMatcherOptions] = useState({ dryRun: true, model: 'gemini-3-pro-preview' });
    const [matchingRunning, setMatchingRunning] = useState(false);
    const [matchLogs, setMatchLogs] = useState([]);
    const logsEndRef = React.useRef(null);

    // Filter State
    const [selectedWeek, setSelectedWeek] = useState('All');
    const [regeneratingId, setRegeneratingId] = useState(null);
    const [showRegenModal, setShowRegenModal] = useState(false);
    const [regenLogs, setRegenLogs] = useState('');

    // Compute Weeks
    const uniqueWeeks = React.useMemo(() => {
        const weeks = new Set(data.matches.map(m => m.weekStart).filter(Boolean));
        return Array.from(weeks).sort().reverse();
    }, [data.matches]);

    const filteredMatches = React.useMemo(() => {
        if (selectedWeek === 'All') return data.matches;
        return data.matches.filter(m => m.weekStart === selectedWeek);
    }, [data.matches, selectedWeek]);

    const handleRegenerateImage = async (matchId) => {
        if (!window.confirm('Regenerate image for this match? This will override existing image.')) return;
        setRegeneratingId(matchId);
        setShowRegenModal(true);
        setRegenLogs('🚀 Starting regeneration process...\n');

        try {
            const response = await fetch(`${API_URL}/api/admin/regenerate-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchId })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value);
                setRegenLogs(prev => prev + text);
            }
        } catch (e) {
            console.error(e);
            setRegenLogs(prev => prev + `\n❌ Error: ${e.message}`);
        } finally {
            setRegeneratingId(null);
        }
    };

    const startMatching = () => {
        setMatchingRunning(true);
        setMatchLogs([{ type: 'info', message: '🚀 Initializing connection...' }]);

        const params = new URLSearchParams({
            dryRun: matcherOptions.dryRun,
            model: matcherOptions.model
        });

        const eventSource = new EventSource(`${API_URL}/api/admin/run-matching?${params}`);

        eventSource.onmessage = (event) => {
            const log = JSON.parse(event.data);
            if (log.type === 'done') {
                setMatchLogs(prev => [...prev, { type: 'info', message: `✅ Process finished with code ${log.code}` }]);
                eventSource.close();
                setMatchingRunning(false);
            } else {
                setMatchLogs(prev => [...prev, log]);
            }
        };

        eventSource.onerror = (err) => {
            console.error('SSE Error:', err);
            setMatchLogs(prev => [...prev, { type: 'error', message: '❌ Connection lost.' }]);
            eventSource.close();
            setMatchingRunning(false);
        };
    };

    // Auto-scroll logs
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [matchLogs]);

    useEffect(() => {
        const fetchAdminData = async () => {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) {
                navigate('/');
                return;
            }
            const user = JSON.parse(storedUser);

            try {
                // Fetch Data and Config in parallel (eliminates waterfall)
                const [dataResponse, configResponse] = await Promise.all([
                    fetch(`${API_URL}/api/admin/data?requester=${user.username}`),
                    fetch(`${API_URL}/api/admin/config`)
                ]);

                const [result, configResult] = await Promise.all([
                    dataResponse.json(),
                    configResponse.json()
                ]);

                if (result.success) {
                    setData({ users: result.users, matches: result.matches });

                    if (configResult.success && configResult.config?.ai) {
                        const aiConfig = configResult.config.ai;
                        setMatcherOptions(prev => ({
                            ...prev,
                            // Use backend default if available
                            model: aiConfig.matchingModel || prev.model,
                            // Store available models for UI
                            allowedModels: aiConfig.allowedMatchingModels || []
                        }));
                    }
                } else {
                    setError(result.message);
                    if (dataResponse.status === 403) {
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
                        <button
                            onClick={() => setActiveTab('matcher')}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '1.1rem',
                                fontWeight: activeTab === 'matcher' ? 'bold' : 'normal',
                                color: activeTab === 'matcher' ? '#6366f1' : '#4b5563',
                                cursor: 'pointer',
                                padding: '0.5rem 1rem'
                            }}
                        >
                            AI Matcher
                        </button>
                        <button
                            onClick={() => setActiveTab('statistics')}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '1.1rem',
                                fontWeight: activeTab === 'statistics' ? 'bold' : 'normal',
                                color: activeTab === 'statistics' ? '#6366f1' : '#4b5563',
                                cursor: 'pointer',
                                padding: '0.5rem 1rem'
                            }}
                        >
                            Statistics
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
                            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
                                <label style={{ marginRight: '0.5rem', fontWeight: 'bold' }}>Filter by Week:</label>
                                <select
                                    value={selectedWeek}
                                    onChange={e => setSelectedWeek(e.target.value)}
                                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                                >
                                    <option value="All">All Weeks</option>
                                    {uniqueWeeks.map(w => (
                                        <option key={w} value={w}>{w}</option>
                                    ))}
                                </select>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                        <th style={{ padding: '1rem' }}>Week</th>
                                        <th style={{ padding: '1rem' }}>Image</th>
                                        <th style={{ padding: '1rem' }}>Member 1</th>
                                        <th style={{ padding: '1rem' }}>Member 2</th>
                                        <th style={{ padding: '1rem' }}>Status</th>
                                        <th style={{ padding: '1rem' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMatches.map(match => (
                                        <tr key={match.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#6b7280' }}>
                                                {match.weekStart || 'N/A'}
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                {match.introImage ? (
                                                    <a href={match.introImage} target="_blank" rel="noreferrer">
                                                        <img
                                                            src={match.introImage}
                                                            alt="Match Intro"
                                                            style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }}
                                                        />
                                                    </a>
                                                ) : (
                                                    <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>No Image</span>
                                                )}
                                            </td>
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
                                            <td style={{ padding: '1rem' }}>
                                                <button
                                                    onClick={() => handleRegenerateImage(match.id)}
                                                    disabled={regeneratingId === match.id}
                                                    style={{
                                                        padding: '0.25rem 0.5rem',
                                                        fontSize: '0.8rem',
                                                        border: '1px solid #d1d5db',
                                                        borderRadius: '4px',
                                                        background: regeneratingId === match.id ? '#f3f4f6' : 'white',
                                                        cursor: regeneratingId === match.id ? 'wait' : 'pointer'
                                                    }}
                                                >
                                                    {regeneratingId === match.id ? 'Generating...' : 'Regenerate Img'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredMatches.length === 0 && (
                                        <tr>
                                            <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                                                No matches found for this selection.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'matcher' && (
                        <div>
                            <h3>AI Matching Orchestrator</h3>
                            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f3f4f6', borderRadius: '8px' }}>
                                <label style={{ marginRight: '1rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={matcherOptions.dryRun}
                                        onChange={e => setMatcherOptions({ ...matcherOptions, dryRun: e.target.checked })}
                                    />
                                    Dry Run (Simulation)
                                </label>
                                <label style={{ marginRight: '1rem' }}>
                                    Model:
                                    <select
                                        value={matcherOptions.model}
                                        onChange={e => setMatcherOptions({ ...matcherOptions, model: e.target.value })}
                                        style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
                                    >
                                        {matcherOptions.allowedModels && matcherOptions.allowedModels.length > 0 ? (
                                            matcherOptions.allowedModels.map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))
                                        ) : (
                                            <>
                                                <option value="gemini-3-pro-preview">Gemini 3 Pro (Fallback)</option>
                                                <option value="gemini-1.5-pro-002">Gemini 1.5 Pro</option>
                                            </>
                                        )}
                                    </select>
                                </label>
                                <button
                                    onClick={startMatching}
                                    disabled={matchingRunning}
                                    style={{
                                        background: matchingRunning ? '#9ca3af' : '#2563eb',
                                        color: 'white',
                                        border: 'none',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '4px',
                                        cursor: matchingRunning ? 'not-allowed' : 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    {matchingRunning ? 'Running...' : '🚀 Start Matching Engine'}
                                </button>
                            </div>

                            <div style={{
                                background: '#1e1e1e',
                                color: '#d4d4d4',
                                padding: '1rem',
                                borderRadius: '8px',
                                fontFamily: 'monospace',
                                height: '400px',
                                overflowY: 'auto',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {matchLogs.length === 0 ? <span style={{ color: '#6b7280' }}>(Logs will appear here...)</span> : null}
                                {matchLogs.map((log, i) => (
                                    <div key={i} style={{ color: log.type === 'error' ? '#ef4444' : '#d4d4d4' }}>
                                        {log.message}
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
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

                    {activeTab === 'statistics' && (() => {
                        const stored = localStorage.getItem('user');
                        const user = stored ? JSON.parse(stored) : null;
                        if (!user) return null;
                        return <StatisticsTab user={user} />;
                    })()}
                </div>
            </div>

            {/* Regeneration Modal */}
            {showRegenModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        width: '80%', maxWidth: '800px', height: '80%',
                        backgroundColor: '#1e1e1e', color: '#d4d4d4',
                        borderRadius: '8px', padding: '1rem',
                        display: 'flex', flexDirection: 'column',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, color: '#fff' }}>Regeneration Logs</h3>
                            <button onClick={() => setShowRegenModal(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
                        </div>
                        <div style={{
                            flex: 1, overflowY: 'auto', fontFamily: 'monospace', whiteSpace: 'pre-wrap',
                            padding: '1rem', background: '#000', borderRadius: '4px', border: '1px solid #333'
                        }}>
                            {regenLogs}
                            {regeneratingId && <div style={{ marginTop: '1rem', fontStyle: 'italic', color: '#666' }}>Processing...</div>}
                        </div>
                        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                            <button
                                onClick={() => setShowRegenModal(false)}
                                disabled={!!regeneratingId}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: regeneratingId ? '#4b5563' : '#2563eb',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: regeneratingId ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {regeneratingId ? 'Running...' : 'Close'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default AdminPage;
