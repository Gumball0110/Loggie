import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuthorizationUrl, GoogleOAuthClient, parseOAuthCallback } from '../src/integrations/gmail/oauth.js';

const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => payload });

test('validates OAuth state and handles denial', () => {
  assert.equal(parseOAuthCallback('/oauth/callback?state=abc&code=code', 'abc'), 'code');
  assert.throws(() => parseOAuthCallback('/oauth/callback?state=wrong&code=code', 'abc'), /invalid authorization state/);
  assert.throws(() => parseOAuthCallback('/oauth/callback?state=abc&error=access_denied', 'abc'), /cancelled/);
});

test('builds a PKCE desktop authorization request with only Gmail readonly scope', () => {
  const url = new URL(buildAuthorizationUrl({ clientId: 'client', redirectUri: 'http://127.0.0.1:1234/oauth/callback', scope: 'https://www.googleapis.com/auth/gmail.readonly', state: 'state', challenge: 'challenge' }));
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/gmail.readonly');
  assert.equal(url.searchParams.get('access_type'), 'offline');
});

test('refreshes expired tokens and preserves the refresh token', async () => {
  let stored = { accessToken: 'old', refreshToken: 'refresh', expiresAt: 0 };
  const oauth = new GoogleOAuthClient({
    config: { clientId: 'client', clientSecret: 'secret', scope: 'scope' },
    credentialStore: { get: async () => stored, set: async (value) => { stored = value; }, clear: async () => {} },
    openExternal: async () => {},
    fetchImpl: async () => response({ access_token: 'new', expires_in: 3600 }),
  });
  assert.equal(await oauth.getAccessToken(), 'new');
  assert.equal(stored.refreshToken, 'refresh');
});

test('disconnect revokes and clears local credentials', async () => {
  let cleared = false;
  let revoked = '';
  const oauth = new GoogleOAuthClient({
    config: { clientId: 'client', scope: 'scope' },
    credentialStore: { get: async () => ({ refreshToken: 'refresh' }), set: async () => {}, clear: async () => { cleared = true; } },
    openExternal: async () => {},
    fetchImpl: async (_url, options) => { revoked = options.body.get('token'); return response({}); },
  });
  await oauth.disconnect();
  assert.equal(revoked, 'refresh');
  assert.equal(cleared, true);
});

test('completes the loopback PKCE flow and stores tokens', async () => {
  let requestHandler;
  let stored;
  const server = {
    on: () => {},
    listen: (_port, _host, callback) => callback(),
    address: () => ({ port: 43210 }),
    close: () => {},
  };
  const oauth = new GoogleOAuthClient({
    config: { clientId: 'client', scope: 'https://www.googleapis.com/auth/gmail.readonly' },
    credentialStore: { set: async (value) => { stored = value; }, get: async () => null, clear: async () => {} },
    serverFactory: (handler) => { requestHandler = handler; return server; },
    fetchImpl: async () => response({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600 }),
    openExternal: async (authorizationUrl) => {
      const state = new URL(authorizationUrl).searchParams.get('state');
      await requestHandler(
        { url: `/oauth/callback?state=${encodeURIComponent(state)}&code=code` },
        { writeHead: () => {}, end: () => {} },
      );
    },
  });
  await oauth.connect();
  assert.equal(stored.accessToken, 'access');
  assert.equal(stored.refreshToken, 'refresh');
});

test('supports cancelling an in-progress authorization', async () => {
  const server = { on: () => {}, listen: (_port, _host, callback) => callback(), address: () => ({ port: 43210 }), close: () => {} };
  const oauth = new GoogleOAuthClient({
    config: { clientId: 'client', scope: 'scope' },
    credentialStore: { set: async () => {}, get: async () => null, clear: async () => {} },
    serverFactory: () => server,
    openExternal: async () => {},
    timeoutMs: 60_000,
  });
  const pending = oauth.connect();
  await new Promise((resolve) => setImmediate(resolve));
  oauth.cancel();
  await assert.rejects(pending, /cancelled/);
});
