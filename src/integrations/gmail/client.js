import { parseGmailThread } from './mime.js';
import { validateGmailQuery } from './query-parser.js';

const API_ROOT = 'https://gmail.googleapis.com/gmail/v1/users/me';

export class GmailClient {
  constructor({ oauth, fetchImpl = fetch }) {
    this.oauth = oauth;
    this.fetchImpl = fetchImpl;
  }

  async request(path, { retry = true } = {}) {
    const token = await this.oauth.getAccessToken({ forceRefresh: !retry });
    const response = await this.fetchImpl(`${API_ROOT}${path}`, { headers: { authorization: `Bearer ${token}` } });
    if (response.status === 401 && retry) return this.request(path, { retry: false });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 403) throw new Error('Gmail denied this request. Reconnect Gmail and confirm read-only access.');
      if (response.status === 429) throw new Error('Gmail is receiving too many requests. Please wait a moment and try again.');
      throw new Error(`Gmail request failed (${response.status}). Please try again.`);
    }
    return payload;
  }

  async getProfile() {
    const profile = await this.request('/profile');
    return { emailAddress: profile.emailAddress, messagesTotal: profile.messagesTotal, threadsTotal: profile.threadsTotal };
  }

  async getThread(threadId) {
    if (!/^[\w-]{1,200}$/.test(threadId || '')) throw new Error('Invalid Gmail thread.');
    return parseGmailThread(await this.request(`/threads/${encodeURIComponent(threadId)}?format=full`));
  }

  async searchThreads(query, { limit = 10, pageToken = null } = {}) {
    const safeQuery = validateGmailQuery(query);
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);
    const parameters = new URLSearchParams({ q: safeQuery, maxResults: String(safeLimit) });
    if (pageToken) parameters.set('pageToken', pageToken);
    const page = await this.request(`/threads?${parameters}`);
    const threads = await Promise.all((page.threads || []).slice(0, safeLimit).map(({ id }) => this.getThread(id)));
    threads.sort((a, b) => (b.latestTimestamp || '').localeCompare(a.latestTimestamp || ''));
    return { threads, nextPageToken: page.nextPageToken || null, resultSizeEstimate: page.resultSizeEstimate || 0 };
  }
}
