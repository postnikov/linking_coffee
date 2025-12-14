import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './AdminHealth.css'; // We'll create this locally

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
