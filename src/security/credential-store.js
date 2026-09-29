import { readFile, rm, writeFile } from 'node:fs/promises';

export function createCredentialStore({ safeStorage, filePath, fileSystem = { readFile, writeFile, rm } }) {
  if (!safeStorage || !filePath) throw new Error('Credential storage is not configured.');

  return {
    async get() {
      try {
        if (!safeStorage.isEncryptionAvailable()) throw new Error('macOS secure storage is unavailable.');
        const encrypted = Buffer.from(await fileSystem.readFile(filePath, 'utf8'), 'base64');
        return JSON.parse(safeStorage.decryptString(encrypted));
      } catch (error) {
        if (error?.code === 'ENOENT') return null;
        throw error;
      }
    },

    async set(credentials) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('macOS secure storage is unavailable.');
      const encrypted = safeStorage.encryptString(JSON.stringify(credentials));
      await fileSystem.writeFile(filePath, `${encrypted.toString('base64')}\n`, { encoding: 'utf8', mode: 0o600 });
    },

    async clear() {
      await fileSystem.rm(filePath, { force: true });
    },
  };
}
