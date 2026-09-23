import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent } from '../server/event-normalizer.js';

test('classifies file reads as low risk', () => {
  const event = normalizeEvent({
    kind: 'pre-tool',
    payload: { conversationId: 'one', toolCall: { name: 'view_file', args: { AbsolutePath: '/tmp/App.js' } } },
  });
  assert.equal(event.category, 'read');
  assert.equal(event.risk, 'low');
  assert.equal(event.target, '/tmp/App.js');
});

test('classifies package installation as medium risk', () => {
  const event = normalizeEvent({
    kind: 'pre-tool',
    payload: { conversationId: 'two', toolCall: { name: 'run_command', args: { CommandLine: 'npm install vite' } } },
  });
  assert.equal(event.category, 'execute');
  assert.equal(event.risk, 'medium');
  assert.equal(event.command, 'npm install vite');
});

test('classifies destructive commands as high risk', () => {
  const event = normalizeEvent({
    kind: 'pre-tool',
    payload: { conversationId: 'three', toolCall: { name: 'run_command', args: { CommandLine: 'rm -rf dist' } } },
  });
  assert.equal(event.risk, 'high');
});
