import React, { useState, useEffect } from 'react';
import './StatisticsTab.css';

const API_URL = process.env.REACT_APP_API_URL || '';

const StatisticsTab = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(30);
  const [activeView, setActiveView] = useState('overview');

  useEffect(() => {
    fetchStatistics();
  }, [period]);

  const fetchStatistics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/api/admin/statistics?period=${period}&requester=${user.username}`
      );
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      } else {
        setError(data.message || 'Failed to load statistics');
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
      setError('Failed to fetch statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="statistics-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="statistics-container">
        <div className="error-state">
          <p className="error-message">{error}</p>
          <button onClick={fetchStatistics} className="retry-button">Retry</button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="statistics-container">
        <p>No statistics available</p>
      </div>
    );
  }

  return (
    <div className="statistics-container">
      <div className="statistics-header">
        <h2>Statistics Dashboard</h2>
        <div className="controls">
          <div className="period-selector">
            <button
              className={period === 7 ? 'active' : ''}
              onClick={() => setPeriod(7)}
            >
              7 days
            </button>
            <button
              className={period === 30 ? 'active' : ''}
              onClick={() => setPeriod(30)}
            >
              30 days
            </button>
            <button
              className={period === 90 ? 'active' : ''}
              onClick={() => setPeriod(90)}
            >
              90 days
            </button>
          </div>
          <button onClick={fetchStatistics} className="refresh-button">
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="view-tabs">
        <button
          className={activeView === 'overview' ? 'active' : ''}
          onClick={() => setActiveView('overview')}
        >
          Overview
        </button>
        <button
          className={activeView === 'daily' ? 'active' : ''}
          onClick={() => setActiveView('daily')}
        >
          Daily
        </button>
        <button
          className={activeView === 'weekly' ? 'active' : ''}
          onClick={() => setActiveView('weekly')}
        >
          Weekly
        </button>
        <button
          className={activeView === 'users' ? 'active' : ''}
          onClick={() => setActiveView('users')}
        >
          Users
        </button>
        <button
          className={activeView === 'matches' ? 'active' : ''}
          onClick={() => setActiveView('matches')}
        >
          Matches
        </button>
      </div>

      <div className="view-content">
        {activeView === 'overview' && <OverviewDashboard stats={stats} />}
        {activeView === 'daily' && <DailyMetricsView stats={stats} />}
        {activeView === 'weekly' && <WeeklyMetricsView stats={stats} />}
        {activeView === 'users' && <UserAnalyticsView stats={stats} />}
        {activeView === 'matches' && <MatchPerformanceView stats={stats} />}
      </div>
    </div>
  );
};

// Overview Dashboard Component
const OverviewDashboard = ({ stats }) => {
  const { overview, weekly, userStatus, matchPerformance } = stats;

  // Get this week's data (first item in weekly array)
  const thisWeek = weekly && weekly.length > 0 ? weekly[0] : null;
  const lastWeek = weekly && weekly.length > 1 ? weekly[1] : null;

  const weeklyChange = thisWeek && lastWeek
    ? thisWeek.newUsers - lastWeek.newUsers
    : 0;

  return (
    <div className="overview-dashboard">
      <div className="kpi-cards-grid">
        <div className="kpi-card">
          <div className="kpi-value">{overview.totalUsers}</div>
          <div className="kpi-label">Total Users</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{overview.activeUsers}</div>
          <div className="kpi-label">Active Users</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{overview.totalMatches}</div>
          <div className="kpi-label">Total Matches</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{overview.avgRating} ⭐</div>
          <div className="kpi-label">Avg Rating</div>
        </div>
      </div>

      {thisWeek && (
        <div className="quick-stats">
          <h3>This Week</h3>
          <div className="stat-row">
            <span>New Users:</span>
            <span className="stat-value">
              {thisWeek.newUsers}
              {weeklyChange !== 0 && (
                <span className={`change ${weeklyChange > 0 ? 'positive' : 'negative'}`}>
                  ({weeklyChange > 0 ? '+' : ''}{weeklyChange})
                </span>
              )}
            </span>
          </div>
          <div className="stat-row">
            <span>Telegram Connections:</span>
            <span className="stat-value">{thisWeek.telegramConnections}</span>
          </div>
          <div className="stat-row">
            <span>LinkedIn Connections:</span>
            <span className="stat-value">{thisWeek.linkedinConnections}</span>
          </div>
          <div className="stat-row">
            <span>Matches Created:</span>
            <span className="stat-value">{thisWeek.matchesCreated}</span>
          </div>
          <div className="stat-row">
            <span>Feedback Response Rate:</span>
            <span className="stat-value">{thisWeek.feedback.responseRate}%</span>
          </div>
        </div>
      )}

      <div className="stat-section">
        <h3>User Status Distribution</h3>
        <div className="progress-bars">
          {Object.entries(userStatus).map(([status, count]) => {
            const percentage = overview.totalUsers > 0
              ? Math.round((count / overview.totalUsers) * 100)
              : 0;
            return (
              <div key={status} className="progress-row">
                <span className="label">{status}: {count}</span>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <span className="percentage">{percentage}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="stat-section">
        <h3>Match Success Breakdown</h3>
        <div className="progress-bars">
          {Object.entries(matchPerformance.statusBreakdown).map(([status, data]) => (
            <div key={status} className="progress-row">
              <span className="label">{status}: {data.count}</span>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${data.percentage}%` }}
                ></div>
              </div>
              <span className="percentage">{data.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Daily Metrics View Component
const DailyMetricsView = ({ stats }) => {
  return (
    <div className="daily-metrics-view">
      <h3>Daily Metrics (Last {stats.daily.length} Days)</h3>
      <div className="table-container">
        <table className="stat-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>New Users</th>
              <th>Telegram Conn.</th>
              <th>LinkedIn Conn.</th>
            </tr>
          </thead>
          <tbody>
            {stats.daily.map(day => (
              <tr key={day.date}>
                <td>{day.date}</td>
                <td>{day.newUsers}</td>
                <td>{day.telegramConnections}</td>
                <td>{day.linkedinConnections}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Weekly Metrics View Component
const WeeklyMetricsView = ({ stats }) => {
  return (
    <div className="weekly-metrics-view">
      <h3>Weekly Aggregates</h3>
      <div className="table-container">
        <table className="stat-table">
          <thead>
            <tr>
              <th>Week Start</th>
              <th>New Users</th>
              <th>Telegram</th>
              <th>LinkedIn</th>
              <th>Matches</th>
              <th>Response Rate</th>
            </tr>
          </thead>
          <tbody>
            {stats.weekly.map(week => (
              <tr key={week.weekStart}>
                <td>{week.weekStart}</td>
                <td>{week.newUsers}</td>
                <td>{week.telegramConnections}</td>
                <td>{week.linkedinConnections}</td>
                <td>{week.matchesCreated}</td>
                <td>{week.feedback.responseRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// User Analytics View Component
const UserAnalyticsView = ({ stats }) => {
  const { profileCompletion, geography, languages } = stats;

  return (
    <div className="user-analytics-view">
      <div className="stat-section">
        <h3>Profile Completion Analysis</h3>
        <div className="completion-summary">
          <p>
            <strong>{profileCompletion.complete}</strong> out of{' '}
            <strong>{profileCompletion.complete + profileCompletion.incomplete}</strong>{' '}
            users have complete profiles ({profileCompletion.completionRate}%)
          </p>
        </div>
        <div className="progress-bars">
          <div className="progress-row">
            <span className="label">Complete: {profileCompletion.complete}</span>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${profileCompletion.completionRate}%` }}
              ></div>
            </div>
            <span className="percentage">{profileCompletion.completionRate}%</span>
          </div>
          <div className="progress-row">
            <span className="label">Incomplete: {profileCompletion.incomplete}</span>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${100 - profileCompletion.completionRate}%` }}
              ></div>
            </div>
            <span className="percentage">{100 - profileCompletion.completionRate}%</span>
          </div>
        </div>
      </div>

      <div className="stat-section">
        <h3>Most Commonly Missing Fields</h3>
        <div className="table-container">
          <table className="stat-table">
            <thead>
              <tr>
                <th>Field Name</th>
                <th>Users Missing</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(profileCompletion.missingFields).slice(0, 10).map(([field, count]) => (
                <tr key={field}>
                  <td>{field.replace(/_/g, ' ')}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="stat-section">
        <h3>Geographic Distribution</h3>
        <div className="table-container">
          <table className="stat-table">
            <thead>
              <tr>
                <th>Country</th>
                <th>Users</th>
              </tr>
            </thead>
            <tbody>
              {geography.countries.slice(0, 10).map(country => (
                <tr key={country.name}>
                  <td>{country.name}</td>
                  <td>{country.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="stat-section">
        <h3>Language Distribution</h3>
        <div className="table-container">
          <table className="stat-table">
            <thead>
              <tr>
                <th>Language</th>
                <th>Users</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(languages).map(([lang, count]) => (
                <tr key={lang}>
                  <td>{lang}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Match Performance View Component
const MatchPerformanceView = ({ stats }) => {
  const { matchPerformance } = stats;

  return (
    <div className="match-performance-view">
      <div className="kpi-cards-grid">
        <div className="kpi-card">
          <div className="kpi-value">{matchPerformance.totalMatches}</div>
          <div className="kpi-label">Total Matches</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{matchPerformance.withFeedback}</div>
          <div className="kpi-label">With Feedback</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{matchPerformance.feedbackRate}%</div>
          <div className="kpi-label">Response Rate</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{matchPerformance.averageRating} ⭐</div>
          <div className="kpi-label">Avg Rating</div>
        </div>
      </div>

      <div className="stat-section">
        <h3>Meeting Status Breakdown</h3>
        <div className="progress-bars">
          {Object.entries(matchPerformance.statusBreakdown).map(([status, data]) => (
            <div key={status} className="progress-row">
              <span className="label">{status}: {data.count}</span>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${data.percentage}%` }}
                ></div>
              </div>
              <span className="percentage">{data.percentage}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="stat-section">
        <h3>Rating Distribution</h3>
        <div className="progress-bars">
          {Object.entries(matchPerformance.ratingDistribution).map(([rating, count]) => {
            const total = Object.values(matchPerformance.ratingDistribution).reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={rating} className="progress-row">
                <span className="label">{rating} ⭐: {count}</span>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <span className="percentage">{percentage}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StatisticsTab;
