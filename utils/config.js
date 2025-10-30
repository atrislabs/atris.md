const fs = require('fs');
const path = require('path');

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

module.exports = {
  getConfigPath,
  loadConfig,
  saveConfig,
  getLogSyncStatePath,
  loadLogSyncState,
  saveLogSyncState,
};
