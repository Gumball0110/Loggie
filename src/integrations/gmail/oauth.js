import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOCATION_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

function base64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function createPkce() {
  const verifier = base64Url(randomBytes(64));
  return { verifier, challenge: base64Url(createHash('sha256').update(verifier).digest()) };
}

function safeStateMatch(expected, actual) {
  if (!expected || !actual) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function parseOAuthCallback(url, expectedState) {
  const callback = new URL(url, 'http://127.0.0.1');
  if (!safeStateMatch(expectedState, callback.searchParams.get('state'))) {
    throw new Error('Google returned an invalid authorization state. Please try again.');
  }
  const error = callback.searchParams.get('error');
  if (error === 'access_denied') throw new Error('Google authorization was cancelled.');
  if (error) throw new Error(`Google authorization failed: ${error}.`);
  const code = callback.searchParams.get('code');
  if (!code) throw new Error('Google did not return an authorization code.');
  return code;
}

function friendlyOAuthError(status, payload) {
  if (payload?.error === 'invalid_grant') return new Error('Your Google authorization has expired or was revoked. Please connect Gmail again.');
  if (payload?.error === 'access_denied') return new Error('Google authorization was denied.');
  return new Error(`Google authorization failed (${status}). Please try again.`);
}

async function tokenRequest(parameters, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(parameters),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw friendlyOAuthError(response.status, payload);
  return payload;
}

export function buildAuthorizationUrl({ clientId, redirectUri, scope, state, challenge }) {
  const url = new URL(AUTHORIZATION_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });
  return url.toString();
}

function successPage(success, message) {
  const color = success ? '#34c759' : '#f25a87';
  return `<!doctype html><meta charset="utf-8"><title>Loggie</title><body style="margin:0;background:#fff2cc;color:#1c1c1e;font:16px -apple-system,BlinkMacSystemFont,sans-serif;display:grid;min-height:100vh;place-items:center"><main style="max-width:440px;padding:36px;text-align:center"><div style="font-size:42px;color:${color}">${success ? '✓' : '!'}</div><h1>${success ? 'Gmail connected' : 'Could not connect Gmail'}</h1><p>${message}</p><p style="color:#6e6e73">You can close this tab and return to Loggie.</p></main></body>`;
}

export class GoogleOAuthClient {
  constructor({ config, credentialStore, openExternal, fetchImpl = fetch, serverFactory = createServer, timeoutMs = 300_000 }) {
    this.config = config;
    this.credentialStore = credentialStore;
    this.openExternal = openExternal;
    this.fetchImpl = fetchImpl;
    this.serverFactory = serverFactory;
    this.timeoutMs = timeoutMs;
    this.pending = null;
  }

  assertConfigured() {
    if (!this.config?.clientId) {
      throw new Error('Google OAuth is not configured. Add Desktop app credentials at credentials/google-oauth.json and restart Loggie.');
    }
  }

  async connect() {
    this.assertConfigured();
    if (this.pending) throw new Error('Google authorization is already in progress.');

    const pkce = createPkce();
    const state = base64Url(randomBytes(32));
    let settled = false;

    return new Promise((resolve, reject) => {
      const finish = (error, credentials) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        server.close();
        this.pending = null;
        if (error) reject(error);
        else resolve(credentials);
      };

      const server = this.serverFactory(async (request, response) => {
        try {
          if (new URL(request.url, 'http://127.0.0.1').pathname !== '/oauth/callback') {
            response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
            response.end('Not found');
            return;
          }
          const code = parseOAuthCallback(request.url, state);
          const address = server.address();
          const redirectUri = `http://127.0.0.1:${address.port}/oauth/callback`;
          const token = await tokenRequest({
            code,
            client_id: this.config.clientId,
            ...(this.config.clientSecret ? { client_secret: this.config.clientSecret } : {}),
            code_verifier: pkce.verifier,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }, { fetchImpl: this.fetchImpl });
          const credentials = {
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
            expiresAt: Date.now() + (Number(token.expires_in) || 3600) * 1000,
            scope: token.scope || this.config.scope,
          };
          if (!credentials.refreshToken) throw new Error('Google did not return a refresh token. Disconnect Loggie in your Google Account and try again.');
          await this.credentialStore.set(credentials);
          response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          response.end(successPage(true, 'Loggie can now read the Gmail messages you request.'));
          finish(null, credentials);
        } catch (error) {
          response.writeHead(400, { 'content-type': 'text/html; charset=utf-8' });
          response.end(successPage(false, error.message));
          finish(error);
        }
      });

      const timer = setTimeout(() => finish(new Error('Google authorization timed out. Please try again.')), this.timeoutMs);
      this.pending = { cancel: () => finish(new Error('Google authorization was cancelled.')) };

      server.on('error', (error) => finish(new Error(`Could not start Google authorization: ${error.message}`)));
      server.listen(0, '127.0.0.1', async () => {
        const address = server.address();
        const redirectUri = `http://127.0.0.1:${address.port}/oauth/callback`;
        const authorizationUrl = buildAuthorizationUrl({
          clientId: this.config.clientId,
          redirectUri,
          scope: this.config.scope,
          state,
          challenge: pkce.challenge,
        });
        try {
          await this.openExternal(authorizationUrl);
        } catch (error) {
          finish(new Error(`Could not open the browser: ${error.message}`));
        }
      });
    });
  }

  cancel() {
    this.pending?.cancel();
  }

  async getAccessToken({ forceRefresh = false } = {}) {
    this.assertConfigured();
    const credentials = await this.credentialStore.get();
    if (!credentials) throw new Error('Connect Gmail before searching your email.');
    if (!forceRefresh && credentials.accessToken && credentials.expiresAt > Date.now() + 60_000) return credentials.accessToken;
    if (!credentials.refreshToken) {
      await this.credentialStore.clear();
      throw new Error('Your Google authorization has expired. Please connect Gmail again.');
    }

    try {
      const token = await tokenRequest({
        client_id: this.config.clientId,
        ...(this.config.clientSecret ? { client_secret: this.config.clientSecret } : {}),
        refresh_token: credentials.refreshToken,
        grant_type: 'refresh_token',
      }, { fetchImpl: this.fetchImpl });
      const updated = {
        ...credentials,
        accessToken: token.access_token,
        expiresAt: Date.now() + (Number(token.expires_in) || 3600) * 1000,
        scope: token.scope || credentials.scope,
      };
      await this.credentialStore.set(updated);
      return updated.accessToken;
    } catch (error) {
      if (/revoked|expired/i.test(error.message)) await this.credentialStore.clear();
      throw error;
    }
  }

  async disconnect() {
    const credentials = await this.credentialStore.get();
    this.cancel();
    if (credentials?.refreshToken || credentials?.accessToken) {
      const token = credentials.refreshToken || credentials.accessToken;
      await this.fetchImpl(REVOCATION_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
      }).catch(() => null);
    }
    await this.credentialStore.clear();
  }
}
