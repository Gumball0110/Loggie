import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createCoordinatorClient } from '../src/core/client.js';
import { createCoordinator } from '../src/core/coordinator.js';
import { createCoreDatabase } from '../src/core/database.js';
import { corePaths, ensureCoordinator } from '../src/core/runtime.js';

test('serves independent clients over a user-only Unix socket', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'loggie-socket-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const paths = corePaths(directory);
  const core = createCoreDatabase({ path: paths.databasePath });
  const coordinator = createCoordinator({ core });
  await coordinator.listen({ path: paths.socketPath });
  context.after(async () => { await coordinator.close(); core.close(); });

  const first = createCoordinatorClient({ socketPath: paths.socketPath });
  const second = await ensureCoordinator({ dataDirectory: directory });
  const project = await first.createProject({ name: 'Unix socket project' });
  assert.equal((await second.listProjects())[0].id, project.id);
  assert.equal((await stat(paths.socketPath)).isSocket(), true);
});
