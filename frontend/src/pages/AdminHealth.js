import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './AdminHealth.css'; // We'll create this locally
import cronstrue from 'cronstrue';

const CronBuilder = ({ value, onChange }) => {
  const [mode, setMode] = useState('custom'); // custom, daily, weekly
  const [hour, setHour] = useState('10');
  const [minute, setMinute] = useState('00');
  const [day, setDay] = useState('1'); // 1 = Monday

  // Parse initial value to set state
  useEffect(() => {
    if (!value) return;
    const parts = value.split(' ');
    if (parts.length < 5) {
      setMode('custom');
      return;
    }

    // Check if Daily: M H * * *
    if (parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
      setMode('daily');
      setMinute(parts[0].padStart(2, '0'));
      setHour(parts[1].padStart(2, '0'));
    }
    // Check if Weekly: M H * * D
    else if (parts[2] === '*' && parts[3] === '*' && parts[4] !== '*') {
      setMode('weekly');
      setMinute(parts[0].padStart(2, '0'));
      setHour(parts[1].padStart(2, '0'));
      setDay(parts[4]);
    } else {
      setMode('custom');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount only - intentionally not syncing with value prop to avoid loops

  const updateCron = (newMode, h, m, d) => {
    let cron = value;
    if (newMode === 'daily') {
      cron = `${parseInt(m)} ${parseInt(h)} * * *`;
    } else if (newMode === 'weekly') {
      cron = `${parseInt(m)} ${parseInt(h)} * * ${d}`;
    }
    onChange(cron);
  };

  const handleModeChange = (e) => {
    const newMode = e.target.value;
    setMode(newMode);
    if (newMode !== 'custom') {
      updateCron(newMode, hour, minute, day);
    }
  };

  const handleTimeChange = (type, val) => {
    if (type === 'hour') {
      setHour(val);
      updateCron(mode, val, minute, day);
    } else {
      setMinute(val);
      updateCron(mode, hour, val, day);
    }
  };

  const handleDayChange = (val) => {
    setDay(val);
    updateCron(mode, hour, minute, val);
  };

  let description = '';
  try {
    description = cronstrue.toString(value);
  } catch (e) {
    description = 'Invalid cron expression';
  }

  return (
    <div className="cron-builder" style={{ marginTop: '10px', padding: '10px', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
      <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#4b5563' }}>
        {description}
        <span style={{ marginLeft: '8px', fontSize: '0.85em', color: '#6b7280', fontWeight: 'normal' }}>
          (UTC)
        </span>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={mode} onChange={handleModeChange} style={{ padding: '5px' }}>
          <option value="custom">Custom (Advanced)</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>

        {mode !== 'custom' && (
          <>
            <span>at</span>
            <select value={hour} onChange={(e) => handleTimeChange('hour', e.target.value)} style={{ padding: '5px' }}>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}</option>
              ))}
            </select>
            <span>:</span>
            <select value={minute} onChange={(e) => handleTimeChange('minute', e.target.value)} style={{ padding: '5px' }}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i * 5} value={(i * 5).toString().padStart(2, '0')}>{(i * 5).toString().padStart(2, '0')}</option>
              ))}
            </select>
          </>
        )}

        {mode === 'weekly' && (
          <>
            <span>on</span>
            <select value={day} onChange={(e) => handleDayChange(e.target.value)} style={{ padding: '5px' }}>
              <option value="1">Monday</option>
              <option value="2">Tuesday</option>
              <option value="3">Wednesday</option>
              <option value="4">Thursday</option>
              <option value="5">Friday</option>
              <option value="6">Saturday</option>
              <option value="0">Sunday</option>
            </select>
          </>
        )}
      </div>
    </div>
  );
};

