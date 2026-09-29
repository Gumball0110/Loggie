import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

test('does not open another TUI inside an existing Loggie session', () => {
  const result = spawnSync(process.execPath, [join(projectRoot, 'bin/loggie.js')], {
    cwd: projectRoot,
    env: { ...process.env, LOGGIE_TUI: '1' },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), 'Loggie is already running in this terminal.');
  assert.doesNotMatch(result.stderr, /needs an interactive terminal/i);
});
