#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec, spawnSync } = require('child_process');
const readline = require('readline');
const os = require('os');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const command = process.argv[2];

function showHelp() {
  console.log('Usage: atris <command>');
  console.log('Commands:');
  console.log('  init       - Initialize ATRIS in current project');
  console.log('  agent      - Select agent for this workspace');
  console.log('  activate   - Load context and start chat with ATRIS agents');
  console.log('  status     - Show system state (tasks, inbox, recent completions)');
  console.log('  analytics  - Show insights from journal (velocity, trends, patterns)');
  console.log('  plan       - Activate navigator (brainstorm and create tasks)');
  console.log('  do         - Activate executor (build tasks from TASK_CONTEXTS)');
  console.log('  review     - Activate validator (verify, test, clean docs)');
  console.log('  chat       - Interactive chat with ATRIS agents');
  console.log('  visualize  - Break down ideas from inbox with 3-4 sentences + ASCII diagram');
  console.log('  log        - View or append to today\'s log');
  console.log('  log sync   - Sync today\'s log to Atris journal');
  console.log('  update     - Update local files from package to latest version');
  console.log('  version    - Show ATRIS version');
  console.log('  login      - Authenticate with AtrisOS (optional, enables cloud sync)');
  console.log('  logout     - Remove stored credentials');
  console.log('  whoami     - Show current authentication status');
  console.log('  help       - Show this help message');
}

if (!command || command === 'help' || command === '--help' || command === '-h') {
  showHelp();
  process.exit(0);
}

// Command handlers
if (command === 'init') {
  initAtris();
} else if (command === 'agent') {
  agentAtris();
} else if (command === 'log') {
  const subcommand = process.argv[3];
  if (subcommand === 'sync') {
    logSyncAtris()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(`✗ Log sync failed: ${error.message || error}`);
        process.exit(1);
      });
  } else {
    logAtris();
  }
} else if (command === 'activate') {
  activateAtris();
} else if (command === 'update') {
  syncAtris();
} else if (command === 'chat') {
  chatAtris()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(`✗ Chat failed: ${error.message || error}`);
      process.exit(1);
    });
} else if (command === 'version') {
  showVersion();
} else if (command === 'login') {
  loginAtris();
} else if (command === 'logout') {
  logoutAtris();
} else if (command === 'whoami') {
  whoamiAtris();
} else if (command === 'visualize') {
  visualizeAtris();
} else if (command === 'plan') {
  planAtris();
} else if (command === 'do') {
  doAtris();
} else if (command === 'review') {
  reviewAtris();
} else if (command === 'status') {
  statusAtris();
} else if (command === 'analytics') {
  analyticsAtris();
} else {
  console.log(`Unknown command: ${command}`);
  console.log('Run "atris help" to see available commands');
  process.exit(1);
}

function initAtris() {
  const targetDir = path.join(process.cwd(), 'atris');
  const agentTeamDir = path.join(targetDir, 'agent_team');
  const sourceFile = path.join(__dirname, '..', 'atris.md');
  const targetFile = path.join(targetDir, 'atris.md');

  // Create atris/ folder structure
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log('✓ Created atris/ folder');
  } else {
    console.log('✓ atris/ folder already exists');
  }

  // Create agent_team/ subfolder
  if (!fs.existsSync(agentTeamDir)) {
    fs.mkdirSync(agentTeamDir, { recursive: true });
    console.log('✓ Created atris/agent_team/ folder');
  }

  // Create placeholder files
  const gettingStartedFile = path.join(targetDir, 'GETTING_STARTED.md');
  const personaFile = path.join(targetDir, 'PERSONA.md');
  const mapFile = path.join(targetDir, 'MAP.md');
  const taskContextsFile = path.join(targetDir, 'TASK_CONTEXTS.md');
  const navigatorFile = path.join(agentTeamDir, 'navigator.md');
  const executorFile = path.join(agentTeamDir, 'executor.md');
  const validatorFile = path.join(agentTeamDir, 'validator.md');

  const gettingStartedSource = path.join(__dirname, '..', 'GETTING_STARTED.md');
  const personaSource = path.join(__dirname, '..', 'PERSONA.md');

  // Copy GETTING_STARTED.md
  if (!fs.existsSync(gettingStartedFile) && fs.existsSync(gettingStartedSource)) {
    fs.copyFileSync(gettingStartedSource, gettingStartedFile);
    console.log('✓ Created GETTING_STARTED.md');
  }

  // Copy PERSONA.md
  if (!fs.existsSync(personaFile) && fs.existsSync(personaSource)) {
    fs.copyFileSync(personaSource, personaFile);
    console.log('✓ Created PERSONA.md');
  }

  if (!fs.existsSync(mapFile)) {
    fs.writeFileSync(mapFile, '# MAP.md\n\n> Generated by your AI agent after reading atris.md\n\nRun your AI agent with atris.md to populate this file.\n');
    console.log('✓ Created MAP.md placeholder');
  }

  if (!fs.existsSync(taskContextsFile)) {
    fs.writeFileSync(taskContextsFile, '# TASK_CONTEXTS.md\n\n> Generated by your AI agent after reading atris.md\n\nRun your AI agent with atris.md to populate this file.\n');
    console.log('✓ Created TASK_CONTEXTS.md placeholder');
  }

  // Copy agent templates from package
  const navigatorSource = path.join(__dirname, '..', 'atris', 'agent_team', 'navigator.md');
  const executorSource = path.join(__dirname, '..', 'atris', 'agent_team', 'executor.md');
  const validatorSource = path.join(__dirname, '..', 'atris', 'agent_team', 'validator.md');

  if (!fs.existsSync(navigatorFile) && fs.existsSync(navigatorSource)) {
    fs.copyFileSync(navigatorSource, navigatorFile);
    console.log('✓ Created agent_team/navigator.md');
  }

  if (!fs.existsSync(executorFile) && fs.existsSync(executorSource)) {
    fs.copyFileSync(executorSource, executorFile);
    console.log('✓ Created agent_team/executor.md');
  }

  if (!fs.existsSync(validatorFile) && fs.existsSync(validatorSource)) {
    fs.copyFileSync(validatorSource, validatorFile);
    console.log('✓ Created agent_team/validator.md');
  }

  // Copy atris.md to the folder
  if (fs.existsSync(sourceFile)) {
    fs.copyFileSync(sourceFile, targetFile);
    console.log('✓ Copied atris.md to atris/ folder');
    console.log('\n✨ ATRIS initialized! Full structure created:');
    console.log('   atris/');
    console.log('   ├── GETTING_STARTED.md (read this first!)');
    console.log('   ├── PERSONA.md (agent personality)');
    console.log('   ├── atris.md (AI agent instructions)');
    console.log('   ├── MAP.md (placeholder)');
    console.log('   ├── TASK_CONTEXTS.md (placeholder)');
    console.log('   └── agent_team/');
    console.log('       ├── navigator.md (placeholder)');
    console.log('       ├── executor.md (placeholder)');
    console.log('       └── validator.md (placeholder)');
    console.log('\nNext steps:');
    console.log('1. Read atris/GETTING_STARTED.md for the full guide');
    console.log('2. Open atris/atris.md and paste it to your AI agent');
    console.log('3. Your agent will populate all placeholder files in ~10 mins');
  } else {
    console.error('✗ Error: atris.md not found in package');
    process.exit(1);
  }
}

