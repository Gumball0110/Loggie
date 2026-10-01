import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isTrustedRendererUrl, validateCompanionPosition, validateSearchRequest, validateThreadId } from '../desktop/ipc-validation.js';

test('accepts only local desktop renderer IPC senders', () => {
  assert.equal(isTrustedRendererUrl('file:///project/desktop/renderer/panel.html'), true);
  assert.equal(isTrustedRendererUrl('https://attacker.example/desktop/renderer/panel.html'), false);
});

test('validates renderer search and thread arguments', () => {
  assert.deepEqual(validateSearchRequest({ text: 'Find Daniel', limit: 999, pageToken: '../bad' }), { text: 'Find Daniel', limit: 20, pageToken: null });
  assert.equal(validateThreadId('thread-123'), 'thread-123');
  assert.throws(() => validateThreadId('../secret'), /Invalid/);
});

test('validates and rounds companion window positions', () => {
  assert.deepEqual(validateCompanionPosition({ x: -100.4, y: 42.7 }), { x: -100, y: 43 });
  assert.throws(() => validateCompanionPosition({ x: 'not-a-position', y: 10 }), /Invalid/);
});

test('renders email as text and exposes no token APIs to the renderer', async () => {
  const renderer = await readFile(new URL('../desktop/renderer/panel.js', import.meta.url), 'utf8');
  const preload = await readFile(new URL('../desktop/preload.cjs', import.meta.url), 'utf8');
  assert.doesNotMatch(renderer, /innerHTML|insertAdjacentHTML/);
  assert.doesNotMatch(preload, /accessToken|refreshToken|credential/);
});

test('exposes scoped core actions without direct database or socket access', async () => {
  const preload = await readFile(new URL('../desktop/preload.cjs', import.meta.url), 'utf8');
  assert.match(preload, /core:\s*Object\.freeze/);
  assert.match(preload, /core:list-projects/);
  assert.match(preload, /core:list-tasks/);
  assert.match(preload, /core:create-task/);
  assert.match(preload, /core:prepare-task/);
  assert.match(preload, /core:start-task/);
  assert.doesNotMatch(preload, /databasePath|socketPath|transitionTask/);
});
