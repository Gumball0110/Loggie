# Loggie

Loggie is a friendly terminal companion that explains commands, failures, risk, and AI coding-agent activity without requiring a separate browser window.

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
