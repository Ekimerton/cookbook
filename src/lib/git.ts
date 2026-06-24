import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { getSettings, saveSettings } from './settings';

const RECIPES_DIR = path.join(process.cwd(), 'data', 'recipes');

export interface GitStatus {
  initialized: boolean;
  remoteUrl: string;
  branch: string;
  uncommittedCount: number;
  modifiedFiles: string[];
  lastCommit: string | null;
  error?: string;
}

let gitQueue = Promise.resolve();

// Utility to run git command in recipes folder sequentially
function runGit(args: string[], cwd = RECIPES_DIR): Promise<{ stdout: string; stderr: string; code: number }> {
  const run = () => new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
    // Ensure dir exists if not cloning
    if (!fs.existsSync(cwd) && !args.includes('clone')) {
      fs.mkdirSync(cwd, { recursive: true });
    }

    const child = spawn('git', args, { cwd });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => stdout += data);
    child.stderr.on('data', (data) => stderr += data);

    child.on('close', (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code: code ?? 0
      });
    });
  });

  const nextPromise = gitQueue.then(run, run);
  gitQueue = nextPromise.then(() => {}, () => {});
  return nextPromise;
}

export async function getGitStatus(): Promise<GitStatus> {
  const gitDir = path.join(RECIPES_DIR, '.git');
  if (!fs.existsSync(gitDir)) {
    return {
      initialized: false,
      remoteUrl: '',
      branch: '',
      uncommittedCount: 0,
      modifiedFiles: [],
      lastCommit: null
    };
  }

  try {
    // 1. Get branch
    const branchRes = await runGit(['branch', '--show-current']);
    const branch = branchRes.code === 0 ? branchRes.stdout : 'unknown';

    // 2. Get remote
    const remoteRes = await runGit(['config', '--get', 'remote.origin.url']);
    const remoteUrl = remoteRes.code === 0 ? remoteRes.stdout : '';

    // 3. Get status
    const statusRes = await runGit(['status', '-s']);
    const modifiedFiles = statusRes.stdout
      ? statusRes.stdout.split('\n').map(line => line.trim()).filter(Boolean)
      : [];
    const uncommittedCount = modifiedFiles.length;

    // 4. Get last commit
    const logRes = await runGit(['log', '-1', '--format=%h - %s (%cr)']);
    const lastCommit = logRes.code === 0 ? logRes.stdout : 'No commits yet';

    return {
      initialized: true,
      remoteUrl,
      branch,
      uncommittedCount,
      modifiedFiles,
      lastCommit
    };
  } catch (err: any) {
    return {
      initialized: true,
      remoteUrl: '',
      branch: '',
      uncommittedCount: 0,
      modifiedFiles: [],
      lastCommit: null,
      error: err.message || String(err)
    };
  }
}

export async function initGitRepo(): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    if (!fs.existsSync(RECIPES_DIR)) {
      fs.mkdirSync(RECIPES_DIR, { recursive: true });
    }

    // Check if already initialized
    const gitDir = path.join(RECIPES_DIR, '.git');
    if (fs.existsSync(gitDir)) {
      return { success: true, output: 'Git repository already initialized.' };
    }

    // 1. git init
    let res = await runGit(['init']);
    let log = res.stdout + '\n' + res.stderr;
    if (res.code !== 0) throw new Error(`git init failed: ${res.stderr}`);

    // 2. rename branch to main
    res = await runGit(['branch', '-M', 'main']);
    log += '\n' + res.stdout + '\n' + res.stderr;

    // 3. git add .
    res = await runGit(['add', '.']);
    log += '\n' + res.stdout + '\n' + res.stderr;

    // 4. git commit
    // Check status first to see if there is anything to commit
    const statusRes = await runGit(['status', '-s']);
    if (statusRes.stdout.trim()) {
      res = await runGit(['commit', '-m', 'Initial recipe commit']);
      log += '\n' + res.stdout + '\n' + res.stderr;
      if (res.code !== 0) throw new Error(`git commit failed: ${res.stderr}`);
    } else {
      log += '\nNo files to commit.';
    }

    // Check if remote URL was set in settings.json
    const settings = getSettings();
    if (settings.RECIPE_GIT_REPO) {
      await configureRemote(settings.RECIPE_GIT_REPO);
      log += `\nConfigured remote origin to ${settings.RECIPE_GIT_REPO}`;
    }

    return { success: true, output: log.trim() };
  } catch (e: any) {
    return { success: false, output: '', error: e.message || String(e) };
  }
}

