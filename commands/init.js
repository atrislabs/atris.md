const fs = require('fs');
const path = require('path');

/**
 * Detect project context by scanning project structure
 * @param {string} projectRoot - Root directory of the project
 * @returns {Object} Detected project context
 */
function detectProjectContext(projectRoot = process.cwd()) {
  const detected = {
    type: 'unknown',
    framework: 'none',
    hasCode: false,
    testCommand: 'none',
    fileStructure: [],
    conventions: {}
  };

  // Check for package files
  const packageFiles = {
    'package.json': 'nodejs',
    'requirements.txt': 'python',
    'pyproject.toml': 'python',
    'Gemfile': 'ruby',
    'go.mod': 'go',
    'Cargo.toml': 'rust',
    'pom.xml': 'java',
    'composer.json': 'php',
    'mix.exs': 'elixir',
    'dub.json': 'd',
    'Podfile': 'ios'
  };

  // Detect primary type from package files
  for (const [file, type] of Object.entries(packageFiles)) {
    if (fs.existsSync(path.join(projectRoot, file))) {
      detected.type = type;
      detected.hasCode = true;
      break;
    }
  }

  // Check for framework indicators
  const frameworks = {
    'package.json': () => {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps.react || deps['react-dom']) return 'react';
        if (deps.vue) return 'vue';
        if (deps.angular || deps['@angular/core']) return 'angular';
        if (deps.next) return 'next';
        if (deps['express']) return 'express';
        if (deps['fastify']) return 'fastify';
        return 'nodejs';
      } catch (e) {
        return 'nodejs';
      }
    },
    'requirements.txt': () => {
      try {
        const req = fs.readFileSync(path.join(projectRoot, 'requirements.txt'), 'utf8');
        if (req.includes('django')) return 'django';
        if (req.includes('flask')) return 'flask';
        if (req.includes('fastapi')) return 'fastapi';
        return 'python';
      } catch (e) {
        return 'python';
      }
    },
    'Gemfile': () => {
      try {
        const gemfile = fs.readFileSync(path.join(projectRoot, 'Gemfile'), 'utf8');
        if (gemfile.includes('rails')) return 'rails';
        if (gemfile.includes('sinatra')) return 'sinatra';
        return 'ruby';
      } catch (e) {
        return 'ruby';
      }
    }
  };

  // Detect framework if we found a package file
  if (detected.type !== 'unknown') {
    const frameworkDetector = frameworks[Object.keys(packageFiles).find(f => 
      fs.existsSync(path.join(projectRoot, f)) && packageFiles[f] === detected.type
    )];
    if (frameworkDetector) {
      detected.framework = frameworkDetector();
    } else {
      detected.framework = detected.type;
    }
  }

  // Check for file structure
  const dirs = ['src', 'app', 'lib', 'docs', 'config', 'test', 'tests', '__tests__', 'spec'];
  for (const dir of dirs) {
    const dirPath = path.join(projectRoot, dir);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      detected.fileStructure.push(dir + '/');
    }
  }

  // Detect test command based on type
  const testCommands = {
    'nodejs': 'npm test',
    'python': 'pytest',
    'ruby': 'rspec',
    'go': 'go test ./...',
    'rust': 'cargo test',
    'java': 'mvn test',
    'php': 'phpunit',
    'elixir': 'mix test'
  };
  if (detected.type !== 'unknown' && testCommands[detected.type]) {
    detected.testCommand = testCommands[detected.type];
  }

  // Check if it's a knowledge base (only markdown files, no code)
  if (detected.type === 'unknown' && detected.fileStructure.length === 0) {
    const files = fs.readdirSync(projectRoot);
    const hasCodeFiles = files.some(f => {
      const ext = path.extname(f);
      return ['.js', '.ts', '.py', '.rb', '.go', '.rs', '.java', '.php', '.tsx', '.jsx', '.vue'].includes(ext);
    });
    const hasMdFiles = files.some(f => path.extname(f) === '.md');
    
    if (!hasCodeFiles && hasMdFiles) {
      detected.type = 'knowledge-base';
      detected.hasCode = false;
      detected.testCommand = 'none';
      detected.framework = 'none';
    }
  }

  // Check for test directories to confirm test command
  const testDirs = ['test', 'tests', '__tests__', 'spec'];
  const hasTestDir = testDirs.some(dir => 
    fs.existsSync(path.join(projectRoot, dir)) && 
    fs.statSync(path.join(projectRoot, dir)).isDirectory()
  );
  
  // If no test dir and we're a codebase, testCommand might be custom
  if (!hasTestDir && detected.hasCode && detected.testCommand !== 'none') {
    // Keep detected test command but note it might be custom
  }

  return detected;
}

