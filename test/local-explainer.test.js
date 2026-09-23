import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanTerminalOutput, explainCommand, summarizeOutput } from '../src/explain/local-explainer.js';

test('explains an unquoted folder path in plain language', () => {
  const result = explainCommand('cd document/ Design Tech', 'cd: too many arguments\r\n', 1);
  assert.equal(result.title, '無法切換資料夾');
  assert.match(result.explanation, /路徑包含空格/);
  assert.equal(result.suggestion, '請改用：cd "document/ Design Tech"');
  assert.match(result.rawSummary, /too many arguments/);
});

test('summarizes a long raw log around important lines', () => {
  const output = ['starting', 'loading', 'warning: old option', 'running', '12 tests passed'].join('\n');
  assert.equal(summarizeOutput(output, 0), 'warning: old option · 12 tests passed');
});

test('turns test runner totals into a compact summary', () => {
  const output = ['tests 11', 'pass 11', 'fail 0'].join('\n');
  const result = explainCommand('npm test', output, 0);
  assert.equal(result.rawSummary, '共 11 項，11 項通過，0 項失敗。');
});

test('removes terminal colors from captured output', () => {
  assert.equal(cleanTerminalOutput('\u001b[31merror\u001b[0m\r\n'), 'error');
});
