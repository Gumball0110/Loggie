#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const agyCandidates = [process.env.AGY_BIN, join(process.env.HOME || '', '.local/bin/agy'), 'agy'].filter(Boolean);
let agy = null;
for (const candidate of agyCandidates) {
  if (candidate === 'agy') { agy = candidate; break; }
  try { await access(candidate, constants.X_OK); agy = candidate; break; } catch {}
}

if (!agy) {
  console.error('Antigravity CLI was not found. Install it from https://antigravity.google/docs/cli/install/');
  process.exit(1);
}

const server = spawn(process.execPath, [join(projectRoot, 'server/server.js')], { cwd: projectRoot, stdio: ['ignore', 'inherit', 'inherit'] });
await new Promise((resolve) => setTimeout(resolve, 450));
spawn('open', ['http://127.0.0.1:4317'], { stdio: 'ignore', detached: true }).unref();

console.log('\nLoggie is watching this Antigravity session.\n');
const agent = spawn(agy, process.argv.slice(2), { cwd: process.cwd(), stdio: 'inherit' });
agent.on('exit', (code, signal) => {
  server.kill('SIGTERM');
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