/**
 * Inject project-specific patterns into agent specs
 * @param {string} agentTeamDir - Directory containing agent_team specs
 * @param {Object} profile - Project profile from detectProjectContext()
 */
function injectProjectPatterns(agentTeamDir, profile) {
  const executorFile = path.join(agentTeamDir, 'executor.md');
  const navigatorFile = path.join(agentTeamDir, 'navigator.md');
  const validatorFile = path.join(agentTeamDir, 'validator.md');

  // Inject into executor.md
  if (fs.existsSync(executorFile)) {
    let executorContent = fs.readFileSync(executorFile, 'utf8');
    
    // Add project-specific test command section
    const testSection = `## Project Context

This is a **${profile.type}** project${profile.framework !== 'none' ? ` using **${profile.framework}**` : ''}.

**Test Command:** ${profile.hasCode ? `\`${profile.testCommand}\`` : 'None (knowledge base)'}

${profile.hasCode ? `**Validation:** Run \`${profile.testCommand}\` before marking tasks complete.` : '**Validation:** Ensure markdown structure and formatting is correct. No code execution needed.'}

**File Structure:** ${profile.fileStructure.length > 0 ? profile.fileStructure.join(', ') : 'Standard project structure'}

---

`;
    
    // Insert after the Activation Prompt section
    if (executorContent.includes('---\n\n## Workflow')) {
      executorContent = executorContent.replace('---\n\n## Workflow', `${testSection}## Workflow`);
      fs.writeFileSync(executorFile, executorContent);
    }
  }

  // Inject into navigator.md
  if (fs.existsSync(navigatorFile)) {
    let navigatorContent = fs.readFileSync(navigatorFile, 'utf8');
    
    const projectNote = `## Project Context

**Project Type:** ${profile.type}${profile.framework !== 'none' ? ` (${profile.framework})` : ''}

**Structure:** ${profile.fileStructure.length > 0 ? profile.fileStructure.join(', ') : 'Standard structure'}

When planning tasks, consider the project structure and conventions above.

---

`;
    
    if (navigatorContent.includes('---\n\n## Workflow')) {
      navigatorContent = navigatorContent.replace('---\n\n## Workflow', `${projectNote}## Workflow`);
      fs.writeFileSync(navigatorFile, navigatorContent);
    }
  }

  // Inject into validator.md
  if (fs.existsSync(validatorFile)) {
    let validatorContent = fs.readFileSync(validatorFile, 'utf8');
    
    const validationNote = `## Project Context

**Project Type:** ${profile.type}${profile.framework !== 'none' ? ` (${profile.framework})` : ''}

${profile.hasCode ? `**Validation:** Run \`${profile.testCommand}\` to verify changes work correctly.` : '**Validation:** Verify markdown formatting, structure, and completeness. No code execution needed.'}

---

`;
    
    if (validatorContent.includes('---\n\n## ')) {
      validatorContent = validatorContent.replace('---\n\n## ', `${validationNote}## `);
      fs.writeFileSync(validatorFile, validatorContent);
    }
  }
}

