#!/usr/bin/env node

const kind = process.argv[2] || 'event';
let input = '';
for await (const chunk of process.stdin) input += chunk;

let payload = {};
try {
  payload = JSON.parse(input || '{}');
  const port = Number(process.env.LOGGIE_PORT || 4317);
  await fetch(`http://127.0.0.1:${port}/api/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, payload }),
    signal: AbortSignal.timeout(1200),
  });
} catch {
  // Loggie must never prevent the coding agent from continuing.
}

if (kind === 'pre-tool') process.stdout.write(JSON.stringify({ decision: 'allow' }));
else if (kind === 'stop') process.stdout.write(JSON.stringify({ decision: 'stop' }));
else process.stdout.write('{}');
