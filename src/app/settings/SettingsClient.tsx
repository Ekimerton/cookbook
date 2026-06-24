'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  saveSettingsAction, 
  initializeGitRepoAction, 
  syncGitAction, 
  cloneGitRepoAction 
} from '../actions';

interface GitStatus {
  initialized: boolean;
  remoteUrl: string;
  branch: string;
  uncommittedCount: number;
  modifiedFiles: string[];
  lastCommit: string | null;
  error?: string;
}

interface SettingsClientProps {
  initialGitRepo: string;
  initialGitStatus: GitStatus;
}

export default function SettingsClient({
  initialGitRepo,
  initialGitStatus,
}: SettingsClientProps) {
  const [gitRepo, setGitRepo] = useState(initialGitRepo);
  const [gitStatus, setGitStatus] = useState<GitStatus>(initialGitStatus);
  
  // Status states
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  
  const [gitLoading, setGitLoading] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string>('');
  const [terminalError, setTerminalError] = useState<string>('');
  const [showCloneConfirm, setShowCloneConfirm] = useState(false);

  async function handleSaveRemote(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess(false);
    setTerminalLogs('Saving remote repository URL...');
    setTerminalError('');

    try {
      const res = await saveSettingsAction({
        RECIPE_GIT_REPO: gitRepo,
      });

      if (res.success) {
        setSettingsSuccess(true);
        setTerminalLogs('Remote URL saved successfully!');
        
        // Reload git status to reflect any new remote configuration
        const statusRes = await fetchGitStatus();
        if (statusRes) setGitStatus(statusRes);
        
        setTimeout(() => setSettingsSuccess(false), 3000);
      } else {
        setTerminalError(res.error || 'Failed to save remote URL.');
      }
    } catch (err: any) {
      setTerminalError(err.message || 'An unexpected error occurred.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function fetchGitStatus() {
    try {
      const { getGitStatusAction } = await import('../actions');
      const res = await getGitStatusAction();
      if (res.success && res.data) {
        return res.data;
      }
    } catch (e) {
      console.error('Failed to reload git status:', e);
    }
    return null;
  }

  async function handleInitRepo() {
    setGitLoading(true);
    setTerminalLogs('Initializing Git repository in data/recipes...');
    setTerminalError('');
    try {
      const res = await initializeGitRepoAction();
      if (res.success) {
        setTerminalLogs(`Git Repository Initialized!\n\n${res.output}`);
        const status = await fetchGitStatus();
        if (status) setGitStatus(status);
      } else {
        setTerminalError(res.error || 'Failed to initialize Git repository.');
        if (res.output) setTerminalLogs(res.output);
      }
    } catch (err: any) {
      setTerminalError(err.message || 'An error occurred during Git initialization.');
    } finally {
      setGitLoading(false);
    }
  }

  async function handleSync(type: 'push' | 'pull') {
    setGitLoading(true);
    setTerminalLogs(`${type === 'pull' ? 'Pulling changes from' : 'Pushing changes to'} remote repository...`);
    setTerminalError('');
    try {
      const res = await syncGitAction(type);
      if (res.success) {
        setTerminalLogs(`Git ${type} completed successfully!\n\n${res.output}`);
        const status = await fetchGitStatus();
        if (status) setGitStatus(status);
      } else {
        setTerminalError(res.error || `Failed to ${type} changes.`);
        if (res.output) setTerminalLogs(res.output);
      }
    } catch (err: any) {
      setTerminalError(err.message || `An error occurred during Git ${type}.`);
    } finally {
      setGitLoading(false);
    }
  }

  async function handleCloneRepo() {
    setShowCloneConfirm(false);
    setGitLoading(true);
    setTerminalLogs(`Cloning repository from ${gitRepo}...`);
    setTerminalError('');
    try {
      const res = await cloneGitRepoAction(gitRepo);
      if (res.success) {
        setTerminalLogs(`Repository cloned successfully!\n\n${res.output}`);
        const status = await fetchGitStatus();
        if (status) setGitStatus(status);
      } else {
        setTerminalError(res.error || 'Failed to clone repository.');
        if (res.output) setTerminalLogs(res.output);
      }
    } catch (err: any) {
      setTerminalError(err.message || 'An error occurred during clone.');
    } finally {
      setGitLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="32" 
          height="32" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="var(--primary)" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.5 1z"></path>
        </svg>
        <h1 style={{ fontSize: '2.25rem', margin: 0 }}>Git Settings</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Git Repository Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ marginBottom: '0.25rem' }}>Local Repository Status</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Local storage location: <code style={{ color: 'var(--primary)' }}>data/recipes/</code>
              </p>
            </div>
            {gitStatus.initialized ? (
              <span className="badge badge-primary" style={{ backgroundColor: '#e8f5e9', color: '#2e7d32' }}>Initialized</span>
            ) : (
              <span className="badge" style={{ backgroundColor: '#ffebee', color: '#c62828' }}>Not Initialized</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Git Remote URL Configuration form */}
            <form onSubmit={handleSaveRemote} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="git-repo" style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>Git Remote URL</label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <input
                    id="git-repo"
                    type="text"
                    className="form-input"
                    value={gitRepo}
                    onChange={(e) => setGitRepo(e.target.value)}
                    placeholder="git@github.com:username/recipes-repo.git"
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={savingSettings || gitLoading}
                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}
                  >
                    {savingSettings ? 'Saving...' : 'Save Remote'}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                  Remote Git repository URL to back up and sync your recipes with.
                </p>
                {settingsSuccess && (
                  <span style={{ color: '#2e7d32', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    URL Saved
                  </span>
                )}
              </div>
            </form>

            {gitStatus.initialized ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', fontSize: '0.95rem' }}>
                  <div style={{ color: 'var(--text-secondary)' }}>Current Branch:</div>
                  <div style={{ fontWeight: 600 }}>{gitStatus.branch}</div>

                  <div style={{ color: 'var(--text-secondary)' }}>Configured Remote URL:</div>
                  <div style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {gitStatus.remoteUrl || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>None configured</span>}
                  </div>

                  <div style={{ color: 'var(--text-secondary)' }}>Last Commit:</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{gitStatus.lastCommit}</div>

                  <div style={{ color: 'var(--text-secondary)' }}>Local Changes:</div>
                  <div>
                    {gitStatus.uncommittedCount > 0 ? (
                      <span style={{ color: '#ef6c00', fontWeight: 600 }}>
                        {gitStatus.uncommittedCount} file(s) modified (unsynced)
                      </span>
                    ) : (
                      <span style={{ color: '#2e7d32' }}>Working directory clean</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <button
                    onClick={() => handleSync('pull')}
                    className="btn btn-outline"
                    disabled={gitLoading || savingSettings || !gitStatus.remoteUrl}
                    title={!gitStatus.remoteUrl ? 'Set a remote Git URL to enable sync' : ''}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <polyline points="19 12 12 19 5 12"></polyline>
                    </svg>
                    Pull from Remote
                  </button>

                  <button
                    onClick={() => handleSync('push')}
                    className="btn btn-outline"
                    disabled={gitLoading || savingSettings || !gitStatus.remoteUrl}
                    title={!gitStatus.remoteUrl ? 'Set a remote Git URL to enable sync' : ''}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
                      <line x1="12" y1="19" x2="12" y2="5"></line>
                      <polyline points="5 12 12 5 19 12"></polyline>
                    </svg>
                    Push to Remote
                  </button>

                  {gitStatus.remoteUrl && !gitStatus.lastCommit?.includes('No commits yet') && (
                    <button
                      onClick={() => setShowCloneConfirm(true)}
                      className="btn btn-outline"
                      style={{ borderColor: '#c62828', color: '#c62828' }}
                      disabled={gitLoading || savingSettings}
                    >
                      Import/Overwrite Local Repo
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', padding: '1rem 0', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '450px' }}>
                  Your recipe folder is not initialized as a git repository yet. Click below to initialize Git, automatically stage and commit all existing recipes, and set it up for syncing.
                </p>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    onClick={handleInitRepo}
                    className="btn btn-primary"
                    disabled={gitLoading || savingSettings}
                  >
                    Initialize Repository
                  </button>
                  {gitRepo && (
                    <button
                      onClick={() => setShowCloneConfirm(true)}
                      className="btn btn-secondary"
                      disabled={gitLoading || savingSettings}
                    >
                      Clone/Import from Remote URL
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Confirm Overwrite/Clone dialog */}
            {showCloneConfirm && (
              <div style={{
                backgroundColor: 'var(--bg-color)',
                border: '2px solid #ef6c00',
                borderRadius: 'var(--radius-sm)',
                padding: '1.5rem',
                marginTop: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <h4 style={{ color: '#ef6c00', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  Warning: Backup and Import
                </h4>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  Importing will rename your current local recipes directory to a backup directory (e.g., <code>recipes_backup_&lt;timestamp&gt;</code>) and clone the remote repository URL:
                  <br />
                  <code style={{ wordBreak: 'break-all', display: 'block', margin: '0.5rem 0', padding: '0.25rem', backgroundColor: 'var(--border-color)', borderRadius: '4px' }}>
                    {gitRepo}
                  </code>
                  Are you sure you want to proceed?
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowCloneConfirm(false)} className="btn btn-outline" disabled={gitLoading}>
                    Cancel
                  </button>
                  <button onClick={handleCloneRepo} className="btn btn-primary" style={{ backgroundColor: '#ef6c00' }} disabled={gitLoading}>
                    Yes, Backup & Import
                  </button>
                </div>
              </div>
            )}

            {/* Terminal Console Output */}
            {(terminalLogs || terminalError) && (
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Operation Logs
                </div>
                <div style={{
                  backgroundColor: '#1e1e1e',
                  color: terminalError ? '#f44336' : '#4caf50',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  padding: '1rem',
                  borderRadius: '6px',
                  whiteSpace: 'pre-wrap',
                  overflowX: 'auto',
                  maxHeight: '250px',
                  border: '1px solid #333'
                }}>
                  {terminalError ? `ERROR: ${terminalError}\n\n` : ''}
                  {terminalLogs}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <Link href="/" className="btn btn-outline" style={{ display: 'inline-flex', padding: '0.5rem 1.25rem' }}>
          Back to Recipes
        </Link>
      </div>
    </div>
  );
}