function syncAtris() {
  const targetDir = path.join(process.cwd(), 'atris');
  const agentTeamDir = path.join(targetDir, 'agent_team');

  // Check if atris/ folder exists
  if (!fs.existsSync(targetDir)) {
    console.error('✗ Error: atris/ folder not found. Run "atris init" first.');
    process.exit(1);
  }

  // Ensure agent_team folder exists
  if (!fs.existsSync(agentTeamDir)) {
    fs.mkdirSync(agentTeamDir, { recursive: true });
  }

  // Files to sync
  const filesToSync = [
    { source: 'atris.md', target: 'atris.md' },
    { source: 'PERSONA.md', target: 'PERSONA.md' },
    { source: 'GETTING_STARTED.md', target: 'GETTING_STARTED.md' },
    { source: 'atris/agent_team/navigator.md', target: 'agent_team/navigator.md' },
    { source: 'atris/agent_team/executor.md', target: 'agent_team/executor.md' },
    { source: 'atris/agent_team/validator.md', target: 'agent_team/validator.md' }
  ];

  let updated = 0;
  let skipped = 0;

  filesToSync.forEach(({ source, target }) => {
    const sourceFile = path.join(__dirname, '..', source);
    const targetFile = path.join(targetDir, target);

    if (!fs.existsSync(sourceFile)) {
      console.log(`⚠ Skipping ${source} (not found in package)`);
      return;
    }

    const currentContent = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, 'utf8') : '';
    const newContent = fs.readFileSync(sourceFile, 'utf8');

    if (currentContent === newContent) {
      skipped++;
      return;
    }

    fs.copyFileSync(sourceFile, targetFile);
    console.log(`✓ Updated ${target}`);
    updated++;
  });

  if (updated === 0) {
    console.log('✓ Already up to date');
  } else {
    console.log(`\n✓ Updated ${updated} file(s), ${skipped} unchanged`);
    console.log('\nRun your AI agent again to use the latest specs and agent templates.');
  }
}

// ============================================
// Log System
// ============================================

function getLogPath(dateStr) {
  const targetDir = path.join(process.cwd(), 'atris');
  const date = dateStr ? new Date(dateStr) : new Date();
  const year = date.getFullYear();
  const dateFormatted = date.toISOString().split('T')[0]; // YYYY-MM-DD

  const logsDir = path.join(targetDir, 'logs');
  const yearDir = path.join(logsDir, year.toString());
  const logFile = path.join(yearDir, `${dateFormatted}.md`);

  return { logsDir, yearDir, logFile, dateFormatted };
}

function ensureLogDirectory() {
  const { logsDir, yearDir } = getLogPath();

  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  if (!fs.existsSync(yearDir)) {
    fs.mkdirSync(yearDir, { recursive: true });
  }
}

function createLogFile(logFile, dateFormatted) {
  const initialContent = `# Log — ${dateFormatted}\n\n## Completed ✅\n\n---\n\n## In Progress 🔄\n\n---\n\n## Backlog\n\n---\n\n## Notes\n\n---\n\n## Inbox\n\n`;
  fs.writeFileSync(logFile, initialContent);
}

