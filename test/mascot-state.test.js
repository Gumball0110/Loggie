import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { mascotAssetPaths, resolveMascotState } from '../desktop/renderer/mascot-state.js';

test('resolves mascot states in click, hover, inactivity, idle priority order', () => {
  assert.equal(resolveMascotState({ excited: true, hovering: true, inactive: true }), 'excited');
  assert.equal(resolveMascotState({ hovering: true, inactive: true }), 'happy');
  assert.equal(resolveMascotState({ inactive: true }), 'sleeping');
  assert.equal(resolveMascotState(), 'idle');
});

test('defines one available PNG asset for every mascot state', async () => {
  assert.deepEqual(Object.keys(mascotAssetPaths), ['idle', 'sleeping', 'happy', 'excited']);
  for (const path of Object.values(mascotAssetPaths)) {
    assert.match(path, /^\.\.\/\.\.\/assets\/[a-z]+\.png$/);
    await access(new URL(path, new URL('../desktop/renderer/companion.html', import.meta.url)));
  }
});
