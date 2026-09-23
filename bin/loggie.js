#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const agyCandidates = [process.env.AGY_BIN, join(process.env.HOME || '', '.local/bin/agy'), 'agy'].filter(Boolean);
let agy = null;
for (const candidate of agyCandidates) {
  if (candidate === 'agy') { agy = candidate; break; }
  try { await access(candidate, constants.X_OK); agy = candidate; break; } catch {}
}

function requireAgy() {
  if (agy) return agy;
  console.error('Antigravity CLI was not found. Install it from https://antigravity.google/docs/cli/install/');
  process.exit(1);
}

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, { stdio: 'inherit', ...options });
}

if (args[0] === 'hook') {
  const result = run(process.execPath, [join(projectRoot, 'hooks/antigravity-hook.js'), args[1] || 'event']);
  process.exit(result.status ?? 0);
}

if (args[0] === 'install') {
  const result = run(requireAgy(), ['plugin', 'install', join(projectRoot, 'antigravity-plugin')]);
  if (result.status === 0) console.log('\nLoggie plugin installed. Run `loggie doctor` to verify it.');
  process.exit(result.status ?? 1);
}

if (args[0] === 'uninstall') {
  const result = run(requireAgy(), ['plugin', 'uninstall', 'loggie']);
  process.exit(result.status ?? 1);
}

if (args[0] === 'doctor') {
  console.log('Loggie doctor\n');
  console.log(`✓ Node.js ${process.version}`);
  if (agy) {
    const version = spawnSync(agy, ['--version'], { encoding: 'utf8' });
    console.log(`✓ Antigravity CLI ${(version.stdout || version.stderr).trim() || 'installed'}`);
    const plugins = spawnSync(agy, ['plugin', 'list'], { encoding: 'utf8' });
    const output = `${plugins.stdout || ''}${plugins.stderr || ''}`;
    console.log(output.toLowerCase().includes('loggie') ? '✓ Loggie Antigravity plugin installed' : '✗ Loggie plugin not installed — run `loggie install`');
  } else {
    console.log('✗ Antigravity CLI not found');
  }
  console.log('✓ Local inspector configured for http://127.0.0.1:4317');
  process.exit(agy ? 0 : 1);
}

requireAgy();

const server = spawn(process.execPath, [join(projectRoot, 'server/server.js')], { cwd: projectRoot, stdio: ['ignore', 'inherit', 'inherit'] });
await new Promise((resolve) => setTimeout(resolve, 450));
spawn('open', ['http://127.0.0.1:4317'], { stdio: 'ignore', detached: true }).unref();

console.log('\nLoggie is watching this Antigravity session.\n');
const agent = spawn(agy, args, { cwd: process.cwd(), stdio: 'inherit' });
agent.on('exit', (code, signal) => {
  server.kill('SIGTERM');
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
