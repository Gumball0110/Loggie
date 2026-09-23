import http from 'node:http';
import { normalizeEvent } from '../../server/event-normalizer.js';

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 2_000_000) throw new Error('Event payload is too large.');
  }
  return JSON.parse(body || '{}');
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

export function createEventServer({ port = Number(process.env.LOGGIE_PORT || 4317), onEvent = () => {}, getEventCount = () => 0 } = {}) {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(response, 200, { ok: true, mode: 'tui', events: getEventCount() });
    }
    if (request.method === 'POST' && url.pathname === '/api/events') {
      try {
        const event = normalizeEvent(await readBody(request));
        onEvent(event);
        return sendJson(response, 202, { accepted: true, id: event.id });
      } catch (error) {
        return sendJson(response, 400, { error: error.message });
      }
    }
    return sendJson(response, 404, { error: 'Not found' });
  });

  return {
    listen() {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          server.off('error', reject);
          resolve();
        });
      });
    },
    close() {
      return new Promise((resolve) => server.close(resolve));
    },
  };
}
