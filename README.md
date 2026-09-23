# Loggie

Loggie turns AI coding-agent activity into a friendly, local action timeline.

## Try the live Antigravity inspector

Requirements:

- Node.js 20 or newer
- Antigravity CLI (`agy`)

From this repository, run:

```bash
npm run loggie
```

Loggie will:

1. start its local-only companion at `http://127.0.0.1:4317`;
2. open the inspector in your browser;
3. start Antigravity CLI in the current terminal;
4. display Antigravity tool calls through workspace-level lifecycle hooks.

The first launch of Antigravity may open a Google sign-in page. Loggie does not receive or store your Google credentials.

To exit, quit Antigravity in the terminal. The Loggie companion stops with it.

## Demo site

The GitHub Pages build is a static visual demo. Live terminal events are available only from the local companion:

https://gumball0110.github.io/Loggie/

## Development

Run the local inspector without launching Antigravity:

```bash
npm start
```

Run tests:

```bash
npm test
```

Antigravity integration is configured in `.agents/hooks.json`. The hooks are observer-only in this version: they report events but do not change or block agent actions.
