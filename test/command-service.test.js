import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createCommandService } from '../desktop/command-service.js';

test('resolves and opens a natural-language VS Code request with structured arguments', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'loggie-command-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, 'AI Terminal Tool');
  await mkdir(target);
  let invocation;
  const service = createCommandService({
    coreClient: { listProjects: async () => [] },
    shell: {},
    roots: [root],
    spawnImpl(command, args) {
      invocation = { command, args };
      return { once(event, listener) { if (event === 'exit') queueMicrotask(() => listener(0)); } };
    },
  });
  const result = await service.execute('幫我在 Visual Studio Code 中開啟 AI Terminal Tool 這個資料夾');
  assert.equal(result.status, 'completed');
  assert.equal(result.target.path, target);
  assert.deepEqual(invocation, { command: '/usr/bin/open', args: ['-a', 'Visual Studio Code', target] });
});

test('returns choices instead of opening when names are ambiguous', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'loggie-command-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'One', 'Report'), { recursive: true });
  await mkdir(join(root, 'Two', 'Report'), { recursive: true });
  const service = createCommandService({ coreClient: { listProjects: async () => [] }, shell: {}, roots: [root] });
  const result = await service.execute('Open report in Finder');
  assert.equal(result.status, 'needs_choice');
  assert.equal(result.candidates.length, 2);
});
