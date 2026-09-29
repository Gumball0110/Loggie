import test from 'node:test';
import assert from 'node:assert/strict';
import { createGmailService } from '../src/integrations/gmail/service.js';

test('marks multiple Gmail matches as ambiguous', async () => {
  const service = createGmailService({
    configured: true,
    oauth: {},
    client: { searchThreads: async () => ({ threads: [{ id: '1' }, { id: '2' }], nextPageToken: null }) },
  });
  const result = await service.search("Find Daniel's latest email");
  assert.equal(result.ambiguous, true);
  assert.equal(result.threads.length, 2);
});
