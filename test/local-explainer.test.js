import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanTerminalOutput, explainCommand, summarizeOutput } from '../src/explain/local-explainer.js';

test('explains an unquoted folder path in plain language', () => {
  const result = explainCommand('cd document/ Design Tech', 'cd: too many arguments\r\n', 1);
  assert.equal(result.title, 'Could not change folders');
  assert.match(result.explanation, /path contains spaces/);
  assert.equal(result.suggestion, 'Try this instead: cd "document/ Design Tech"');
  assert.match(result.rawSummary, /too many arguments/);
});

test('summarizes a long raw log around important lines', () => {
  const output = ['starting', 'loading', 'warning: old option', 'running', '12 tests passed'].join('\n');
  assert.equal(summarizeOutput(output, 0), 'warning: old option · 12 tests passed');
});

test('turns test runner totals into a compact summary', () => {
  const output = ['tests 11', 'pass 11', 'fail 0'].join('\n');
  const result = explainCommand('npm test', output, 0);
  assert.equal(result.rawSummary, '11 total, 11 passed, 0 failed.');
});

test('removes terminal colors from captured output', () => {
  assert.equal(cleanTerminalOutput('\u001b[31merror\u001b[0m\r\n'), 'error');
});
