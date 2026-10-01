import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveTarget } from '../src/commands/target-resolver.js';

test('finds folders by human name and ranks an exact match first', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'loggie-discovery-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'AI Terminal Tool'));
  await writeFile(join(root, 'AI Terminal Notes.txt'), 'notes');
  const results = await resolveTarget({ target: 'AI Terminal Tool', roots: [root] });
  assert.equal(results[0].path, join(root, 'AI Terminal Tool'));
  assert.equal(results[0].score, 100);
});

test('ignores stale known projects', async () => {
  const results = await resolveTarget({ target: 'Missing', projects: [{ name: 'Missing', directoryPath: '/definitely/not/here' }], roots: [] });
  assert.deepEqual(results, []);
});
