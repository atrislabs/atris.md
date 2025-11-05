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

  const ensured = await ensureValidCredentials(apiRequestJson);
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
  let shouldPush = true; // Flag to track if we should push local changes
  let finalLocalContent = localContent; // Track what final local content should be

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

      // Check if local has changes since last sync
      const localMatchesKnown = (knownRemoteHash && localHash === knownRemoteHash);

      if (remoteTime > localTime && !remoteMatchesKnown) {
        // Web is newer - need to pull/merge
        const normalizedRemote = remoteContent ? remoteContent.replace(/\r\n/g, '\n') : null;
        const normalizedLocal = localContent.replace(/\r\n/g, '\n');
        
        if (normalizedRemote !== null && normalizedRemote.trim() === normalizedLocal.trim()) {
          // Content identical, just update timestamp
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
            // Clean merge - auto-merge and continue
            const mergedContent = reconstructJournal(merged);
            fs.writeFileSync(logFile, mergedContent, 'utf8');
            console.log('✓ Auto-merged web and local changes');
            console.log(`   Merged sections: ${Object.keys(merged).filter(k => k !== '__header__').join(', ')}`);
            finalLocalContent = mergedContent;
            
            // Update timestamp to match web
            const remoteDate = new Date(remoteUpdatedAt);
            if (!Number.isNaN(remoteDate.getTime())) {
              fs.utimesSync(logFile, remoteDate, remoteDate);
            }
            
            // If local didn't have changes, don't push (web already has latest)
            if (localMatchesKnown) {
              console.log('✓ Sync complete (web had updates, local was unchanged)');
              const state = loadLogSyncState();
              state[dateFormatted] = {
                updated_at: remoteUpdatedAt,
                hash: computeContentHash(mergedContent),
              };
              saveLogSyncState(state);
              return;
            }
          } else {
            // Conflicts detected - prompt user
            console.log('⚠️  Conflicting changes in same section(s)');
            console.log(`   Conflicts: ${conflicts.join(', ')}`);
            console.log(`   Remote updated: ${remoteUpdatedAt}`);
            console.log(`   Local modified: ${localModified}`);
            console.log('');
            console.log('   Options:');
            console.log('   1. Use web version (overwrite local)');
            console.log('   2. Keep local version (overwrite web)');
            console.log('   3. Merge (combine both - may need manual cleanup)');
            console.log('');

            if (typeof remoteContent === 'string') {
              showLogDiff(logFile, remoteContent);
            }

            const answer = await promptUser('Choose option (1/2/3): ');

            if (answer === '1') {
              // Use web version
              const pulledContent = existing.data?.content || '';
              fs.writeFileSync(logFile, pulledContent, 'utf8');
              remoteHash = computeContentHash(pulledContent);
              finalLocalContent = pulledContent;
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
              // Don't push - web already has the correct version
              shouldPush = false;
            } else if (answer === '2') {
              // Keep local version - will push to web
              console.log('⏩ Keeping local version, will push to web');
              finalLocalContent = localContent;
            } else if (answer === '3') {
              // Merge both
              const mergedContent = reconstructJournal(merged);
              fs.writeFileSync(logFile, mergedContent, 'utf8');
              finalLocalContent = mergedContent;
              console.log('✓ Merged both versions (check for duplicates)');
              console.log(`   Merged sections: ${Object.keys(merged).filter(k => k !== '__header__').join(', ')}`);
            } else {
              // Invalid answer - default to keeping local
              console.log('⏩ Invalid choice, keeping local version');
              finalLocalContent = localContent;
            }
          }
        } catch (parseError) {
          // Fallback to simple prompt
          console.log('⚠️  Web version is newer than local version');
          console.log(`   Remote updated: ${remoteUpdatedAt}`);
          console.log(`   Local modified: ${localModified}`);
          console.log('');
          console.log('   Options:');
          console.log('   1. Use web version (overwrite local)');
          console.log('   2. Keep local version (overwrite web)');
          console.log('');

          if (typeof remoteContent === 'string') {
            showLogDiff(logFile, remoteContent);
          }

          const answer = await promptUser('Choose option (1/2): ');

          if (answer === '1') {
            const pulledContent = existing.data?.content || '';
            fs.writeFileSync(logFile, pulledContent, 'utf8');
            remoteHash = computeContentHash(pulledContent);
            finalLocalContent = pulledContent;
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
            // Don't push - web already has the correct version
            shouldPush = false;
          } else {
            // Keep local - will push
            console.log('⏩ Keeping local version, will push to web');
            finalLocalContent = localContent;
          }
        }
      } else if (remoteTime < localTime && !localMatchesKnown) {
        // Local is newer - will push
        console.log('📤 Local changes detected, will push to web');
        finalLocalContent = localContent;
      } else if (remoteTime > localTime && remoteMatchesKnown) {
        // Web timestamp ahead but matches known state (clock skew)
        console.log('⚠️  Web timestamp ahead due to clock skew (matches last sync); pushing local changes.');
        finalLocalContent = localContent;
      } else if (remoteTime === localTime || (localMatchesKnown && remoteMatchesKnown)) {
        // Already synced
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
      } else if (localMatchesKnown && !remoteMatchesKnown) {
        // Local unchanged, web has updates - just pull
        console.log('📥 Web has updates, local unchanged - pulling...');
        const pulledContent = existing.data?.content || '';
        fs.writeFileSync(logFile, pulledContent, 'utf8');
        const pulledHash = computeContentHash(pulledContent);
        if (remoteUpdatedAt) {
          const remoteDate = new Date(remoteUpdatedAt);
          if (!Number.isNaN(remoteDate.getTime())) {
            fs.utimesSync(logFile, remoteDate, remoteDate);
          }
          const state = loadLogSyncState();
          state[dateFormatted] = {
            updated_at: remoteUpdatedAt,
            hash: pulledHash,
          };
          saveLogSyncState(state);
        }
        console.log('✓ Local journal updated from web');
        console.log(`🗒️  File: ${path.relative(process.cwd(), logFile)}`);
        return;
      }
    }
  } else if (!existing.status) {
    throw new Error('Unable to reach Atris API. Check your network connection.');
  } else if (existing.status && existing.status !== 404) {
    throw new Error(existing.error || 'Failed to check existing journal entry');
  }

  // Only push if we should (web wasn't newer and user chose to keep local, or local is newer)
  if (!shouldPush) {
    return;
  }

  // Update local file with final content if it changed
  if (finalLocalContent !== localContent) {
    fs.writeFileSync(logFile, finalLocalContent, 'utf8');
  }

  const payload = {
    content: finalLocalContent,
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
    console.log(`✓ Updated journal entry on web (previous update: ${remoteUpdatedAt || 'unknown'})`);
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
