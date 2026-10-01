import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSessionTransition, assertTaskTransition } from '../src/core/domain.js';

test('enforces task lifecycle and approved brief requirement', () => {
  assert.throws(() => assertTaskTransition('waiting', 'briefed'), /approved brief/);
  assert.doesNotThrow(() => assertTaskTransition('waiting', 'briefed', { hasApprovedBrief: true }));
  assert.doesNotThrow(() => assertTaskTransition('briefed', 'running'));
  assert.doesNotThrow(() => assertTaskTransition('running', 'done'));
  assert.throws(() => assertTaskTransition('waiting', 'done'), /cannot transition/);
});

test('does not reopen a terminal session after it is terminal', () => {
  assert.doesNotThrow(() => assertSessionTransition('starting', 'running'));
  assert.doesNotThrow(() => assertSessionTransition('running', 'completed'));
  assert.throws(() => assertSessionTransition('completed', 'running'), /cannot transition/);
});
