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
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const headers = {
        'Content-Type': 'application/json',
        'x-admin-user': user.tg_username // Custom header for auth check
      };
      
      const res = await fetch(`${API_URL}${endpoint}?requester=${user.tg_username}`, {
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
    if (data) setLogFiles(data.files);
  };

  const loadLogContent = async (file) => {
    setActiveLogFile(file);
    const data = await apiFetch(`/api/admin/logs/view?file=${file.path}`);
    if (data) setLogContent(data.content);
  };

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

  if (!isAdmin) return <div className="p-4">Access Denied</div>;

  return (
    <div className="admin-health-container">
      <div className="tabs">
        <button className={activeTab === 'logs' ? 'active' : ''} onClick={() => setActiveTab('logs')}>Logs</button>
        <button className={activeTab === 'cron' ? 'active' : ''} onClick={() => setActiveTab('cron')}>Cron Scheduler</button>
        <button className={activeTab === 'backups' ? 'active' : ''} onClick={() => setActiveTab('backups')}>Backups</button>
      </div>

      <div className="tab-content">
        {loading && <div className="loader">Loading...</div>}
        {error && <div className="error-msg">{error}</div>}

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="logs-view">
            <div className="logs-sidebar">
              <h3>Log Files</h3>
              <ul>
                {logFiles.map(f => (
                  <li key={f.name} onClick={() => loadLogContent(f)} className={activeLogFile?.name === f.name ? 'active' : ''}>
                    {f.name} <small>({(f.size / 1024).toFixed(1)} KB)</small>
                  </li>
                ))}
              </ul>
            </div>
            <div className="logs-display">
              <textarea readOnly value={logContent} placeholder="Select a log file to view..." />
            </div>
          </div>
        )}

        {/* CRON TAB */}
        {activeTab === 'cron' && (
          <div className="cron-view">
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
