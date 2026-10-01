import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommandIntent } from '../src/commands/intent-parser.js';

test('parses the requested Chinese VS Code command', () => {
  const intent = parseCommandIntent('幫我在Visual Studio Code中開啟AI Terminal Tool這個檔案');
  assert.equal(intent.type, 'open');
  assert.equal(intent.application, 'vscode');
  assert.equal(intent.target, 'AI Terminal Tool');
});

test('parses English open commands and rejects unsupported work', () => {
  assert.deepEqual(parseCommandIntent('Open AI Terminal Tool in VS Code'), {
    type: 'open', application: 'vscode', applicationLabel: 'Visual Studio Code', target: 'AI Terminal Tool', original: 'Open AI Terminal Tool in VS Code',
  });
  assert.equal(parseCommandIntent('Fix the tests').type, 'unsupported');
});

test('does not remove an app-like word from the target name', () => {
  assert.equal(parseCommandIntent('Open Code Samples in VS Code').target, 'Code Samples');
});
