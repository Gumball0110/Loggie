export function isTrustedRendererUrl(url) {
  return typeof url === 'string' && url.startsWith('file:') && url.includes('/desktop/renderer/');
}

export function validateSearchRequest(request) {
  if (!request || typeof request.text !== 'string' || request.text.length > 500) {
    throw new Error('Enter a valid email search.');
  }
  return {
    text: request.text,
    limit: Math.min(Math.max(Number(request.limit) || 10, 1), 20),
    pageToken: typeof request.pageToken === 'string' && /^[\w-]{1,500}$/.test(request.pageToken) ? request.pageToken : null,
  };
}

export function validateThreadId(threadId) {
  if (typeof threadId !== 'string' || !/^[\w-]{1,200}$/.test(threadId)) throw new Error('Invalid Gmail thread.');
  return threadId;
}
