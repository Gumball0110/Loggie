# Loggie

Loggie is a small, friendly desktop companion for macOS. Its original terminal companion is still included and explains commands, failures, risk, and AI coding-agent activity.

## Requirements

- macOS
- Node.js 20 or newer
- zsh (for command lifecycle information)

Antigravity CLI and Claude Code are optional. Loggie still works as a normal split terminal when neither is installed.

## Install for local development

```bash
npm install
npm link
```

## Desktop companion (Milestone 1)

Launch the standalone desktop app:

```bash
npm run desktop
```

A floating Loggie mascot appears above your ordinary app windows. Click it to open the assistant on the right side of the display under your pointer. You can also press `Command+Shift+L`, or use the Loggie menu bar icon, to open and close the assistant.

The mascot can be dragged and its position is restored after restart. Use **hide Loggie** in the panel to hide both windows; the menu bar icon and keyboard shortcut remain available. Use **Quit Loggie** in the menu bar menu to stop the app.

This milestone intentionally does not connect Gmail or call OpenAI yet. The text box returns a clear setup message instead of simulating email access. Your existing `.env` file stays local and is ignored by Git; it will be used by the agent milestone later.

Quick desktop verification:

```bash
npm run desktop:smoke
```

The smoke check opens both secure Electron renderer pages, then quits automatically. On macOS you may be asked to allow the global keyboard shortcut the first time you use it.

### Manual Milestone 1 test

1. Run `npm install`, then `npm run desktop`.
2. Confirm the mascot floats above another app and can be dragged.
3. Click the mascot and confirm the right sidebar opens without covering the menu bar or Dock.
4. Minimize the sidebar and reopen it with `Command+Shift+L`.
5. Move the mascot to a second display, quit from the menu bar, relaunch, and confirm it returns to a visible position.
6. Type a message and confirm Loggie states that Gmail is not connected rather than claiming to access email.

### Not implemented yet

- Milestone 2: Google OAuth, secure credential storage, and read-only Gmail search/thread retrieval.
- Milestone 3: OpenAI-powered intent handling and draft generation.
- Milestone 4: editable approval flow and Gmail sending.
- Milestone 5: full end-to-end tests, packaging, and final documentation.

## Terminal companion

Start Loggie in any project:

```bash
cd /path/to/your/project
loggie
```

The left side is a normal zsh session. The right side explains what happened in plain language, summarizes the command's raw output, and shows exit status, duration, risk, and supported AI-agent activity. The MVP explainer runs locally and does not require an AI API. Run ordinary commands or start an AI tool from the left side:

```bash
ls
npm test
agy
claude
```

Type `exit` to close Loggie.

## AI integrations

Install the observer plugin once for deeper Antigravity activity:

```bash
loggie install
loggie doctor
```

You can start an AI tool directly inside the TUI:

```bash
loggie agy
loggie claude
```

Claude currently runs inside the Loggie terminal, but its dedicated hook adapter is planned for a later version.

## Optional web inspector

The previous browser experience remains available:

```bash
loggie --web
```

The GitHub Pages build is a static visual demo:

https://gumball0110.github.io/Loggie/

## Development

```bash
npm test
```

The TUI uses a local pseudo-terminal and an in-memory terminal emulator. Shell integration is injected through a temporary zsh configuration and removed when the session ends; Loggie does not edit the user's `.zshrc`.

Remove the Antigravity plugin with:

```bash
loggie uninstall
```
