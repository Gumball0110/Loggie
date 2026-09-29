const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;

function cleanPhrase(value) {
  return value
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[?.!,]+$/g, '')
    .trim();
}

function quote(value) {
  return `"${value.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim()}"`;
}

export function validateGmailQuery(query) {
  if (typeof query !== 'string' || !query.trim() || query.length > 500 || CONTROL_PATTERN.test(query)) {
    throw new Error('That email search is not valid.');
  }
  return query.trim();
}

export function parseNaturalLanguageSearch(input) {
  if (typeof input !== 'string' || !input.trim() || input.length > 500 || CONTROL_PATTERN.test(input)) {
    throw new Error('Please enter a shorter email search.');
  }

  const text = input.trim();
  const lowered = text.toLowerCase();
  const terms = [];
  const email = text.match(EMAIL_PATTERN)?.[0];
  const fromMatch = text.match(/\bfrom\s+(.+?)(?=\s+(?:about|regarding|with|in|during|sent|this|last|recent)\b|[?.!,]|$)/i);
  const possessiveMatch = text.match(/^(?:(?:find|show|open|read)\s+)?([\p{L}\p{N}][\p{L}\p{N} .'-]{0,60}?)['’]s\s+(?:latest|recent|last)?\s*email/iu);
  const sender = cleanPhrase(email || fromMatch?.[1] || possessiveMatch?.[1] || '');
  if (sender) terms.push(`from:${quote(sender)}`);

  const topicMatch = text.match(/\b(?:about|regarding|subject(?:\s+is|:)?|topic(?:\s+is|:)?)\s+(.+?)(?=[?.!]|$)/i);
  const topic = cleanPhrase(topicMatch?.[1] || '');
  if (topic) terms.push(quote(topic));

  if (/\brecent\b/i.test(text)) terms.push('newer_than:90d');

  if (terms.length === 0) {
    const fallback = cleanPhrase(text
      .replace(/^(?:loggie[, ]+)?(?:find|show|search(?: for)?|open|read)\s+(?:me\s+)?/i, '')
      .replace(/\b(?:my|the)\s+(?:email|emails|message|messages|conversation|thread)s?\b/gi, ''));
    if (fallback && !/^(?:email|emails|message|messages)$/i.test(fallback)) terms.push(quote(fallback));
  }

  if (terms.length === 0) terms.push('newer_than:30d');

  return {
    query: validateGmailQuery(terms.join(' ')),
    intent: {
      sender: sender || null,
      topic: topic || null,
      latest: /\b(?:latest|last)\b/i.test(lowered),
      recent: /\brecent\b/i.test(lowered),
    },
  };
}
