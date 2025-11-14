const fs = require('fs');
const path = require('path');
const { getLogPath } = require('../lib/journal');

async function planAtris() {
  const { loadConfig } = require('../utils/config');
  const { loadCredentials } = require('../utils/auth');
  const { executeCodeExecution } = require('../utils/claude_sdk');
  const args = process.argv.slice(3);
  const executeFlag = args.includes('--execute');
  
  const config = loadConfig();
  const executionMode = executeFlag ? 'agent' : (config.execution_mode || 'prompt');
  
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

  // Detect uncertainty in inbox context
  const uncertaintySignals = ['not sure', 'maybe', 'but ', 'thinking about', 'uncertain', 'unclear', 'unsure', 'don\'t know'];
  const hasUncertainty = inboxContext && uncertaintySignals.some(signal =>
    inboxContext.toLowerCase().includes(signal)
  );

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│ ATRIS Plan — Navigator Agent Activated                      │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');

  // Show suggestion if uncertainty detected
  if (hasUncertainty) {
    console.log('💡 Suggestion:');
    console.log('   Sounds like you\'re exploring options.');
    console.log('   Try `atris brainstorm` first for conversational exploration,');
    console.log('   then run `atris plan` when ready to commit.');
    console.log('');
    console.log('   Or continue with plan if you prefer. Your call.');
    console.log('');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('');
  }
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
  console.log('You are the Navigator. Plan features and create the build spec.');
  console.log('');
  console.log('⚠️  APPROVAL REQUIRED — Follow this workflow:');
  console.log('');
  console.log('STEP 1: Show ASCII visualization');
  console.log('   Create diagrams showing:');
  console.log('   - Architecture: Component interactions, data flow');
  console.log('   - DB schema: Tables, relationships, indexes');
  console.log('   - UI/UX: User flow, screen layouts');
  console.log('   SHOW diagrams to user and WAIT for approval.');
  console.log('');
  console.log('STEP 2: After approval, ask user where to save the plan');
  console.log('   Options:');
  console.log('   A) Create NEW feature folder: atris/features/[name]/');
  console.log('   B) Update EXISTING feature: atris/features/[existing-name]/');
  console.log('   C) Simple task: Just update TASK_CONTEXTS.md');
  console.log('');
  console.log('   Check atris/features/ to see existing features.');
  console.log('   If this is small/simple, suggest option C.');
  console.log('   If this is substantial new feature, suggest option A.');
  console.log('   If extending existing feature, suggest option B.');
  console.log('');
  console.log('STEP 3: Based on user choice:');
  console.log('');
  console.log('   If NEW feature (option A):');
  console.log('     - Create atris/features/[feature-name]/');
  console.log('     - Create idea.md (problem, solution, ASCII diagrams, success criteria)');
  console.log('     - Create build.md (step-by-step instructions for executor)');
  console.log('     - Update atris/features/README.md');
  console.log('');
  console.log('   If EXISTING feature (option B):');
  console.log('     - Update atris/features/[existing-name]/build.md');
  console.log('     - Optionally update idea.md if scope changed');
  console.log('     - Update atris/features/README.md status');
  console.log('');
  console.log('   If SIMPLE task (option C):');
  console.log('     - Add task to TASK_CONTEXTS.md Backlog section');
  console.log('');
  console.log('⛔ DO NOT execute the build — that\'s for "atris do" (executor agent)');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 After planning: Run "atris do" to execute the build');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  // Check execution mode
  if (executionMode === 'agent') {
    // Agent mode: execute via backend API
    if (!config.agent_id) {
      throw new Error('No agent selected. Run "atris agent" first.');
    }
    const credentials = loadCredentials();
    if (!credentials || !credentials.token) {
      throw new Error('Not logged in. Run "atris login" first.');
    }

    // Build system prompt
    let systemPrompt = '';
    if (navigatorSpec) {
      systemPrompt += navigatorSpec + '\n\n';
    }
    
    // Reference MAP.md and PERSONA.md
    const personaFile = path.join(targetDir, 'PERSONA.md');
    if (fs.existsSync(personaFile)) {
      systemPrompt += '## PERSONA.md\n' + fs.readFileSync(personaFile, 'utf8') + '\n\n';
    }
    
    const mapFile = path.join(targetDir, 'MAP.md');
    const mapPath = fs.existsSync(mapFile) ? path.relative(process.cwd(), mapFile) : null;
    if (mapPath) {
      systemPrompt += `## MAP.md\nRead this file for file:line references: ${mapPath}\n\n`;
    }

    // Build user prompt with context
    let userPrompt = `You are the Navigator. Take ideas from Inbox → break them down into perfect, manageable tasks.\n\n`;
    userPrompt += `⚠️ CRITICAL: You MUST create visualizations BEFORE writing tasks!\n\n`;
    
    if (inboxContext) {
      userPrompt += `## INBOX CONTEXT:\n${inboxContext}\n\n`;
    } else {
      userPrompt += `## INBOX CONTEXT:\n(No items in Inbox - check logs/YYYY/YYYY-MM-DD.md for inbox items)\n\n`;
    }
    
    if (taskContexts) {
      userPrompt += `## CURRENT TASK_CONTEXTS.md:\n${taskContexts}\n\n`;
    }
    
    userPrompt += `Your job (execute these steps):\n\n`;
    userPrompt += `STEP 1: Generate ASCII visualizations for user approval\n`;
    userPrompt += `   Create diagrams showing architecture, flows, schemas, UI/UX.\n`;
    userPrompt += `   SHOW these diagrams and wait for approval before proceeding.\n\n`;
    userPrompt += `STEP 2: Break approved ideas into concrete tasks\n`;
    userPrompt += `   - Each task should be: Specific, Measurable, Actionable\n`;
    userPrompt += `   - Include file:line references from MAP.md\n`;
    userPrompt += `   - List dependencies between tasks\n`;
    userPrompt += `   - Add acceptance criteria for each task\n\n`;
    userPrompt += `STEP 3: Write tasks to TASK_CONTEXTS.md\n`;
    userPrompt += `   - Add tasks to Backlog section\n`;
    userPrompt += `   - Format: Task number, description, file refs, acceptance criteria\n`;
    userPrompt += `   - Quality over speed - tasks must be perfect for systems player execution\n\n`;
    userPrompt += `Start planning now. Read MAP.md for file references.`;

    console.log('');
    console.log('🤖 AGENT MODE: Executing via backend API...');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Execute via API
    try {
      await executeCodeExecution({
        prompt: userPrompt,
        allowedTools: ['Read', 'Write', 'Edit'], // Navigator needs to write TASK_CONTEXTS.md
        permissionMode: 'default',
        maxTurns: 15,
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
      console.log('💡 After planning: Run "atris do" to execute tasks');
      console.log('');
    } catch (error) {
      console.error(`\n✗ Agent execution failed: ${error.message}`);
      throw error;
    }
  }
  // Prompt mode continues with existing output (already logged above)
}

module.exports = {
  planAtris
};

async function doAtris() {
  const { loadConfig } = require('../utils/config');
  const { loadCredentials } = require('../utils/auth');
  const { executeCodeExecution } = require('../utils/claude_sdk');
  const args = process.argv.slice(3);
  const executeFlag = args.includes('--execute');
  
  const config = loadConfig();
  const executionMode = executeFlag ? 'agent' : (config.execution_mode || 'prompt');
  
  const cwd = process.cwd();
  const targetDir = path.join(cwd, 'atris');
  const executorFile = path.join(targetDir, 'agent_team', 'executor.md');

  if (!fs.existsSync(executorFile)) {
    console.log('✗ executor.md not found. Run "atris init" first.');
    process.exit(1);
  }

  // Load project profile for context
  let context = 'ROOT';
  let profile = null;
  const profileFile = path.join(targetDir, '.project-profile.json');
  if (fs.existsSync(profileFile)) {
    try {
      profile = JSON.parse(fs.readFileSync(profileFile, 'utf8'));
      // Use profile type as context (e.g., 'nodejs', 'python', 'knowledge-base')
      context = profile.type.toUpperCase();
      if (profile.framework !== 'none') {
        context += `/${profile.framework.toUpperCase()}`;
      }
    } catch (e) {
      // Fallback to ROOT if profile parse fails
      context = 'ROOT';
    }
  }
  
  // Load executor spec
  const executorSpec = fs.readFileSync(executorFile, 'utf8');

  // Load PERSONA.md
  const personaFile = path.join(targetDir, 'PERSONA.md');
  let persona = '';
  if (fs.existsSync(personaFile)) {
    persona = fs.readFileSync(personaFile, 'utf8');
  }

  // Reference MAP.md (agents read on-demand)
  const mapFile = path.join(targetDir, 'MAP.md');
  const mapPath = fs.existsSync(mapFile) ? path.relative(process.cwd(), mapFile) : null;

  // Load tasks from TASK_CONTEXTS.md (generic - no hardcoded paths)
  let tasksContent = '';
  let taskSource = '';
  const taskContextsFile = path.join(targetDir, 'TASK_CONTEXTS.md');
  if (fs.existsSync(taskContextsFile)) {
    tasksContent = fs.readFileSync(taskContextsFile, 'utf8');
    taskSource = 'atris/TASK_CONTEXTS.md';
  }
  
  // Extract tasks from TASK_CONTEXTS.md (no tag filtering - all tasks available)
  const taskTag = '';
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
  
  // Load TASK_CONTEXTS.md content (using existing taskContextsFile variable)
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
  
  if (mapPath) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🗺️  MAP.md: ' + mapPath);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Read this file for file:line references when navigating the codebase.');
    console.log('');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 INSTRUCTION PROMPT FOR YOUR CODING AGENT:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('You are the Executor. Build exactly what\'s in the spec.');
  console.log('');
  console.log('⚠️  Find your build instructions:');
  console.log('');
  console.log('STEP 1: Check for feature folders');
  console.log('   Look in atris/features/ for folders with build.md');
  console.log('   If you find build.md with status "planning" or "in-progress":');
  console.log('     - Read atris/features/[name]/build.md');
  console.log('     - Execute step-by-step exactly as written');
  console.log('     - Update status in atris/features/README.md as you progress');
  console.log('');
  console.log('STEP 2: If no feature folders, check TASK_CONTEXTS.md');
  console.log('   Look in atris/TASK_CONTEXTS.md Backlog section');
  console.log('   Claim a task (move to In Progress with timestamp)');
  console.log('   Execute the task');
  console.log('   Move to Completed when done');
  console.log('');
  console.log('STEP 3: Execute the build');
  console.log('   - Use file edit tools (NOT just describing)');
  console.log('   - Run terminal commands');
  console.log('   - Test as you go');
  console.log('   - Follow MAP.md for navigation');
  console.log('');
  console.log('STEP 4: After completion');
  console.log('   If feature: Update atris/features/README.md → status: "complete"');
  console.log('   If task: Move to TASK_CONTEXTS.md Completed section');
  console.log('');
  console.log('⛔ DO NOT plan or design — just execute what\'s already written');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  // Check execution mode
  if (executionMode === 'agent') {
    // Agent mode: execute via backend API
    if (!config.agent_id) {
      throw new Error('No agent selected. Run "atris agent" first.');
    }
    const credentials = loadCredentials();
    if (!credentials || !credentials.token) {
      throw new Error('Not logged in. Run "atris login" first.');
    }

    // Build system prompt
    let systemPrompt = '';
    if (executorSpec) {
      systemPrompt += executorSpec + '\n\n';
    }
    if (persona) {
      systemPrompt += '## PERSONA.md\n' + persona + '\n\n';
    }
    if (mapPath) {
      systemPrompt += `## MAP.md\nRead this file for file:line references: ${mapPath}\n\n`;
    }
    if (profile) {
      systemPrompt += `## PROJECT CONTEXT\nType: ${context}\nProfile: ${JSON.stringify(profile, null, 2)}\n\n`;
    }

    // Build user prompt with context
    let userPrompt = `⚠️ CRITICAL: Execute tasks NOW. Use file tools to edit code, terminal to run commands.\n\n`;
    userPrompt += `You are the Executor. Get it done, precisely, following instructions perfectly.\n\n`;
    
    if (filteredTasks) {
      userPrompt += `## TASKS TO EXECUTE (from ${taskSource}):\n${filteredTasks}\n\n`;
    } else {
      userPrompt += `## TASKS TO EXECUTE:\n(No tasks found - check TASK_CONTEXTS.md)\n\n`;
    }
    
    if (taskContexts) {
      userPrompt += `## TASK_CONTEXTS.md (Additional Context):\n${taskContexts}\n\n`;
    }
    
    userPrompt += `Your process (EXECUTE these steps):\n`;
    userPrompt += `1. Read tasks from TASK_CONTEXTS.md (shown above)\n`;
    userPrompt += `2. For each task: Show ASCII visualization first (especially complex changes)\n`;
    userPrompt += `3. Execute task: Use file edit tools, terminal commands, etc.\n`;
    userPrompt += `4. After completion: Move task to TASK_CONTEXTS.md <completed> section\n`;
    userPrompt += `5. Follow PERSONA.md for communication style\n`;
    userPrompt += `6. Use MAP.md to navigate codebase\n\n`;
    userPrompt += `DO NOT just describe what you would do - actually edit files and execute commands!\n`;
    userPrompt += `Context: ${context}\n`;
    userPrompt += `Start executing tasks now.`;

    console.log('');
    console.log('🤖 AGENT MODE: Executing via backend API...');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Execute via API
    try {
      await executeCodeExecution({
        prompt: userPrompt,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash'], // Executor needs all tools
        permissionMode: 'default',
        maxTurns: 20,
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
    } catch (error) {
      console.error(`\n✗ Agent execution failed: ${error.message}`);
      throw error;
    }
  }
  // Prompt mode continues with existing output (already logged above)
}

async function reviewAtris() {
  const { loadConfig } = require('../utils/config');
  const { loadCredentials } = require('../utils/auth');
  const { executeCodeExecution } = require('../utils/claude_sdk');
  const args = process.argv.slice(3);
  const executeFlag = args.includes('--execute');
  
  const config = loadConfig();
  const executionMode = executeFlag ? 'agent' : (config.execution_mode || 'prompt');
  
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

  // Read journal for timestamp context
  const { logFile, dateFormatted } = getLogPath();
  let journalPath = '';
  if (fs.existsSync(logFile)) {
    journalPath = path.relative(process.cwd(), logFile);
  }

  const mapFile = path.join(targetDir, 'MAP.md');
  const mapPath = fs.existsSync(mapFile) ? path.relative(process.cwd(), mapFile) : null;

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
  console.log('🗺️  MAP.md: ' + (mapPath || 'Not found'));
  console.log('   Read this file for file:line references when navigating the codebase.');
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
  
  // Check execution mode
  if (executionMode === 'agent') {
    // Agent mode: execute via backend API
    if (!config.agent_id) {
      throw new Error('No agent selected. Run "atris agent" first.');
    }
    const credentials = loadCredentials();
    if (!credentials || !credentials.token) {
      throw new Error('Not logged in. Run "atris login" first.');
    }

    // Build system prompt
    let systemPrompt = '';
    if (validatorSpec) {
      systemPrompt += validatorSpec + '\n\n';
    }
    if (testingGuide) {
      systemPrompt += '## TESTING GUIDE\n' + testingGuide + '\n\n';
    }
    
    const personaFile = path.join(targetDir, 'PERSONA.md');
    if (fs.existsSync(personaFile)) {
      systemPrompt += '## PERSONA.md\n' + fs.readFileSync(personaFile, 'utf8') + '\n\n';
    }
    
    if (mapPath) {
      systemPrompt += `## MAP.md\nRead this file for file:line references: ${mapPath}\n\n`;
    }

    // Build user prompt with context
    let userPrompt = `You are the Validator. Auto-activated after "atris do" completes.\n\n`;
    userPrompt += `Validation Loop:\n`;
    userPrompt += `  1. Ultrathink (say "ultrathink", think 3 times)\n`;
    userPrompt += `  2. Check requirements → build → edge cases → errors → integration\n`;
    userPrompt += `  3. Run tests (unit, integration, linting, type checking)\n`;
    userPrompt += `  4. If issues found: report → "atris do" fixes → "atris review" again\n`;
    userPrompt += `  5. Repeat until: "✅ All good. Ready for human testing."\n\n`;
    
    if (taskContexts) {
      userPrompt += `## TASK_CONTEXTS.md:\n${taskContexts}\n\n`;
    }
    
    userPrompt += `Your job:\n`;
    userPrompt += `  • Verify everything works\n`;
    userPrompt += `  • Test thoroughly (unless user says no)\n`;
    userPrompt += `  • Update docs if needed (MAP.md, TASK_CONTEXTS.md)\n`;
    userPrompt += `  • Clean TASK_CONTEXTS.md (move completed tasks to Completed section, then delete)\n`;
    userPrompt += `  • Extract learnings for journal\n`;
    userPrompt += `  • Only approve when truly ready for human testing\n\n`;
    userPrompt += `The cycle: do → review → [issues] → do → review → ✅ Ready\n`;
    userPrompt += `Start validating now. Read files, run tests, verify implementation.`;

    console.log('');
    console.log('🤖 AGENT MODE: Executing via backend API...');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Execute via API
    try {
      await executeCodeExecution({
        prompt: userPrompt,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash'], // Validator needs to read, test, update docs
        permissionMode: 'default',
        maxTurns: 15,
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
    } catch (error) {
      console.error(`\n✗ Agent execution failed: ${error.message}`);
      throw error;
    }
  }
  // Prompt mode continues with existing output (already logged above)
}


module.exports = {
  planAtris,
  doAtris,
  reviewAtris
};
