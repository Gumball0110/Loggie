import test from 'node:test';
import assert from 'node:assert/strict';
import { addAgentEvent, createTuiState, finishCommand, startCommand } from '../src/tui/state.js';

test('tracks a successful shell command', () => {
  const state = createTuiState();
  startCommand(state, 'npm test', '/tmp/project', 1000);
  finishCommand(state, 0, 2500);
  assert.equal(state.command, 'npm test');
  assert.equal(state.commandStatus, 'complete');
  assert.equal(state.exitCode, 0);
  assert.equal(state.durationMs, 1500);
});

test('marks destructive shell commands as high risk', () => {
  const state = createTuiState();
  startCommand(state, 'rm -rf build', '/tmp/project');
  assert.equal(state.risk, 'high');
});

test('keeps recent agent activity', () => {
  const state = createTuiState();
  addAgentEvent(state, { tool: 'view_file', title: 'checking project information', risk: 'low' });
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].tool, 'view_file');
});
