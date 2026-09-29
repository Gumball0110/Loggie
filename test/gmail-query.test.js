import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNaturalLanguageSearch, validateGmailQuery } from '../src/integrations/gmail/query-parser.js';

test('parses a latest email request by sender name', () => {
  const result = parseNaturalLanguageSearch("Find Daniel's latest email.");
  assert.equal(result.query, 'from:"Daniel"');
  assert.equal(result.intent.sender, 'Daniel');
  assert.equal(result.intent.latest, true);
});

test('parses sender address and topic', () => {
  const result = parseNaturalLanguageSearch('Find email from daniel@example.com about Thursday lab meeting');
  assert.equal(result.query, 'from:"daniel@example.com" "Thursday lab meeting"');
});

test('rejects unsafe or oversized Gmail queries', () => {
  assert.throws(() => validateGmailQuery('hello\u0000world'), /not valid/);
  assert.throws(() => validateGmailQuery('x'.repeat(501)), /not valid/);
});