function initAtris() {
  const targetDir = path.join(process.cwd(), 'atris');
  const agentTeamDir = path.join(targetDir, 'agent_team');
  const sourceFile = path.join(__dirname, '..', 'atris.md');
  const targetFile = path.join(targetDir, 'atris.md');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log('✓ Created atris/ folder');
  } else {
    console.log('✓ atris/ folder already exists');
  }

  if (!fs.existsSync(agentTeamDir)) {
    fs.mkdirSync(agentTeamDir, { recursive: true });
    console.log('✓ Created atris/agent_team/ folder');
  }

  const gettingStartedFile = path.join(targetDir, 'GETTING_STARTED.md');
  const personaFile = path.join(targetDir, 'PERSONA.md');
  const mapFile = path.join(targetDir, 'MAP.md');
  const todoFile = path.join(targetDir, 'TODO.md');
  const navigatorFile = path.join(agentTeamDir, 'navigator.md');
  const executorFile = path.join(agentTeamDir, 'executor.md');
  const validatorFile = path.join(agentTeamDir, 'validator.md');
  const launcherFile = path.join(agentTeamDir, 'launcher.md');
  const brainstormerFile = path.join(agentTeamDir, 'brainstormer.md');

  const gettingStartedSource = path.join(__dirname, '..', 'GETTING_STARTED.md');
  const personaSource = path.join(__dirname, '..', 'PERSONA.md');

  if (!fs.existsSync(gettingStartedFile) && fs.existsSync(gettingStartedSource)) {
    fs.copyFileSync(gettingStartedSource, gettingStartedFile);
    console.log('✓ Created GETTING_STARTED.md');
  }

  if (!fs.existsSync(personaFile) && fs.existsSync(personaSource)) {
    fs.copyFileSync(personaSource, personaFile);
    console.log('✓ Created PERSONA.md');
  }

  if (!fs.existsSync(mapFile)) {
    fs.writeFileSync(mapFile, '# MAP.md\n\n> Generated by your AI agent after reading atris.md\n\nRun your AI agent with atris.md to populate this file.\n');
    console.log('✓ Created MAP.md placeholder');
  }

  if (!fs.existsSync(todoFile)) {
    fs.writeFileSync(
      todoFile,
      '# TODO.md\n\n' +
      '> Working TODO list for this project.\n' +
      '> Use this file as the current working context (tasks, links to features, etc.).\n' +
      '\n' +
      'Your AI agent can auto-populate this file after reading atris.md.\n'
    );
    console.log('✓ Created TODO.md placeholder');
  }

  // Create features directory and README
  const featuresDir = path.join(targetDir, 'features');
  const templatesDir = path.join(featuresDir, '_templates');
  
  if (!fs.existsSync(featuresDir)) {
    fs.mkdirSync(featuresDir, { recursive: true });
    const featuresReadme = path.join(featuresDir, 'README.md');
    fs.writeFileSync(featuresReadme, '# Features\n\nThis directory tracks all features built using the atrisDev protocol.\n\nEach feature has:\n- `[feature-name]/idea.md` - Problem, solution, diagrams, success criteria\n- `[feature-name]/build.md` - Implementation plan, files changed, testing\n- `[feature-name]/validate.md` - End-to-end simulation script\n\n---\n\n## Features Built\n\n*Features will appear here as you build them.*\n');
    console.log('✓ Created features/ directory with README');
  }

  // Create _templates/validate.md.template if not exists
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }
  const validateTemplateSource = path.join(__dirname, '..', 'atris', 'features', '_templates', 'validate.md.template');
  const validateTemplateTarget = path.join(templatesDir, 'validate.md.template');
  
  if (fs.existsSync(validateTemplateSource)) {
    fs.copyFileSync(validateTemplateSource, validateTemplateTarget);
    console.log('✓ Created features/_templates/validate.md.template');
  } else {
    // Fallback if source not found (for safety)
    const fallbackContent = `# Validation — [Feature Name]\n\n> **Role:** System Validation Script\n> **Executor:** Validator Agent\n> **Instructions:** Run these steps sequentially. If ANY step fails, the feature is broken.\n\n---\n\n## 1. Environment Check\n- [ ] **Pre-flight:**\n  - Command: \`npm run type-check\` (or relevant)\n  - Expect: No errors\n\n## 2. Simulation Steps (The "Real" Test)\n\n### Step 1: [Name]\n- **Action:** [Exact command]\n- **Expect:** [Exact output regex]\n\n---\n\n**Status:** [Pending | Verified]\n`;
    fs.writeFileSync(validateTemplateTarget, fallbackContent);
    console.log('✓ Created features/_templates/validate.md.template (fallback)');
  }


  const navigatorSource = path.join(__dirname, '..', 'atris', 'agent_team', 'navigator.md');
  const executorSource = path.join(__dirname, '..', 'atris', 'agent_team', 'executor.md');
  const validatorSource = path.join(__dirname, '..', 'atris', 'agent_team', 'validator.md');
  const launcherSource = path.join(__dirname, '..', 'atris', 'agent_team', 'launcher.md');
  const brainstormerSource = path.join(__dirname, '..', 'atris', 'agent_team', 'brainstormer.md');

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

  if (!fs.existsSync(brainstormerFile) && fs.existsSync(brainstormerSource)) {
    fs.copyFileSync(brainstormerSource, brainstormerFile);
    console.log('✓ Created agent_team/brainstormer.md');
  }

  // Detect project context and generate profile
  const profile = detectProjectContext(process.cwd());
  const profileFile = path.join(targetDir, '.project-profile.json');
  fs.writeFileSync(profileFile, JSON.stringify(profile, null, 2));
  console.log(`✓ Generated .project-profile.json (detected: ${profile.type}${profile.framework !== 'none' ? '/' + profile.framework : ''})`);

  // Inject project patterns into agent specs
  injectProjectPatterns(agentTeamDir, profile);
  console.log('✓ Injected project patterns into agent_team specs');

  // Create agent instruction files for different tools
  const agentInstructions = `# atrisDev Protocol

When the user asks to build/plan/fix/check something, FIRST run:

\`\`\`bash
atris
\`\`\`

Then follow the instructions in the output.

## Workflow

The \`atris\` command will tell you to:
1. Read atris.md (the full protocol)
2. Show atris visualization
3. Wait for approval
4. Create atris/features/[name]/idea.md + build.md
5. Execute step by step
6. Review and update atris/features/README.md

DO NOT explore the codebase manually. Run \`atris\` first, then follow its instructions.`;

  // .cursorrules for Cursor
  const cursorRulesFile = path.join(process.cwd(), '.cursorrules');
  if (!fs.existsSync(cursorRulesFile)) {
    fs.writeFileSync(cursorRulesFile, agentInstructions);
    console.log('✓ Created .cursorrules (for Cursor)');
  }

  // AGENTS.md for Codex
  const agentsMdFile = path.join(process.cwd(), 'AGENTS.md');
  if (!fs.existsSync(agentsMdFile)) {
    fs.writeFileSync(agentsMdFile, agentInstructions);
    console.log('✓ Created AGENTS.md (for Codex)');
  }

  // CLAUDE.md for Claude Code (copy from atris/)
  const claudeMdSource = path.join(__dirname, '..', 'atris', 'CLAUDE.md');
  const claudeMdFile = path.join(targetDir, 'CLAUDE.md');
  if (!fs.existsSync(claudeMdFile) && fs.existsSync(claudeMdSource)) {
    fs.copyFileSync(claudeMdSource, claudeMdFile);
    console.log('✓ Created atris/CLAUDE.md (for Claude Code)');
  }

  if (fs.existsSync(sourceFile)) {
    fs.copyFileSync(sourceFile, targetFile);
    console.log('✓ Copied atris.md to atris/ folder');
    console.log('\n✨ ATRIS initialized! Full structure created:');
    console.log('   atris/');
    console.log('   ├── GETTING_STARTED.md (read this first!)');
    console.log('   ├── PERSONA.md (agent personality)');
    console.log('   ├── atris.md (AI agent instructions)');
    console.log('   ├── MAP.md (placeholder)');
    console.log('   ├── TODO.md (placeholder)');
    console.log('   └── agent_team/');
    console.log('       ├── brainstormer.md (vision shaper)');
    console.log('       ├── navigator.md (planner)');
    console.log('       ├── executor.md (builder)');
    console.log('       ├── validator.md (reviewer)');
    console.log('       └── launcher.md (closer)');
    console.log('\nNext steps:');
    console.log('1. Read atris/GETTING_STARTED.md for the full guide');
    console.log('2. Open atris/atris.md and paste it to your AI agent');
    console.log('3. Your agent will populate all placeholder files in ~10 mins');
  } else {
    console.error('✗ Error: atris.md not found in package');
    process.exit(1);
  }
}

module.exports = { initAtris, detectProjectContext };
