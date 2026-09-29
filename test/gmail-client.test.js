import test from 'node:test';
import assert from 'node:assert/strict';
import { GmailClient } from '../src/integrations/gmail/client.js';

const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => payload });

test('searches Gmail threads with pagination and retrieves thread metadata', async () => {
  const calls = [];
  const client = new GmailClient({
    oauth: { getAccessToken: async () => 'secret-token' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.includes('/threads?')) return response({ threads: [{ id: 't1' }], nextPageToken: 'next', resultSizeEstimate: 2 });
      return response({ id: 't1', messages: [{ id: 'm1', threadId: 't1', internalDate: '1000', snippet: 'Hi', payload: { mimeType: 'text/plain', headers: [{ name: 'Subject', value: 'Hello' }], body: { data: Buffer.from('Body').toString('base64url') } } }] });
    },
  });
  const result = await client.searchThreads('from:"Daniel"', { limit: 5, pageToken: 'page-one' });
  assert.equal(result.threads[0].subject, 'Hello');
  assert.equal(result.nextPageToken, 'next');
  assert.match(calls[0].url, /pageToken=page-one/);
  assert.equal(calls[0].options.headers.authorization, 'Bearer secret-token');
});

test('refreshes once after a Gmail 401', async () => {
  const forces = [];
  let count = 0;
  const client = new GmailClient({
    oauth: { getAccessToken: async ({ forceRefresh }) => { forces.push(forceRefresh); return 'token'; } },
    fetchImpl: async () => ++count === 1 ? response({}, 401) : response({ emailAddress: 'me@example.com' }),
  });
  assert.equal((await client.getProfile()).emailAddress, 'me@example.com');
  assert.deepEqual(forces, [false, true]);
});