export async function configureRemote(url: string): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      // Remove remote origin if empty URL is saved
      const checkRemote = await runGit(['remote']);
      if (checkRemote.stdout.includes('origin')) {
        const res = await runGit(['remote', 'remove', 'origin']);
        // Update user-settings.json
        saveSettings({ RECIPE_GIT_REPO: '' });
        return { success: true, output: 'Remote origin removed successfully.' };
      }
      return { success: true, output: 'No remote origin configured.' };
    }

    // Check if remote origin already exists
    const checkRemote = await runGit(['remote']);
    let res;
    if (checkRemote.stdout.includes('origin')) {
      res = await runGit(['remote', 'set-url', 'origin', cleanUrl]);
    } else {
      res = await runGit(['remote', 'add', 'origin', cleanUrl]);
    }

    const log = res.stdout + '\n' + res.stderr;
    if (res.code !== 0) throw new Error(`Failed to configure remote: ${res.stderr}`);

    // Update settings file
    saveSettings({ RECIPE_GIT_REPO: cleanUrl });

    return { success: true, output: `Remote origin set to ${cleanUrl} successfully.\n` + log.trim() };
  } catch (e: any) {
    return { success: false, output: '', error: e.message || String(e) };
  }
}

export async function pullFromRemote(): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    const status = await getGitStatus();
    if (!status.initialized) {
      throw new Error('Repository is not initialized.');
    }
    if (!status.remoteUrl) {
      throw new Error('No remote origin URL is configured.');
    }

    const branch = status.branch || 'main';
    const res = await runGit(['pull', 'origin', branch, '--allow-unrelated-histories', '--no-rebase']);
    const log = res.stdout + '\n' + res.stderr;

    if (res.code !== 0) {
      return { success: false, output: log.trim(), error: `git pull failed with exit code ${res.code}` };
    }

    return { success: true, output: log.trim() };
  } catch (e: any) {
    return { success: false, output: '', error: e.message || String(e) };
  }
}

export async function pushToRemote(): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    const status = await getGitStatus();
    if (!status.initialized) {
      throw new Error('Repository is not initialized.');
    }
    if (!status.remoteUrl) {
      throw new Error('No remote origin URL is configured.');
    }

    // Commit any untracked or modified files automatically before pushing, just to be sure!
    if (status.uncommittedCount > 0) {
      await runGit(['add', '.']);
      await runGit(['commit', '-m', 'Save recipes (auto-sync)']);
    }

    const branch = status.branch || 'main';
    // Push and set upstream
    const res = await runGit(['push', '-u', 'origin', branch]);
    const log = res.stdout + '\n' + res.stderr;

    if (res.code !== 0) {
      return { success: false, output: log.trim(), error: `git push failed with exit code ${res.code}` };
    }

    return { success: true, output: log.trim() };
  } catch (e: any) {
    return { success: false, output: '', error: e.message || String(e) };
  }
}

export async function cloneRemote(url: string): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    const cleanUrl = url.trim();
    if (!cleanUrl) throw new Error('Valid repository URL is required for cloning.');

    const parentDir = path.dirname(RECIPES_DIR); // data/
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // If RECIPES_DIR already exists, back it up
    if (fs.existsSync(RECIPES_DIR)) {
      const backupDir = path.join(parentDir, `recipes_backup_${Date.now()}`);
      fs.renameSync(RECIPES_DIR, backupDir);
      console.log(`Backed up existing recipes directory to ${backupDir}`);
    }

    // Run git clone URL recipes inside parentDir
    const res = await runGit(['clone', cleanUrl, 'recipes'], parentDir);
    const log = res.stdout + '\n' + res.stderr;

    if (res.code !== 0) {
      throw new Error(`git clone failed: ${res.stderr}`);
    }

    // Save to settings
    saveSettings({ RECIPE_GIT_REPO: cleanUrl });

    return { success: true, output: `Cloned repository successfully into data/recipes.\n` + log.trim() };
  } catch (e: any) {
    return { success: false, output: '', error: e.message || String(e) };
  }
}
