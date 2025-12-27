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
  }, []); // Run once on mount (or when value prop changes if you want bidirectional sync, but careful of loops)

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
  const { t } = useTranslation();
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
  }, [activeTab]);

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
        const text = await res.text();
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

  const refreshScriptLog = () => {
    if (selectedScript) {
      loadScriptLog(selectedScript, logOffset);
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
  }, [autoRefresh, logType, selectedScript, logOffset, searchTerm]);

  // Update log type handler
  useEffect(() => {
    if (logType === 'scripts' && scriptLogs.length === 0) {
      fetchScriptLogs();
    }
  }, [logType]);

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
    if(!window.confirm(`Delete job ${name}?`)) return;
    const data = await apiFetch('/api/admin/scheduler', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', job: { name } })
    });
    if (data) setCronJobs(data.jobs);
  };

  const handleRunJob = async (name) => {
    await apiFetch('/api/admin/scheduler/run', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    alert(`Job ${name} triggered! Check logs.`);
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
      alert(`${data.message}\nBot Name: @${data.bot?.username}`);
    }
  };

  if (!isAdmin) return <div className="p-4">Access Denied</div>;

  return (
    <div className="admin-health-container">
      <div className="tabs">
        <button className={activeTab === 'logs' ? 'active' : ''} onClick={() => setActiveTab('logs')}>Logs</button>
        <button className={activeTab === 'cron' ? 'active' : ''} onClick={() => setActiveTab('cron')}>Cron Scheduler</button>
        <button className={activeTab === 'backups' ? 'active' : ''} onClick={() => setActiveTab('backups')}>Backups</button>
        <button className="btn-secondary" style={{marginLeft: 'auto'}} onClick={handleTestBot}>Check Bot Health 🤖</button>
      </div>

      <div className="tab-content">
        {loading && <div className="loader">Loading...</div>}
        {error && <div className="error-msg">{error}</div>}

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="logs-view">
            <div className="logs-tabs" style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setLogType('system')}
                className={logType === 'system' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '8px 16px' }}
              >
                System Logs
              </button>
              <button
                onClick={() => setLogType('scripts')}
                className={logType === 'scripts' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '8px 16px' }}
              >
                Script Logs
              </button>
            </div>

            {logType === 'system' && (
              <div className="logs-view" style={{ display: 'flex', gap: '15px', height: '600px' }}>
                <div className="logs-sidebar" style={{ width: '250px', borderRight: '1px solid #e5e7eb', paddingRight: '15px' }}>
                  <h3>Log Files</h3>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {logFiles.map(f => (
                      <li
                        key={f.name}
                        onClick={() => loadLogContent(f)}
                        className={activeLogFile?.name === f.name ? 'active' : ''}
                        style={{
                          padding: '8px',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          marginBottom: '5px',
                          background: activeLogFile?.name === f.name ? '#3b82f6' : '#f9fafb',
                          color: activeLogFile?.name === f.name ? 'white' : 'black'
                        }}
                      >
                        {f.name} <small>({(f.size / 1024).toFixed(1)} KB)</small>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="logs-display" style={{ flex: 1 }}>
                  <textarea
                    readOnly
                    value={logContent}
                    placeholder="Select a log file to view..."
                    style={{
                      width: '100%',
                      height: '100%',
                      fontFamily: 'monospace',
                      padding: '10px',
                      background: '#1f2937',
                      color: '#f3f4f6',
                      border: '1px solid #374151',
                      borderRadius: '4px'
                    }}
                  />
                </div>
              </div>
            )}

            {logType === 'scripts' && (
              <div className="script-logs">
                <div className="script-selector" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                  <select
                    value={selectedScript}
                    onChange={(e) => {
                      setSearchTerm('');
                      setLogOffset(0);
                      loadScriptLog(e.target.value);
                    }}
                    style={{ flex: 1, padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  >
                    <option value="">Select a script...</option>
                    {scriptLogs.map(log => (
                      <option key={log.script} value={log.script}>
                        {log.script} ({(log.size / 1024).toFixed(1)} KB, {log.lines} lines)
                      </option>
                    ))}
                  </select>

                  <div className="log-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      onClick={() => downloadScriptLog(selectedScript)}
                      disabled={!selectedScript}
                      className="btn-secondary"
                      style={{ padding: '8px 12px' }}
                    >
                      Download
                    </button>
                    <button
                      onClick={refreshScriptLog}
                      disabled={!selectedScript}
                      className="btn-secondary"
                      style={{ padding: '8px 12px' }}
                    >
                      Refresh
                    </button>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                      />
                      Auto-refresh (5s)
                    </label>
                  </div>
                </div>

                <div className="log-search" style={{ marginBottom: '15px' }}>
                  <input
                    type="text"
                    placeholder="Search in log..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        setLogOffset(0);
                        loadScriptLog(selectedScript, 0);
                      }
                    }}
                    style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  />
                  <small style={{ color: '#6b7280', marginTop: '5px', display: 'block' }}>
                    Press Enter to search
                  </small>
                </div>

                <div className="log-content" style={{
                  background: '#1f2937',
                  color: '#f3f4f6',
                  padding: '15px',
                  borderRadius: '4px',
                  maxHeight: '600px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  lineHeight: '1.5'
                }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                    {scriptLogContent || 'No log content available. Select a script to view logs.'}
                  </pre>
                </div>

                {selectedScript && (
                  <div className="log-pagination" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '15px',
                    padding: '10px',
                    background: '#f9fafb',
                    borderRadius: '4px'
                  }}>
                    <button
                      onClick={loadPreviousPage}
                      disabled={logOffset === 0}
                      className="btn-secondary"
                      style={{ padding: '6px 12px' }}
                    >
                      Previous
                    </button>
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>
                      Lines {logOffset + 1} - {Math.min(logOffset + logLimit, totalLines)} of {totalLines}
                    </span>
                    <button
                      onClick={loadNextPage}
                      disabled={!hasMore}
                      className="btn-secondary"
                      style={{ padding: '6px 12px' }}
                    >
                      Next
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
                 <input placeholder="Job Name" value={jobForm.name} onChange={e => setJobForm({...jobForm, name: e.target.value})} disabled={isEditingJob} />
                 <select value={jobForm.script} onChange={e => setJobForm({...jobForm, script: e.target.value})}>
                   <option value="">Select Script</option>
                   {availableScripts.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
                 <input placeholder="Cron Expression (e.g. 0 10 * * 1)" value={jobForm.cron} onChange={e => setJobForm({...jobForm, cron: e.target.value})} />
                 <CronBuilder value={jobForm.cron} onChange={(newCron) => setJobForm({ ...jobForm, cron: newCron })} />
                 <label>
                   <input type="checkbox" checked={jobForm.enabled} onChange={e => setJobForm({...jobForm, enabled: e.target.checked})} /> Enabled
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
    </div>
  );
};

export default AdminHealth;