const AdminHealth = ({ user, isAdmin }) => {
  useTranslation(); // Keep for potential future i18n usage
  const [activeTab, setActiveTab] = useState('logs');

  // Data States
  const [logFiles, setLogFiles] = useState([]);
  const [activeLogFile, setActiveLogFile] = useState(null);
  const [logContent, setLogContent] = useState('');

  // Script Logs States
  const [logType, setLogType] = useState('system'); // 'system' or 'scripts'
  const [scriptLogs, setScriptLogs] = useState([]);
  const [selectedScript, setSelectedScript] = useState('');
  const [scriptLogContent, setScriptLogContent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [logOffset, setLogOffset] = useState(0);
  const [logLimit] = useState(100);
  const [totalLines, setTotalLines] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // UX Enhancement States
  const [quickFilter, setQuickFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const searchInputRef = React.useRef(null);

  const [cronJobs, setCronJobs] = useState([]);
  const [availableScripts, setAvailableScripts] = useState([]);
  const [showJobForm, setShowJobForm] = useState(false);
  const [isEditingJob, setIsEditingJob] = useState(false);
  const [jobForm, setJobForm] = useState({ name: '', script: '', cron: '', enabled: true });

  const [backupFiles, setBackupFiles] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initial Data Fetch
  useEffect(() => {
    if (!isAdmin) return;

    // Fetch initial data based on tab
    return () => {
      // clean up
    };
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab === 'logs') fetchLogFiles();
    if (activeTab === 'cron') { fetchScheduler(); fetchScripts(); }
    if (activeTab === 'backups') fetchBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]); // Functions are stable, only re-run when tab changes

  // ============================================
  // UX HELPER FUNCTIONS
  // ============================================

  // Parse log line to determine severity level
  const parseLogSeverity = (line) => {
    const patterns = {
      error: /\[ERROR\]|\bERROR\b|❌|Failed|Exception|ENOENT|Error:/i,
      warn: /\[WARN\]|\bWARN\b|⚠️|Warning/i,
      success: /\[SUCCESS\]|✅|Completed|SUCCESS|Script completed/i,
      info: /\[INFO\]|\bINFO\b|ℹ️|Starting|Sending|Found|Fetched/i
    };

    for (const [level, regex] of Object.entries(patterns)) {
      if (regex.test(line)) return level;
    }
    return 'default';
  };

  // Toast notification system
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Highlight search terms in text
  const highlightSearchTerm = (text, term) => {
    if (!term || term.length < 2) return text;
    try {
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = text.split(new RegExp(`(${escapedTerm})`, 'gi'));
      return parts.map((part, i) =>
        part.toLowerCase() === term.toLowerCase()
          ? <mark key={i} className="search-highlight">{part}</mark>
          : part
      );
    } catch {
      return text;
    }
  };

  // Copy line to clipboard
  const handleCopyLine = (line) => {
    navigator.clipboard.writeText(line).then(() => {
      showToast('📋 Copied to clipboard!', 'info');
    });
  };

  // Filter chips configuration
  const filterChips = [
    { id: 'all', label: 'All', icon: '📋' },
    { id: 'error', label: 'Errors', icon: '❌' },
    { id: 'warn', label: 'Warnings', icon: '⚠️' },
    { id: 'success', label: 'Success', icon: '✅' },
  ];

  // Get filtered and parsed log lines
  const getProcessedLogLines = (content) => {
    if (!content) return [];
    const lines = content.split('\n').filter(line => line.trim());

    return lines.map((line, index) => ({
      number: index + 1,
      content: line,
      severity: parseLogSeverity(line)
    })).filter(line => {
      if (quickFilter === 'all') return true;
      return line.severity === quickFilter;
    });
  };

  // Count logs by severity
  const getLogCounts = (content) => {
    if (!content) return { all: 0, error: 0, warn: 0, success: 0 };
    const lines = content.split('\n').filter(line => line.trim());
    const counts = { all: lines.length, error: 0, warn: 0, success: 0 };

    lines.forEach(line => {
      const severity = parseLogSeverity(line);
      if (counts[severity] !== undefined) counts[severity]++;
    });

    return counts;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === '/' && activeTab === 'logs') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSearchTerm('');
        searchInputRef.current?.blur();
      }
      if (e.key === 'r' && activeTab === 'logs' && logType === 'scripts') {
        e.preventDefault();
        refreshScriptLog();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, logType, selectedScript]); // refreshScriptLog uses these deps internally

  // API Helpers
  const apiFetch = async (endpoint, options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const API_URL = process.env.REACT_APP_API_URL || '';
      const headers = {
        'Content-Type': 'application/json',
        'x-admin-user': user.tg_username // Custom header for auth check
      };

      const separator = endpoint.includes('?') ? '&' : '?';
      const res = await fetch(`${API_URL}${endpoint}${separator}requester=${user.tg_username}`, {
        ...options,
        headers: { ...headers, ...options.headers }
      });

      // Handle non-JSON response (e.g., HTML 404/500)
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        await res.text(); // Consume the response body
        throw new Error(`Server response was not JSON. Status: ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data;
    } catch (e) {
      console.error("API Error", e);
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // LOGS Handlers
  const fetchLogFiles = async () => {
    const data = await apiFetch('/api/admin/logs');
    if (data) {
      setLogFiles(data.files);
      if (data.files.length > 0 && !activeLogFile) {
        loadLogContent(data.files[0]);
      }
    }
  };

  const loadLogContent = async (file) => {
    setActiveLogFile(file);
    const data = await apiFetch(`/api/admin/logs/view?file=${file.path}`);
    if (data) setLogContent(data.content);
  };

  // SCRIPT LOGS Handlers
  const fetchScriptLogs = async () => {
    const data = await apiFetch('/api/admin/logs/scripts');
    if (data && data.logs) {
      setScriptLogs(data.logs);
      if (data.logs.length > 0 && !selectedScript) {
        setSelectedScript(data.logs[0].script);
        loadScriptLog(data.logs[0].script);
      }
    }
  };

  const loadScriptLog = async (scriptName, offset = 0) => {
    if (!scriptName) return;
    setSelectedScript(scriptName);
    setLogOffset(offset);

    const searchParam = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : '';
    const data = await apiFetch(`/api/admin/logs/scripts/${scriptName}?offset=${offset}&limit=${logLimit}${searchParam}`);

    if (data) {
      setScriptLogContent(data.lines.join('\n'));
      setTotalLines(data.totalLines);
      setHasMore(data.hasMore);
    }
  };

  const downloadScriptLog = async (scriptName) => {
    if (!scriptName) return;
    const API_URL = process.env.REACT_APP_API_URL || '';
    const url = `${API_URL}/api/admin/logs/scripts/${scriptName}/download?requester=${user.tg_username}`;
    window.open(url, '_blank');
  };

  const refreshScriptLog = async () => {
    if (selectedScript) {
      setIsRefreshing(true);
      await loadScriptLog(selectedScript, logOffset);
      setIsRefreshing(false);
      showToast('🔄 Logs refreshed', 'info');
    }
  };

  const loadPreviousPage = () => {
    if (logOffset >= logLimit) {
      loadScriptLog(selectedScript, logOffset - logLimit);
    }
  };

  const loadNextPage = () => {
    if (hasMore) {
      loadScriptLog(selectedScript, logOffset + logLimit);
    }
  };

  // Auto-refresh effect for script logs
  useEffect(() => {
    if (autoRefresh && logType === 'scripts' && selectedScript) {
      const interval = setInterval(() => {
        refreshScriptLog();
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, logType, selectedScript, logOffset, searchTerm]); // refreshScriptLog uses these deps

  // Update log type handler
  useEffect(() => {
    if (logType === 'scripts' && scriptLogs.length === 0) {
      fetchScriptLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logType]); // Only trigger on logType change, scriptLogs check is just a guard

  // CRON Handlers
  const fetchScheduler = async () => {
    const data = await apiFetch('/api/admin/scheduler');
    if (data) setCronJobs(data.jobs);
  };

  const fetchScripts = async () => {
    const data = await apiFetch('/api/admin/scripts');
    if (data) setAvailableScripts(data.scripts);
  };

  const handleSaveJob = async () => {
    const action = isEditingJob ? 'update' : 'add';
    const data = await apiFetch('/api/admin/scheduler', {
      method: 'POST',
      body: JSON.stringify({ action, job: jobForm })
    });
    if (data) {
      setCronJobs(data.jobs);
      setShowJobForm(false);
      setIsEditingJob(false);
      setJobForm({ name: '', script: '', cron: '', enabled: true });
    }
  };

  const handleDeleteJob = async (name) => {
    if (!window.confirm(`Delete job ${name}?`)) return;
    const data = await apiFetch('/api/admin/scheduler', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', job: { name } })
    });
    if (data) setCronJobs(data.jobs);
  };

  const handleRunJob = async (name) => {
    const data = await apiFetch('/api/admin/scheduler/run', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    if (data) {
      showToast(`🚀 Job "${name}" triggered! Check logs.`, 'success');
    }
  };

  const handleToggleJob = async (job) => {
    const newJob = { ...job, enabled: !job.enabled };
    const data = await apiFetch('/api/admin/scheduler', {
      method: 'POST',
      body: JSON.stringify({ action: 'update', job: newJob })
    });
    if (data) setCronJobs(data.jobs);
  };

  // BACKUP Handlers
  const fetchBackups = async () => {
    const data = await apiFetch('/api/admin/backups');
    if (data) setBackupFiles(data.files);
  };

  const handleTestBot = async () => {
    const data = await apiFetch('/api/admin/bot/test', { method: 'POST' });
    if (data) {
      showToast(`✅ ${data.message} - Bot: @${data.bot?.username}`, 'success');
    }
  };

  if (!isAdmin) return <div className="p-4">Access Denied</div>;

  return (
    <div className="admin-health-container">
      <div className="tabs">
        <button className={activeTab === 'logs' ? 'active' : ''} onClick={() => setActiveTab('logs')}>Logs</button>
        <button className={activeTab === 'cron' ? 'active' : ''} onClick={() => setActiveTab('cron')}>Cron Scheduler</button>
        <button className={activeTab === 'backups' ? 'active' : ''} onClick={() => setActiveTab('backups')}>Backups</button>
        <button className="btn-secondary" style={{ marginLeft: 'auto' }} onClick={handleTestBot}>Check Bot Health 🤖</button>
      </div>

      <div className="tab-content">
        {loading && (
          <div className="loading-overlay">
            <div className="spinner" />
            <span>Loading...</span>
          </div>
        )}
        {error && <div className="error-msg">⚠️ {error}</div>}

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="logs-view">
            <div className="logs-tabs">
              <button
                onClick={() => setLogType('system')}
                className={logType === 'system' ? 'btn-primary' : 'btn-secondary'}
              >
                📁 System Logs
              </button>
              <button
                onClick={() => setLogType('scripts')}
                className={logType === 'scripts' ? 'btn-primary' : 'btn-secondary'}
              >
                📜 Script Logs
              </button>
            </div>

            {logType === 'system' && (
              <div className="system-logs-container">
                <div className="system-logs-sidebar">
                  <h3>📁 Log Files</h3>
                  <ul>
                    {logFiles.map(f => (
                      <li
                        key={f.name}
                        onClick={() => loadLogContent(f)}
                        className={activeLogFile?.name === f.name ? 'active' : ''}
                      >
                        <span>{f.name}</span>
                        <small>{(f.size / 1024).toFixed(1)} KB</small>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="system-logs-content">
                  <textarea
                    readOnly
                    value={logContent}
                    placeholder="Select a log file to view..."
                  />
                </div>
              </div>
            )}

            {logType === 'scripts' && (
              <div className="script-logs">
                {/* Script Selector Row */}
                <div className="log-controls">
                  <select
                    value={selectedScript}
                    onChange={(e) => {
                      setSearchTerm('');
                      setLogOffset(0);
                      setQuickFilter('all');
                      loadScriptLog(e.target.value);
                    }}
                    style={{ flex: 1, padding: '10px', border: '1px solid #4b5563', borderRadius: '6px', background: '#374151', color: '#e5e7eb', maxWidth: '400px' }}
                  >
                    <option value="">Select a script...</option>
                    {scriptLogs.map(log => (
                      <option key={log.script} value={log.script}>
                        {log.script} ({(log.size / 1024).toFixed(1)} KB, {log.lines} lines)
                      </option>
                    ))}
                  </select>

                  <div className="log-actions">
                    <button
                      onClick={() => downloadScriptLog(selectedScript)}
                      disabled={!selectedScript}
                      className="btn-secondary"
                    >
                      📥 Download
                    </button>
                    <button
                      onClick={refreshScriptLog}
                      disabled={!selectedScript || isRefreshing}
                      className="btn-secondary"
                    >
                      {isRefreshing ? <span className="spinner-small" /> : '🔄'} Refresh
                    </button>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9ca3af', fontSize: '13px' }}>
                      <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                      />
                      Auto-refresh
                      {autoRefresh && <span className="pulse-dot" title="Auto-refresh active" />}
                    </label>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="log-search" style={{ marginBottom: '12px' }}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="🔍 Search in log... (press / to focus)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        setLogOffset(0);
                        loadScriptLog(selectedScript, 0);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #4b5563',
                      borderRadius: '6px',
                      background: '#374151',
                      color: '#e5e7eb',
                      fontSize: '14px'
                    }}
                  />
                </div>

                {/* Quick Filter Chips */}
                {scriptLogContent && (
                  <div className="quick-filters">
                    {filterChips.map(chip => {
                      const counts = getLogCounts(scriptLogContent);
                      return (
                        <button
                          key={chip.id}
                          className={`filter-chip ${quickFilter === chip.id ? 'active' : ''}`}
                          onClick={() => setQuickFilter(chip.id)}
                        >
                          {chip.icon} {chip.label}
                          <span className="count">{counts[chip.id] || 0}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Enhanced Log Content */}
                <div className="log-lines-container">
                  {!scriptLogContent ? (
                    <div className="log-empty-state">
                      <div className="icon">📋</div>
                      <p>No log content available.</p>
                      <p>Select a script to view logs.</p>
                    </div>
                  ) : (
                    getProcessedLogLines(scriptLogContent).map((line) => (
                      <div
                        key={line.number}
                        className={`log-line ${line.severity}`}
                        onClick={() => handleCopyLine(line.content)}
                        title="Click to copy"
                      >
                        <span className="log-line-number">{line.number}</span>
                        <span className="log-line-content">
                          {highlightSearchTerm(line.content, searchTerm)}
                        </span>
                      </div>
                    ))
                  )}
                  {scriptLogContent && getProcessedLogLines(scriptLogContent).length === 0 && (
                    <div className="log-empty-state">
                      <div className="icon">🔍</div>
                      <p>No logs match the current filter.</p>
                      <button
                        className="btn-secondary"
                        onClick={() => setQuickFilter('all')}
                        style={{ marginTop: '12px' }}
                      >
                        Show All Logs
                      </button>
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {selectedScript && (
                  <div className="log-pagination" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '15px',
                    padding: '12px',
                    background: '#374151',
                    borderRadius: '6px'
                  }}>
                    <button
                      onClick={loadPreviousPage}
                      disabled={logOffset === 0}
                      className="btn-secondary"
                    >
                      ← Previous
                    </button>
                    <span style={{ fontSize: '14px', color: '#9ca3af' }}>
                      Lines {logOffset + 1} - {Math.min(logOffset + logLimit, totalLines)} of {totalLines}
                    </span>
                    <button
                      onClick={loadNextPage}
                      disabled={!hasMore}
                      className="btn-secondary"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CRON TAB */}
        {activeTab === 'cron' && (
          <div className="cron-view">
            {/* Timezone Info Banner */}
            <div style={{
              background: '#fef3c7',
              border: '1px solid #fbbf24',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '15px',
              fontSize: '0.9em',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '1.2em' }}>ℹ️</span>
              <span>All cron job times are in <strong>UTC</strong> timezone (server time).</span>
            </div>

            <div className="cron-header">
              <h3>Scheduled Jobs</h3>
              <button className="btn-primary" onClick={() => { setIsEditingJob(false); setShowJobForm(true); setJobForm({ name: '', script: availableScripts[0] || '', cron: '* * * * *', enabled: true }) }}>
                + Add Job
              </button>
            </div>

            {/* Job Form */}
            {showJobForm && (
              <div className="job-form">
                <input placeholder="Job Name" value={jobForm.name} onChange={e => setJobForm({ ...jobForm, name: e.target.value })} disabled={isEditingJob} />
                <select value={jobForm.script} onChange={e => setJobForm({ ...jobForm, script: e.target.value })}>
                  <option value="">Select Script</option>
                  {availableScripts.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input placeholder="Cron Expression (e.g. 0 10 * * 1)" value={jobForm.cron} onChange={e => setJobForm({ ...jobForm, cron: e.target.value })} />
                <CronBuilder value={jobForm.cron} onChange={(newCron) => setJobForm({ ...jobForm, cron: newCron })} />
                <label>
                  <input type="checkbox" checked={jobForm.enabled} onChange={e => setJobForm({ ...jobForm, enabled: e.target.checked })} /> Enabled
                </label>
                <button onClick={handleSaveJob}>Save</button>
                <button onClick={() => { setShowJobForm(false); setJobForm({ name: '', script: '', cron: '', enabled: true }); }}>Cancel</button>
              </div>
            )}

            <table className="cron-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Script</th>
                  <th>Schedule</th>
                  <th>Status</th>
                  <th>Last Run</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cronJobs.map(job => (
                  <tr key={job.name} className={!job.enabled ? 'disabled' : ''}>
                    <td>{job.name}</td>
                    <td>{job.script}</td>
                    <td><code>{job.cron}</code></td>
                    <td>
                      <span className={`status-badge ${job.enabled ? 'active' : 'inactive'}`}>
                        {job.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td>{job.lastRun ? `${new Date(job.lastRun).toLocaleString()} (${job.lastStatus})` : 'Never'}</td>
                    <td className="actions">
                      <button onClick={() => handleToggleJob(job)}>{job.enabled ? 'Disable' : 'Enable'}</button>
                      <button onClick={() => handleRunJob(job.name)}>Run Now</button>
                      <button onClick={() => { setIsEditingJob(true); setShowJobForm(true); setJobForm(job); }}>Edit</button>
                      <button className="btn-danger" onClick={() => handleDeleteJob(job.name)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* BACKUPS TAB */}
        {activeTab === 'backups' && (
          <div className="backups-view">
            <h3>Backup Files</h3>
            <table className="backups-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Size</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {backupFiles.map(f => (
                  <tr key={f.name}>
                    <td>{f.name}</td>
                    <td>{(f.size / 1024 / 1024).toFixed(2)} MB</td>
                    <td>{new Date(f.created).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHealth;
