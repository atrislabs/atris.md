const fs = require('fs');
const path = require('path');
const { getLogPath, ensureLogDirectory, createLogFile } = require('../lib/file-ops');
const { parseJournalSections, mergeSections, reconstructJournal, showLogDiff } = require('../lib/journal');
const { computeContentHash, isSameTimestamp } = require('../lib/journal');
const { loadConfig, loadLogSyncState, saveLogSyncState } = require('../utils/config');
const { ensureValidCredentials } = require('../utils/auth');
const { apiRequestJson } = require('../utils/api');
const { promptUser } = require('../utils/auth');

async function logSyncAtris() {
  const targetDir = path.join(process.cwd(), 'atris');

  if (!fs.existsSync(targetDir)) {
    throw new Error('atris/ folder not found. Run "atris init" first.');
  }

  let dateArg = process.argv[4];
  if (dateArg && dateArg.startsWith('--date=')) {
    dateArg = dateArg.split('=')[1];
  }

  let { logsDir, yearDir, logFile, dateFormatted } = getLogPath(dateArg);
  if (Number.isNaN(new Date(dateFormatted).getTime())) {
    throw new Error(`Invalid date provided: ${dateArg}`);
  }

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

  const config = loadConfig();
  if (!config.agent_id) {
    throw new Error('No agent selected. Run "atris agent" first.');
  }

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

        try {
          const localSections = parseJournalSections(normalizedLocal);
          const remoteSections = parseJournalSections(normalizedRemote || '');
          const { merged, conflicts } = mergeSections(localSections, remoteSections, knownRemoteHash);

          if (conflicts.length === 0) {
            const mergedContent = reconstructJournal(merged);
            fs.writeFileSync(logFile, mergedContent, 'utf8');
            console.log('✓ Auto-merged web and local changes');
            console.log(`   Merged sections: ${Object.keys(merged).filter(k => k !== '__header__').join(', ')}`);
            localContent = mergedContent;
          } else {
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

module.exports = { logSyncAtris };
