const fs = require('fs');
const path = require('path');
const { getLogPath, ensureLogDirectory, createLogFile, parseInboxItems, addInboxIdea, removeInboxItemFromContent, recordBrainstormSession } = require('../lib/file-ops');
const { loadConfig } = require('../utils/config');
const { loadCredentials } = require('../utils/auth');
const { apiRequestJson } = require('../utils/api');
const { executeCodeExecution } = require('../utils/claude_sdk');

function brainstormAbortError() {
  const error = new Error('Brainstorm cancelled by user.');
  error.__brainstormAbort = true;
  return error;
}

async function brainstormAtris() {
  // Check for args: atris brainstorm "topic" --outcome "..." --vibe "..." --constraints "..." --execute
  const args = process.argv.slice(3);
  let topicArg = null;
  let outcomeArg = null;
  let vibeArg = null;
  let constraintsArg = null;
  let executeFlag = false;
  
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
    } else if (args[i] === '--execute') {
      executeFlag = true;
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
  let hasTopic = false;

  // If no args provided, start with blank idea (conversation starter)
  if (!topicArg) {
    const initialContent = journalContext || (fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '');
    let inboxItems = parseInboxItems(initialContent);
    
    if (inboxItems.length > 0) {
      // Offer to use first inbox item, but default to blank
      selectedInboxItem = inboxItems[0];
      topicSummary = ''; // Blank - let brainstormer start the conversation
      hasTopic = false;
    } else {
      // No inbox items, start completely blank
      topicSummary = '';
      hasTopic = false;
    }
  } else {
    // Topic provided - add to inbox and use it
    const newId = addInboxIdea(logFile, topicSummary);
    selectedInboxItem = { id: newId, text: topicSummary };
    hasTopic = true;
    console.log(`✓ Added I${newId} to today's Inbox.`);
  }

  const sourceLabel = selectedInboxItem ? `I${selectedInboxItem.id}` : 'Blank';

  // Load brainstormer agent spec
  const brainstormerFile = path.join(targetDir, 'agent_team', 'brainstormer.md');
  let brainstormerSpec = '';
  if (fs.existsSync(brainstormerFile)) {
    brainstormerSpec = fs.readFileSync(brainstormerFile, 'utf8');
  } else {
    console.log('⚠️  brainstormer.md not found. Using default brainstorming approach.');
  }

  // Load PERSONA.md for context
  const personaFile = path.join(targetDir, 'PERSONA.md');
  let persona = '';
  if (fs.existsSync(personaFile)) {
    persona = fs.readFileSync(personaFile, 'utf8');
  }

  // Reference MAP.md (agents read on-demand)
  const mapFile = path.join(targetDir, 'MAP.md');
  const mapPath = fs.existsSync(mapFile) ? path.relative(process.cwd(), mapFile) : null;

  // Build the brainstorm message (structured for AI to read)
  let brainstormMessage = '';
  if (hasTopic && topicSummary) {
    brainstormMessage = [
      `I want to brainstorm: ${topicSummary}`,
      '',
      userStory ? `The outcome should be: ${userStory}` : '',
      feelingsVibe ? `Vibe we're going for: ${feelingsVibe}` : '',
      constraints ? `Constraints: ${constraints}` : '',
    ].filter(line => line !== '').join('\n');
  } else {
    // Blank idea - brainstormer should start the conversation
    brainstormMessage = 'No specific idea yet. Help me explore what we could build.';
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧠 BRAINSTORM SESSION READY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  if (brainstormerSpec) {
    console.log('📋 AGENT SPEC:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(brainstormerSpec);
    console.log('─────────────────────────────────────────────────────────────');
    console.log('');
  }

  if (persona) {
    console.log('👤 PERSONA.md — Communication & Work Style');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(persona);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
  }

  if (mapPath) {
    console.log('🗺️  MAP.md:', mapPath);
    console.log('   Read this file for file:line references when navigating the codebase.');
    console.log('');
  }

  if (journalContext) {
    console.log('📅 JOURNAL CONTEXT:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(journalContext.substring(0, 1000));
    if (journalContext.length > 1000) {
      console.log('...');
    }
    console.log('─────────────────────────────────────────────────────────────');
    console.log('');
  }

  // Check execution mode
  const executionMode = executeFlag ? 'agent' : (config.execution_mode || 'prompt');
  
  if (executionMode === 'agent') {
    // Agent mode: execute via backend API
    if (!config.agent_id) {
      throw new Error('No agent selected. Run "atris agent" first.');
    }
    if (!credentials || !credentials.token) {
      throw new Error('Not logged in. Run "atris login" first.');
    }

    // Build system prompt
    let systemPrompt = '';
    if (brainstormerSpec) {
      systemPrompt += brainstormerSpec + '\n\n';
    }
    if (persona) {
      systemPrompt += '## PERSONA.md\n' + persona + '\n\n';
    }
    if (mapPath) {
      systemPrompt += `## MAP.md\nRead this file for file:line references: ${mapPath}\n\n`;
    }
    if (journalContext) {
      systemPrompt += '## JOURNAL CONTEXT\n' + journalContext.substring(0, 2000) + '\n\n';
    }
    
    systemPrompt += `⚠️ BRAINSTORM MODE: EXPLORE ONLY. NO IMPLEMENTATION. ⚠️

You are the Brainstormer. Your job: explore ideas, ask questions, show ASCII diagrams.

CRITICAL: Do NOT write code, edit files, or implement anything.
Brainstorm = explore & shape vision only. Implementation happens in \`atris do\` phase.

Start the conversation NOW.`;

    // Build user prompt
    let userPrompt = '';
    if (hasTopic && topicSummary) {
      userPrompt = brainstormMessage;
    } else {
      userPrompt = 'No specific idea yet. Help me explore what we could build.';
      if (selectedInboxItem) {
        userPrompt += `\n\n💡 Optional context: There's an inbox item I${selectedInboxItem.id}: "${selectedInboxItem.text}"`;
        userPrompt += '\n   You can reference it, but start the conversation fresh.';
      }
    }

    console.log('');
    console.log('🤖 AGENT MODE: Executing via backend API...');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Execute via API
    try {
      await executeCodeExecution({
        prompt: userPrompt,
        allowedTools: ['Read'], // Brainstorm mode: only read, no write
        permissionMode: 'default',
        maxTurns: 10,
        systemPrompt,
        workingDirectory: process.cwd(),
        agentId: config.agent_id,
        token: credentials.token,
        onMessage: (data) => {
          if (data.type === 'text' && data.content) {
            process.stdout.write(data.content);
          } else if (data.type === 'tool_use') {
            console.log(`\n🛠️  [${data.tool || data.tool_name}] ${JSON.stringify(data.input || data.tool_input || {}).substring(0, 100)}`);
          } else if (data.type === 'tool_result') {
            const result = data.result || data.content || '';
            const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
            const preview = resultStr.substring(0, 200);
            console.log(`\n✅ [Result] ${preview}${resultStr.length > 200 ? '...' : ''}`);
          } else if (data.type === 'error') {
            console.error(`\n❌ Error: ${data.error}`);
          } else if (data.type === 'result') {
            // Final result message
            if (data.result) {
              console.log(`\n🎯 [Final] ${data.result}`);
            }
            if (data.duration_ms) {
              console.log(`⏱️  Duration: ${(data.duration_ms / 1000).toFixed(2)}s`);
            }
            if (data.cost_usd) {
              console.log(`💰 Cost: $${data.cost_usd.toFixed(4)}`);
            }
          }
        },
        onError: (error) => {
          console.error(`\n❌ Execution error: ${error.message}`);
        },
      });
      
      console.log('\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('💡 After shaping the vision, you can run:');
      console.log('   • `atris plan` - to break vision into tasks');
      console.log('   • `atris do` - to execute tasks');
      console.log('   • `atris review` - to validate');
      console.log('   • `atris launch` - to ship');
      console.log('');
    } catch (error) {
      console.error(`\n✗ Agent execution failed: ${error.message}`);
      throw error;
    }
  } else {
    // Prompt mode: output text (default behavior)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 INSTRUCTION PROMPT FOR YOUR CODING AGENT:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('⚠️  BRAINSTORM MODE: EXPLORE ONLY. NO IMPLEMENTATION. ⚠️');
    console.log('');
    console.log('You are the Brainstormer. Your job: explore ideas, ask questions, show ASCII diagrams.');
    console.log('');
    console.log('CRITICAL: Do NOT write code, edit files, or implement anything.');
    console.log('Brainstorm = explore & shape vision only. Implementation happens in `atris do` phase.');
    console.log('');
    console.log('Start the conversation NOW.');
    console.log('');
    if (hasTopic && topicSummary) {
      console.log('BRAINSTORM TOPIC:');
      console.log(brainstormMessage);
    } else {
      console.log('BRAINSTORM TOPIC:');
      console.log('(Blank - no idea yet. Help explore possibilities and shape a vision together.)');
      if (selectedInboxItem) {
        console.log('');
        console.log(`💡 Optional context: There's an inbox item I${selectedInboxItem.id}: "${selectedInboxItem.text}"`);
        console.log('   You can reference it, but start the conversation fresh.');
      }
    }
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('💡 After shaping the vision, you can run:');
    console.log('   • `atris plan` - to break vision into tasks');
    console.log('   • `atris do` - to execute tasks');
    console.log('   • `atris review` - to validate');
    console.log('   • `atris launch` - to ship');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
}

module.exports = { brainstormAtris };
