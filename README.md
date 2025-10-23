# Atris

Drop one command. Your team of AI agents instantly know your entire codebase.

No more "where is the auth logic?" or "which file handles payments?" Atris gives AI agents a navigation system with exact file:line answers in seconds.

## Install

```bash
npm install -g atris
```

→ npm package: https://www.npmjs.com/package/atris

## Usage

```bash
cd your-project
atris init
atris activate
```

See `atris/GETTING_STARTED.md` for full instructions. Your AI agent reads `atris/atris.md` and generates:
- **MAP.md** - Navigation guide with file:line precision
- **agent_team/** - Navigator, executor, validator specs
- **TASK_CONTEXTS.md** - Structured task bank

Takes ~10 minutes. Works for code, product, sales, research—any system.

## Update

```bash
atris update
```

Syncs local `atris.md` to latest version.

## Talk to agents

`atris activate` works immediately — it loads your journal, MAP, and TASK_CONTEXTS without needing an account. When you're ready to collaborate with Atris cloud agents, run:

```bash
atris agent   # pick an agent persona for this project
atris login   # authenticate once for cloud sync + chat
atris chat    # open an interactive session
```

---

**License:** MIT | **Repo:** [github.com/atrislabs/atris.md](https://github.com/atrislabs/atris.md.git)
