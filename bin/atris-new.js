#!/usr/bin/env node

// Thin router - imports and dispatches to command modules
const { initAtris } = require('../commands/init');
const { syncAtris } = require('../commands/sync');
const { logAtris } = require('../commands/log');
const { logSyncAtris } = require('../commands/log-sync');
const { brainstormAtris } = require('../commands/brainstorm');
const { loginAtris, logoutAtris, whoamiAtris } = require('../commands/auth');
const { showVersion } = require('../commands/version');

// Temporary: Keep old commands in main file until extracted
// These will be moved to command files soon
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { loadConfig, saveConfig } = require('../utils/config');
const { loadCredentials } = require('../utils/auth');
const { apiRequestJson } = require('../utils/api');
const { getLogPath, ensureLogDirectory, createLogFile } = require('../lib/file-ops');

// Extract remaining commands inline for now - will move to modules
async function agentAtris() {
  const { promptUser } = require('../utils/auth');
  const targetDir = path.join(process.cwd(), 'atris');
  if (!fs.existsSync(targetDir)) {
    console.error('✗ Error: atris/ folder not found. Run "atris init" first.');
    process.exit(1);
  }
  const credentials = loadCredentials();
  if (!credentials || !credentials.token) {
    console.error('✗ Error: Not logged in. Run "atris login" first.');
    process.exit(1);
  }
  console.log('🔍 Fetching your agents...\n');
  const result = await apiRequestJson('/agent/my-agents', {
    method: 'GET',
    token: credentials.token,
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
  const config = loadConfig();
  if (config.agent_id) {
    const current = agents.find(a => a.id === config.agent_id);
    if (current) {
      console.log(`Current agent: ${current.name}\n`);
    }
  }
  console.log('Available agents:');
  agents.forEach((agent, index) => {
    console.log(`  ${index + 1}. ${agent.name}`);
  });
  console.log('');
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
  config.agent_id = selectedAgent.id;
  config.agent_name = selectedAgent.name;
  saveConfig(config);
  console.log(`\n✓ Selected agent: ${selectedAgent.name}`);
  console.log(`✓ Config saved to atris/.config`);
  console.log(`\nYou can now use "atris chat" to talk with this agent.`);
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

// Main command router
const command = process.argv[2];

if (!command || command === 'help' || command === '--help' || command === '-h') {
  showHelp();
  process.exit(0);
}

// Route commands
if (command === 'init') {
  initAtris();
} else if (command === 'agent') {
  agentAtris().catch((error) => {
    console.error(`✗ Agent selection failed: ${error.message || error}`);
    process.exit(1);
  });
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
} else if (command === 'update') {
  syncAtris();
} else if (command === 'version') {
  showVersion();
} else if (command === 'login') {
  loginAtris();
} else if (command === 'logout') {
  logoutAtris();
} else if (command === 'whoami') {
  whoamiAtris();
} else if (command === 'brainstorm') {
  brainstormAtris()
    .then(() => process.exit(0))
    .catch((error) => {
      if (error && error.__brainstormAbort) {
        process.exit(0);
      }
      console.error(`✗ Brainstorm failed: ${error.message || error}`);
      process.exit(1);
    });
} else {
  // For now, fallback to old file for remaining commands
  // TODO: Extract remaining commands
  console.error(`✗ Command "${command}" not yet modularized. Using legacy handler.`);
  require('./atris-legacy.js');
}

