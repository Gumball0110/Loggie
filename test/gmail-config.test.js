import test from 'node:test';
import assert from 'node:assert/strict';
import { readGmailConfig } from '../src/integrations/gmail/config.js';

const desktopJson = JSON.stringify({
  installed: { client_id: 'desktop-id', client_secret: 'desktop-secret' },
});

test('loads a Desktop OAuth client file without requiring environment credentials', () => {
  const config = readGmailConfig({
    environment: {},
    credentialsPath: '/private/google-oauth.json',
    readFile: () => desktopJson,
  });
  assert.equal(config.configured, true);
  assert.equal(config.clientId, 'desktop-id');
  assert.equal(config.clientSecret, 'desktop-secret');
  assert.equal(config.configurationError, null);
});

test('prefers the local Desktop OAuth client file over environment fallback values', () => {
  const config = readGmailConfig({
    environment: { GOOGLE_OAUTH_CLIENT_ID: 'environment-id' },
    credentialsPath: '/private/google-oauth.json',
    readFile: () => desktopJson,
  });
  assert.equal(config.clientId, 'desktop-id');
});

test('rejects malformed and Web application OAuth files safely', () => {
  const malformed = readGmailConfig({ environment: {}, credentialsPath: '/private/google-oauth.json', readFile: () => '{' });
  assert.equal(malformed.configured, false);
  assert.match(malformed.configurationError, /not valid JSON/);

  const webClient = readGmailConfig({
    environment: {},
    credentialsPath: '/private/google-oauth.json',
    readFile: () => JSON.stringify({ web: { client_id: 'web-id' } }),
  });
  assert.equal(webClient.configured, false);
  assert.match(webClient.configurationError, /Desktop app credentials/);
});

test('uses environment credentials only when the local file is absent', () => {
  const missingFile = new Error('missing');
  missingFile.code = 'ENOENT';
  const config = readGmailConfig({
    environment: { GOOGLE_OAUTH_CLIENT_ID: 'fallback-id', GOOGLE_OAUTH_CLIENT_SECRET: 'fallback-secret' },
    credentialsPath: '/private/google-oauth.json',
    readFile: () => { throw missingFile; },
  });
  assert.equal(config.configured, true);
  assert.equal(config.clientId, 'fallback-id');
});
