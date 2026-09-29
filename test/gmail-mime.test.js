import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlToSafeText, parseGmailMessage, parseGmailThread } from '../src/integrations/gmail/mime.js';

const encode = (value) => Buffer.from(value).toString('base64url');

test('parses multipart messages and prefers plain text', () => {
  const parsed = parseGmailMessage({
    id: 'm1', threadId: 't1', internalDate: '1700000000000', snippet: 'Hello',
    payload: {
      headers: [
        { name: 'From', value: 'Daniel <daniel@example.com>' },
        { name: 'To', value: 'Jess <jess@example.com>' },
        { name: 'Subject', value: 'Lab meeting' },
        { name: 'Message-ID', value: '<message@example.com>' },
      ],
      parts: [
        { mimeType: 'text/html', body: { data: encode('<b>HTML</b>') } },
        { mimeType: 'text/plain', body: { data: encode('Plain hello') } },
      ],
    },
  });
  assert.equal(parsed.body, 'Plain hello');
  assert.equal(parsed.from, 'Daniel <daniel@example.com>');
  assert.equal(parsed.subject, 'Lab meeting');
  assert.equal(parsed.threadId, 't1');
});

test('sanitizes HTML into inert text', () => {
  assert.equal(htmlToSafeText('<script>steal()</script><p>Hello &amp; welcome</p>'), 'Hello & welcome');
});

test('parses and orders a complete thread', () => {
  const thread = parseGmailThread({ id: 't1', messages: [
    { id: 'm2', threadId: 't1', internalDate: '2000', payload: { headers: [{ name: 'Subject', value: 'Re: Test' }], body: { data: encode('Second') }, mimeType: 'text/plain' } },
    { id: 'm1', threadId: 't1', internalDate: '1000', payload: { headers: [{ name: 'Subject', value: 'Test' }], body: { data: encode('First') }, mimeType: 'text/plain' } },
  ] });
  assert.deepEqual(thread.messages.map(({ id }) => id), ['m1', 'm2']);
  assert.equal(thread.subject, 'Re: Test');
});
