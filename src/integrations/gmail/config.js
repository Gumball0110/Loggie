export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export function readGmailConfig(environment = process.env) {
  const clientId = environment.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = environment.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  return {
    clientId: clientId || null,
    clientSecret: clientSecret || null,
    configured: Boolean(clientId),
    scope: GMAIL_READONLY_SCOPE,
  };
}
