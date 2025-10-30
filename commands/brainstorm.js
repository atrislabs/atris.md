const fs = require('fs');
const path = require('path');
const readline = require('readline');
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
    console.log('📝 Instructions for your coding agent:');
    console.log('');
    console.log(brainstormMessage);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('💡 Your coding agent should read the above and start brainstorming with you.');
    console.log('   Keep it conversational, short responses, ASCII diagrams when helpful.');
    console.log('');

    const logChoice = await askYesNo('Log this brainstorm setup to today\'s journal? (y/n): ');
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
      console.log('✓ Brainstorm session logged to journal.');
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💡 TIP: Run "atris log sync" to push to backend');
      console.log('   Then run "atris analytics" to see your stats grow! 📈');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else {
      console.log('Skipped journaling.');
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Setup complete! Your coding agent should start brainstorming now.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } finally {
    rl.close();
  }
}

module.exports = { brainstormAtris };
