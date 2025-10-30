const fs = require('fs');
const path = require('path');
const { getLogPath, ensureLogDirectory, createLogFile, parseInboxItems, addInboxIdea, removeInboxItemFromContent, recordBrainstormSession } = require('../lib/file-ops');
const { loadConfig } = require('../utils/config');
const { loadCredentials } = require('../utils/auth');
const { apiRequestJson } = require('../utils/api');

function brainstormAbortError() {
  const error = new Error('Brainstorm cancelled by user.');
  error.__brainstormAbort = true;
  return error;
}

async function brainstormAtris() {
  // Check for args: atris brainstorm "topic" --outcome "..." --vibe "..." --constraints "..."
  const args = process.argv.slice(3);
  let topicArg = null;
  let outcomeArg = null;
  let vibeArg = null;
  let constraintsArg = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--outcome' && args[i + 1]) {
      outcomeArg = args[i + 1];
      i++;
    } else if (args[i] === '--vibe' && args[i + 1]) {
      vibeArg = args[i + 1];
      i++;
    } else if (args[i] === '--constraints' && args[i + 1]) {
      constraintsArg = args[i + 1];
      i++;
    } else if (!args[i].startsWith('--') && !topicArg) {
      topicArg = args[i];
    }
  }
  const targetDir = path.join(process.cwd(), 'atris');
  if (!fs.existsSync(targetDir)) {
    throw new Error('atris/ folder not found. Run "atris init" first.');
  }

  ensureLogDirectory();
  const { logFile, dateFormatted } = getLogPath();
  if (!fs.existsSync(logFile)) {
    createLogFile(logFile, dateFormatted);
  }

  // Show current stats for game-like feel
  let todayStats = { completions: 0, inbox: 0 };
  if (fs.existsSync(logFile)) {
    const logContent = fs.readFileSync(logFile, 'utf8');
    const completionMatches = logContent.match(/- \*\*C\d+:/g);
    todayStats.completions = completionMatches ? completionMatches.length : 0;
    const inboxMatch = logContent.match(/## Inbox\n([\s\S]*?)(?=\n##|---)/);
    if (inboxMatch && inboxMatch[1].trim()) {
      const inboxMatches = inboxMatch[1].match(/- \*\*I\d+:/g);
      todayStats.inbox = inboxMatches ? inboxMatches.length : 0;
    }
  }

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ ATRIS Brainstorm — structured prompt generator              │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log(`📅 Date: ${dateFormatted}`);
  console.log(`📊 Today: ${todayStats.completions} completions | ${todayStats.inbox} inbox items`);
  console.log('💡 Type "exit" at any prompt to cancel.');
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

  // Determine topic and inputs
  let selectedInboxItem = null;
  let topicSummary = topicArg || '';
  let userStory = outcomeArg || '';
  let feelingsVibe = vibeArg || '';
  let constraints = constraintsArg || '';

  // If no args provided, use inbox or prompt user
  if (!topicArg) {
    const initialContent = journalContext || (fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '');
    let inboxItems = parseInboxItems(initialContent);
    
    if (inboxItems.length > 0) {
      // Use first inbox item if available
      selectedInboxItem = inboxItems[0];
      topicSummary = selectedInboxItem.text;
      console.log(`📌 Using inbox item I${selectedInboxItem.id}: ${topicSummary}`);
    } else {
      throw new Error('No topic provided. Usage: atris brainstorm "topic" [--outcome "..."] [--vibe "..."] [--constraints "..."]');
    }
  } else {
    // Add new idea to inbox
    const newId = addInboxIdea(logFile, topicSummary);
    selectedInboxItem = { id: newId, text: topicSummary };
    console.log(`✓ Added I${newId} to today's Inbox.`);
  }

  const sourceLabel = selectedInboxItem ? `I${selectedInboxItem.id}` : 'Ad-hoc';

  // Build the brainstorm message (structured for AI to read)
  const brainstormMessage = [
    `I want to brainstorm: ${topicSummary}`,
    '',
    userStory ? `The outcome should be: ${userStory}` : '',
    feelingsVibe ? `Vibe we're going for: ${feelingsVibe}` : '',
    journalContext ? `Recent context from journal:\n${journalContext.substring(0, 500)}${journalContext.length > 500 ? '...' : ''}` : '',
    constraints ? `Constraints: ${constraints}` : '',
    '',
    'Help me uncover what we need to build. Keep responses short (4-5 sentences), pause for alignment, sketch ASCII when structure helps.',
  ].filter(line => line !== '').join('\n');

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧠 BRAINSTORM SESSION READY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📝 INSTRUCTIONS FOR YOUR CODING AGENT:');
  console.log('');
  console.log('ACTION REQUIRED: Start brainstorming with the user NOW. Then execute CLI commands as needed.');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('BRAINSTORM PROMPT:');
  console.log(brainstormMessage);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('⚠️  CRITICAL: You MUST execute CLI commands, not just discuss them!');
  console.log('');
  console.log('After brainstorming, execute:');
  console.log('  1. `atris plan` - to break ideas into tasks');
  console.log('  2. `atris do` - to execute the tasks');
  console.log('  3. `atris review` - to validate');
  console.log('  4. `atris launch` - to ship');
  console.log('');
  console.log('Use your terminal tool to run these commands. Do not just talk about them!');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

module.exports = { brainstormAtris };
