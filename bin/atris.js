#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec, spawnSync } = require('child_process');
const readline = require('readline');
const os = require('os');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');

let CLI_VERSION = 'unknown';
try {
  const pkgRaw = fs.readFileSync(PACKAGE_JSON_PATH, 'utf8');
  const pkg = JSON.parse(pkgRaw);
  if (pkg && typeof pkg.version === 'string') {
    CLI_VERSION = pkg.version;
  }
} catch {
  // Ignore parse errors; fall back to unknown
}

const DEFAULT_CLIENT_ID = `AtrisCLI/${CLI_VERSION}`;
const DEFAULT_USER_AGENT = `${DEFAULT_CLIENT_ID} (node ${process.version}; ${os.platform()} ${os.release()} ${os.arch()})`;

// Update check utility
const { checkForUpdates, showUpdateNotification } = require('../utils/update-check');

// Run update check in background (non-blocking)
// Skip for 'version' and 'update' commands to avoid redundant messages
let updateCheckPromise = null;
if (process.argv[2] && !['version', 'update', 'help'].includes(process.argv[2])) {
  updateCheckPromise = checkForUpdates()
    .then((updateInfo) => {
      // Show notification if update available (after command completes)
      if (updateInfo) {
        // Wait a bit for command output to finish, then show notification
        setTimeout(() => {
          showUpdateNotification(updateInfo);
        }, 100);
      }
      return updateInfo;
    })
    .catch(() => {
      // Silently fail - don't annoy users with update check errors
      return null;
    });
}

const command = process.argv[2];

const TOKEN_REFRESH_BUFFER_SECONDS = 300; // Refresh ~5 minutes before expiry

