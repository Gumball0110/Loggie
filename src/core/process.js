#!/usr/bin/env node

import { chmod, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createCoordinatorClient } from './client.js';
import { createCoordinator } from './coordinator.js';
import { coreProtocolVersion } from './coordinator.js';
import { createCoreDatabase } from './database.js';
import { corePaths } from './runtime.js';

const directoryIndex = process.argv.indexOf('--data-directory');
const dataDirectory = directoryIndex >= 0 ? process.argv[directoryIndex + 1] : null;
if (!dataDirectory) {
  console.error('Usage: process.js --data-directory <path>');
  process.exit(2);
}

const safeDirectory = resolve(dataDirectory);
await mkdir(safeDirectory, { recursive: true, mode: 0o700 });
const { databasePath, socketPath } = corePaths(safeDirectory);
const existing = createCoordinatorClient({ socketPath });
try {
  const health = await existing.health();
  if (health.ok && health.version === coreProtocolVersion) process.exit(0);
  if (Number.isInteger(health.pid) && health.pid !== process.pid) {
    try { process.kill(health.pid, 'SIGTERM'); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  await rm(socketPath, { force: true });
} catch {
  await rm(socketPath, { force: true });
}

const core = createCoreDatabase({ path: databasePath });
const coordinator = createCoordinator({ core });

async function shutdown(code = 0) {
  try { await coordinator.close(); } catch {}
  try { core.close(); } catch {}
  await rm(socketPath, { force: true });
  process.exit(code);
}

process.once('SIGTERM', () => shutdown(0));
process.once('SIGINT', () => shutdown(0));
process.once('SIGHUP', () => shutdown(0));
process.once('uncaughtException', (error) => {
  console.error(error);
  shutdown(1);
});

try {
  await coordinator.listen({ path: socketPath });
  await chmod(socketPath, 0o600);
} catch (error) {
  core.close();
  if (error.code !== 'EADDRINUSE') console.error(error);
  process.exit(error.code === 'EADDRINUSE' ? 0 : 1);
}
