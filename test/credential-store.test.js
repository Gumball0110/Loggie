import test from 'node:test';
import assert from 'node:assert/strict';
import { createCredentialStore } from '../src/security/credential-store.js';

test('encrypts credentials at rest and disconnect clears them', async () => {
  let disk = null;
  const fileSystem = {
    readFile: async () => disk,
    writeFile: async (_path, value) => { disk = value; },
    rm: async () => { disk = null; },
  };
  const safeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`encrypted:${value}`),
    decryptString: (value) => value.toString().replace(/^encrypted:/, ''),
  };
  const store = createCredentialStore({ safeStorage, filePath: '/tokens', fileSystem });
  await store.set({ accessToken: 'private' });
  assert.doesNotMatch(disk, /accessToken|private/);
  assert.deepEqual(await store.get(), { accessToken: 'private' });
  await store.clear();
  assert.equal(disk, null);
});