function decodeJwtClaims(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function getTokenExpiryEpochSeconds(token) {
  const claims = decodeJwtClaims(token);
  if (!claims || typeof claims.exp !== 'number') {
    return null;
  }
  return claims.exp;
}

function shouldRefreshToken(token, bufferSeconds = TOKEN_REFRESH_BUFFER_SECONDS) {
  const exp = getTokenExpiryEpochSeconds(token);
  if (!exp) {
    return false;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  return exp <= nowSeconds + bufferSeconds;
}

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
  console.log('  console    - Execute tasks autonomously via Claude SDK');
  console.log('  review     - Activate validator (verify, test, clean docs)');
  console.log('  launch     - Activate launcher (document, capture learnings, publish, celebrate)');
  console.log('  chat       - Interactive chat with ATRIS agents');
  console.log('  brainstorm - Generate structured brainstorm prompt for agents');
  console.log('  autopilot  - Guided plan → do → review loop with success criteria');
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

// Command handlers - using modular commands where available
const { initAtris: initCmd } = require('../commands/init');
const { syncAtris: syncCmd } = require('../commands/sync');
const { logAtris: logCmd } = require('../commands/log');
const { logSyncAtris: logSyncCmd } = require('../commands/log-sync');
const { brainstormAtris: brainstormCmd } = require('../commands/brainstorm');
const { loginAtris: loginCmd, logoutAtris: logoutCmd, whoamiAtris: whoamiCmd } = require('../commands/auth');
const { showVersion: versionCmd } = require('../commands/version');

if (command === 'init') {
  initCmd();
} else if (command === 'agent') {
  agentAtris();
} else if (command === 'log') {
  const subcommand = process.argv[3];
  if (subcommand === 'sync') {
    logSyncCmd()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(`✗ Log sync failed: ${error.message || error}`);
        process.exit(1);
      });
  } else {
    logCmd();
  }
} else if (command === 'activate') {
  activateAtris();
} else if (command === 'update') {
  syncCmd();
} else if (command === 'chat') {
  chatAtris()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(`✗ Chat failed: ${error.message || error}`);
      process.exit(1);
    });
} else if (command === 'version') {
  versionCmd();
} else if (command === 'login') {
  loginCmd();
} else if (command === 'logout') {
  logoutCmd();
} else if (command === 'whoami') {
  whoamiCmd();
} else if (command === 'visualize') {
  visualizeAtris();
} else if (command === 'plan') {
  planAtris();
} else if (command === 'do') {
  doAtris();
} else if (command === 'console') {
  consoleAtris()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(`✗ Console failed: ${error.message || error}`);
      process.exit(1);
    });
} else if (command === 'review') {
  reviewAtris();
} else if (command === 'launch') {
  launchAtris();
} else if (command === 'autopilot') {
  autopilotAtris()
    .then(() => process.exit(0))
    .catch((error) => {
      if (error && error.__autopilotAbort) {
        process.exit(0);
      }
      console.error(`✗ Autopilot failed: ${error.message || error}`);
      process.exit(1);
    });
} else if (command === 'brainstorm') {
  brainstormCmd()
    .then(() => process.exit(0))
    .catch((error) => {
      if (error && error.__brainstormAbort) {
        process.exit(0);
      }
      console.error(`✗ Brainstorm failed: ${error.message || error}`);
      process.exit(1);
    });
} else if (command === 'status') {
  const isQuick = process.argv.includes('--quick') || process.argv.includes('-q');
  statusAtris(isQuick);
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
  const launcherFile = path.join(agentTeamDir, 'launcher.md');

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
  const launcherSource = path.join(__dirname, '..', 'atris', 'agent_team', 'launcher.md');

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

  if (!fs.existsSync(launcherFile) && fs.existsSync(launcherSource)) {
    fs.copyFileSync(launcherSource, launcherFile);
    console.log('✓ Created agent_team/launcher.md');
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
    console.log('       ├── validator.md (placeholder)');
    console.log('       └── launcher.md (placeholder)');
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
    { source: 'atris/agent_team/validator.md', target: 'agent_team/validator.md' },
    { source: 'atris/agent_team/launcher.md', target: 'agent_team/launcher.md' }
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
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateFormatted = `${year}-${month}-${day}`; // YYYY-MM-DD in local time

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

        // Try section-based merge
        try {
          const localSections = parseJournalSections(normalizedLocal);
          const remoteSections = parseJournalSections(normalizedRemote || '');
          const { merged, conflicts } = mergeSections(localSections, remoteSections, knownRemoteHash);

          if (conflicts.length === 0) {
            // Clean merge - auto-merge and continue
            const mergedContent = reconstructJournal(merged);
            fs.writeFileSync(logFile, mergedContent, 'utf8');
            console.log('✓ Auto-merged web and local changes');
            console.log(`   Merged sections: ${Object.keys(merged).filter(k => k !== '__header__').join(', ')}`);
            // Update local content for push
            localContent = mergedContent;
          } else {
            // Conflicts detected - prompt user
            console.log('⚠️  Conflicting changes in same section(s)');
            console.log(`   Conflicts: ${conflicts.join(', ')}`);
            console.log(`   Remote updated: ${remoteUpdatedAt}`);
            console.log(`   Local modified: ${localModified}`);
            console.log('   Type "y" to replace local with web version, or "n" to keep local changes.');
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
          }
        } catch (parseError) {
          // Fallback to old prompt behavior if parsing fails
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
  if (!headers['User-Agent'] && !headers['user-agent']) {
    headers['User-Agent'] = DEFAULT_USER_AGENT;
  }
  if (!headers['X-Atris-Client']) {
    headers['X-Atris-Client'] = DEFAULT_CLIENT_ID;
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

async function performTokenRefresh(credentials, sourceLabel = 'refreshed') {
  if (!credentials || !credentials.refresh_token) {
    return { ok: false, error: 'missing_refresh_token' };
  }

  const refreshed = await refreshAccessToken(credentials.refresh_token, credentials.provider);
  if (!refreshed.ok) {
    return { ok: false, error: refreshed.error || 'Refresh request failed' };
  }

  const accessToken = refreshed.data?.access_token;
  if (!accessToken) {
    return { ok: false, error: 'No access token returned by refresh API' };
  }

  const newRefreshToken = refreshed.data?.refresh_token || credentials.refresh_token;
  const refreshUser = refreshed.data?.user || null;
  const provider = refreshed.data?.provider || credentials.provider;
  const email = refreshUser?.email || credentials.email;
  const userId = refreshUser?.id || credentials.user_id;

  saveCredentials(accessToken, newRefreshToken, email, userId, provider);
  let latestCreds = loadCredentials();

  const validation = await validateAccessToken(accessToken);
  let finalUser = refreshUser;

  if (validation.ok && validation.data?.valid) {
    finalUser = validation.data.user || refreshUser || null;
    const updatedEmail = finalUser?.email || latestCreds?.email || email;
    const updatedProvider = finalUser?.provider || latestCreds?.provider || provider;
    const updatedUserId = finalUser?.id || latestCreds?.user_id || userId;

    if (
      !latestCreds ||
      updatedEmail !== latestCreds.email ||
      updatedProvider !== latestCreds.provider ||
      updatedUserId !== latestCreds.user_id
    ) {
      saveCredentials(accessToken, newRefreshToken, updatedEmail, updatedUserId, updatedProvider);
      latestCreds = loadCredentials();
    }
  }

  return {
    ok: true,
    payload: {
      credentials: latestCreds || loadCredentials(),
      user: finalUser,
      source: sourceLabel,
    },
  };
}

async function ensureValidCredentials(options = {}) {
  let credentials = loadCredentials();
  if (!credentials || !credentials.token) {
    return { error: 'not_logged_in' };
  }

  if (credentials.refresh_token && shouldRefreshToken(credentials.token)) {
    const proactive = await performTokenRefresh(credentials, 'proactive_refresh');
    if (proactive.ok) {
      return proactive.payload;
    }
    credentials = loadCredentials() || credentials;
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

  const refreshed = await performTokenRefresh(credentials, 'refreshed');
  if (!refreshed.ok) {
    return { error: 'refresh_failed', detail: refreshed.error };
  }

  return refreshed.payload;
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
  try {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
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

function parseJournalSections(content) {
  const sections = {};
  const lines = content.split('\n');
  let currentSection = '__header__';
  let currentContent = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      // Save previous section
      if (currentContent.length > 0 || currentSection === '__header__') {
        sections[currentSection] = currentContent.join('\n');
      }
      // Start new section
      currentSection = line.substring(3).trim();
      currentContent = [line];
    } else {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentContent.length > 0) {
    sections[currentSection] = currentContent.join('\n');
  }

  return sections;
}

function mergeSections(localSections, remoteSections, knownRemoteHash) {
  const merged = {};
  const conflicts = [];

  // Get all unique section names
  const allSections = new Set([...Object.keys(localSections), ...Object.keys(remoteSections)]);

  for (const section of allSections) {
    const localContent = localSections[section] || '';
    const remoteContent = remoteSections[section] || '';

    if (localContent === remoteContent) {
      // Same content, use either
      merged[section] = localContent;
    } else if (!remoteContent) {
      // Only in local, keep local
      merged[section] = localContent;
    } else if (!localContent) {
      // Only in remote, keep remote
      merged[section] = remoteContent;
    } else {
      // Both exist but differ - check if remote matches known state
      const remoteHash = computeContentHash(remoteContent);
      if (knownRemoteHash && remoteHash === knownRemoteHash) {
        // Remote hasn't changed since last sync, prefer local
        merged[section] = localContent;
      } else {
        // Real conflict - mark for user review
        conflicts.push(section);
        merged[section] = localContent; // Default to local
      }
    }
  }

  return { merged, conflicts };
}

function reconstructJournal(sections) {
  const parts = [];

  // Header first
  if (sections['__header__']) {
    parts.push(sections['__header__']);
  }

  // Then all other sections in order (preserve original order where possible)
  const sectionOrder = ['Completed ✅', 'In Progress 🔄', 'Backlog', 'Notes', 'Inbox', 'Timestamps', 'Lessons Learned'];

  for (const section of sectionOrder) {
    if (sections[section]) {
      parts.push(sections[section]);
    }
  }

  // Add any remaining sections not in the standard order
  for (const [section, content] of Object.entries(sections)) {
    if (section !== '__header__' && !sectionOrder.includes(section)) {
      parts.push(content);
    }
  }

  return parts.join('\n');
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

async function brainstormAtris() {
  const targetDir = path.join(process.cwd(), 'atris');
  if (!fs.existsSync(targetDir)) {
    throw new Error('atris/ folder not found. Run "atris init" first.');
  }

  ensureLogDirectory();
  const { logFile, dateFormatted } = getLogPath();
  if (!fs.existsSync(logFile)) {
    createLogFile(logFile, dateFormatted);
  }

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ ATRIS Brainstorm — structured prompt generator              │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log(`Date: ${dateFormatted}`);
  console.log('Type "exit" at any prompt to cancel.');
  console.log('');

  // Try to fetch latest journal entry from backend (optional)
  let journalContext = '';
  const config = loadConfig();
  const credentials = loadCredentials();
  
  if (config.agent_id && credentials && credentials.token) {
    try {
      console.log('📖 Fetching latest journal entry from AtrisOS...');
      const journalResult = await apiRequestJson(`/agents/${config.agent_id}/journal/today`, {
        method: 'GET',
        token: credentials.token,
      });
      
      if (journalResult.ok && journalResult.data?.content) {
        journalContext = journalResult.data.content;
        console.log('✓ Loaded journal entry from backend');
      } else {
        // Try fetching latest entry if today doesn't exist
        const listResult = await apiRequestJson(`/agents/${config.agent_id}/journal/?limit=1`, {
          method: 'GET',
          token: credentials.token,
        });
        
        if (listResult.ok && listResult.data?.entries?.length > 0) {
          journalContext = listResult.data.entries[0].content || '';
          console.log('✓ Loaded latest journal entry from backend');
        }
      }
    } catch (error) {
      // Silently fail - we'll use local log file instead
      console.log('ℹ️  Using local journal file (backend unavailable)');
    }
    console.log('');
  }

  // Fallback to local log file if no backend context
  if (!journalContext) {
    if (fs.existsSync(logFile)) {
      journalContext = fs.readFileSync(logFile, 'utf8');
    }
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = async (promptText, options = {}) => {
    const { allowEmpty = false } = options;
    while (true) {
      const answer = await new Promise((resolve) => rl.question(promptText, resolve));
      const trimmed = answer.trim();
      if (trimmed.toLowerCase() === 'exit') {
        throw brainstormAbortError();
      }
      if (!allowEmpty && trimmed === '') {
        console.log('Please enter a value (or type "exit" to abort).');
        continue;
      }
      return trimmed;
    }
  };

  const askYesNo = async (promptText) => {
    while (true) {
      const response = (await ask(promptText)).toLowerCase();
      if (response === 'y' || response === 'yes') return true;
      if (response === 'n' || response === 'no') return false;
      console.log('Please answer with "y" or "n" (or type "exit" to abort).');
    }
  };

  const collectList = async (label, options = {}) => {
    const { minimum = 0 } = options;
    const items = [];
    while (true) {
      const promptSuffix = items.length === 0 ? '' : ' (blank to finish)';
      const value = await ask(`${label} ${items.length + 1}${promptSuffix}: `, {
        allowEmpty: items.length >= minimum,
      });
      if (!value) {
        if (items.length < minimum) {
          console.log(`Please provide at least ${minimum} ${minimum === 1 ? 'item' : 'items'}.`);
          continue;
        }
        break;
      }
      items.push(value);
    }
    return items;
  };

  let selectedInboxItem = null;
  let topicSummary = '';

  try {
    const initialContent = journalContext || (fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '');
    let inboxItems = parseInboxItems(initialContent);

    if (inboxItems.length > 0) {
      console.log('Choose a brainstorm source:');
      console.log('  1. Select an item from today\'s Inbox');
      console.log('  2. Enter a new idea');
      console.log('');

      let choice;
      while (true) {
        choice = await ask('Choice (1-2): ');
        if (choice === '1' || choice === '2') {
          break;
        }
        console.log('Please enter 1 or 2.');
      }

      if (choice === '1') {
        console.log('');
        console.log('Today\'s Inbox:');
        inboxItems.forEach((item, index) => {
          console.log(`  ${index + 1}. I${item.id} — ${item.text}`);
        });
        console.log('');

        while (true) {
          const selection = await ask(`Pick an item (1-${inboxItems.length}): `);
          const index = parseInt(selection, 10);
          if (!Number.isNaN(index) && index >= 1 && index <= inboxItems.length) {
            selectedInboxItem = inboxItems[index - 1];
            break;
          }
          console.log(`Enter a number between 1 and ${inboxItems.length}.`);
        }

        const editedSummary = await ask('Brainstorm topic (press Enter to keep original): ', { allowEmpty: true });
        topicSummary = editedSummary ? editedSummary : selectedInboxItem.text;
      } else {
        console.log('');
        topicSummary = await ask('Describe the brainstorm topic: ');
        const newId = addInboxIdea(logFile, topicSummary);
        console.log(`✓ Added I${newId} to today\'s Inbox.`);
        selectedInboxItem = { id: newId, text: topicSummary };
      }
    } else {
      console.log('No items in today\'s Inbox. Capture a new idea to begin.');
      topicSummary = await ask('Describe the brainstorm topic: ');
      const newId = addInboxIdea(logFile, topicSummary);
      console.log(`✓ Added I${newId} to today\'s Inbox.`);
      selectedInboxItem = { id: newId, text: topicSummary };
    }

    const sourceLabel = selectedInboxItem ? `I${selectedInboxItem.id}` : 'Ad-hoc';

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📖 Step 1: Craft the Story');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('What should the output be? How should it feel?');
    console.log('This helps us capture the vision before diving into details.');
    console.log('');

    const userStory = await ask('Describe the desired outcome (what should users experience?): ');
    const feelingsVibe = await ask('Feelings/vibes we\'re aiming for? (optional): ', { allowEmpty: true });

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧠 Step 2: Brainstorm Session');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Now let\'s uncover what we need to build.');
    console.log('');

    const constraints = await ask('Constraints or guardrails? (optional): ', { allowEmpty: true });

    // Build concise, spaced-out prompt (4-5 sentences max, lots of spacing)
    const promptLines = [];
    
    // Extract key snippets from journal if available (very brief)
    let journalHint = '';
    if (journalContext && journalContext.trim()) {
      const maxHint = 200;
      const lines = journalContext.split('\n').slice(0, 5).join(' ').trim();
      if (lines.length > maxHint) {
        journalHint = lines.substring(0, maxHint) + '...';
      } else {
        journalHint = lines;
      }
    }

    promptLines.push('You:');
    promptLines.push('');
    promptLines.push(`I want to brainstorm: ${topicSummary}`);
    promptLines.push('');
    
    if (userStory) {
      promptLines.push(`The outcome should be: ${userStory}`);
      promptLines.push('');
    }
    
    if (feelingsVibe) {
      promptLines.push(`Vibe we\'re going for: ${feelingsVibe}`);
      promptLines.push('');
    }
    
    if (journalHint) {
      promptLines.push(`Recent context: ${journalHint}`);
      promptLines.push('');
    }
    
    if (constraints) {
      promptLines.push(`Constraints: ${constraints}`);
    promptLines.push('');
    }
    
    promptLines.push('Help me uncover what we need to build. Keep responses short (4-5 sentences), pause for alignment, sketch ASCII when structure helps.');
    promptLines.push('');
    promptLines.push('Claude:');

    const promptText = promptLines.join('\n');

    console.log('');
    console.log('Copy this prompt into Claude Code (or your agent of choice):');
    console.log('');
    console.log('```');
    console.log(promptText);
    console.log('```');
    console.log('');

    const logChoice = await askYesNo('Log this brainstorm session to today\'s journal? (y/n): ');
    if (logChoice) {
      const sessionSummary = await ask('Session summary (1-2 sentences): ');
      const nextStepsRaw = await ask('Next steps (optional, separate with ";"): ', { allowEmpty: true });
      const nextSteps = nextStepsRaw
        ? nextStepsRaw.split(';').map((item) => item.trim()).filter(Boolean)
        : [];
      recordBrainstormSession(
        logFile,
        sourceLabel,
        topicSummary,
        userStory,
        [],
        [],
        constraints,
        '',
        feelingsVibe || '',
        nextSteps,
        sessionSummary
      );
      if (selectedInboxItem) {
        const archive = await askYesNo('Archive this Inbox idea now? (y/n): ');
        if (archive) {
          let latestContent = fs.readFileSync(logFile, 'utf8');
          latestContent = removeInboxItemFromContent(latestContent, selectedInboxItem.id);
          fs.writeFileSync(logFile, latestContent);
          console.log(`✓ Archived I${selectedInboxItem.id} from Inbox.`);
        }
      }
      console.log('✓ Brainstorm session logged.');
    } else {
      console.log('Skipped journaling. Prompt is ready for your agent.');
    }

    console.log('\nBrainstorm complete.');
  } finally {
    rl.close();
  }
}

function brainstormAbortError() {
  const error = new Error('Brainstorm cancelled by user.');
  error.__brainstormAbort = true;
  return error;
}

function generateWorkflowFile(workflowFile, metadata) {
  const targetDir = path.join(process.cwd(), 'atris');
  
  // Load all context needed for agents
  const navigatorFile = path.join(targetDir, 'agent_team', 'navigator.md');
  const executorFile = path.join(targetDir, 'agent_team', 'executor.md');
  const validatorFile = path.join(targetDir, 'agent_team', 'validator.md');
  const launcherFile = path.join(targetDir, 'agent_team', 'launcher.md');
  const personaFile = path.join(targetDir, 'PERSONA.md');
  const mapFile = path.join(targetDir, 'MAP.md');
  const taskContextsFile = path.join(targetDir, 'TASK_CONTEXTS.md');
  const { logFile } = getLogPath();
  
  const workflow = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    metadata: {
      feature: metadata.feature,
      userStory: metadata.userStory,
      constraints: metadata.constraints || '',
      successCriteria: metadata.successCriteria || [],
      riskNotes: metadata.riskNotes || '',
      journalPath: metadata.logFile
    },
    states: {
      NAVIGATOR: {
        agentSpec: fs.existsSync(navigatorFile) ? fs.readFileSync(navigatorFile, 'utf8') : '',
        context: {
          inboxPath: metadata.logFile,
          taskContextsPath: 'atris/TASK_CONTEXTS.md',
          mapPath: 'atris/MAP.md'
        },
        instructions: 'Take ideas from Inbox → break them down into perfect, manageable tasks. Create visualizations (ASCII diagrams) for logic flows, DB tables, architecture, UI/UX. Write tasks to TASK_CONTEXTS.md.'
      },
      EXECUTOR: {
        agentSpec: fs.existsSync(executorFile) ? fs.readFileSync(executorFile, 'utf8') : '',
        context: {
          personaPath: 'atris/PERSONA.md',
          mapPath: 'atris/MAP.md',
          taskContextsPath: 'atris/TASK_CONTEXTS.md'
        },
        instructions: 'Get it done, precisely, following instructions perfectly. Show ASCII visualization for complex changes. Execute tasks following executor spec. Move completed tasks to <completed> section.'
      },
      VALIDATOR: {
        agentSpec: fs.existsSync(validatorFile) ? fs.readFileSync(validatorFile, 'utf8') : '',
        context: {
          taskContextsPath: 'atris/TASK_CONTEXTS.md',
          mapPath: 'atris/MAP.md',
          journalPath: metadata.logFile
        },
        instructions: 'Auto-activated after "atris do" completes. Ultrathink, check requirements → build → edge cases → errors → integration. Run tests. Repeat until: "✅ All good. Ready for human testing."'
      },
      LAUNCHER: {
        agentSpec: fs.existsSync(launcherFile) ? fs.readFileSync(launcherFile, 'utf8') : '',
        context: {
          taskContextsPath: 'atris/TASK_CONTEXTS.md',
          mapPath: 'atris/MAP.md',
          journalPath: metadata.logFile
        },
        instructions: 'Ship it clean. Document what was shipped, extract learnings, update MAP.md and docs, clean up, Git commit + push, celebrate!'
      }
    },
    currentState: null,
    currentIteration: 0,
    history: []
  };
  
  fs.writeFileSync(workflowFile, JSON.stringify(workflow, null, 2));
}

function updateWorkflowState(workflowFile, stateName, iteration) {
  if (!fs.existsSync(workflowFile)) return;
  
  const workflow = JSON.parse(fs.readFileSync(workflowFile, 'utf8'));
  workflow.currentState = stateName;
  workflow.currentIteration = iteration;
  workflow.history.push({
    state: stateName,
    iteration: iteration,
    timestamp: new Date().toISOString()
  });
  
  // Update context with latest file contents
  const targetDir = path.join(process.cwd(), 'atris');
  const taskContextsFile = path.join(targetDir, 'TASK_CONTEXTS.md');
  const mapFile = path.join(targetDir, 'MAP.md');
  const { logFile } = getLogPath();
  
  // Refresh task contexts if exists
  if (fs.existsSync(taskContextsFile)) {
    workflow.states[stateName].context.taskContexts = fs.readFileSync(taskContextsFile, 'utf8').substring(0, 5000); // Limit size
  }
  
  // Refresh map if exists
  if (fs.existsSync(mapFile)) {
    workflow.states[stateName].context.map = fs.readFileSync(mapFile, 'utf8').substring(0, 3000); // Limit size
  }
  
  // Refresh journal inbox if exists
  if (fs.existsSync(logFile)) {
    const logContent = fs.readFileSync(logFile, 'utf8');
    const inboxMatch = logContent.match(/## Inbox\n([\s\S]*?)(?=\n##|$)/);
    if (inboxMatch) {
      workflow.states[stateName].context.inbox = inboxMatch[1].trim().substring(0, 2000); // Limit size
    }
  }
  
  fs.writeFileSync(workflowFile, JSON.stringify(workflow, null, 2));
}

async function autopilotAtris() {
  const targetDir = path.join(process.cwd(), 'atris');
  if (!fs.existsSync(targetDir)) {
    throw new Error('atris/ folder not found. Run "atris init" first.');
  }

  const navigatorFile = path.join(targetDir, 'agent_team', 'navigator.md');
  const executorFile = path.join(targetDir, 'agent_team', 'executor.md');
  const validatorFile = path.join(targetDir, 'agent_team', 'validator.md');
  const launcherFile = path.join(targetDir, 'agent_team', 'launcher.md');

  const missingSpecs = [];
  if (!fs.existsSync(navigatorFile)) missingSpecs.push('navigator.md');
  if (!fs.existsSync(executorFile)) missingSpecs.push('executor.md');
  if (!fs.existsSync(validatorFile)) missingSpecs.push('validator.md');
  if (!fs.existsSync(launcherFile)) missingSpecs.push('launcher.md');

  if (missingSpecs.length > 0) {
    throw new Error(`Missing agent spec(s): ${missingSpecs.join(', ')}. Run "atris init" to restore them.`);
  }

  ensureLogDirectory();
  const { logFile, dateFormatted } = getLogPath();
  if (!fs.existsSync(logFile)) {
    createLogFile(logFile, dateFormatted);
  }

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ ATRIS Autopilot — Full Cycle Automation                      │');
  console.log('│ brainstorm → plan → do → review → launch                    │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log(`Date: ${dateFormatted}`);
  console.log('Type "exit" at any prompt to cancel.');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = async (promptText, options = {}) => {
    const { allowEmpty = false } = options;
    while (true) {
      const answer = await new Promise((resolve) => rl.question(promptText, resolve));
      const trimmed = answer.trim();
      if (trimmed.toLowerCase() === 'exit') {
        throw autopilotAbortError();
      }
      if (!allowEmpty && trimmed === '') {
        console.log('Please enter a value (or type "exit" to abort).');
        continue;
      }
      return trimmed;
    }
  };

  const askYesNo = async (promptText) => {
    while (true) {
      const response = (await ask(promptText)).toLowerCase();
      if (response === 'y' || response === 'yes') return true;
      if (response === 'n' || response === 'no') return false;
      console.log('Please answer with "y" or "n" (or type "exit" to abort).');
    }
  };

  // ========================================
  // STEP 1: Brainstorm with user
  // ========================================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧠 STEP 1: Brainstorm — Define the vision');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  let selectedInboxItem = null;
  let topicSummary = '';
  let userStory = '';
  let feelingsVibe = '';
  let constraints = '';

  // Try to fetch latest journal entry from backend
  let journalContext = '';
  const config = loadConfig();
  const credentials = loadCredentials();
  
  if (config.agent_id && credentials && credentials.token) {
    try {
      const journalResult = await apiRequestJson(`/agents/${config.agent_id}/journal/today`, {
        method: 'GET',
        token: credentials.token,
      });
      
      if (journalResult.ok && journalResult.data?.content) {
        journalContext = journalResult.data.content;
      } else {
        const listResult = await apiRequestJson(`/agents/${config.agent_id}/journal/?limit=1`, {
          method: 'GET',
          token: credentials.token,
        });
        
        if (listResult.ok && listResult.data?.entries?.length > 0) {
          journalContext = listResult.data.entries[0].content || '';
        }
      }
    } catch (error) {
      // Fallback to local
    }
  }

  // Fallback to local log file
  if (!journalContext && fs.existsSync(logFile)) {
    journalContext = fs.readFileSync(logFile, 'utf8');
  }

  try {
    const initialContent = journalContext || (fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '');
    let inboxItems = parseInboxItems(initialContent);

    if (inboxItems.length > 0) {
      console.log('Choose a brainstorm source:');
      console.log('  1. Select an item from today\'s Inbox');
      console.log('  2. Enter a new idea');
      console.log('');

      let choice;
      while (true) {
        choice = await ask('Choice (1-2): ');
        if (choice === '1' || choice === '2') {
          break;
        }
        console.log('Please enter 1 or 2.');
      }

      if (choice === '1') {
        console.log('');
        console.log('Today\'s Inbox:');
        inboxItems.forEach((item, index) => {
          console.log(`  ${index + 1}. I${item.id} — ${item.text}`);
        });
        console.log('');

        while (true) {
          const selection = await ask(`Pick an item (1-${inboxItems.length}): `);
          const index = parseInt(selection, 10);
          if (!Number.isNaN(index) && index >= 1 && index <= inboxItems.length) {
            selectedInboxItem = inboxItems[index - 1];
            break;
          }
          console.log(`Enter a number between 1 and ${inboxItems.length}.`);
        }

        const editedSummary = await ask('Brainstorm topic (press Enter to keep original): ', { allowEmpty: true });
        topicSummary = editedSummary ? editedSummary : selectedInboxItem.text;
      } else {
        console.log('');
        topicSummary = await ask('Describe the brainstorm topic: ');
        const newId = addInboxIdea(logFile, topicSummary);
        console.log(`✓ Added I${newId} to today\'s Inbox.`);
        selectedInboxItem = { id: newId, text: topicSummary };
      }
    } else {
      console.log('No items in today\'s Inbox. Capture a new idea to begin.');
      topicSummary = await ask('Describe the brainstorm topic: ');
      const newId = addInboxIdea(logFile, topicSummary);
      console.log(`✓ Added I${newId} to today\'s Inbox.`);
      selectedInboxItem = { id: newId, text: topicSummary };
    }

    const sourceLabel = selectedInboxItem ? `I${selectedInboxItem.id}` : 'Ad-hoc';

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📖 Craft the Story — What should the output be?');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    userStory = await ask('Describe the desired outcome (what should users experience?): ');
    feelingsVibe = await ask('Feelings/vibes we\'re aiming for? (optional): ', { allowEmpty: true });
    constraints = await ask('Constraints or guardrails? (optional): ', { allowEmpty: true });

    // Generate and show brainstorm prompt
    const promptLines = [];
    promptLines.push('You:');
    promptLines.push('');
    promptLines.push(`I want to brainstorm: ${topicSummary}`);
    promptLines.push('');
    
    if (userStory) {
      promptLines.push(`The outcome should be: ${userStory}`);
      promptLines.push('');
    }
    
    if (feelingsVibe) {
      promptLines.push(`Vibe we\'re going for: ${feelingsVibe}`);
      promptLines.push('');
    }
    
    if (constraints) {
      promptLines.push(`Constraints: ${constraints}`);
      promptLines.push('');
    }
    
    promptLines.push('Help me uncover what we need to build. Keep responses short (4-5 sentences), pause for alignment, sketch ASCII when structure helps.');
    promptLines.push('');
    promptLines.push('Claude:');

    const promptText = promptLines.join('\n');

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 PROMPT FOR YOUR CODING EDITOR:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('```');
    console.log(promptText);
    console.log('```');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Get approval to proceed with autopilot
    console.log('');
    const proceed = await askYesNo('✓ Brainstorm complete. Ready to start autopilot (plan → do → review → launch)? (y/n): ');
    if (!proceed) {
      console.log('\nAutopilot cancelled. Brainstorm prompt is ready for your agent.');
      return;
    }

    // Log brainstorm session
    const sessionSummary = await ask('Brainstorm session summary (1-2 sentences, optional): ', { allowEmpty: true });
    recordBrainstormSession(
      logFile,
      sourceLabel,
      topicSummary,
      userStory,
      [],
      [],
      constraints,
      '',
      feelingsVibe || '',
      [],
      sessionSummary || 'Autopilot brainstorm session'
    );

    // Define success criteria
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 Define Success Criteria');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    const successCriteria = [];
    while (true) {
      const criteria = await ask(`Success criteria ${successCriteria.length + 1}: `, {
        allowEmpty: successCriteria.length > 0,
      });
      if (!criteria) {
        if (successCriteria.length === 0) {
          console.log('Please provide at least one success criteria.');
          continue;
        }
        break;
      }
      successCriteria.push(criteria);
    }

    const riskNotes = await ask('Any risks or notes? (optional): ', { allowEmpty: true });

    recordAutopilotVision(
      logFile,
      sourceLabel,
      topicSummary,
      successCriteria,
      riskNotes ? riskNotes : ''
    );

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✓ Vision locked in');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`• Source: ${sourceLabel}`);
    console.log(`• Summary: ${topicSummary}`);
    console.log('• Success Criteria:');
    successCriteria.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item}`);
    });
    if (riskNotes) {
      console.log(`• Notes: ${riskNotes}`);
    }
    console.log('');
    console.log('🚀 Starting automated cycle: plan → do → review → launch');
    console.log('   (No manual pauses - fully automated after this approval)');
    console.log('');

    // ========================================
    // Generate workflow file for coding agents
    // ========================================
    const workflowFile = path.join(targetDir, '.atris-workflow.json');
    generateWorkflowFile(workflowFile, {
      feature: topicSummary,
      userStory,
      constraints,
      successCriteria,
      riskNotes,
      logFile: path.relative(process.cwd(), logFile)
    });

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📄 WORKFLOW FILE GENERATED: .atris-workflow.json');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Coding agents can read this file to enter workflow states');
    console.log('   Each state includes all context needed for execution');
    console.log('');

    // ========================================
    // STEP 2-4: Automated plan → do → review loop
    // ========================================
    let iteration = 1;
    while (true) {
      console.log(`\n${'═'.repeat(70)}`);
      console.log(`AUTOPILOT ITERATION ${iteration}`);
      console.log(`${'═'.repeat(70)}\n`);

      // Plan
      console.log('[STATE:NAVIGATOR]');
      console.log('[1/4] 📋 Plan — Navigator creating tasks...');
      planAtris();
      updateWorkflowState(workflowFile, 'NAVIGATOR', iteration);
      console.log('   ✓ Planning prompt displayed to agent');
      console.log('   ✓ Workflow state updated: [STATE:NAVIGATOR]\n');

      // Do
      console.log('[STATE:EXECUTOR]');
      console.log('[2/4] 🔨 Do — Executor building...');
      doAtris();
      updateWorkflowState(workflowFile, 'EXECUTOR', iteration);
      console.log('   ✓ Execution prompt displayed to agent');
      console.log('   ✓ Workflow state updated: [STATE:EXECUTOR]\n');

      // Review
      console.log('[STATE:VALIDATOR]');
      console.log('[3/4] ✅ Review — Validator checking...');
      reviewAtris();
      updateWorkflowState(workflowFile, 'VALIDATOR', iteration);
      console.log('   ✓ Validation prompt displayed to agent');
      console.log('   ✓ Workflow state updated: [STATE:VALIDATOR]\n');

      // Check if success
      console.log(`${'─'.repeat(70)}`);
      const isSuccess = await askYesNo(`Did we meet the success criteria? (y/n): `);
      console.log('');

      if (isSuccess) {
        const successNotes = await ask('Notes for the log (optional): ', { allowEmpty: true });
        recordAutopilotIteration(
          logFile,
          iteration,
          'Success',
          successNotes ? successNotes : ''
        );
        
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✓ Success criteria met!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');

        // ========================================
        // STEP 5: Launch
        // ========================================
        console.log('[STATE:LAUNCHER]');
        console.log('[5/5] 🚀 Launch — Launcher shipping...');
        launchAtris();
        updateWorkflowState(workflowFile, 'LAUNCHER', iteration);
        console.log('   ✓ Launch prompt displayed to agent');
        console.log('   ✓ Workflow state updated: [STATE:LAUNCHER]\n');

        recordAutopilotSuccess(
          logFile,
          selectedInboxItem ? selectedInboxItem.id : null,
          topicSummary
        );

        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 AUTOPILOT COMPLETE');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('✓ Feature completed and shipped');
        console.log('✓ All prompts displayed for agent workflow');
        console.log('✓ Success recorded in journal');
        console.log('');
        break;
      } else {
        const followUp = await ask('Describe remaining blockers / next steps (optional): ', {
          allowEmpty: true,
        });
        recordAutopilotIteration(
          logFile,
          iteration,
          'Follow-up required',
          followUp ? followUp : ''
        );
        const continueLoop = await askYesNo('Continue with another iteration? (y/n): ');
        if (!continueLoop) {
          console.log('\nAutopilot paused. Success criteria not yet met.');
          break;
        }
        iteration += 1;
      }
    }
  } finally {
    rl.close();
  }
}

function autopilotAbortError() {
  const error = new Error('Autopilot cancelled by user.');
  error.__autopilotAbort = true;
  return error;
}

function addInboxIdea(logFile, summary) {
  const content = fs.readFileSync(logFile, 'utf8');
  const nextId = getNextInboxId(content);
  const updated = addInboxItemToContent(content, nextId, summary);
  fs.writeFileSync(logFile, updated);
  return nextId;
}

function parseInboxItems(content) {
  const match = content.match(/## Inbox\n([\s\S]*?)(?=\n##|\n---|$)/);
  if (!match) {
    return [];
  }
  const body = match[1];
  const lines = body.split('\n');
  const items = [];
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('(Empty')) return;
    const parsed = trimmed.match(/^- \*\*I(\d+):\*\*\s*(.+)$|^- \*\*I(\d+):\s+(.+)$/);
    if (parsed) {
      const id = parseInt(parsed[1] || parsed[3], 10);
      const text = parsed[2] || parsed[4];
      items.push({ id, text, line: trimmed });
    }
  });
  return items;
}

function replaceInboxSection(content, items) {
  const regex = /(## Inbox\n)([\s\S]*?)(\n---|\n##|$)/;
  if (!regex.test(content)) {
    const lines = items.length ? items.map((item) => item.line).join('\n') : '(Empty - inbox zero achieved)';
    return `${content}\n\n## Inbox\n\n${lines}\n`;
  }

  return content.replace(regex, (match, header, body, suffix) => {
    const inner = items.length
      ? `\n${items.map((item) => item.line).join('\n')}\n`
      : '\n(Empty - inbox zero achieved)\n';
    return `${header}${inner}${suffix}`;
  });
}

function addInboxItemToContent(content, id, summary) {
  const items = parseInboxItems(content).filter((item) => item.id !== id);
  const newItem = { id, text: summary, line: `- **I${id}:** ${summary}` };
  const updatedItems = [newItem, ...items];
  return replaceInboxSection(content, updatedItems);
}

function removeInboxItemFromContent(content, id) {
  const items = parseInboxItems(content).filter((item) => item.id !== id);
  return replaceInboxSection(content, items);
}

function getNextInboxId(content) {
  const items = parseInboxItems(content);
  if (items.length === 0) return 1;
  return items.reduce((max, item) => (item.id > max ? item.id : max), 0) + 1;
}

function parseCompletionItems(content) {
  const match = content.match(/## Completed ✅\n([\s\S]*?)(?=\n##|\n---|$)/);
  if (!match) {
    return [];
  }
  const body = match[1];
  const lines = body.split('\n');
  const items = [];
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('(Empty')) return;
    const parsed = trimmed.match(/^- \*\*C(\d+):\*\*\s*(.+)$|^- \*\*C(\d+):\s+(.+)$/);
    if (parsed) {
      const id = parseInt(parsed[1] || parsed[3], 10);
      const text = parsed[2] || parsed[4];
      items.push({ id, text, line: trimmed });
    }
  });
  return items;
}

function replaceCompletedSection(content, items) {
  const regex = /(## Completed ✅\n)([\s\S]*?)(\n---|\n##|$)/;
  if (!regex.test(content)) {
    const lines = items.length ? items.map((item) => item.line).join('\n') : '';
    return `${content}\n\n## Completed ✅\n\n${lines}\n`;
  }

  return content.replace(regex, (match, header, body, suffix) => {
    const inner = items.length
      ? `\n${items.map((item) => item.line).join('\n')}\n`
      : '\n';
    return `${header}${inner}${suffix}`;
  });
}

function addCompletionItemToContent(content, id, summary) {
  const items = parseCompletionItems(content).filter((item) => item.id !== id);
  const newItem = { id, text: summary, line: `- **C${id}:** ${summary}` };
  const updatedItems = [...items, newItem];
  return replaceCompletedSection(content, updatedItems);
}

function getNextCompletionId(content) {
  const items = parseCompletionItems(content);
  if (items.length === 0) return 1;
  return items.reduce((max, item) => (item.id > max ? item.id : max), 0) + 1;
}

function insertIntoNotesSection(content, block) {
  const regex = /(## Notes\n)([\s\S]*?)(\n---|\n##|$)/;
  const match = content.match(regex);
  if (!match) {
    return `${content}\n\n## Notes\n\n${block}\n`;
  }
  const header = match[1];
  const body = match[2];
  const suffix = match[3];
  const trimmedBody = body.replace(/\s*$/, '');
  const newBody = trimmedBody
    ? `${trimmedBody}\n\n${block}\n`
    : `\n${block}\n`;
  return content.replace(regex, `${header}${newBody}${suffix}`);
}

function getTimeLabel() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function recordAutopilotVision(logFile, sourceLabel, summary, successCriteria, riskNotes) {
  const content = fs.readFileSync(logFile, 'utf8');
  const lines = [
    `### Autopilot Vision — ${getTimeLabel()}`,
    `**Source:** ${sourceLabel}`,
    `**Summary:** ${summary}`,
    '**Success Criteria:**',
    ...successCriteria.map((item) => `- ${item}`),
  ];
  if (riskNotes && riskNotes.trim()) {
    lines.push(`**Risks / Notes:** ${riskNotes}`);
  }
  const block = lines.join('\n');
  const updated = insertIntoNotesSection(content, block);
  fs.writeFileSync(logFile, updated);
}

function recordAutopilotIteration(logFile, iteration, result, notes) {
  const content = fs.readFileSync(logFile, 'utf8');
  const lines = [
    `### Autopilot Iteration ${iteration} — ${getTimeLabel()}`,
    `**Validator Result:** ${result}`,
  ];
  if (notes && notes.trim()) {
    lines.push(`**Notes:** ${notes}`);
  }
  const block = lines.join('\n');
  const updated = insertIntoNotesSection(content, block);
  fs.writeFileSync(logFile, updated);
}

function recordAutopilotSuccess(logFile, inboxId, summary) {
  let content = fs.readFileSync(logFile, 'utf8');
  if (typeof inboxId === 'number' && !Number.isNaN(inboxId)) {
    content = removeInboxItemFromContent(content, inboxId);
  }
  const nextId = getNextCompletionId(content);
  content = addCompletionItemToContent(content, nextId, `Autopilot — ${summary}`);
  fs.writeFileSync(logFile, content);
}

function recordBrainstormSession(
  logFile,
  sourceLabel,
  topic,
  desiredOutcome,
  keyQuestions,
  focusAreas,
  constraints,
  references,
  tonePreference,
  nextSteps,
  sessionSummary
) {
  let content = fs.readFileSync(logFile, 'utf8');
  const lines = [
    `### Brainstorm Session — ${getTimeLabel()}`,
    `**Source:** ${sourceLabel}`,
    `**Topic:** ${topic}`,
  ];
  if (desiredOutcome) {
    lines.push(`**User Story / Desired Outcome:** ${desiredOutcome}`);
  }
  if (tonePreference) {
    lines.push(`**Vibe / Feelings:** ${tonePreference}`);
  }
  if (keyQuestions && keyQuestions.length > 0) {
    lines.push('**Key Questions:**');
    keyQuestions.forEach((item) => lines.push(`- ${item}`));
  }
  if (focusAreas && focusAreas.length > 0) {
    lines.push('**Focus Areas:**');
    focusAreas.forEach((item) => lines.push(`- ${item}`));
  }
  if (constraints) {
    lines.push(`**Constraints:** ${constraints}`);
  }
  if (references) {
    lines.push(`**Context / References:** ${references}`);
  }
  if (sessionSummary) {
    lines.push(`**Session Summary:** ${sessionSummary}`);
  }
  if (nextSteps && nextSteps.length > 0) {
    lines.push('**Next Steps:**');
    nextSteps.forEach((item) => lines.push(`- ${item}`));
  }

  const block = lines.join('\n');
  content = insertIntoNotesSection(content, block);
  fs.writeFileSync(logFile, content);
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
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 INSTRUCTION PROMPT FOR YOUR CODING AGENT:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('You are the Navigator. Take ideas from Inbox → break them down into perfect, manageable tasks.');
  console.log('');
  console.log('⚠️  CRITICAL: You MUST create visualizations BEFORE writing tasks!');
  console.log('');
  console.log('Your job (execute these steps):');
  console.log('');
  console.log('STEP 1: Generate ASCII visualizations for user approval');
  console.log('   Create diagrams showing:');
  console.log('   - Logic/flow: How data/control flows through the system');
  console.log('   - DB schema: Table structures, relationships, indexes');
  console.log('   - Architecture: Component interactions, file structure changes');
  console.log('   - UI/UX: User flow, screen layouts, interactions');
  console.log('   SHOW these diagrams to the user and wait for approval before proceeding.');
  console.log('');
  console.log('STEP 2: Break approved ideas into concrete tasks');
  console.log('   - Each task should be: Specific, Measurable, Actionable');
  console.log('   - Include file:line references from MAP.md');
  console.log('   - List dependencies between tasks');
  console.log('   - Add acceptance criteria for each task');
  console.log('');
  console.log('STEP 3: Write tasks to TASK_CONTEXTS.md');
  console.log('   - Add tasks to Backlog section');
  console.log('   - Format: Task number, description, file refs, acceptance criteria');
  console.log('   - Quality over speed - tasks must be perfect for systems player execution');
  console.log('');
  console.log('Load journal context if needed. Use MAP.md for file references.');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 After planning: Run "atris do" to execute tasks');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
}

function doAtris() {
  const cwd = process.cwd();
  const targetDir = path.join(cwd, 'atris');
  const executorFile = path.join(targetDir, 'agent_team', 'executor.md');

  if (!fs.existsSync(executorFile)) {
    console.log('✗ executor.md not found. Run "atris init" first.');
    process.exit(1);
  }

  // Detect context: frontend/backend/root
  const isFrontend = cwd.includes('atrisos-web');
  const isBackend = cwd.includes('atrisos-backend');
  const context = isFrontend ? 'FRONTEND' : (isBackend ? 'BACKEND' : 'ROOT');
  
  // Load executor spec
  const executorSpec = fs.readFileSync(executorFile, 'utf8');

  // Load PERSONA.md
  const personaFile = path.join(targetDir, 'PERSONA.md');
  let persona = '';
  if (fs.existsSync(personaFile)) {
    persona = fs.readFileSync(personaFile, 'utf8');
  }

  // Load MAP.md
  const mapFile = path.join(targetDir, 'MAP.md');
  let mapContent = '';
  if (fs.existsSync(mapFile)) {
    mapContent = fs.readFileSync(mapFile, 'utf8');
  }

  // Load tasks from appropriate TODO file
  let tasksContent = '';
  let taskSource = '';
  if (isFrontend) {
    const todoFile = path.join(cwd, 'TODO', 'todo.md');
    if (fs.existsSync(todoFile)) {
      tasksContent = fs.readFileSync(todoFile, 'utf8');
      taskSource = 'atrisos-web/TODO/todo.md';
    }
  } else if (isBackend) {
    const todoFile = path.join(cwd, 'TODO.md');
    if (fs.existsSync(todoFile)) {
      tasksContent = fs.readFileSync(todoFile, 'utf8');
      taskSource = 'atrisos-backend/TODO.md';
    }
  } else {
    // Root level - check both
    const frontendTodo = path.join(cwd, 'atrisos-web', 'TODO', 'todo.md');
    const backendTodo = path.join(cwd, 'atrisos-backend', 'TODO.md');
    if (fs.existsSync(frontendTodo)) {
      tasksContent += '=== FRONTEND TASKS ===\n';
      tasksContent += fs.readFileSync(frontendTodo, 'utf8');
      taskSource += 'atrisos-web/TODO/todo.md\n';
    }
    if (fs.existsSync(backendTodo)) {
      tasksContent += '\n=== BACKEND TASKS ===\n';
      tasksContent += fs.readFileSync(backendTodo, 'utf8');
      taskSource += 'atrisos-backend/TODO.md\n';
    }
  }
  
  // Extract tagged tasks
  const taskTag = isFrontend ? '[FRONTEND]' : (isBackend ? '[BACKEND]' : '');
  let filteredTasks = '';
  if (taskTag && tasksContent) {
    const taskLines = tasksContent.split('\n');
    let inTasksSection = false;
    let currentTask = [];
    for (const line of taskLines) {
      if (line.includes('<tasks>')) {
        inTasksSection = true;
        continue;
      }
      if (line.includes('</tasks>')) {
        inTasksSection = false;
        if (currentTask.length > 0) {
          filteredTasks += currentTask.join('\n') + '\n\n';
        }
        currentTask = [];
        continue;
      }
      if (inTasksSection && line.trim()) {
        if (line.includes(taskTag)) {
          currentTask = [line];
        } else if (currentTask.length > 0) {
          currentTask.push(line);
        }
      }
    }
    if (currentTask.length > 0) {
      filteredTasks += currentTask.join('\n') + '\n';
    }
  } else {
    filteredTasks = tasksContent;
  }
  
  // Load TASK_CONTEXTS.md (legacy, but keep for compatibility)
  const taskContextsFile = path.join(targetDir, 'TASK_CONTEXTS.md');
  let taskContexts = '';
  if (fs.existsSync(taskContextsFile)) {
    taskContexts = fs.readFileSync(taskContextsFile, 'utf8');
  }
  
  // Build super prompt
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ ATRIS Do — Executor Agent Activated                         │');
  console.log(`│ Context: ${context}                                           │`);
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 YOUR TASK: Execute tasks tagged [' + taskTag + '] from ' + taskSource);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  if (persona) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 PERSONA.md — Communication & Work Style');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(persona);
    console.log('');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 EXECUTOR SPEC — How to Build');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(executorSpec);
  console.log('');
  
  if (filteredTasks) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 TASKS TO EXECUTE — ' + taskSource);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(filteredTasks || '(No tasks found matching your tag)');
  console.log('');
  }
  
  if (taskContexts && taskContexts.trim()) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 TASK_CONTEXTS.md (Additional Context)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(taskContexts);
  console.log('');
  }
  
  if (mapContent && mapContent.trim()) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🗺️  MAP.md — Codebase Navigation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    // Show full map if < 3000 chars, else truncate intelligently
    if (mapContent.length > 3000) {
      const lines = mapContent.split('\n');
      const importantLines = lines.slice(0, 100).join('\n');
      console.log(importantLines);
      console.log('\n... (see full MAP.md for complete reference)');
    } else {
      console.log(mapContent);
    }
  console.log('');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 INSTRUCTION PROMPT FOR YOUR CODING AGENT:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('⚠️  CRITICAL: Execute tasks NOW. Use file tools to edit code, terminal to run commands.');
  console.log('');
  console.log('You are the Executor. Get it done, precisely, following instructions perfectly.');
  console.log('');
  console.log('Execution Modes:');
  console.log('  • Single-shot (default): Complete all tasks automatically');
  console.log('  • Step-by-step: Use "atris do --step" for user-controlled execution');
  console.log('');
  console.log('Your process (EXECUTE these steps):');
  console.log('1. Read tasks from TASK_CONTEXTS.md (shown above)');
  console.log('2. For each task: Show ASCII visualization first (especially complex changes)');
  console.log('3. Execute task: Use file edit tools, terminal commands, etc.');
  console.log('4. After completion: Move task to TASK_CONTEXTS.md <completed> section');
  console.log('5. Follow PERSONA.md for communication style');
  console.log('');
  console.log('DO NOT just describe what you would do - actually edit files and execute commands!');
  console.log('6. Use MAP.md to navigate codebase');
  console.log('');
  console.log('User controls pace: Choose single-shot or step-by-step based on confidence.');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
}

async function consoleAtris() {
  const targetDir = path.join(process.cwd(), 'atris');

  // Check atris/ exists
  if (!fs.existsSync(targetDir)) {
    console.error('✗ Error: atris/ folder not found. Run "atris init" first.');
    process.exit(1);
  }

  // Check credentials
  const credentials = loadCredentials();
  if (!credentials || !credentials.token) {
    console.error('✗ Error: Not logged in. Run "atris login" first.');
    process.exit(1);
  }

  // Check agent selected
  const config = loadConfig();
  if (!config.agent_id) {
    console.error('✗ Error: No agent selected. Run "atris agent" first.');
    process.exit(1);
  }

  // Read TASK_CONTEXTS.md
  const taskContextsFile = path.join(targetDir, 'TASK_CONTEXTS.md');
  let taskContexts = '';
  if (fs.existsSync(taskContextsFile)) {
    taskContexts = fs.readFileSync(taskContextsFile, 'utf8');
  }

  // Parse tasks from Backlog section
  const backlogMatch = taskContexts.match(/## Backlog\n([\s\S]*?)(?=\n## In Progress|\n---|\n## Instructions|$)/);
  const backlogContent = backlogMatch ? backlogMatch[1].trim() : '';

  if (!backlogContent || backlogContent === '(No active tasks)' || backlogContent === '(Unclaimed tasks ready for execution)') {
    console.log('');
    console.log('✗ No tasks in Backlog. Create tasks first with "atris plan"');
    console.log('');
    process.exit(0);
  }

  // Extract task lines (simple parsing)
  const taskLines = backlogContent
    .split('\n')
    .filter(line => line.trim() && !line.includes('(') && line.length > 10);

  if (taskLines.length === 0) {
    console.log('');
    console.log('✗ No valid tasks in Backlog.');
    console.log('');
    process.exit(0);
  }

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ ATRIS Console — Claude SDK Executor                         │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('📋 Available Tasks:');
  console.log('─────────────────────────────────────────────────────────────');

  taskLines.forEach((task, idx) => {
    const taskText = task.replace(/^[-*]\s*/, '').slice(0, 60);
    console.log(`  ${idx + 1}. ${taskText}${task.length > 60 ? '...' : ''}`);
  });

  console.log('');

  // Get user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Select task number (or "q" to quit): ', async (answer) => {
      rl.close();

      if (answer.toLowerCase() === 'q') {
        console.log('');
        process.exit(0);
      }

      const taskIdx = parseInt(answer, 10) - 1;
      if (isNaN(taskIdx) || taskIdx < 0 || taskIdx >= taskLines.length) {
        console.error('✗ Invalid selection');
        process.exit(1);
      }

      const selectedTask = taskLines[taskIdx];

      // Read executor spec and MAP.md for context
      const executorFile = path.join(targetDir, 'agent_team', 'executor.md');
      let executorSpec = '';
      if (fs.existsSync(executorFile)) {
        executorSpec = fs.readFileSync(executorFile, 'utf8');
      }

      const mapFile = path.join(targetDir, 'MAP.md');
      let mapContent = '';
      if (fs.existsSync(mapFile)) {
        mapContent = fs.readFileSync(mapFile, 'utf8');
      }

      // Build context message
      const contextMessage = `## Task to Build
${selectedTask}

## Executor Spec
${executorSpec}

## Navigation Map (MAP.md)
${mapContent}

---

Follow the executor spec. Show ASCII diagrams for complex changes. Ask for confirmation before modifying files.`;

      console.log('');
      console.log('Spawning Claude Code session...');
      console.log('─────────────────────────────────────────────────────────────');
      console.log('');

      // Spawn Claude Code session with Agent SDK
      const agentId = config.agent_id;
      const apiUrl = 'https://api.atris.ai';
      const endpoint = `${apiUrl}/api/${agentId}/session`;

      const body = JSON.stringify({
        context: contextMessage,
        working_directory: process.cwd(),
        allowed_tools: ['Read', 'Write', 'Bash', 'Edit'],
      });

      try {
        // Call backend to spawn Claude Code session
        await spawnClaudeCodeSession(endpoint, credentials.token, body);
        console.log('');
        console.log('─────────────────────────────────────────────────────────────');
        console.log('✓ Session complete. Returning to console...');
        console.log('');
        resolve();
      } catch (error) {
        console.error(`✗ Session failed: ${error.message || error}`);
        process.exit(1);
      }
    });
  });
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

  // Read project-specific testing guide if it exists (optional - projects can add their own)
  // Checks common locations: root, backend/, atris/ directories
  let testingGuide = '';
  const possiblePaths = [
    path.join(process.cwd(), 'AGENT_TESTING_GUIDE.md'),
    path.join(process.cwd(), 'TESTING_GUIDE.md'),
    path.join(process.cwd(), 'atris', 'TESTING_GUIDE.md'),
  ];
  for (const guidePath of possiblePaths) {
    if (fs.existsSync(guidePath)) {
      testingGuide = fs.readFileSync(guidePath, 'utf8');
      break;
    }
  }

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
  if (testingGuide) {
    console.log('');
    console.log('🧪 BACKEND TESTING GUIDE:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(testingGuide);
    console.log('');
    console.log('─────────────────────────────────────────────────────────────');
  }
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
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 INSTRUCTION PROMPT FOR YOUR CODING AGENT:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('You are the Validator. Auto-activated after "atris do" completes.');
  console.log('');
  console.log('Validation Loop:');
  console.log('  1. Ultrathink (say "ultrathink", think 3 times)');
  console.log('  2. Check requirements → build → edge cases → errors → integration');
  console.log('  3. Run tests (unit, integration, linting, type checking)');
  console.log('  4. If issues found: report → "atris do" fixes → "atris review" again');
  console.log('  5. Repeat until: "✅ All good. Ready for human testing."');
  console.log('');
  console.log('Your job:');
  console.log('  • Verify everything works');
  console.log('  • Test thoroughly (unless user says no)');
  console.log('  • Update docs if needed');
  console.log('  • Clean TASK_CONTEXTS.md (move completed tasks)');
  console.log('  • Extract learnings for journal');
  console.log('  • Only approve when truly ready for human testing');
  console.log('');
  console.log('The cycle: do → review → [issues] → do → review → ✅ Ready');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
}

function launchAtris() {
  const targetDir = path.join(process.cwd(), 'atris');
  const launcherFile = path.join(targetDir, 'agent_team', 'launcher.md');

  if (!fs.existsSync(launcherFile)) {
    console.log('✗ launcher.md not found. Run "atris init" first.');
    process.exit(1);
  }

  // Read launcher.md
  const launcherSpec = fs.readFileSync(launcherFile, 'utf8');

  // Read TASK_CONTEXTS.md for completed tasks context
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

  // Read journal for recent completions
  const { logFile, dateFormatted } = getLogPath();
  let journalPath = '';
  let journalContent = '';
  if (fs.existsSync(logFile)) {
    journalPath = path.relative(process.cwd(), logFile);
    journalContent = fs.readFileSync(logFile, 'utf8');
  }

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ ATRIS Launch — Launcher Agent Activated                     │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('📋 AGENT SPEC:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(launcherSpec);
  console.log('');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('');
  console.log('📝 TASK_CONTEXTS.md (for completed tasks context):');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(taskContexts || '(Empty)');
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
  if (journalContent) {
    const completedMatch = journalContent.match(/## Completed ✅[\s\S]*?(?=## |$)/);
    if (completedMatch) {
      console.log('Recent completions:');
      console.log('─────────────────────────────────────────────────────────────');
      console.log(completedMatch[0].substring(0, 300) + '... (truncated)');
      console.log('');
      console.log('─────────────────────────────────────────────────────────────');
    }
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 INSTRUCTION PROMPT FOR YOUR CODING AGENT:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('You are the Launcher. Ship it clean.');
  console.log('');
  console.log('⚠️  CRITICAL: Execute these steps NOW using terminal and file tools:');
  console.log('');
  console.log('Launch Workflow:');
  console.log('  1. Document what was shipped (add Launch entry to journal Notes section)');
  console.log('  2. Extract learnings (what worked? what would you do differently?)');
  console.log('  3. Update MAP.md with new patterns/file locations');
  console.log('  4. Update relevant docs (README, API docs, etc.)');
  console.log('  5. Clean up (remove temp files, unused code, etc.)');
  console.log('  6. [EXECUTE] Git commit + push:');
  console.log('     - Run: git add -A');
  console.log('     - Run: git commit -m "Descriptive message about what was shipped"');
  console.log('     - Run: git push origin master');
  console.log('  7. Optional: Update changelog/blog (7 sentences max essay on what shipped)');
  console.log('  8. Run: atris log sync (to sync journal to backend)');
  console.log('  9. Celebrate! 🎉');
  console.log('');
  console.log('DO NOT just describe these steps - actually execute the git commands!');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
}

function statusAtris(isQuick = false) {
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

  // Quick mode: one-line summary
  if (isQuick) {
    console.log(`📥 ${inboxItems.length} | 📋 ${backlogTasks.length} | 🔨 ${inProgressTasks.length} | ✅ ${completions.length}`);
    return;
  }

  // Full display status
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

function spawnClaudeCodeSession(url, token, body) {
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

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const response = JSON.parse(Buffer.concat(chunks).toString());
          // Session spawned - could return session ID, URL, etc
          resolve(response);
        } catch (e) {
          resolve({ status: 'session_initiated' });
        }
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

function streamProChat(url, token, body, showTools = false) {
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
              const msg = JSON.parse(data);

              // Handle different message types from Claude SDK
              if (msg.type === 'system_init' && showTools) {
                console.log(`[System] Tools available: ${msg.tools?.join(', ') || 'none'}`);
              } else if (msg.type === 'assistant') {
                // Display assistant text response
                if (msg.content && Array.isArray(msg.content)) {
                  for (const block of msg.content) {
                    if (block.type === 'text') {
                      process.stdout.write(block.text);
                    }
                  }
                }
              } else if (msg.type === 'tool_use' && showTools) {
                console.log(`\n[⚙️  Executing: ${msg.tool_name}]`);
              } else if (msg.type === 'tool_result' && showTools) {
                const preview = msg.content?.substring(0, 100) || '';
                console.log(`[✓ Result]: ${preview}${msg.content?.length > 100 ? '...' : ''}`);
              } else if (msg.type === 'result') {
                // Final result
                if (msg.result) {
                  process.stdout.write(msg.result);
                }
              } else if (msg.chunk) {
                // Legacy chunk format
                process.stdout.write(msg.chunk);
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
