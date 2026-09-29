import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isTrustedRendererUrl, validateSearchRequest, validateThreadId } from '../desktop/ipc-validation.js';

test('accepts only local desktop renderer IPC senders', () => {
  assert.equal(isTrustedRendererUrl('file:///project/desktop/renderer/panel.html'), true);
  assert.equal(isTrustedRendererUrl('https://attacker.example/desktop/renderer/panel.html'), false);
});

test('validates renderer search and thread arguments', () => {
  assert.deepEqual(validateSearchRequest({ text: 'Find Daniel', limit: 999, pageToken: '../bad' }), { text: 'Find Daniel', limit: 20, pageToken: null });
  assert.equal(validateThreadId('thread-123'), 'thread-123');
  assert.throws(() => validateThreadId('../secret'), /Invalid/);
});

test('renders email as text and exposes no token APIs to the renderer', async () => {
  const renderer = await readFile(new URL('../desktop/renderer/panel.js', import.meta.url), 'utf8');
  const preload = await readFile(new URL('../desktop/preload.cjs', import.meta.url), 'utf8');
  assert.doesNotMatch(renderer, /innerHTML|insertAdjacentHTML/);
  assert.doesNotMatch(preload, /accessToken|refreshToken|credential/);
});
