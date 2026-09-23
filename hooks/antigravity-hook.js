#!/usr/bin/env node

const kind = process.argv[2] || 'event';
let input = '';
for await (const chunk of process.stdin) input += chunk;

let payload = {};
try {
  payload = JSON.parse(input || '{}');
  await fetch('http://127.0.0.1:4317/api/events', {
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
