function decodeBase64Url(value = '') {
  if (!value) return '';
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/&(#x?[\da-f]+|\w+);/gi, (_match, entity) => {
    if (entity[0] === '#') {
      const hexadecimal = entity[1]?.toLowerCase() === 'x';
      const point = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : '';
    }
    return named[entity.toLowerCase()] ?? '';
  });
}

export function htmlToSafeText(html = '') {
  return decodeEntities(html
    .replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function collectBodies(part, bodies = { plain: [], html: [] }) {
  if (!part) return bodies;
  const content = decodeBase64Url(part.body?.data);
  if (content && part.mimeType === 'text/plain') bodies.plain.push(content);
  if (content && part.mimeType === 'text/html') bodies.html.push(content);
  for (const child of part.parts || []) collectBodies(child, bodies);
  return bodies;
}

function headerMap(headers = []) {
  return Object.fromEntries(headers.map(({ name, value }) => [name.toLowerCase(), value]));
}

function cleanQuotedText(value) {
  const lines = value.replace(/\r/g, '').split('\n');
  const quoteStart = lines.findIndex((line) => /^On .+wrote:$/i.test(line.trim()) || /^-{2,}\s*Original Message\s*-{2,}$/i.test(line.trim()));
  return (quoteStart > 0 ? lines.slice(0, quoteStart) : lines).join('\n').trim();
}

export function parseGmailMessage(message) {
  const headers = headerMap(message.payload?.headers);
  const bodies = collectBodies(message.payload);
  const rawBody = bodies.plain.find((body) => body.trim()) || htmlToSafeText(bodies.html.find((body) => body.trim()) || '');
  const timestamp = Number(message.internalDate);

  return {
    id: message.id,
    threadId: message.threadId,
    messageId: headers['message-id'] || null,
    from: headers.from || '',
    to: headers.to || '',
    cc: headers.cc || '',
    subject: headers.subject || '(no subject)',
    timestamp: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null,
    body: cleanQuotedText(rawBody),
    snippet: message.snippet || '',
  };
}

export function parseGmailThread(thread) {
  const messages = (thread.messages || []).map(parseGmailMessage).sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
  const latest = messages.at(-1);
  return {
    id: thread.id,
    historyId: thread.historyId || null,
    subject: latest?.subject || '(no subject)',
    snippet: latest?.snippet || '',
    latestTimestamp: latest?.timestamp || null,
    participants: [...new Set(messages.flatMap((message) => [message.from, message.to]).filter(Boolean))],
    messages,
  };
}
