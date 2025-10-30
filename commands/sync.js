const fs = require('fs');
const path = require('path');

function syncAtris() {
  const targetDir = path.join(process.cwd(), 'atris');
  const agentTeamDir = path.join(targetDir, 'agent_team');

  if (!fs.existsSync(targetDir)) {
    console.error('✗ Error: atris/ folder not found. Run "atris init" first.');
    process.exit(1);
  }

  if (!fs.existsSync(agentTeamDir)) {
    fs.mkdirSync(agentTeamDir, { recursive: true });
  }

  const filesToSync = [
    { source: 'atris.md', target: 'atris.md' },
    { source: 'PERSONA.md', target: 'PERSONA.md' },
    { source: 'GETTING_STARTED.md', target: 'GETTING_STARTED.md' },
    { source: 'atris/agent_team/navigator.md', target: 'agent_team/navigator.md' },
    { source: 'atris/agent_team/executor.md', target: 'agent_team/executor.md' },
    { source: 'atris/agent_team/validator.md', target: 'agent_team/validator.md' },
    { source: 'atris/agent_team/launcher.md', target: 'agent_team/launcher.md' }
  ];

  let updated = 0;
  let skipped = 0;

  filesToSync.forEach(({ source, target }) => {
    const sourceFile = path.join(__dirname, '..', source);
    const targetFile = path.join(targetDir, target);

    if (!fs.existsSync(sourceFile)) {
      console.log(`⚠ Skipping ${source} (not found in package)`);
      return;
    }

    const currentContent = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, 'utf8') : '';
    const newContent = fs.readFileSync(sourceFile, 'utf8');

    if (currentContent === newContent) {
      skipped++;
      return;
    }

    fs.copyFileSync(sourceFile, targetFile);
    console.log(`✓ Updated ${target}`);
    updated++;
  });

  if (updated === 0) {
    console.log('✓ Already up to date');
  } else {
    console.log(`\n✓ Updated ${updated} file(s), ${skipped} unchanged`);
    console.log('\nRun your AI agent again to use the latest specs and agent templates.');
  }
}

module.exports = { syncAtris };