function logAtris() {
  const targetDir = path.join(process.cwd(), 'atris');

  // Check if atris/ folder exists
  if (!fs.existsSync(targetDir)) {
    console.error('✗ Error: atris/ folder not found. Run "atris init" first.');
    process.exit(1);
  }

  // Ensure log directory exists
  ensureLogDirectory();
  const { logFile, dateFormatted } = getLogPath();

  // Create log file if doesn't exist
  if (!fs.existsSync(logFile)) {
    createLogFile(logFile, dateFormatted);
  }

  // Start interactive logging session
  console.log(`┌─────────────────────────────────────────────────────────┐`);
  console.log(`│ Daily Log — ${dateFormatted}              [type "exit" to quit] │`);
  console.log(`└─────────────────────────────────────────────────────────┘`);
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> '
  });

  rl.prompt();

  rl.on('line', (line) => {
    const input = line.trim();

    if (input.toLowerCase() === 'exit') {
      console.log('\n✓ Log saved');
      rl.close();
      process.exit(0);
    }

    if (input) {
      const entry = `- ${input}\n`;
      fs.appendFileSync(logFile, entry);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

function appendLog(message) {
  ensureLogDirectory();
  const { logFile, dateFormatted } = getLogPath();

  // Create log file if doesn't exist
  if (!fs.existsSync(logFile)) {
    createLogFile(logFile, dateFormatted);
    console.log(`✓ Created log for ${dateFormatted}`);
  }

  // Append message with timestamp
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  const entry = `**${timestamp}** — ${message}\n\n`;

  fs.appendFileSync(logFile, entry);
  console.log(`✓ Added to ${dateFormatted} log`);
}

async function logSyncAtris() {
  const targetDir = path.join(process.cwd(), 'atris');

  if (!fs.existsSync(targetDir)) {
    throw new Error('atris/ folder not found. Run "atris init" first.');
  }

  // Determine date (today by default, allow optional 4th arg or --date=)
  let dateArg = process.argv[4];
  if (dateArg && dateArg.startsWith('--date=')) {
    dateArg = dateArg.split('=')[1];
  }

  let { logsDir, yearDir, logFile, dateFormatted } = getLogPath(dateArg);
  if (Number.isNaN(new Date(dateFormatted).getTime())) {
    throw new Error(`Invalid date provided: ${dateArg}`);
  }

  // Ensure log directory and file exist
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  if (!fs.existsSync(yearDir)) {
    fs.mkdirSync(yearDir, { recursive: true });
  }
  if (!fs.existsSync(logFile)) {
    createLogFile(logFile, dateFormatted);
    console.log(`Created local log template for ${dateFormatted}. Fill it in before syncing.`);
  }

  const localContent = fs.readFileSync(logFile, 'utf8');
  const localHash = computeContentHash(localContent);

  // Ensure agent selected
  const config = loadConfig();
  if (!config.agent_id) {
    throw new Error('No agent selected. Run "atris agent" first.');
  }

  // Ensure credentials
  const ensured = await ensureValidCredentials();
  if (ensured.error) {
    if (ensured.error === 'not_logged_in') {
      throw new Error('Not logged in. Run "atris login" first.');
    }
    if (ensured.detail && ensured.detail.toLowerCase().includes('enotfound')) {
      throw new Error('Unable to reach Atris API. Check your network connection.');
    }
    throw new Error(ensured.detail || ensured.error || 'Authentication failed');
  }

  const credentials = ensured.credentials;
  const agentId = config.agent_id;
  const agentLabel = config.agent_name || agentId;

  console.log(`🔄 Syncing log for ${dateFormatted} with agent "${agentLabel}"`);

  // Check existing remote entry (best effort)
  const syncState = loadLogSyncState();
  const knownRemoteUpdate = syncState[dateFormatted]?.updated_at || null;
  const knownRemoteHash = syncState[dateFormatted]?.hash || null;

  let remoteExists = false;
  let remoteUpdatedAt = null;
  let remoteContent = null;
  let remoteHash = null;
  const existing = await apiRequestJson(`/agents/${agentId}/journal/${dateFormatted}`, {
    method: 'GET',
    token: credentials.token,
  });

  if (existing.ok) {
    remoteExists = true;
    remoteUpdatedAt = existing.data?.updated_at || existing.data?.created_at || null;
    remoteContent = typeof existing.data?.content === 'string' ? existing.data.content : null;
    remoteHash = remoteContent ? computeContentHash(remoteContent) : null;

    // Bidirectional sync: check if remote is newer
    if (remoteUpdatedAt) {
      const localStats = fs.statSync(logFile);
      const localModified = localStats.mtime.toISOString();
      const remoteTime = new Date(remoteUpdatedAt).getTime();
      const localTime = new Date(localModified).getTime();

      const remoteMatchesKnown = (knownRemoteUpdate && isSameTimestamp(remoteUpdatedAt, knownRemoteUpdate))
        || (remoteHash && knownRemoteHash && remoteHash === knownRemoteHash);

      if (remoteTime > localTime && !remoteMatchesKnown) {
        const normalizedRemote = remoteContent ? remoteContent.replace(/\r\n/g, '\n') : null;
        const normalizedLocal = localContent.replace(/\r\n/g, '\n');
        if (normalizedRemote !== null && normalizedRemote.trim() === normalizedLocal.trim()) {
          const remoteDate = new Date(remoteUpdatedAt);
          if (!Number.isNaN(remoteDate.getTime())) {
            fs.utimesSync(logFile, remoteDate, remoteDate);
            const state = loadLogSyncState();
            state[dateFormatted] = {
              updated_at: remoteUpdatedAt,
              hash: remoteHash || knownRemoteHash || computeContentHash(remoteContent || ''),
            };
            saveLogSyncState(state);
          }
          console.log('✓ Already synced (timestamps aligned with web)');
          return;
        }

        // Remote is newer - prompt user
        console.log('⚠️  Web version is newer than local version');
        console.log(`   Remote updated: ${remoteUpdatedAt}`);
        console.log(`   Local modified: ${localModified}`);
        console.log('   Type "y" to replace your local file with the web version, or "n" to keep local changes and push them to the web.');
        console.log('');

        if (typeof remoteContent === 'string') {
          showLogDiff(logFile, remoteContent);
        }

        const answer = await promptUser('Overwrite local with web version? (y/n): ');

        if (answer && answer.toLowerCase() === 'y') {
          // Pull remote content
          const pulledContent = existing.data?.content || '';
          fs.writeFileSync(logFile, pulledContent, 'utf8');
          remoteHash = computeContentHash(pulledContent);
          console.log('✓ Local journal updated from web');
          console.log(`🗒️  File: ${path.relative(process.cwd(), logFile)}`);
          if (remoteUpdatedAt) {
            const remoteDate = new Date(remoteUpdatedAt);
            if (!Number.isNaN(remoteDate.getTime())) {
              fs.utimesSync(logFile, remoteDate, remoteDate);
            }
            const state = loadLogSyncState();
            state[dateFormatted] = {
              updated_at: remoteUpdatedAt,
              hash: remoteHash || computeContentHash(pulledContent),
            };
            saveLogSyncState(state);
          }
          return;
        } else {
          console.log('⏩ Keeping local version, will push to web');
        }
      } else if (remoteTime > localTime && remoteMatchesKnown) {
        console.log('⚠️  Web timestamp ahead due to clock skew (matches last sync); pushing local changes.');
      } else if (remoteTime === localTime) {
        console.log('✓ Already synced (local and web are identical)');
        if (remoteUpdatedAt) {
          const state = loadLogSyncState();
          state[dateFormatted] = {
            updated_at: remoteUpdatedAt,
            hash: remoteHash || knownRemoteHash || computeContentHash(remoteContent || ''),
          };
          saveLogSyncState(state);
        }
        return;
      }
    }
  } else if (!existing.status) {
    throw new Error('Unable to reach Atris API. Check your network connection.');
  } else if (existing.status && existing.status !== 404) {
    throw new Error(existing.error || 'Failed to check existing journal entry');
  }

  const payload = {
    content: localContent,
    metadata: {
      source: 'cli',
      local_path: `logs/${dateFormatted}.md`,
    },
  };

  const result = await apiRequestJson(`/agents/${agentId}/journal/${dateFormatted}`, {
    method: 'PUT',
    token: credentials.token,
    body: payload,
  });

  if (!result.ok) {
    if (!result.status) {
      throw new Error('Unable to reach Atris API. Check your network connection.');
    }
    throw new Error(result.error || 'Failed to sync journal entry');
  }

  const data = result.data || {};
  const updatedAt = data.updated_at || new Date().toISOString();

  if (remoteExists) {
    console.log(`✓ Updated journal entry (previous update: ${remoteUpdatedAt || 'unknown'})`);
  } else {
    console.log('✓ Created journal entry in Atris');
  }

  console.log(`🗒️  Local file: ${path.relative(process.cwd(), logFile)}`);
  console.log(`🕒 Updated at: ${updatedAt}`);
  const updatedDate = new Date(updatedAt);
  if (!Number.isNaN(updatedDate.getTime())) {
    fs.utimesSync(logFile, updatedDate, updatedDate);
  }
  const finalContent = fs.readFileSync(logFile, 'utf8');
  const finalHash = computeContentHash(finalContent);
  const finalState = loadLogSyncState();
  finalState[dateFormatted] = {
    updated_at: updatedAt,
    hash: finalHash,
  };
  saveLogSyncState(finalState);
  console.log('');
  console.log('Next: open the dashboard journal to verify formatting, or run this command after edits to stay in sync.');
}

function showTodayLog() {
  const { logFile, dateFormatted } = getLogPath();

  if (!fs.existsSync(logFile)) {
    console.log(`No log for today (${dateFormatted})`);
    console.log('\nCreate one with: atris log "your message"');
    process.exit(0);
  }

  const content = fs.readFileSync(logFile, 'utf8');
  console.log(content);
}

function showRecentLogs() {
  const { logsDir, yearDir } = getLogPath();

  if (!fs.existsSync(logsDir) || !fs.existsSync(yearDir)) {
    console.log('No logs found');
    console.log('\nCreate one with: atris log "your message"');
    process.exit(0);
  }

  // Get all log files in current year directory
  const files = fs.readdirSync(yearDir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse()
    .slice(0, 3); // Last 3 days

  if (files.length === 0) {
    console.log('No logs found');
    process.exit(0);
  }

  console.log(`\n📋 Last ${files.length} day(s) of logs:\n`);
  console.log('='.repeat(60) + '\n');

  files.reverse().forEach((file, index) => {
    const filePath = path.join(yearDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(content);

    // Add separator between days
    if (index < files.length - 1) {
      console.log('─'.repeat(60) + '\n');
    }
  });
}

// ============================================
// Authentication & Credentials Management
// ============================================

function getCredentialsPath() {
  const homeDir = os.homedir();
  const atrisDir = path.join(homeDir, '.atris');

  // Create .atris directory if it doesn't exist
  if (!fs.existsSync(atrisDir)) {
    fs.mkdirSync(atrisDir, { recursive: true });
  }

  return path.join(atrisDir, 'credentials.json');
}

function saveCredentials(token, refreshToken, email, userId, provider) {
  const credentialsPath = getCredentialsPath();
  const credentials = {
    token,
    refresh_token: refreshToken || null,
    email: email || null,
    user_id: userId || null,
    provider: provider || null,
    saved_at: new Date().toISOString()
  };

  fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
}

function loadCredentials() {
  const credentialsPath = getCredentialsPath();

  if (!fs.existsSync(credentialsPath)) {
    return null;
  }

  try {
    const data = fs.readFileSync(credentialsPath, 'utf8');
    const parsed = JSON.parse(data);
    if (!parsed.provider) {
      parsed.provider = null;
    }
    if (!parsed.saved_at && parsed.created_at) {
      parsed.saved_at = parsed.created_at;
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

function deleteCredentials() {
  const credentialsPath = getCredentialsPath();

  if (fs.existsSync(credentialsPath)) {
    fs.unlinkSync(credentialsPath);
  }
}

function getApiBaseUrl() {
  const raw = process.env.ATRIS_API_URL || 'https://api.atris.ai/api';
  return raw.replace(/\/$/, '');
}

function getAppBaseUrl() {
  const raw = process.env.ATRIS_APP_URL || 'https://atris.ai';
  return raw.replace(/\/$/, '');
}

function buildApiUrl(pathname) {
  const base = getApiBaseUrl();
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${normalizedPath}`;
}

async function apiRequestJson(pathname, options = {}) {
  const url = buildApiUrl(pathname);
  const headers = { ...(options.headers || {}) };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let bodyPayload;
  if (options.body !== undefined && options.body !== null) {
    if (typeof options.body === 'string' || Buffer.isBuffer(options.body)) {
      bodyPayload = options.body;
    } else {
      bodyPayload = JSON.stringify(options.body);
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }
  }

  try {
    const result = await httpRequest(url, {
      method: options.method || 'GET',
      headers,
      body: bodyPayload,
    });

    const text = result.body.toString('utf8');
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    const ok = result.status >= 200 && result.status < 300;
    const errorMessage = !ok
      ? (data && typeof data === 'object' && (data.detail || data.error || data.message)) || text || 'Request failed'
      : undefined;

    return {
      ok,
      status: result.status,
      data,
      text,
      error: errorMessage,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      text: '',
      error: error.message || 'Network error',
    };
  }
}

function httpRequest(urlString, options) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlString);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    const requestOptions = {
      method: options.method || 'GET',
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: `${parsed.pathname}${parsed.search}`,
      headers: { ...(options.headers || {}) },
    };

    const req = transport.request(requestOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      if (!req.hasHeader('Content-Length')) {
        req.setHeader('Content-Length', Buffer.byteLength(options.body));
      }
      req.write(options.body);
    }

    req.end();
  });
}

async function validateAccessToken(token) {
  if (!token) {
    return { ok: false, status: 0, error: 'Missing token' };
  }
  return apiRequestJson('/auth/validate', {
    method: 'POST',
    body: { token },
    token,
  });
}

async function refreshAccessToken(refreshToken, provider) {
  if (!refreshToken) {
    return { ok: false, status: 0, error: 'Missing refresh token' };
  }
  const body = { refresh_token: refreshToken };
  if (provider) {
    body.provider = provider;
  }
  return apiRequestJson('/auth/refresh', {
    method: 'POST',
    body,
  });
}

async function ensureValidCredentials(options = {}) {
  const credentials = loadCredentials();
  if (!credentials || !credentials.token) {
    return { error: 'not_logged_in' };
  }

  const validation = await validateAccessToken(credentials.token);
  if (validation.ok && validation.data?.valid) {
    const user = validation.data.user || null;
    const updatedEmail = user?.email || credentials.email;
    const updatedProvider = user?.provider || credentials.provider;
    const updatedUserId = user?.id || credentials.user_id;

    if (
      updatedEmail !== credentials.email ||
      updatedProvider !== credentials.provider ||
      updatedUserId !== credentials.user_id
    ) {
      saveCredentials(
        credentials.token,
        credentials.refresh_token,
        updatedEmail,
        updatedUserId,
        updatedProvider
      );
    }

    return {
      credentials: loadCredentials(),
      user,
      source: 'access_token',
    };
  }

  if (!credentials.refresh_token) {
    return { error: 'token_invalid', detail: validation.error || 'Token expired' };
  }

  const refreshed = await refreshAccessToken(credentials.refresh_token, credentials.provider);
  if (!refreshed.ok) {
    return { error: 'refresh_failed', detail: refreshed.error };
  }

  const accessToken = refreshed.data?.access_token;
  const newRefreshToken = refreshed.data?.refresh_token || credentials.refresh_token;
  const refreshUser = refreshed.data?.user || null;
  const provider = refreshed.data?.provider || credentials.provider;
  const email = refreshUser?.email || credentials.email;
  const userId = refreshUser?.id || credentials.user_id;

  if (!accessToken) {
    return { error: 'refresh_failed', detail: 'No access token returned by refresh API' };
  }

  saveCredentials(accessToken, newRefreshToken, email, userId, provider);
  const latestValidation = await validateAccessToken(accessToken);
  const finalUser =
    latestValidation.ok && latestValidation.data?.valid
      ? latestValidation.data.user || refreshUser
      : refreshUser;

  return {
    credentials: loadCredentials(),
    user: finalUser,
    source: 'refreshed',
  };
}

async function fetchMyAgents(token) {
  if (!token) {
    return null;
  }

  const response = await apiRequestJson('/agent/my-agents', {
    method: 'GET',
    token,
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(response.error || 'Failed to fetch agents');
  }

  return response.data;
}

async function displayAccountSummary() {
  const ensured = await ensureValidCredentials();

  if (ensured.error) {
    console.log('Status: Not logged in');
    if (ensured.detail) {
      console.log(`Reason: ${ensured.detail}`);
    }
    return { error: ensured.error, detail: ensured.detail };
  }

  const { credentials, user } = ensured;
  const email = user?.email || credentials.email || 'unknown';
  const userId = user?.id || credentials.user_id || 'unknown';
  const provider = user?.provider || credentials.provider || 'unknown';
  const savedAt = credentials.saved_at || 'unknown';

  console.log('Status: Logged in ✓');
  console.log(`Email: ${email}`);
  console.log(`User ID: ${userId}`);
  console.log(`Provider: ${provider}`);
  console.log(`Credentials saved: ${savedAt}`);
  console.log(`Credential file: ${getCredentialsPath()}`);

  try {
    const agentsResponse = await fetchMyAgents(credentials.token);
    if (agentsResponse && agentsResponse.my_agents) {
      const agents = agentsResponse.my_agents;
      const total = agentsResponse.total ?? agents.length;
      console.log(`Agents: ${total}`);
      agents.slice(0, 5).forEach((agent) => {
        const name = agent.name || agent.id || 'Unnamed agent';
        console.log(`  • ${name}`);
      });
      if (total > 5) {
        console.log(`  …and ${total - 5} more`);
      }
    }
  } catch (error) {
    console.log(`Agents: Unable to load (${error.message})`);
  }

  return { credentials, user };
}

function openBrowser(url) {
  const platform = os.platform();
  let command;

  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, (error) => {
    if (error) {
      console.log(`\nCouldn't open browser automatically. Please visit:\n${url}`);
    }
  });
}

function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function loginAtris() {
  try {
    console.log('🔐 Login to AtrisOS\n');

    const existing = loadCredentials();
    if (existing) {
      const label = existing.email || existing.user_id || 'unknown user';
      console.log(`Already logged in as: ${label}`);
      const confirm = await promptUser('Do you want to login again? (y/N): ');
      if (confirm.toLowerCase() !== 'y') {
        console.log('Login cancelled.');
        process.exit(0);
      }
    }

    console.log('Choose login method:');
    console.log('  1. Browser OAuth (recommended)');
    console.log('  2. Paste existing API token');
    console.log('  3. Cancel');

    const choice = await promptUser('\nEnter choice (1-3): ');

    if (choice === '1') {
      const loginUrl = `${getAppBaseUrl()}/auth/cli`;
      console.log('\n🌐 Opening browser for OAuth login…');
      console.log('If it does not open automatically, visit:');
      console.log(loginUrl);
      console.log('\nAfter signing in, copy the CLI code shown in the browser and paste it below.');
      console.log('Codes expire after five minutes.\n');

      openBrowser(loginUrl);

      const code = await promptUser('Paste the CLI code here: ');
      if (!code) {
        console.error('✗ Error: Code is required');
        process.exit(1);
      }

      const exchange = await apiRequestJson('/auth/cli/exchange', {
        method: 'POST',
        body: { code: code.trim() },
      });

      if (!exchange.ok || !exchange.data) {
        console.error(`✗ Error: ${exchange.error || 'Invalid or expired code'}`);
        process.exit(1);
      }

      const payload = exchange.data;
      const token = payload.token;
      const refreshToken = payload.refresh_token;

      if (!token || !refreshToken) {
        console.error('✗ Error: Backend did not return tokens. Please try again.');
        process.exit(1);
      }

      const email = payload.email || existing?.email || null;
      const userId = payload.user_id || existing?.user_id || null;
      const provider = payload.provider || 'atris';

      saveCredentials(token, refreshToken, email, userId, provider);
      console.log('\n✓ Successfully logged in!');
      await displayAccountSummary();
      console.log('\nYou can now use cloud features with atris commands.');
      process.exit(0);
    } else if (choice === '2') {
      console.log('\n📋 Manual Token Entry');
      console.log('Get your token from: https://app.atris.ai/settings/api\n');

      const tokenInput = await promptUser('Paste your API token: ');

      if (!tokenInput) {
        console.error('✗ Error: Token is required');
        process.exit(1);
      }

      const trimmed = tokenInput.trim();
      saveCredentials(trimmed, null, existing?.email || null, existing?.user_id || null, existing?.provider || 'manual');
      console.log('\nAttempting to validate token…\n');

      const summary = await displayAccountSummary();
      if (summary.error) {
        console.log('\n⚠️ Token saved, but validation failed. You may need to relogin.');
      } else {
        console.log('\n✓ Token validated successfully.');
      }

      console.log('\nYou can now use cloud features with atris commands.');
      process.exit(0);
    } else {
      console.log('Login cancelled.');
      process.exit(0);
    }
  } catch (error) {
    console.error(`\n✗ Login failed: ${error.message || error}`);
    process.exit(1);
  }
}

function logoutAtris() {
  const credentials = loadCredentials();

  if (!credentials) {
    console.log('Not currently logged in.');
    process.exit(0);
  }

  deleteCredentials();
  console.log('✓ Successfully logged out');
  console.log(`✓ Removed credentials from ${getCredentialsPath()}`);
}

async function whoamiAtris() {
  try {
    const summary = await displayAccountSummary();
    if (summary.error) {
      console.log('\nRun "atris login" to authenticate with AtrisOS.');
      process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    console.error(`✗ Failed to fetch account details: ${error.message || error}`);
    process.exit(1);
  }
}

function showVersion() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log(`atris v${packageJson.version}`);
  } catch (error) {
    console.error('✗ Error: Could not read package.json');
    process.exit(1);
  }
}

// ============================================
// Config Management
// ============================================

function getConfigPath() {
  const targetDir = path.join(process.cwd(), 'atris');
  return path.join(targetDir, '.config');
}

function loadConfig() {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const data = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

function saveConfig(config) {
  const configPath = getConfigPath();
  const targetDir = path.dirname(configPath);

  if (!fs.existsSync(targetDir)) {
    console.error('✗ Error: atris/ folder not found. Run "atris init" first.');
    process.exit(1);
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getLogSyncStatePath() {
  const targetDir = path.join(process.cwd(), 'atris');
  return path.join(targetDir, '.log_sync_state.json');
}

function loadLogSyncState() {
  const statePath = getLogSyncStatePath();
  if (!fs.existsSync(statePath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return {};
  }
}

function saveLogSyncState(state) {
  const statePath = getLogSyncStatePath();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function isSameTimestamp(a, b) {
  if (!a || !b) return false;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return false;
  return Math.abs(ta - tb) < 5;
}

function computeContentHash(content) {
  if (typeof content !== 'string') {
    return null;
  }

  const normalized = content.replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function showLogDiff(localPath, remoteContent) {
  let tmpDir;
  try {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atris-diff-'));
    const remotePath = path.join(tmpDir, 'remote.md');
    fs.writeFileSync(remotePath, remoteContent, 'utf8');

    const diffCommands = [
      { cmd: 'git', args: ['--no-pager', 'diff', '--no-index', '--color=always', '--', localPath, remotePath] },
      { cmd: 'diff', args: ['-u', localPath, remotePath] },
    ];

    let shown = false;
    for (const { cmd, args } of diffCommands) {
      const result = spawnSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      if (result.error || result.status === 127) {
        continue;
      }

      const output = `${result.stdout || ''}${result.stderr || ''}`.trimEnd();
      if (output) {
        console.log('─────────────────────────────────────────────────────────────');
        console.log('Diff (web -> local):');
        process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
        console.log('─────────────────────────────────────────────────────────────');
        shown = true;
        break;
      }
    }

    if (!shown) {
      console.log('─────────────────────────────────────────────────────────────');
      console.log('Diff: (no textual diff available; files may be identical or differ only in whitespace)');
      console.log('─────────────────────────────────────────────────────────────');
    }
  } catch (error) {
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`Unable to show diff automatically (${error.message || error}).`);
    console.log('─────────────────────────────────────────────────────────────');
  } finally {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (_) {
        // ignore cleanup errors
      }
    }
  }
}
// ============================================
// Agent Selection
// ============================================

async function agentAtris() {
  const targetDir = path.join(process.cwd(), 'atris');

  // Check if atris/ folder exists
  if (!fs.existsSync(targetDir)) {
    console.error('✗ Error: atris/ folder not found. Run "atris init" first.');
    process.exit(1);
  }

  // Check if logged in
  const credentials = loadCredentials();

  if (!credentials || !credentials.token) {
    console.error('✗ Error: Not logged in. Run "atris login" first.');
    process.exit(1);
  }

  console.log('🔍 Fetching your agents...\n');

  // Fetch agents from backend
  const result = await apiRequestJson('/agent/my-agents', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${credentials.token}`,
    },
  });

  if (!result.ok) {
    console.error(`✗ Error: ${result.error || 'Failed to fetch agents'}`);
    process.exit(1);
  }

  const agents = result.data?.my_agents || [];

  if (agents.length === 0) {
    console.log('No agents found. Create one at https://app.atris.ai');
    process.exit(0);
  }

  // Show current selection
  const config = loadConfig();
  if (config.agent_id) {
    const current = agents.find(a => a.id === config.agent_id);
    if (current) {
      console.log(`Current agent: ${current.name}\n`);
    }
  }

  // Display agents
  console.log('Available agents:');
  agents.forEach((agent, index) => {
    console.log(`  ${index + 1}. ${agent.name}`);
  });

  console.log('');

  // Prompt for selection
  const answer = await promptUser('Select agent number (or press Enter to cancel): ');

  if (!answer) {
    console.log('Cancelled.');
    process.exit(0);
  }

  const selection = parseInt(answer, 10);

  if (isNaN(selection) || selection < 1 || selection > agents.length) {
    console.error('✗ Invalid selection');
    process.exit(1);
  }

  const selectedAgent = agents[selection - 1];

  // Save to config
  config.agent_id = selectedAgent.id;
  config.agent_name = selectedAgent.name;
  saveConfig(config);

  console.log(`\n✓ Selected agent: ${selectedAgent.name}`);
  console.log(`✓ Config saved to atris/.config`);
  console.log(`\nYou can now use "atris chat" to talk with this agent.`);
}

async function activateAtris() {
  console.log('Loading context...');
  console.log('');

  // Check atris/ exists
  const targetDir = path.join(process.cwd(), 'atris');
  if (!fs.existsSync(targetDir)) {
    console.error('✗ Error: atris/ folder not found. Run "atris init" first.');
    process.exit(1);
  }

  const config = loadConfig();
  const credentials = loadCredentials();

  const hasAgent = Boolean(config.agent_id);
  const hasCredentials = Boolean(credentials && credentials.token);
  const agentLabel = hasAgent ? (config.agent_name || config.agent_id) : null;

  if (hasAgent) {
    console.log(`✓ Agent ready: ${agentLabel}`);
  } else {
    console.log('⚠ No agent selected. Run "atris agent" to set one when you want to chat.');
  }

  if (hasCredentials) {
    console.log('✓ Logged in to AtrisOS');
  } else {
    console.log('⚠ Not logged in. Run "atris login" to enable cloud sync and agent chat.');
  }
  console.log('');

  // Read today's log
  const { logFile, dateFormatted } = getLogPath();
  let logEntries = [];

  if (fs.existsSync(logFile)) {
    const logContent = fs.readFileSync(logFile, 'utf8');
    const lines = logContent.split('\n').filter(l => l.startsWith('**'));
    logEntries = lines.slice(0, 3); // Last 3 entries
  }

  console.log('✓ Today\'s log (' + logEntries.length + ' entries)');
  console.log('✓ MAP.md');
  console.log('✓ TASK_CONTEXTS.md');
  console.log('');
  console.log('─────────────────────────────────────────────');
  console.log('Recent log entries:');

  if (logEntries.length > 0) {
    logEntries.forEach(entry => {
      const text = entry.replace(/\*\*.*?\*\*\s*—\s*/, '- ');
      console.log(text);
    });
  } else {
    console.log('(no entries yet)');
  }

  console.log('─────────────────────────────────────────────');
  console.log('');
  console.log('✓ Context loaded');
  console.log('');
  if (hasAgent && hasCredentials) {
    console.log('Use "atris chat" to chat with your agent or "atris log" to edit your journal.');
  } else {
    console.log('Use "atris log" to edit your journal. When ready, run "atris agent" and "atris login" to chat with agents.');
  }
}

async function chatAtris() {
  // Get message from command line args
  const message = process.argv.slice(3).join(' ').trim();

  // Check atris/ exists
  const targetDir = path.join(process.cwd(), 'atris');
  if (!fs.existsSync(targetDir)) {
    console.error('✗ Error: atris/ folder not found. Run "atris init" first.');
    process.exit(1);
  }

  // Check agent selected
  const config = loadConfig();
  if (!config.agent_id) {
    console.error('✗ Error: No agent selected. Run "atris agent" first.');
    process.exit(1);
  }

  // Check credentials
  const credentials = loadCredentials();
  if (!credentials || !credentials.token) {
    console.error('✗ Error: Not logged in. Run "atris login" first.');
    process.exit(1);
  }

  // If message provided, one-shot mode
  if (message) {
    await chatOnce(config, credentials, message);
    return;
  }

  // Otherwise, interactive mode
  await chatInteractive(config, credentials);
}

async function chatOnce(config, credentials, message) {
  console.log(`\nAgent: ${config.agent_name || config.agent_id}`);
  console.log('');

  const agentId = config.agent_id;
  const apiUrl = 'https://api.atris.ai';
  const endpoint = `${apiUrl}/api/agent/${agentId}/pro-chat`;

  const body = JSON.stringify({
    message: message,
    stream: true,
    memory_enabled: true,
  });

  try {
    await streamProChat(endpoint, credentials.token, body);
    console.log('\n\n✓ Complete\n');
  } catch (error) {
    console.error(`\n✗ Error: ${error.message || error}`);
    process.exit(1);
  }
}

async function chatInteractive(config, credentials) {
  return new Promise((resolve) => {
    const agentId = config.agent_id;
    const agentName = config.agent_name || config.agent_id;
    const conversationId = `cli-${Date.now()}`;

    console.log('┌────────────────────────────────────────────────────────────┐');
    console.log(`│ ATRIS Chat — ${agentName.padEnd(43)} │`);
    console.log('├────────────────────────────────────────────────────────────┤');
    console.log('│ Type your message and press Enter                          │');
    console.log('│ Type "exit" to quit                                        │');
    console.log('└────────────────────────────────────────────────────────────┘');
    console.log('');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
    });

    rl.prompt();

    const handleLine = async (line) => {
      const input = line.trim();

      if (input.toLowerCase() === 'exit') {
        console.log('\n✓ Session saved\n');
        rl.close();
        resolve();
        return;
      }

      if (!input) {
        rl.prompt();
        return;
      }

      // Send to pro-chat
      console.log('');
      const apiUrl = 'https://api.atris.ai';
      const endpoint = `${apiUrl}/api/agent/${agentId}/pro-chat`;

      const body = JSON.stringify({
        message: input,
        conversation_id: conversationId,
        stream: true,
        memory_enabled: true,
      });

      try {
        await streamProChat(endpoint, credentials.token, body);
        console.log('\n');
      } catch (error) {
        console.error(`\n✗ Error: ${error.message || error}\n`);
      }

      rl.prompt();
    };

    rl.on('line', (line) => {
      // Pause readline while processing
      rl.pause();
      handleLine(line)
        .then(() => {
          rl.resume();
        })
        .catch((error) => {
          console.error(`\n✗ Error: ${error.message || error}\n`);
          rl.resume();
          rl.prompt();
        });
    });

    rl.on('close', () => {
      console.log('\nGoodbye!');
      resolve();
    });
  });
}

function visualizeAtris() {
  const { logFile, dateFormatted } = getLogPath();

  // Check if log exists
  if (!fs.existsSync(logFile)) {
    console.log('✗ No journal entry for today. Run "atris log" to create one.');
    process.exit(1);
  }

  // Read the log file
  const logContent = fs.readFileSync(logFile, 'utf8');

  // Extract Inbox section
  const inboxMatch = logContent.match(/## Inbox\n([\s\S]*?)(?=\n##|$)/);
  if (!inboxMatch || !inboxMatch[1].trim()) {
    console.log('✗ No items in Inbox. Add ideas to your journal first.');
    process.exit(1);
  }

  const inboxItems = inboxMatch[1]
    .trim()
    .split('\n')
    .filter(line => line.match(/^- \*\*I\d+:/))
    .map(line => {
      const match = line.match(/^- \*\*I\d+:\s+(.+)$|^- \*\*I\d+:\*\*\s*(.+)$/);
      return match ? (match[1] || match[2]) : line;
    });

  if (inboxItems.length === 0) {
    console.log('✗ No formatted inbox items. Use format: - **I#: Description**');
    process.exit(1);
  }

  // Display visualization template
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ ATRIS Visualize — Break Down & Approval Gate                │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');

  inboxItems.forEach((item, idx) => {
    console.log(`\n📌 Idea ${idx + 1}: ${item}`);
    console.log('─────────────────────────────────────────');
    console.log('AGENT PROMPT TEMPLATE:\n');
    console.log('1. Break this idea into 3-4 concrete steps.');
    console.log('2. Create ASCII diagram showing flow/structure.');
    console.log('3. Get user approval before creating task.\n');
    console.log('EXAMPLE ASCII (for UI ideas):');
    console.log('```');
    console.log('  Journal Entry');
    console.log('       ↓');
    console.log('  Extract Ideas');
    console.log('       ↓');
    console.log('  Visualize Plan');
    console.log('       ↓');
    console.log('  User Approval');
    console.log('       ↓');
    console.log('  Create Task');
    console.log('```\n');
  });

  console.log('─────────────────────────────────────────');
  console.log('✓ Ready to pass to agents with approval gate enabled.');
  console.log('');
}

function planAtris() {
  const targetDir = path.join(process.cwd(), 'atris');
  const navigatorFile = path.join(targetDir, 'agent_team', 'navigator.md');

  if (!fs.existsSync(navigatorFile)) {
    console.log('✗ navigator.md not found. Run "atris init" first.');
    process.exit(1);
  }

  // Read navigator.md
  const navigatorSpec = fs.readFileSync(navigatorFile, 'utf8');

  // Read journal Inbox for context
  const { logFile } = getLogPath();
  let inboxContext = '';

  if (fs.existsSync(logFile)) {
    const logContent = fs.readFileSync(logFile, 'utf8');
    const inboxMatch = logContent.match(/## Inbox\n([\s\S]*?)(?=\n##|$)/);
    if (inboxMatch && inboxMatch[1].trim()) {
      inboxContext = inboxMatch[1].trim();
    }
  }

  // Read TASK_CONTEXTS.md for current state
  const taskContextsFile = path.join(targetDir, 'TASK_CONTEXTS.md');
  let taskContexts = '';
  if (fs.existsSync(taskContextsFile)) {
    taskContexts = fs.readFileSync(taskContextsFile, 'utf8');
  }

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ ATRIS Plan — Navigator Agent Activated                      │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('📋 AGENT SPEC:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(navigatorSpec);
  console.log('');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log('📥 INBOX CONTEXT:');
  console.log('─────────────────────────────────────────────────────────────');
  if (inboxContext) {
    console.log(inboxContext);
  } else {
    console.log('(No items in Inbox)');
  }
  console.log('');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log('📝 CURRENT TASK_CONTEXTS.md:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(taskContexts);
  console.log('');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log('🎯 Now: Follow navigator spec to create tasks from Inbox');
  console.log('   ↳ Reminder: run "atris visualize" to capture approval (steps + ASCII) before writing new tasks.');
  console.log('');
}

function doAtris() {
  const targetDir = path.join(process.cwd(), 'atris');
  const executorFile = path.join(targetDir, 'agent_team', 'executor.md');

  if (!fs.existsSync(executorFile)) {
    console.log('✗ executor.md not found. Run "atris init" first.');
    process.exit(1);
  }

  // Read executor.md
  const executorSpec = fs.readFileSync(executorFile, 'utf8');

  // Read TASK_CONTEXTS.md
  const taskContextsFile = path.join(targetDir, 'TASK_CONTEXTS.md');
  let taskContexts = '';
  if (fs.existsSync(taskContextsFile)) {
    taskContexts = fs.readFileSync(taskContextsFile, 'utf8');
  }

  // Read MAP.md for reference
  const mapFile = path.join(targetDir, 'MAP.md');
  let mapContent = '';
  if (fs.existsSync(mapFile)) {
    mapContent = fs.readFileSync(mapFile, 'utf8');
  }

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ ATRIS Do — Executor Agent Activated                         │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('📋 AGENT SPEC:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(executorSpec);
  console.log('');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log('📝 TASK_CONTEXTS.md:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(taskContexts);
  console.log('');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log('🗺️  MAP.md REFERENCE:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(mapContent.substring(0, 500) + '... (truncated)');
  console.log('');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log('🎯 Now: Follow executor spec to build tasks from TASK_CONTEXTS.md');
  console.log('');
}

function reviewAtris() {
  const targetDir = path.join(process.cwd(), 'atris');
  const validatorFile = path.join(targetDir, 'agent_team', 'validator.md');

  if (!fs.existsSync(validatorFile)) {
    console.log('✗ validator.md not found. Run "atris init" first.');
    process.exit(1);
  }

  // Read validator.md
  const validatorSpec = fs.readFileSync(validatorFile, 'utf8');

  // Read TASK_CONTEXTS.md
  const taskContextsFile = path.join(targetDir, 'TASK_CONTEXTS.md');
  let taskContexts = '';
  if (fs.existsSync(taskContextsFile)) {
    taskContexts = fs.readFileSync(taskContextsFile, 'utf8');
  }

  // Read MAP.md
  const mapFile = path.join(targetDir, 'MAP.md');
  let mapContent = '';
  if (fs.existsSync(mapFile)) {
    mapContent = fs.readFileSync(mapFile, 'utf8');
  }

  // Read journal for timestamp context
  const { logFile, dateFormatted } = getLogPath();
  let journalPath = '';
  if (fs.existsSync(logFile)) {
    journalPath = path.relative(process.cwd(), logFile);
  }

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ ATRIS Review — Validator Agent Activated                    │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('📋 AGENT SPEC:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(validatorSpec);
  console.log('');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log('📝 TASK_CONTEXTS.md:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(taskContexts);
  console.log('');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log('🗺️  MAP.md REFERENCE:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(mapContent.substring(0, 500) + '... (truncated)');
  console.log('');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log('📅 JOURNAL: ' + (journalPath || 'Not found'));
  console.log('');
  console.log('🎯 Now: Use ultrathink → validate → update docs → clean TASK_CONTEXTS');
  console.log('');
}

function statusAtris() {
  const targetDir = path.join(process.cwd(), 'atris');

  if (!fs.existsSync(targetDir)) {
    console.log('✗ atris/ folder not found. Run "atris init" first.');
    process.exit(1);
  }

  // Read TASK_CONTEXTS.md for backlog and in-progress tasks
  const taskContextsFile = path.join(targetDir, 'TASK_CONTEXTS.md');
  let backlogTasks = [];
  let inProgressTasks = [];
  if (fs.existsSync(taskContextsFile)) {
    const taskContent = fs.readFileSync(taskContextsFile, 'utf8');

    // Extract Backlog
    const backlogMatch = taskContent.match(/## Backlog\n([\s\S]*?)(?=\n##|$)/);
    if (backlogMatch && backlogMatch[1].trim() && !backlogMatch[1].includes('(No active tasks)')) {
      const tasks = backlogMatch[1].trim().split('\n### ').filter(t => t.trim());
      backlogTasks = tasks.map(t => {
        const match = t.match(/Task:\s*(.+)/);
        return match ? match[1].substring(0, 60) : null;
      }).filter(Boolean);
    }

    // Extract In Progress
    const inProgressMatch = taskContent.match(/## In Progress\n([\s\S]*?)(?=\n##|$)/);
    if (inProgressMatch && inProgressMatch[1].trim() && !inProgressMatch[1].includes('Format:')) {
      const tasks = inProgressMatch[1].trim().split('\n### ').filter(t => t.trim() && !t.startsWith('(Tasks') && !t.startsWith('Format:'));
      inProgressTasks = tasks.map(t => {
        const titleMatch = t.match(/Task:\s*(.+)/);
        const claimMatch = t.match(/\*\*Claimed by:\*\*\s*(.+)/);
        if (titleMatch) {
          const title = titleMatch[1].substring(0, 40);
          const claimed = claimMatch ? claimMatch[1].substring(0, 20) : 'Unknown';
          return { title, claimed };
        }
        return null;
      }).filter(Boolean);
    }
  }

  // Read journal for inbox and completions
  const { logFile, dateFormatted } = getLogPath();
  let inboxItems = [];
  let completions = [];

  if (fs.existsSync(logFile)) {
    const logContent = fs.readFileSync(logFile, 'utf8');

    // Extract inbox
    const inboxMatch = logContent.match(/## Inbox\n([\s\S]*?)(?=\n##|$)/);
    if (inboxMatch && inboxMatch[1].trim()) {
      inboxItems = inboxMatch[1]
        .trim()
        .split('\n')
        .filter(l => l.match(/^- \*\*I\d+:/))
        .map(l => {
          const match = l.match(/^- \*\*I(\d+):\s+(.+)$|^- \*\*I(\d+):\*\*\s*(.+)$/);
          return match ? { id: match[1] || match[3], title: match[2] || match[4] } : null;
        })
        .filter(Boolean);
    }

    // Extract recent completions
    const completedMatch = logContent.match(/## Completed ✅\n([\s\S]*?)(?=\n##|---)/);
    if (completedMatch && completedMatch[1].trim()) {
      completions = completedMatch[1]
        .trim()
        .split('\n')
        .filter(l => l.match(/^- \*\*C\d+:/))
        .slice(-3)
        .map(l => {
          const match = l.match(/^- \*\*C(\d+):\s+(.+)$|^- \*\*C(\d+):\*\*\s*(.+)$/);
          return match ? { id: match[1] || match[3], title: match[2] || match[4] } : null;
        })
        .filter(Boolean);
    }
  }

  // Display status
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log(`│ ATRIS Status — ${dateFormatted}${' '.repeat(39 - dateFormatted.length)}│`);
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');

  // Backlog tasks
  console.log(`📋 Backlog (unclaimed): ${backlogTasks.length}`);
  if (backlogTasks.length > 0) {
    backlogTasks.forEach(t => {
      console.log(`   • ${t}${t.length > 60 ? '...' : ''}`);
    });
  } else {
    console.log('   (No backlog tasks)');
  }
  console.log('');

  // In Progress tasks
  console.log(`🔨 In Progress (claimed): ${inProgressTasks.length}`);
  if (inProgressTasks.length > 0) {
    inProgressTasks.forEach(t => {
      console.log(`   • ${t.title}${t.title.length > 40 ? '...' : ''}`);
      console.log(`     Claimed by: ${t.claimed}`);
    });
  } else {
    console.log('   (No tasks being worked on)');
  }
  console.log('');

  // Inbox
  console.log(`📥 Inbox Items: ${inboxItems.length}`);
  if (inboxItems.length > 0) {
    inboxItems.slice(0, 3).forEach(i => {
      console.log(`   • I${i.id}: ${i.title.substring(0, 50)}${i.title.length > 50 ? '...' : ''}`);
    });
    if (inboxItems.length > 3) {
      console.log(`   ... and ${inboxItems.length - 3} more`);
    }
  } else {
    console.log('   (No items in inbox)');
  }
  console.log('');

  // Recent completions
  console.log(`✅ Recent Completions: ${completions.length}`);
  if (completions.length > 0) {
    completions.forEach(c => {
      console.log(`   • C${c.id}: ${c.title.substring(0, 50)}${c.title.length > 50 ? '...' : ''}`);
    });
  } else {
    console.log('   (No completions yet)');
  }
  console.log('');

  console.log('─────────────────────────────────────────────────────────────');
  console.log('Next: atris plan → do → review (or atris log to add ideas)');
  console.log('');
}

function streamProChat(url, token, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    const requestOptions = {
      method: 'POST',
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept': 'text/event-stream',
      },
    };

    const req = transport.request(requestOptions, (res) => {
      if (res.statusCode !== 200) {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          reject(new Error(`HTTP ${res.statusCode}: ${text}`));
        });
        return;
      }

      let buffer = '';

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.chunk) {
                process.stdout.write(parsed.chunk);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      });

      res.on('end', () => {
        resolve();
      });

      res.on('error', (err) => {
        reject(err);
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

function analyticsAtris() {
  const targetDir = path.join(process.cwd(), 'atris');

  if (!fs.existsSync(targetDir)) {
    console.log('✗ atris/ folder not found. Run "atris init" first.');
    process.exit(1);
  }

  // Get date range (today + last 7 days)
  const today = new Date();
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date);
  }

  // Parse journals and collect data
  let totalCompletions = 0;
  let todayCompletions = 0;
  let todayInbox = 0;
  let oldestInbox = 0;
  const completionsByDay = {};
  const hourCounts = {};

  dates.forEach((date, index) => {
    const year = date.getFullYear();
    const dateFormatted = date.toISOString().split('T')[0];
    const logPath = path.join(targetDir, 'logs', year.toString(), `${dateFormatted}.md`);

    if (!fs.existsSync(logPath)) {
      completionsByDay[dateFormatted] = 0;
      return;
    }

    const content = fs.readFileSync(logPath, 'utf8');

    // Count completions (C# pattern)
    const completionMatches = content.match(/- \*\*C\d+:/g);
    const completionCount = completionMatches ? completionMatches.length : 0;
    completionsByDay[dateFormatted] = completionCount;
    totalCompletions += completionCount;

    if (index === 0) {
      todayCompletions = completionCount;

      // Count today's inbox
      const inboxMatch = content.match(/## Inbox\n([\s\S]*?)(?=\n##|---)/);
      if (inboxMatch && inboxMatch[1].trim()) {
        const inboxMatches = inboxMatch[1].match(/- \*\*I\d+:/g);
        todayInbox = inboxMatches ? inboxMatches.length : 0;
      }
    }

    if (index === 6) {
      // Count oldest day's inbox for trend
      const inboxMatch = content.match(/## Inbox\n([\s\S]*?)(?=\n##|---)/);
      if (inboxMatch && inboxMatch[1].trim()) {
        const inboxMatches = inboxMatch[1].match(/- \*\*I\d+:/g);
        oldestInbox = inboxMatches ? inboxMatches.length : 0;
      }
    }

    // Parse timestamps for productivity hours
    const timestampMatches = content.match(/\*\*(\d{2}):(\d{2}):(\d{2})\*\*/g);
    if (timestampMatches) {
      timestampMatches.forEach(ts => {
        const hour = parseInt(ts.match(/\d{2}/)[0]);
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
    }
  });

  // Calculate metrics
  const velocity = (totalCompletions / 7).toFixed(1);
  const inboxTrend = todayInbox > oldestInbox ? 'Growing ⬆' :
                     todayInbox < oldestInbox ? 'Shrinking ⬇' :
                     'Stable →';

  // Find most productive hour
  let mostProductiveHour = null;
  let maxCount = 0;
  Object.keys(hourCounts).forEach(hour => {
    if (hourCounts[hour] > maxCount) {
      maxCount = hourCounts[hour];
      mostProductiveHour = hour;
    }
  });

  const productiveHours = mostProductiveHour !== null ?
    `${mostProductiveHour}:00 - ${(parseInt(mostProductiveHour) + 1) % 24}:00` :
    'No data';

  // Display analytics
  const dateFormatted = today.toISOString().split('T')[0];
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log(`│ ATRIS Analytics — ${dateFormatted}${' '.repeat(33 - dateFormatted.length)}│`);
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');

  // Today's performance
  console.log(`📊 Today's Performance`);
  console.log(`   Completions: ${todayCompletions}`);
  console.log(`   Inbox items: ${todayInbox}`);
  console.log('');

  // Weekly trends
  console.log(`📈 Weekly Trends (Last 7 Days)`);
  console.log(`   Total completions: ${totalCompletions}`);
  console.log(`   Average velocity: ${velocity} completions/day`);
  console.log(`   Inbox trend: ${inboxTrend}`);
  console.log('');

  // Productivity patterns
  console.log(`⏰ Productivity Patterns`);
  console.log(`   Most active hour: ${productiveHours}`);
  console.log(`   Activity count: ${maxCount} timestamps`);
  console.log('');

  // Daily breakdown
  console.log(`📅 Daily Breakdown`);
  const sortedDates = Object.keys(completionsByDay).sort().reverse();
  sortedDates.forEach((date, index) => {
    const count = completionsByDay[date];
    const bar = '█'.repeat(count);
    const label = index === 0 ? ' (today)' : '';
    console.log(`   ${date}: ${bar} ${count}${label}`);
  });
  console.log('');

  console.log('─────────────────────────────────────────────────────────────');
  console.log('💡 Insight: This data syncs to backend via "atris log sync"');
  console.log('');
}
