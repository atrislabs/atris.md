const fs = require('fs');
const path = require('path');

/**
 * Detect workspace state: fresh install, has inbox items, in-progress work, or blocked
 */
function detectWorkspaceState(workspaceDir) {
  const atrisDir = path.join(workspaceDir, 'atris');
  const featuresDir = path.join(atrisDir, 'FEATURES');
  const logsDir = path.join(atrisDir, 'logs');
  const mapFile = path.join(atrisDir, 'MAP.md');
  const taskContextFile = path.join(atrisDir, 'TASK_CONTEXTS.md');
  const todayLog = getTodayLogPath(logsDir);

  // Check if atris/ exists
  if (!fs.existsSync(atrisDir)) {
    return { state: 'fresh', reason: 'No atris/ folder found' };
  }

  // Check for in-progress work (FEATURES/*.md files)
  if (fs.existsSync(featuresDir)) {
    const featureFiles = fs.readdirSync(featuresDir).filter(f => f.endsWith('.md'));
    const inProgressFeatures = featureFiles.filter(f => {
      const content = fs.readFileSync(path.join(featuresDir, f), 'utf8');
      return content.includes('status: in-progress');
    });

    if (inProgressFeatures.length > 0) {
      const feature = inProgressFeatures[0];
      return {
        state: 'in-progress',
        feature: feature.replace('.md', ''),
        file: path.join(featuresDir, feature)
      };
    }
  }

  // Check for inbox items in today's log
  if (fs.existsSync(todayLog)) {
    const logContent = fs.readFileSync(todayLog, 'utf8');
    const inboxMatch = logContent.match(/## Inbox\n([\s\S]*?)(?=##|$)/);
    if (inboxMatch && inboxMatch[1].trim()) {
      const inboxItems = inboxMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(line => line.length > 0);

      if (inboxItems.length > 0) {
        return {
          state: 'inbox',
          items: inboxItems,
          count: inboxItems.length
        };
      }
    }
  }

  // Check for blocked tasks
  if (fs.existsSync(taskContextFile)) {
    const content = fs.readFileSync(taskContextFile, 'utf8');
    if (content.includes('Risk Level: High') || content.includes('blocked')) {
      return { state: 'blocked', reason: 'Tasks marked as blocked or high risk' };
    }
  }

  // Default: setup complete but no active work
  return { state: 'ready', reason: 'Setup complete, no active work' };
}

/**
 * Get today's log file path
 */
function getTodayLogPath(logsDir) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return path.join(logsDir, year.toString(), `${year}-${month}-${day}.md`);
}

/**
 * Load context: MAP, journal, and feature files
 */
function loadContext(workspaceDir) {
  const atrisDir = path.join(workspaceDir, 'atris');
  const mapFile = path.join(atrisDir, 'MAP.md');
  const todayLog = getTodayLogPath(path.join(atrisDir, 'logs'));
  const featuresDir = path.join(atrisDir, 'FEATURES');

  const context = {
    mapExists: fs.existsSync(mapFile),
    hasInbox: false,
    inboxItems: [],
    inProgressFeatures: [],
    recentLog: null
  };

  // Load MAP
  if (context.mapExists) {
    context.map = fs.readFileSync(mapFile, 'utf8').split('\n').slice(0, 5); // First 5 lines
  }

  // Load inbox
  if (fs.existsSync(todayLog)) {
    const logContent = fs.readFileSync(todayLog, 'utf8');
    const inboxMatch = logContent.match(/## Inbox\n([\s\S]*?)(?=##|$)/);
    if (inboxMatch && inboxMatch[1].trim()) {
      context.hasInbox = true;
      context.inboxItems = inboxMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(line => line.length > 0)
        .slice(0, 3); // First 3 items
      context.recentLog = todayLog;
    }
  }

  // Load in-progress features
  if (fs.existsSync(featuresDir)) {
    const featureFiles = fs.readdirSync(featuresDir).filter(f => f.endsWith('.md'));
    context.inProgressFeatures = featureFiles
      .filter(f => {
        const content = fs.readFileSync(path.join(featuresDir, f), 'utf8');
        return content.includes('status: in-progress');
      })
      .slice(0, 2); // First 2 features
  }

  return context;
}

module.exports = {
  detectWorkspaceState,
  loadContext,
  getTodayLogPath
};
