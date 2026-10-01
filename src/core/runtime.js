import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCoordinatorClient } from './client.js';
import { coreProtocolVersion } from './coordinator.js';

export function corePaths(dataDirectory) {
  return { databasePath: join(dataDirectory, 'loggie.db'), socketPath: join(dataDirectory, 'loggie.sock') };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function isReady(client) {
  try {
    const health = await client.health();
    return health.ok === true && health.version === coreProtocolVersion;
  } catch { return false; }
}

export async function ensureCoordinator({ dataDirectory, executable = process.execPath, timeoutMs = 5000 } = {}) {
  if (!dataDirectory) throw new Error('Coordinator dataDirectory is required.');
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
  const { socketPath } = corePaths(dataDirectory);
  const client = createCoordinatorClient({ socketPath });
  if (await isReady(client)) return client;

  const processPath = fileURLToPath(new URL('./process.js', import.meta.url));
  const child = spawn(executable, [processPath, '--data-directory', dataDirectory], {
    detached: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'ignore',
  });
  child.unref();

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isReady(client)) return client;
    await delay(50);
  }
  throw new Error('Loggie coordinator did not become ready.');
}
