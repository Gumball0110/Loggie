import { readFileSync } from 'node:fs';

export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

function environmentCredentials(environment) {
  return {
    clientId: environment.GOOGLE_OAUTH_CLIENT_ID?.trim() || null,
    clientSecret: environment.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || null,
  };
}

function credentialsFromDesktopClient(contents) {
  const parsed = JSON.parse(contents);
  if (!parsed?.installed || parsed.web) {
    throw new Error('The Google OAuth file must contain Desktop app credentials.');
  }

  const clientId = parsed.installed.client_id?.trim();
  if (!clientId) throw new Error('The Google OAuth file is missing its client ID.');

  return {
    clientId,
    clientSecret: parsed.installed.client_secret?.trim() || null,
  };
}

export function readGmailConfig({
  environment = process.env,
  credentialsPath,
  readFile = readFileSync,
} = {}) {
  let credentials = null;
  let configurationError = null;

  if (credentialsPath) {
    try {
      credentials = credentialsFromDesktopClient(readFile(credentialsPath, 'utf8'));
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        configurationError = error instanceof SyntaxError
          ? 'The Google OAuth credentials file is not valid JSON.'
          : error.message;
      }
    }
  }

  if (!credentials && !configurationError) {
    const fallback = environmentCredentials(environment);
    if (fallback.clientId) credentials = fallback;
  }

  return {
    clientId: credentials?.clientId || null,
    clientSecret: credentials?.clientSecret || null,
    configured: Boolean(credentials?.clientId),
    configurationError,
    scope: GMAIL_READONLY_SCOPE,
  };
}
