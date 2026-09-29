import { parseNaturalLanguageSearch } from './query-parser.js';

export function createGmailService({ oauth, client, configured }) {
  return {
    configuration() {
      return { configured };
    },

    async status() {
      if (!configured) return { configured: false, connected: false, account: null };
      try {
        const account = await client.getProfile();
        return { configured: true, connected: true, account };
      } catch (error) {
        if (/connect Gmail|authorization|revoked|expired/i.test(error.message)) {
          return { configured: true, connected: false, account: null, error: error.message };
        }
        throw error;
      }
    },

    async connect() {
      await oauth.connect();
      return client.getProfile();
    },

    cancelConnect() {
      oauth.cancel();
    },

    async disconnect() {
      await oauth.disconnect();
      return { connected: false };
    },

    async search(naturalLanguage, options = {}) {
      const parsed = parseNaturalLanguageSearch(naturalLanguage);
      const result = await client.searchThreads(parsed.query, options);
      return { ...result, query: parsed.query, intent: parsed.intent, ambiguous: result.threads.length > 1 };
    },

    getThread(threadId) {
      return client.getThread(threadId);
    },
  };
}
