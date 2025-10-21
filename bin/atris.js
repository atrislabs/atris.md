#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const command = process.argv[2];

if (!command) {
  console.log('Usage: atris <command>');
  console.log('Commands:');
  console.log('  init   - Initialize ATRIS in current project');
  process.exit(0);
}

// Command handlers
if (command === 'init') {
  initAtris();
} else {
  console.log(`Unknown command: ${command}`);
  console.log('Run "atris" without arguments to see available commands');
  process.exit(1);
}

function initAtris() {
  const targetDir = path.join(process.cwd(), 'atris');
  const sourceFile = path.join(__dirname, '..', 'atris.md');
  const targetFile = path.join(targetDir, 'atris.md');

  // Create atris/ folder if it doesn't exist
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log('✓ Created atris/ folder');
  } else {
    console.log('✓ atris/ folder already exists');
  }

  // Copy atris.md to the folder
  if (fs.existsSync(sourceFile)) {
    fs.copyFileSync(sourceFile, targetFile);
    console.log('✓ Copied atris.md to atris/ folder');
    console.log('\nATRIS initialized! Next steps:');
    console.log('1. Read atris/atris.md for instructions');
    console.log('2. Paste the content to Claude or your favorite AI agent');
    console.log('3. The agent will generate CODE_MAP.md and specialized agents');
  } else {
    console.error('✗ Error: atris.md not found in package');
    process.exit(1);
  }
}
