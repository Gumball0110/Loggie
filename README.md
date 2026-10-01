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

## Desktop companion

Launch the standalone desktop app:

```bash
npm run desktop
```

A floating Loggie mascot appears above your ordinary app windows. Click it to open the assistant on the right side of the display under your pointer. You can also press `Command+Shift+L`, or use the Loggie menu bar icon, to open and close the assistant.

The mascot can be dragged and its position is restored after restart. Use **hide Loggie** in the panel to hide both windows; the menu bar icon and keyboard shortcut remain available. Use **Quit Loggie** in the menu bar menu to stop the app.

The desktop app includes read-only Gmail integration. It can connect one Google account, search conversations, and display complete threads. It cannot draft or send email.

The desktop uses a command-first interface. Ask Loggie to open a local file, folder, or project in Visual Studio Code, Finder, Terminal, or its default app—for example, `Open AI Terminal Tool in VS Code`. Loggie searches known projects plus Documents, Desktop, and Downloads; it opens a unique match directly and asks you to choose when names are ambiguous. Commands run locally and structured process arguments are used instead of passing natural language to a shell.

## Gmail setup (Milestone 2)

Loggie uses Google's installed desktop OAuth flow with PKCE and a temporary loopback callback. Tokens are encrypted with Electron secure storage (macOS Keychain-backed) and never enter the renderer.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. Open **APIs & Services → Library**, find **Gmail API**, and enable it.
3. Open **Google Auth Platform → Branding** and configure the app name and support email.
4. Under **Audience**, choose **External** for a personal Gmail account. Keep the app in testing and add your Gmail address under **Test users**.
5. Under **Data Access**, add only `https://www.googleapis.com/auth/gmail.readonly`.
6. Under **Clients**, create an OAuth client with application type **Desktop app**.
7. Download the client JSON from Google and save it at this exact local path:

```bash
mkdir -p credentials
# Move the downloaded file to:
# credentials/google-oauth.json
```

Do not copy the client secret into renderer code. Both `credentials/` and `.env` are ignored by Git. Loggie reads the Desktop client file only in Electron's main process. Google recommends loopback redirects for macOS desktop apps and PKCE for installed apps. See Google's [desktop OAuth documentation](https://developers.google.com/identity/protocols/oauth2/native-app) and [Gmail scope documentation](https://developers.google.com/workspace/gmail/api/auth/scopes).

Restart Loggie after adding the credentials file:

```bash
npm run desktop
```

Click **Connect**, complete authorization in the system browser, and return to Loggie. If Google reports that the app is unavailable to you, confirm your Gmail address is listed as a test user. Do not use a Web application OAuth client; Loggie expects a Desktop app client.

### Manual Gmail test checklist

1. Launch Loggie and confirm Gmail initially shows **Not connected**.
2. Click **Connect**, approve the single read-only Gmail permission in the system browser, and confirm the connected address appears.
3. Search `Find Daniel's latest email` and confirm real matching conversations appear.
4. Search `Find the email about Thursday's lab meeting` and confirm topic search works.
5. If multiple conversations appear, select the intended result.
6. Confirm the full thread shows sender, recipients, timestamps, subject, and message text.
7. Disconnect Gmail and confirm searching becomes unavailable.
8. Restart Loggie and confirm the disconnected state persists.

Loggie does not monitor Gmail in the background. Email content is shown as inert text and is never treated as an instruction. Milestone 2 does not send, modify, archive, or delete email.

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
